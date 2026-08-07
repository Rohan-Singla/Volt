"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowUp, Code2, Globe, Layers } from "lucide-react";
import { AuthModal } from "@/components/auth-modal";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Build a Kanban board with drag-and-drop",
  "Create a personal finance tracker with charts",
  "Make a Pomodoro timer with stats",
  "Build a markdown notes app with preview",
  "Create a recipe finder with filters",
  "Make a habit tracker with streaks",
];

const EXAMPLES = [
  { icon: Globe, label: "Landing page", prompt: "Build a SaaS landing page with hero, features, pricing, and FAQ sections" },
  { icon: Layers, label: "Dashboard", prompt: "Create an analytics dashboard with a sidebar, KPI cards, and a line chart" },
  { icon: Code2, label: "Todo app", prompt: "Build a todo app with local storage, due dates, and priority labels" },
];

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [pending, setPending] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  useEffect(() => {
    autoResize();
  }, [prompt]);

  function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPending(trimmed);
    setAuthOpen(true);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(prompt);
    }
  }

  function onAuthSuccess() {
    setAuthOpen(false);
    router.push("/project/new");
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-primary/8 blur-[140px] rounded-full" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm text-foreground">Lovable</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => { setPending(""); setAuthOpen(true); }}
            className="text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
          >
            Sign in
          </button>
          <button
            onClick={() => { setPending(""); setAuthOpen(true); }}
            className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            Get started
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 pb-20 gap-10">
        <div className="text-center space-y-3 max-w-xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
            What do you want to{" "}
            <span className="text-primary">build?</span>
          </h1>
          <p className="text-muted-foreground text-base">
            Describe your app and AI will write, run, and preview it live.
          </p>
        </div>

        <div className="w-full max-w-2xl">
          <div
            className={cn(
              "relative rounded-2xl border bg-card transition-all duration-200",
              prompt
                ? "border-primary/50 shadow-[0_0_0_1px_var(--color-primary)/20,0_8px_32px_rgba(0,0,0,0.4)]"
                : "border-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-border/80"
            )}
          >
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the app you want to build..."
              rows={1}
              className="w-full bg-transparent text-foreground placeholder:text-muted-foreground resize-none px-5 pt-4 pb-14 text-sm leading-relaxed outline-none min-h-[56px]"
            />
            <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-4 py-3">
              <span className="text-xs text-muted-foreground hidden sm:block">
                {prompt ? "↵ Enter to build · Shift+↵ new line" : ""}
              </span>
              <button
                onClick={() => submit(prompt)}
                disabled={!prompt.trim()}
                className={cn(
                  "ml-auto h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  prompt.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-3">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">↵</kbd> to build — you&apos;ll be asked to sign in first
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full max-w-2xl">
          <p className="text-xs text-muted-foreground">Try an example</p>
          <div className="flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => { setPrompt(ex.prompt); textareaRef.current?.focus(); }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-border bg-card text-xs text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-accent transition-all"
              >
                <ex.icon className="h-3.5 w-3.5 text-primary" />
                {ex.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-xl">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="px-3 py-1.5 rounded-full border border-border/60 bg-transparent text-xs text-muted-foreground hover:text-foreground hover:border-border transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </main>

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={onAuthSuccess}
        initialPrompt={pending}
      />
    </div>
  );
}
