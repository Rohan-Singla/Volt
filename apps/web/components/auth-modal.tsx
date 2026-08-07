"use client";

import { useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  initialPrompt: string;
}

export function AuthModal({ open, onOpenChange, onSuccess, initialPrompt }: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSuccess();
    }, 900);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader className="items-center text-center gap-1">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mb-1">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-lg">
            {mode === "signup" ? "Create your account" : "Welcome back"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed max-w-[220px]">
            {mode === "signup"
              ? "Sign up to start building your app."
              : "Sign in to continue building."}
          </DialogDescription>
        </DialogHeader>

        {initialPrompt && (
          <div className="rounded-lg bg-muted/60 border border-border px-3 py-2 text-xs text-muted-foreground line-clamp-2 italic">
            &ldquo;{initialPrompt}&rdquo;
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3 mt-1">
          <div className="space-y-1.5">
            <Label htmlFor="auth-username">Username</Label>
            <Input
              id="auth-username"
              placeholder="yourname"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={mode === "signup" ? 3 : 1}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" ? 8 : 1}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {mode === "signup" && (
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading
              ? mode === "signup" ? "Creating account..." : "Signing in..."
              : mode === "signup" ? "Create account & build" : "Sign in & continue"}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            type="button"
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(""); }}
            className="text-primary hover:underline font-medium"
          >
            {mode === "signup" ? "Sign in" : "Sign up"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
