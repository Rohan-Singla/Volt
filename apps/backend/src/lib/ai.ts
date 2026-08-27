import OpenAI from "openai";
import { Sandbox } from "e2b";
import { readFile, writeFile, runCommand } from "./sandbox.js";

const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: "https://api.deepseek.com",
});

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file in the sandbox",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to the file" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Write content to a file in the sandbox, creating it if it doesn't exist",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Absolute path to the file" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_shell_command",
      description: "Run a shell command in the sandbox and return stdout + stderr",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to run" },
        },
        required: ["command"],
      },
    },
  },
];

/**
 * Hard ceiling for deepseek-chat, not a tunable — the API caps completions here
 * whether or not max_tokens is sent. When a write_file call exceeds it the
 * response is cut off mid-string and its `arguments` JSON is unparseable, so
 * the only real defence is keeping generated files small.
 */
const MAX_OUTPUT_TOKENS = 8192;

/** Guard against the tool loop spinning forever on a model that never settles. */
const MAX_STEPS = 40;

/** How many times to nudge the model after a truncated response before giving up. */
const MAX_TRUNCATION_RETRIES = 3;

const SYSTEM_PROMPT = `You are an expert web developer building apps inside a Linux sandbox.
A Vite + React + TypeScript project is already scaffolded at /home/user/app.
Tailwind CSS v3 is already installed and configured — use it freely without installing anything.
The dev server is already running on port 5173 with HMR — file changes are picked up automatically.

Rules:
- Always work inside /home/user/app
- Use the provided tools to read, write, and run commands
- NEVER start, stop, restart, or kill the dev server
- NEVER run npm run dev, pkill vite, or any process management commands
- Write clean, modern React + TypeScript with Tailwind CSS
- You may run npm install to add third-party packages (charts, icons, etc.)
- When you are done, respond with a plain text summary of what you built — no tool calls in the final message

File size limits (important):
- A single response cannot exceed ${MAX_OUTPUT_TOKENS} output tokens, and a write_file call that
  exceeds it is cut off mid-argument and thrown away
- Keep every file under ~200 lines. Never write a whole page in one call
- Split larger UIs into separate component files (e.g. src/components/Hero.tsx,
  Features.tsx, Pricing.tsx, Footer.tsx) and write them one per call, then compose
  them in App.tsx`;

export interface ConversationEntry {
  role: "user" | "model";
  content: string;
}

export type StreamEvent =
  | { type: "status"; text: string }
  | { type: "tool"; name: string; detail: string }
  | { type: "done"; aiText: string; previewUrl: string; messageId?: string };

export async function runAILoop(
  sandbox: Sandbox,
  history: ConversationEntry[],
  userMessage: string,
  onEvent?: (event: StreamEvent) => void
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];

  let truncationRetries = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: MAX_OUTPUT_TOKENS,
    });

    const choice = response.choices[0];
    if (!choice) return "The model returned no response.";
    const msg = choice.message;

    // A truncated tool call carries half-written `arguments` that will not
    // parse. Drop the turn entirely rather than pushing a malformed assistant
    // message (the API rejects tool_calls with no matching tool reply) and ask
    // for smaller files instead.
    if (choice.finish_reason === "length" && msg.tool_calls?.length) {
      truncationRetries++;
      if (truncationRetries > MAX_TRUNCATION_RETRIES) {
        return "I couldn't finish — the file I was writing kept exceeding the model's output limit. Try asking for one section at a time.";
      }

      console.log(`[ai] truncated response, retry ${truncationRetries}/${MAX_TRUNCATION_RETRIES}`);
      onEvent?.({ type: "status", text: "Response too long — retrying with smaller files..." });
      messages.push({
        role: "user",
        content:
          "Your last response was cut off because it exceeded the output token limit, so nothing was written. Do not write that file in a single call. Split it into several smaller component files, each well under 200 lines, and write them one per call.",
      });
      continue;
    }

    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "Done.";
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const fn = (call as OpenAI.Chat.ChatCompletionMessageFunctionToolCall).function;

      let args: Record<string, string>;
      try {
        args = JSON.parse(fn.arguments) as Record<string, string>;
      } catch {
        // Every tool_call needs a matching tool reply or the next request is
        // rejected, so answer with the error and let the model correct itself.
        console.log(`[ai] unparseable arguments for ${fn.name} (${fn.arguments.length} chars)`);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content:
            "Error: the arguments were not valid JSON, most likely because the content was too large and got truncated. Nothing was written. Retry with a smaller file.",
        });
        continue;
      }

      const detail = fn.name === "write_file" ? args.path : fn.name === "read_file" ? args.path : args.command ?? "";
      onEvent?.({ type: "tool", name: fn.name, detail });

      let result: string;
      if (fn.name === "read_file") {
        result = await readFile(sandbox, args.path);
      } else if (fn.name === "write_file") {
        result = await writeFile(sandbox, args.path, args.content);
      } else if (fn.name === "run_shell_command") {
        result = await runCommand(sandbox, args.command);
      } else {
        result = `Unknown tool: ${fn.name}`;
      }

      console.log(`[tool] ${fn.name}(${JSON.stringify(args)}) → ${result.slice(0, 100)}`);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  console.log(`[ai] hit MAX_STEPS (${MAX_STEPS}) without settling`);
  return `I stopped after ${MAX_STEPS} steps without finishing. The work so far is saved — send another message to continue.`;
}
