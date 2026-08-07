# lovable-clone

Chat with an AI agent to generate, edit, and preview a live web app in an isolated sandbox.

## Stack

- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 16, Tailwind v4, shadcn/ui
- **Backend:** Express, TypeScript
- **LLM:** Gemini (function calling)
- **Sandboxing:** E2B (one sandbox per project, preview URL included)
- **Database:** Postgres via Prisma
- **Storage:** Cloudflare R2 (project source backups)

## Architecture

```
Browser (Next.js)
      |
      v
Primary Backend (Express)
      |              |
      |              v
      |        Gemini tool-calling loop
      |        (read_file / write_file / run_shell_command)
      |              |
      |              v
      |        E2B Sandbox (one per project)
      |              |-- filesystem.write()
      |              |-- commands.run()
      |              |-- getHost(5173)  ->  public preview URL
      |              |-- onStdout()     ->  streams logs to client
      v
Cloudflare R2
      |-- zip uploaded after each tool-call loop
      |-- downloaded and extracted on sandbox cold start
```

## Packages

```
apps/
  web/              Next.js frontend
  primary-backend/  Express API, Gemini loop, E2B + R2 integration
packages/
  db/               Prisma schema + client
  shared-types/     Shared TypeScript types
```

## Getting started

```bash
pnpm install
pnpm db:migrate
pnpm dev
```
