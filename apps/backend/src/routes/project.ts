import { Router, Response } from "express";
import { z } from "zod";
import { prisma } from "@repo/db";
import { requireAuth, AuthRequest } from "../middleware/auth.js";
import { getOrCreateSandbox, getPreviewUrl, ensureDevServer, readAllSandboxFiles, restoreFilesToSandbox } from "../lib/sandbox.js";
import { runAILoop, ConversationEntry, StreamEvent } from "../lib/ai.js";
import { snapshotToR2, listFromR2, readFromR2, restoreFromR2, deleteProjectFiles } from "../lib/r2.js";

function sse(res: Response, event: StreamEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
  (res as Response & { flush?: () => void }).flush?.();
}

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

projectRouter.delete("/projects/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId as string, userId: req.userId! },
  });
  if (!project) { res.status(404).json({ message: "Project not found" }); return; }

  await prisma.conversationHistory.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await deleteProjectFiles(project.id).catch(() => {});

  res.json({ ok: true });
});

projectRouter.get("/projects/:projectId/files", requireAuth, async (req: AuthRequest, res) => {
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId as string, userId: req.userId! },
    select: { id: true },
  });
  if (!project) { res.json({ files: [] }); return; }
  try {
    const paths = await listFromR2(project.id);
    res.json({ files: paths.map((p) => `/home/user/app/${p}`) });
  } catch {
    res.json({ files: [] });
  }
});

projectRouter.get("/projects/:projectId/file", requireAuth, async (req: AuthRequest, res) => {
  const filePath = req.query.path as string;
  if (!filePath) { res.status(400).json({ message: "path required" }); return; }
  const project = await prisma.project.findFirst({
    where: { id: req.params.projectId as string, userId: req.userId! },
    select: { id: true },
  });
  if (!project) { res.status(404).json({ message: "not found" }); return; }
  try {
    const r2Path = filePath.replace("/home/user/app/", "");
    const content = await readFromR2(project.id, r2Path);
    res.json({ content });
  } catch {
    res.status(404).json({ message: "file not found" });
  }
});

projectRouter.post("/projects/:projectId/messages", requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({ message: z.string().min(1) });
  const result = schema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "message is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  if (res.socket) res.socket.setNoDelay(true);

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
      sse(res, { type: "done", aiText: "Project not found.", previewUrl: "" });
      res.end();
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

    sse(res, { type: "status", text: "Starting sandbox..." });
    const { sandbox, isNew } = await getOrCreateSandbox(project.sandboxId ?? null);
    const previewUrl = getPreviewUrl(sandbox);

    await prisma.project.update({
      where: { id: project.id },
      data: { sandboxId: sandbox.sandboxId, previewUrl },
    });

    if (isNew && project.sandboxId) {
      sse(res, { type: "status", text: "Restoring project files..." });
      const saved = await restoreFromR2(project.id);
      if (saved.length > 0) await restoreFilesToSandbox(sandbox, saved);
    }

    sse(res, { type: "status", text: "Starting dev server..." });
    await ensureDevServer(sandbox);
    sse(res, { type: "status", text: "AI is building..." });

    const history: ConversationEntry[] = project.conversationHistory.map((h: { from: string; contents: string }) => ({
      role: h.from === "USER" ? "user" : "model",
      content: h.contents,
    }));

    const aiResponse = await runAILoop(sandbox, history, result.data.message, (event) => {
      sse(res, event);
    });

    const saved = await prisma.conversationHistory.create({
      data: {
        projectId: project.id,
        type: "TEXT_MESSAGE",
        from: "ASSISTANT",
        contents: aiResponse,
      },
    });

    const projectFiles = await readAllSandboxFiles(sandbox);
    await snapshotToR2(project.id, projectFiles);

    console.log(`[project] previewUrl: ${previewUrl}`);
    res.write(`data: ${JSON.stringify({ type: "done", aiText: aiResponse, previewUrl, messageId: saved.id })}\n\n`);
  } catch (err) {
    console.error("Message handler error:", err);
    sse(res, { type: "done", aiText: `Error: ${String(err)}`, previewUrl: "" });
  } finally {
    res.end();
  }
});
