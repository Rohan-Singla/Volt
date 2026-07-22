import { Router } from "express";

export const authRouter = Router();

authRouter.post("/signup", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});

authRouter.post("/signin", async (_req, res) => {
  res.status(501).json({ message: "not implemented" });
});
