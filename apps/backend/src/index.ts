import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { projectRouter } from "./routes/project.js";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(authRouter);
app.use(projectRouter);

app.listen(PORT, () => {
  console.log(`primary-backend listening on http://localhost:${PORT}`);
});
  