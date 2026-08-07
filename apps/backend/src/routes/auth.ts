import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "@repo/db";

export const authRouter = Router();

const signupSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8),
});

const signinSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: string, username: string) {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET!, { expiresIn: "30d" });
}

authRouter.post("/signup", async (req, res) => {
  const result = signupSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: result.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const { username, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    res.status(409).json({ message: "Username already taken" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({ data: { username, password: hashed } });

  res.status(201).json({ token: signToken(user.id, user.username) });
});

authRouter.post("/signin", async (req, res) => {
  const result = signinSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ message: "Invalid input" });
    return;
  }

  const { username, password } = result.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  res.json({ token: signToken(user.id, user.username) });
});
