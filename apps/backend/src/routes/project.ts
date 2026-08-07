import { Router } from "express";

export const projectRouter = Router();

projectRouter.post("/project", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});

projectRouter.get("/projects", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});

projectRouter.get("/project/:projectId", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});

projectRouter.post("/project/conversation/:projectId", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});
