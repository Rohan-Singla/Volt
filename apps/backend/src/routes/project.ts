import { Router } from "express";
import { z } from "zod";
import { prisma } from "@repo/db";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { getOrCreateSandbox, getPreviewUrl, ensureDevServer } from "../lib/sandbox.js";
import { runAILoop, ConversationEntry } from "../lib/ai.js";

export const projectRouter = Router();

projectRouter.post("/projects", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ title: z.string().min(1), initialPrompt: z.string().min(1) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "title and initialPrompt are required" });
    return;
  }

  const project = await prisma.project.create({
    data: {
      title: result.data.title,
      initialPrompt: result.data.initialPrompt,
      userId: req.userId!,
    },
  });

  res.status(201).json(project);
});

projectRouter.get("/projects", requireAuth, async (req: AuthRequest, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      initialPrompt: true,
      previewUrl: true,
      createdAt: true,
    },
  });
  res.json(projects);
});

projectRouter.get("/projects/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId as string, userId: req.userId! },
    include: {
      conversationHistory: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return;
  }

  res.json(project);
});

projectRouter.post("/projects/:projectId/messages", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ message: z.string().min(1) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "message is required" });
    return;
  }

  try {
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId as string, userId: req.userId! },
    include: {
      conversationHistory: {
        where: { hidden: false },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!project) {
    res.status(404).json({ message: "Project not found" });
    return;
  }

  await prisma.conversationHistory.create({
    data: {
      projectId: project.id,
      type: "TEXT_MESSAGE",
      from: "USER",
      contents: result.data.message,
    },
  });

  const isNew = !project.sandboxId;
  const sandbox = await getOrCreateSandbox(project.sandboxId ?? null);

  if (isNew) {
    const previewUrl = getPreviewUrl(sandbox);
    await prisma.project.update({
      where: { id: project.id },
      data: { sandboxId: sandbox.sandboxId, previewUrl },
    });
  }

  await ensureDevServer(sandbox);

  const history: ConversationEntry[] = project.conversationHistory.map((h: { from: string; contents: string }) => ({
    role: h.from === "USER" ? "user" : "model",
    content: h.contents,
  }));

  const aiResponse = await runAILoop(sandbox, history, result.data.message);

  const saved = await prisma.conversationHistory.create({
    data: {
      projectId: project.id,
      type: "TEXT_MESSAGE",
      from: "ASSISTANT",
      contents: aiResponse,
    },
  });

  const updatedProject = await prisma.project.findFirst({
    where: { id: project.id },
    select: { previewUrl: true },
  });

  res.json({
    message: saved,
    previewUrl: updatedProject?.previewUrl,
  });
  } catch (err) {
    console.error("Message handler error:", err);
    res.status(500).json({ message: String(err) });
  }
});
