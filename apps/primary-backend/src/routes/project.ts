import { Router } from "express";

export const projectRouter = Router();

projectRouter.post("/project", async (_req, res) => {
  // TODO: create project (title, initialPrompt) for authed user
  res.status(501).json({ message: "not implemented" });
});

projectRouter.get("/projects", async (_req, res) => {
  // TODO: list authed user's projects
  res.status(501).json({ message: "not implemented" });
});

projectRouter.get("/project/:projectId", async (_req, res) => {
  // TODO: fetch project + conversation history
  res.status(501).json({ message: "not implemented" });
});

projectRouter.post("/project/conversation/:projectId", async (_req, res) => {
  // TODO: append user message, run Gemini tool-calling loop, persist steps
  res.status(501).json({ message: "not implemented" });
});
