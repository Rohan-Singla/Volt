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

const SYSTEM_PROMPT = `You are an expert web developer building apps inside a Linux sandbox.
A Vite + React + TypeScript project is already scaffolded at /home/user/app and the dev server is already running on port 5173 with HMR enabled.

Rules:
- Always work inside /home/user/app
- Use the provided tools to read, write, and run commands
- NEVER start, stop, restart, or kill the dev server — it is already running and HMR picks up all file changes automatically
- NEVER run npm run dev, pkill vite, or any process management commands
- Write clean, modern React + TypeScript code
- Use Tailwind CSS for styling if needed (install with: npm install -D tailwindcss@3 postcss autoprefixer && npx tailwindcss init -p)
- You may run npm install to add packages
- When you are done, respond with a plain text summary of what you built — no tool calls in the final message`;

export interface ConversationEntry {
  role: "user" | "model";
  content: string;
}

export async function runAILoop(
  sandbox: Sandbox,
  history: ConversationEntry[],
  userMessage: string,
  onToolCall?: (name: string, args: Record<string, string>) => void
): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];

  while (true) {
    const response = await client.chat.completions.create({
      model: "deepseek-chat",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];
    const msg = choice.message;
    messages.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return msg.content ?? "Done.";
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const fn = (call as OpenAI.Chat.ChatCompletionMessageFunctionToolCall).function;
      const args = JSON.parse(fn.arguments) as Record<string, string>;
      onToolCall?.(fn.name, args);

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
}
