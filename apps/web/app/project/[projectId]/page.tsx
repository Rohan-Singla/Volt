"use client";

import { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Code2,
  Eye,
  ChevronLeft,
  RotateCcw,
  Copy,
  Check,
  Loader2,
  ExternalLink,
  Terminal,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MessageFrom = "USER" | "ASSISTANT";
type EntryType = "TEXT_MESSAGE" | "TOOL_CALL";

interface Message {
  id: string;
  from: MessageFrom;
  type: EntryType;
  contents: string;
  toolCall?: string;
}

const MOCK_MESSAGES: Message[] = [
  { id: "1", from: "USER", type: "TEXT_MESSAGE", contents: "Build me a todo app with local storage" },
  { id: "2", from: "ASSISTANT", type: "TEXT_MESSAGE", contents: "I'll build a todo app with local storage for you. Let me create the files now." },
  { id: "3", from: "ASSISTANT", type: "TOOL_CALL", contents: 'src/App.tsx\n\nimport { useState, useEffect } from "react"\n...\n', toolCall: "WRITE_FILE" },
  { id: "4", from: "ASSISTANT", type: "TEXT_MESSAGE", contents: "Done! Your todo app is live. It supports adding, completing, and deleting todos — all persisted in localStorage." },
];

const MOCK_FILES = [
  {
    name: "src/App.tsx", content: `import { useState, useEffect } from "react"

interface Todo {
  id: number
  text: string
  done: boolean
}

export default function App() {
  const [todos, setTodos] = useState<Todo[]>(() => {
    const saved = localStorage.getItem("todos")
    return saved ? JSON.parse(saved) : []
  })
  const [input, setInput] = useState("")

  useEffect(() => {
    localStorage.setItem("todos", JSON.stringify(todos))
  }, [todos])

  function addTodo() {
    if (!input.trim()) return
    setTodos([...todos, { id: Date.now(), text: input, done: false }])
    setInput("")
  }

  function toggleTodo(id: number) {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  function deleteTodo(id: number) {
    setTodos(todos.filter(t => t.id !== id))
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">My Todos</h1>
      <div className="flex gap-2 mb-4">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          placeholder="Add a todo..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={addTodo} className="bg-blue-500 text-white px-4 py-2 rounded">
          Add
        </button>
      </div>
      <ul className="space-y-2">
        {todos.map(todo => (
          <li key={todo.id} className="flex items-center gap-2 p-3 border rounded">
            <input type="checkbox" checked={todo.done} onChange={() => toggleTodo(todo.id)} />
            <span className={todo.done ? "line-through text-gray-400" : ""}>{todo.text}</span>
            <button onClick={() => deleteTodo(todo.id)} className="ml-auto text-red-500 text-sm">
              delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}`,
  },
  {
    name: "src/main.tsx", content: `import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)`,
  },
  {
    name: "index.html", content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Todo App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
];

function ToolCallBadge({ toolCall }: { toolCall: string }) {
  const colors: Record<string, string> = {
    WRITE_FILE: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
    READ_FILE: "text-blue-400 border-blue-400/30 bg-blue-400/10",
    DELETE_FILE: "text-red-400 border-red-400/30 bg-red-400/10",
    UPDATE_FILE: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-mono", colors[toolCall] ?? "text-muted-foreground border-border")}>
      <Terminal className="h-3 w-3" />
      {toolCall.toLowerCase()}
    </span>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.from === "USER";
  const isToolCall = msg.type === "TOOL_CALL";

  if (isToolCall) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          {msg.toolCall && <ToolCallBadge toolCall={msg.toolCall} />}
        </div>
        <pre className="text-xs font-mono text-muted-foreground bg-muted/50 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
          {msg.contents}
        </pre>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        {msg.contents}
      </div>
    </div>
  );
}

function CodePanel() {
  const [activeFile, setActiveFile] = useState(MOCK_FILES[0].name);
  const [copied, setCopied] = useState(false);

  const file = MOCK_FILES.find((f) => f.name === activeFile) ?? MOCK_FILES[0];

  function copyCode() {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-1 px-3 border-b border-border overflow-x-auto min-h-9.5 bg-sidebar">
        {MOCK_FILES.map((f) => (
          <button
            key={f.name}
            onClick={() => setActiveFile(f.name)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-t font-mono whitespace-nowrap transition-colors",
              activeFile === f.name
                ? "text-foreground bg-card border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3 w-3" />
            {f.name.split("/").pop()}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <span className="text-xs font-mono text-muted-foreground">{activeFile}</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={copyCode}>
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-4 text-xs font-mono text-muted-foreground leading-relaxed">
          <code>{file.content}</code>
        </pre>
      </div>
    </div>
  );
}

function PreviewPanel({ projectId }: { projectId: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="bg-muted rounded px-3 py-1 text-xs font-mono text-muted-foreground truncate max-w-xs">
            {projectId}.lovable.app
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reload">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Open in new tab">
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="relative flex-1 bg-white">
        <iframe src="about:blank" className="w-full h-full" title="Live preview" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4 pointer-events-none">
          <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
            <Eye className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="text-sm text-zinc-400">Preview appears once the sandbox is running.</p>
        </div>
      </div>
    </div>
  );
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const holdActive = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { cleanupDrag.current?.(); }, []);

  function onDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    cleanupDrag.current?.();

    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    holdActive.current = false;

    holdTimer.current = setTimeout(() => {
      holdActive.current = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }, 200);

    function cleanup() {
      if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      holdActive.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      cleanupDrag.current = null;
    }

    function onMouseMove(ev: MouseEvent) {
      if (ev.buttons !== 1) { cleanup(); return; }
      if (!holdActive.current) return;
      const delta = ev.clientX - dragStartX.current;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(next);
    }

    function onMouseUp() {
      const wasHolding = holdActive.current;
      cleanup();
      if (!wasHolding) setSidebarOpen((v) => !v);
    }

    cleanupDrag.current = cleanup;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      from: "USER",
      type: "TEXT_MESSAGE",
      contents: input.trim(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          from: "ASSISTANT",
          type: "TEXT_MESSAGE",
          contents: "I've updated the app as requested. Check the preview on the right.",
        },
      ]);
      setSending(false);
    }, 1500);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      sendMessage();
    }
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card/50 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href="/dashboard">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Todo App</span>
          <Badge variant="secondary" className="text-xs h-5">
            {projectId}
          </Badge>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Sandbox running
          </Badge>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          style={sidebarOpen ? { width: sidebarWidth } : { width: 0 }}
          className={cn(
            "flex flex-col border-r border-border bg-sidebar shrink-0",
            !sidebarOpen && "overflow-hidden"
          )}
        >
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Building...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-border space-y-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask for changes... (⌘↵ to send)"
              rows={3}
              className="text-sm resize-none"
              disabled={sending}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">⌘↵ to send</span>
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="gap-1.5 h-7 text-xs"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                Send
              </Button>
            </div>
          </div>
        </aside>

        <div
          onMouseDown={onDividerMouseDown}
          title={sidebarOpen ? "Drag to resize · Click to collapse" : "Click to expand"}
          className="group relative w-3 shrink-0 cursor-col-resize flex items-center justify-center"
        >
          <div className="w-px h-full bg-border group-hover:bg-primary/50 transition-colors" />
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-border group-hover:bg-primary/60 transition-colors opacity-0 group-hover:opacity-100" />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1 px-4 h-10 border-b border-border bg-card/50 shrink-0">
            <Tabs value={rightTab} onValueChange={(v) => setRightTab(v as "preview" | "code")} className="h-full flex items-center">
              <TabsList className="h-7 bg-muted/60">
                <TabsTrigger value="preview" className="h-6 text-xs gap-1.5">
                  <Eye className="h-3 w-3" /> Preview
                </TabsTrigger>
                <TabsTrigger value="code" className="h-6 text-xs gap-1.5">
                  <Code2 className="h-3 w-3" /> Code
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-hidden">
            {rightTab === "preview" ? (
              <PreviewPanel projectId={projectId} />
            ) : (
              <CodePanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
