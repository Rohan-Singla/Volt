import { Sandbox } from "e2b";

const SANDBOX_TIMEOUT = 60 * 60 * 1000;

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
  },
})
`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
`;

const POSTCSS_CONFIG = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;

const APP_CSS = ``;

export async function getOrCreateSandbox(sandboxId: string | null): Promise<Sandbox> {
  if (sandboxId) {
    try {
      const sandbox = await Sandbox.connect(sandboxId);
      await sandbox.setTimeout(SANDBOX_TIMEOUT);
      return sandbox;
    } catch {}
  }
  const sandbox = await Sandbox.create({ timeoutMs: SANDBOX_TIMEOUT });
  await bootstrapSandbox(sandbox);
  return sandbox;
}

async function bootstrapSandbox(sandbox: Sandbox) {
  const run = async (cmd: string, timeoutMs = 120000) => {
    const r = await sandbox.commands.run(cmd, { timeoutMs });
    console.log(`[sandbox] $ ${cmd.slice(0, 80)}`);
    if (r.stdout) console.log("[stdout]", r.stdout.slice(0, 200));
    return r;
  };

  await run("node --version && npm --version");
  await run("cd /home/user && npx --yes create-vite@5 app --template react-ts", 120000);
  await run("cd /home/user/app && npm install", 120000);
  await run("cd /home/user/app && npm install -D tailwindcss@3 postcss autoprefixer", 120000);

  await sandbox.files.write("/home/user/app/vite.config.ts", VITE_CONFIG);
  await sandbox.files.write("/home/user/app/tailwind.config.js", TAILWIND_CONFIG);
  await sandbox.files.write("/home/user/app/postcss.config.js", POSTCSS_CONFIG);
  await sandbox.files.write("/home/user/app/src/index.css", INDEX_CSS);
  await sandbox.files.write("/home/user/app/src/App.css", APP_CSS);
}

async function isDevServerRunning(sandbox: Sandbox): Promise<boolean> {
  try {
    const r = await sandbox.commands.run(
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/",
      { timeoutMs: 8000 }
    );
    return r.stdout.trim() !== "000";
  } catch {
    return false;
  }
}

async function waitUntilReady(sandbox: Sandbox, maxMs = 20000): Promise<void> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await isDevServerRunning(sandbox)) {
      console.log("[sandbox] dev server ready");
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  console.log("[sandbox] dev server did not respond in time");
}

export async function ensureDevServer(sandbox: Sandbox): Promise<void> {
  if (await isDevServerRunning(sandbox)) {
    console.log("[sandbox] dev server already running");
    return;
  }

  console.log("[sandbox] starting dev server...");
  await sandbox.commands.run("pkill -f vite || true", { timeoutMs: 5000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));

  void sandbox.commands.run("cd /home/user/app && npm run dev -- --host", {
    timeoutMs: 0,
  }).catch(() => {});

  await waitUntilReady(sandbox);
}

export async function readFile(sandbox: Sandbox, path: string): Promise<string> {
  try {
    return await sandbox.files.read(path);
  } catch {
    return `Error: file not found at ${path}`;
  }
}

export async function writeFile(sandbox: Sandbox, path: string, content: string): Promise<string> {
  await sandbox.files.write(path, content);
  return `Written ${path}`;
}

export async function runCommand(sandbox: Sandbox, command: string): Promise<string> {
  try {
    const result = await sandbox.commands.run(command, { timeoutMs: 60000 });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    return output || "Command completed with no output";
  } catch (err: unknown) {
    const e = err as { result?: { stdout?: string; stderr?: string }; message?: string };
    const partial = [e.result?.stdout, e.result?.stderr].filter(Boolean).join("\n");
    if (partial) return partial;
    if (e.message?.includes("timed out") || e.message?.includes("signal: terminated")) {
      return "Command timed out";
    }
    throw err;
  }
}

export function getPreviewUrl(sandbox: Sandbox): string {
  return `https://${sandbox.getHost(5173)}`;
}
