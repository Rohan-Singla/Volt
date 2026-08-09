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
  ExternalLink,
  Loader2,
  Terminal,
  FileCode2,
  FolderOpen,
  File,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface Message {
  id: string;
  from: "USER" | "ASSISTANT";
  type: "TEXT_MESSAGE" | "TOOL_CALL";
  contents: string;
  toolCall?: string | null;
}

interface Project {
  id: string;
  title: string;
  initialPrompt: string;
  previewUrl: string | null;
  conversationHistory: Message[];
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.from === "USER";

  return (
    <div className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        )}
      >
        {msg.contents}
      </div>
    </div>
  );
}

function PreviewPanel({ previewUrl, onReload, isSending }: { previewUrl: string | null; onReload: () => void; isSending: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sleeping, setSleeping] = useState(false);

  useEffect(() => {
    setSleeping(false);
    if (previewUrl && iframeRef.current) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <div className="bg-muted rounded px-3 py-1 text-xs font-mono text-muted-foreground truncate max-w-xs">
          {previewUrl ?? "Waiting for sandbox..."}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" title="Reload" onClick={onReload}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {previewUrl && (
            <Button variant="ghost" size="icon" className="h-7 w-7" title="Open in new tab" asChild>
              <a href={previewUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="relative flex-1 bg-white">
        {previewUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={previewUrl}
              className={cn("w-full h-full border-0", sleeping && "invisible")}
              title="Live preview"
              onError={() => setSleeping(true)}
            />
            {sleeping && !isSending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4 bg-zinc-50">
                <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-zinc-400" />
                </div>
                <p className="text-sm font-medium text-zinc-600">Sandbox is sleeping</p>
                <p className="text-xs text-zinc-400">Send a message to wake it up — your code is saved.</p>
              </div>
            )}
            {isSending && sleeping && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-50">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                <p className="text-xs text-zinc-400">Waking up sandbox...</p>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
            <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
              <Eye className="h-5 w-5 text-zinc-400" />
            </div>
            <p className="text-sm text-zinc-400">Preview appears after the first message.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CodePanel({ projectId, refreshKey }: { projectId: string; refreshKey: number }) {
  const [files, setFiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loadingContent, setLoadingContent] = useState(false);

  useEffect(() => {
    setLoadingFiles(true);
    api.get<{ files: string[] }>(`/projects/${projectId}/files`)
      .then((r) => {
        setFiles(r.files);
        if (r.files.length > 0) {
          const preferred = r.files.find((f) => f.endsWith("App.tsx")) ?? r.files[0];
          setSelected(preferred);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  }, [projectId, refreshKey]);

  useEffect(() => {
    if (!selected) return;
    setLoadingContent(true);
    api.get<{ content: string }>(`/projects/${projectId}/file?path=${encodeURIComponent(selected)}`)
      .then((r) => setContent(r.content))
      .catch(() => setContent("Could not load file."))
      .finally(() => setLoadingContent(false));
  }, [projectId, selected]);

  function fileName(path: string) {
    return path.split("/").pop() ?? path;
  }

  if (loadingFiles) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading files...</span>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
        <FolderOpen className="h-8 w-8" />
        <p className="text-xs">No files yet. Send a message to start building.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-48 shrink-0 border-r border-border overflow-y-auto bg-sidebar py-2">
        {files.map((f) => (
          <button
            key={f}
            onClick={() => setSelected(f)}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors",
              selected === f
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            <File className="h-3 w-3 shrink-0" />
            <span className="truncate">{fileName(f)}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto bg-zinc-950 relative">
        {loadingContent ? (
          <div className="flex items-center justify-center h-full gap-2 text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <>
            <div className="sticky top-0 px-4 py-1.5 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 text-xs text-zinc-400 font-mono">
              {selected?.replace("/home/user/app/", "") ?? ""}
            </div>
            <pre className="p-4 text-xs text-zinc-200 font-mono leading-relaxed overflow-x-auto whitespace-pre">
              {content}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

const MIN_WIDTH = 220;
const MAX_WIDTH = 600;
const DEFAULT_WIDTH = 320;

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [codeRefreshKey, setCodeRefreshKey] = useState(0);
  const [rightTab, setRightTab] = useState<"preview" | "code">("preview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const holdActive = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(DEFAULT_WIDTH);
  const cleanupDrag = useRef<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => () => { cleanupDrag.current?.(); }, []);

  const autoSentRef = useRef(false);

  useEffect(() => {
    api.get<Project>(`/projects/${projectId}`)
      .then((p) => {
        setProject(p);
        setMessages(p.conversationHistory);
        setPreviewUrl(p.previewUrl);
        if (p.conversationHistory.length === 0 && p.initialPrompt && !autoSentRef.current) {
          autoSentRef.current = true;
          sendFirstMessage(p.initialPrompt);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function reloadPreview() {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }

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

  function toolLabel(name: string, detail: string): string {
    if (name === "write_file") return `Writing ${detail}`;
    if (name === "read_file") return `Reading ${detail}`;
    if (name === "run_shell_command") return `Running: ${detail.slice(0, 40)}`;
    return name;
  }

  async function streamMessage(text: string) {
    const userMsg: Message = {
      id: Date.now().toString(),
      from: "USER",
      type: "TEXT_MESSAGE",
      contents: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);
    setLiveStatus("Connecting...");

    const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const token = getToken();

    try {
      const response = await fetch(`${BASE}/projects/${projectId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Server error ${response.status}: ${errText.slice(0, 200)}`);
      }
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw) as {
              type: "status" | "tool" | "done";
              text?: string;
              name?: string;
              detail?: string;
              aiText?: string;
              previewUrl?: string;
              messageId?: string;
            };

            if (event.type === "status") {
              setLiveStatus(event.text ?? null);
            } else if (event.type === "tool") {
              setLiveStatus(toolLabel(event.name ?? "", event.detail ?? ""));
            } else if (event.type === "done") {
              setLiveStatus(null);
              setMessages((prev) => [
                ...prev,
                {
                  id: event.messageId ?? Date.now().toString(),
                  from: "ASSISTANT",
                  type: "TEXT_MESSAGE",
                  contents: event.aiText ?? "Done.",
                },
              ]);
              if (event.previewUrl) setPreviewUrl(event.previewUrl);
              setCodeRefreshKey((k) => k + 1);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (err) {
      console.error("[SSE] error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          from: "ASSISTANT",
          type: "TEXT_MESSAGE",
          contents: err instanceof Error ? err.message : "Something went wrong.",
        },
      ]);
    } finally {
      setSending(false);
      setLiveStatus(null);
    }
  }

  async function sendFirstMessage(text: string) {
    await streamMessage(text);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    await streamMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendMessage();
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center gap-3 px-4 h-12 border-b border-border bg-card/50 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href="/dashboard"><ChevronLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">{project?.title ?? "Loading..."}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <div className={cn("h-1.5 w-1.5 rounded-full", previewUrl ? "bg-emerald-400" : "bg-muted-foreground")} />
            {previewUrl ? "Sandbox running" : "Sandbox starting"}
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
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="h-3 w-3 text-primary" />
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  <span className="text-xs truncate">{liveStatus ?? "Building..."}</span>
                </div>
                {liveStatus && liveStatus.startsWith("Writing") && (
                  <div className="ml-8 flex items-center gap-1.5 text-[11px] text-primary/70">
                    <FileCode2 className="h-3 w-3 shrink-0" />
                    <span className="font-mono truncate">{liveStatus.replace("Writing ", "")}</span>
                  </div>
                )}
                {liveStatus && liveStatus.startsWith("Running") && (
                  <div className="ml-8 flex items-center gap-1.5 text-[11px] text-amber-500/80">
                    <Terminal className="h-3 w-3 shrink-0" />
                    <span className="font-mono truncate">{liveStatus.replace("Running: ", "")}</span>
                  </div>
                )}
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
              <PreviewPanel previewUrl={previewUrl} onReload={reloadPreview} isSending={sending} />
            ) : (
              <CodePanel projectId={projectId} refreshKey={codeRefreshKey} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
