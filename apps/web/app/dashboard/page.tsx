"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Plus,
  FolderOpen,
  Clock,
  Search,
  LogOut,
  ChevronRight,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { getPayload, signOut } from "@/lib/auth";
import { api } from "@/lib/api";

interface Project {
  id: string;
  title: string;
  initialPrompt: string;
  previewUrl: string | null;
  createdAt: string;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [username, setUsername] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const payload = getPayload();
    if (!payload) { router.replace("/"); return; }
    setUsername(payload.username);

    api.get<Project[]>("/projects")
      .then(setProjects)
      .catch(() => {})
      .finally(() => setLoading(false));

    const initialPrompt = searchParams.get("prompt");
    if (initialPrompt) {
      setPrompt(initialPrompt);
      setOpen(true);
    }
  }, [router, searchParams]);

  function handleSignOut() {
    signOut();
    router.push("/");
  }

  async function handleDelete(e: React.MouseEvent, projectId: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setDeletingId(projectId);
    try {
      await api.delete(`/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch {
      alert("Failed to delete project.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const project = await api.post<Project>("/projects", { title, initialPrompt: prompt });
      router.push(`/project/${project.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create project");
      setCreating(false);
    }
  }

  const filtered = projects.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.initialPrompt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-foreground hover:text-primary transition-colors">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">Volt</span>
          </Link>
          <div className="flex items-center gap-2">
            {username && <span className="text-sm text-muted-foreground hidden sm:block">{username}</span>}
            <Button variant="ghost" size="icon" title="Sign out" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {loading ? "Loading..." : `${projects.length} project${projects.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button className="gap-2 self-start sm:self-auto" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            New project
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <FolderOpen className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              {search ? "No projects match your search." : "No projects yet."}
            </p>
            {!search && (
              <Button variant="outline" onClick={() => setOpen(true)}>Create your first project</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 transition-all space-y-3 flex flex-col relative"
              >
                <div className="flex items-start justify-between">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(e, project.id)}
                      disabled={deletingId === project.id}
                      className="opacity-0 group-hover:opacity-100 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                    >
                      {deletingId === project.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <h3 className="font-semibold truncate">{project.title}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {project.initialPrompt}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {timeAgo(project.createdAt)}
                </div>
              </Link>
            ))}

            <button
              onClick={() => setOpen(true)}
              className="rounded-xl border border-dashed border-border bg-transparent p-5 hover:border-primary/40 hover:bg-card transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground min-h-35"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">New project</span>
            </button>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setCreateError(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Give your project a name and describe what you want to build.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="proj-title">Project name</Label>
              <Input
                id="proj-title"
                placeholder="My awesome app"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proj-prompt">Initial prompt</Label>
              <Textarea
                id="proj-prompt"
                placeholder="Build a todo app with drag-and-drop reordering and local storage..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                required
              />
              <p className="text-xs text-muted-foreground">
                Be specific — the more detail, the better the first result.
              </p>
            </div>
            {createError && <p className="text-xs text-destructive">{createError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Create & build</>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
