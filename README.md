# lovable-clone

An AI app-builder platform: chat with an LLM agent to generate, edit, and preview a live web app in an isolated per-project sandbox.

## Stack

- **Language:** TypeScript across the board
- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 16 (App Router, Tailwind v4, shadcn/ui)
- **Backend:** Express + TypeScript
- **LLM:** Gemini (tool/function calling)
- **Sandboxing:** [E2B](https://e2b.dev) — one sandbox per active project (Firecracker microVMs, ~150ms cold start, automatic preview URLs)
- **Database:** Postgres (via Prisma)
- **Object store:** Cloudflare R2 — project source backups (S3-compatible, free tier, no egress fees)
- **Preview URLs:** E2B provides a public URL per sandbox automatically — no ingress controller or wildcard DNS needed

## Architecture

```
Browser (Next.js)
      │
      ▼
Primary Backend (Express API) ──────► Postgres (users, projects, conversation history)
      │                │
      │                ▼
      │          Gemini tool-calling loop
      │          (read_file / write_file / delete_file / run_shell_command)
      │                │
      │                ▼
      │          E2B Sandbox (one per active project)
      │                ├── filesystem.write()   ← file edits applied here
      │                ├── commands.run()       ← npm install, vite dev, etc.
      │                ├── getHost(5173)        ← returns public preview URL
      │                └── onStdout()           ← streams logs back to client
      │
      ▼
Cloudflare R2
      ← project source zipped and uploaded after each tool-call loop
      → downloaded and extracted when a sandbox is cold-started for an existing project
```

### How a conversation turn works

1. User sends a message → `POST /project/conversation/:projectId`
2. Backend fetches conversation history from Postgres and sends it to Gemini with tool schemas attached
3. Gemini responds with one or more tool calls (`write_file`, `read_file`, etc.)
4. Backend executes each tool call against the project's E2B sandbox
5. Tool results are fed back to Gemini — loop repeats until Gemini returns a plain text response
6. Every step (user message, tool call, tool result, AI response) is persisted to `ConversationHistory`
7. The E2B sandbox dev server picks up file changes live — the preview URL updates instantly

### Sandbox lifecycle

- **Cold start:** user opens a project with no running sandbox → orchestration logic in the backend calls `Sandbox.create()`, downloads the latest source zip from R2, extracts it, and starts the dev server
- **Active:** sandbox stays alive while the project is open; frontend sends heartbeats
- **Teardown:** missed heartbeats → backend calls `sandbox.kill()`; source is already backed up to R2

## Packages / apps (turborepo)

```
apps/
  web/              # Next.js frontend — prompt page, dashboard, project editor (chat + preview + code)
  primary-backend/  # Express API — auth, project CRUD, Gemini tool-calling loop, E2B sandbox management, R2 backup
packages/
  db/               # Prisma schema + client (shared by primary-backend)
  shared-types/     # Shared TS types (tool schemas, API contracts, conversation types)
```

The orchestrator and agent-runtime apps from the original Kubernetes design are not needed — E2B replaces both.

## Database schema

- `User` — id, username, password, projects[]
- `Project` — id, title, initialPrompt, userId, sandboxId (active E2B sandbox ID), conversationHistory[]
- `ConversationHistory` — id, projectId, type (`TOOL_CALL` | `TEXT_MESSAGE`), from (`USER` | `ASSISTANT`), contents, hidden, toolCall (`READ_FILE` | `WRITE_FILE` | `DELETE_FILE` | `UPDATE_FILE`)

## API

```
POST /signup
POST /signin
POST /project                          # create project, spin up E2B sandbox, upload initial zip to R2
GET  /project/:projectId               # fetch project + conversation history
GET  /projects                         # list user's projects
POST /project/conversation/:projectId  # run Gemini loop, execute tool calls in sandbox, persist steps
DELETE /project/:projectId             # kill sandbox, delete R2 backup
```

## Build order

1. **Primary backend** — auth, project CRUD, Postgres schema, conversation history storage
2. **Gemini tool-calling loop** — define tool schemas, run the loop, persist every step to `ConversationHistory`
3. **E2B integration** — `Sandbox.create()` on new project, `filesystem.write()` / `commands.run()` for tool calls, `getHost()` for preview URL, zip + upload to R2 on loop completion
4. **Cold-start restore** — on project open, if no active sandbox: create sandbox, download zip from R2, extract, start dev server
5. **Heartbeat + teardown** — frontend pings `/project/:projectId/heartbeat`; backend kills sandbox after missed heartbeats
6. **Streaming** — stream Gemini token output and sandbox stdout back to the browser over SSE or WebSocket

## Environment variables

```bash
# apps/primary-backend/.env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/lovable_clone
JWT_SECRET=change-me

GEMINI_API_KEY=

E2B_API_KEY=

CLOUDFLARE_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=lovable-clone-projects
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
```

## Getting started

```bash
pnpm install
pnpm db:migrate   # apply Prisma schema to Postgres
pnpm dev          # runs all apps via turborepo
```
