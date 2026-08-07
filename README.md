# lovable-clone
 
An AI app-builder platform: chat with an LLM agent to generate, edit, and preview a live web app in an isolated per-project sandbox.
 
Inspired by Lovable's architecture — chat interface → LLM tool-calling agent → sandboxed code execution → live preview via per-project ingress.
 
## Stack
 
- **Language:** TypeScript across the board
- **Monorepo:** Turborepo + pnpm workspaces
- **LLM:** Gemini (tool/function calling)
- **Sandboxing:** Kubernetes — one pod (+ service) per active project
- **Database:** Postgres
- **Object store:** S3-compatible (project source backups)
- **Ingress:** per-project subdomain routing (`https://{projectId}.yourdomain.com`)
## Architecture
 
```
Frontend (Next.js)
   │
   ▼
Primary Backend (API) ──────► Postgres (users, projects, conversation history)
   │        │
   │        ▼
   │   Gemini (tool-calling loop: read_file / write_file / delete_file / run_shell_command)
   │
   ▼
Orchestrator ──► Kubernetes API (createPod / createSvc per project)
   │
   ▼
Worker Pod (per project)
   ├─ agent (applies tool-call file edits, runs dev server)
   └─ ws (streams file updates / logs back to orchestrator)
   │
   ▼
Ingress Controller ──► https://{projectId}.yourdomain.com (live preview)
```
 
## Packages / apps (turborepo)
 
```
apps/
  web/            # Next.js frontend — landing page + project page (chat, preview, code view)
  primary-backend/# Express/Fastify API — auth, project CRUD, conversation endpoints
  orchestrator/   # Talks to k8s API — create/destroy sandbox pods+services, heartbeat/reaper
  agent-runtime/  # Runs inside each sandbox pod — applies file ops, exposes ws, runs dev server
packages/
  db/             # Prisma schema + client (shared by primary-backend)
  shared-types/   # Shared TS types (tool schemas, API contracts, conversation types)
  tool-schemas/   # Gemini function-calling tool definitions (read_file, write_file, etc.)
```
 
## Database schema (initial)
 
- `User` — id, username, password, projects[]
- `Project` — id, title, initialPrompt, userId, conversationHistory[]
- `ConversationHistory` — id, projectId, type (`TOOL_CALL` | `TEXT_MESSAGE`), from (`USER` | `ASSISTANT`), contents, hidden, toolCall (`READ_FILE` | `WRITE_FILE` | `DELETE_FILE` | `UPDATE_FILE`)
## API (initial)
 
```
POST /signup
POST /signin
POST /project
GET  /project/:projectId
GET  /projects
POST /project/conversation/:projectId
POST /sandbox            # orchestrator: create sandbox for a project
DELETE /sandbox/:projectId
```
 
## Build order
 
1. **Primary backend** — auth, project CRUD, Postgres schema, conversation history storage.
2. **Gemini tool-calling loop** — define `read_file`/`write_file`/`delete_file` function schemas, loop until no more tool calls, persist each step to `ConversationHistory`.
3. **Local fake sandbox** — run generated code in a throwaway local Docker container to validate the tool-call → file-write → preview loop before touching Kubernetes.
4. **Orchestrator (Kubernetes)** — `create_sandbox` → `k8s.createPod()` + `k8s.createSvc()`; store pod/service refs against the project.
5. **Ingress** — wildcard DNS + dynamic ingress rules routing `{projectId}.yourdomain.com` to the project's service.
6. **Agent runtime + websocket** — process running inside the pod that receives file-op events live and applies them without a full redeploy.
7. **Cleanup** — frontend heartbeats the orchestrator per open project; missed heartbeats trigger pod teardown. Add resource limits/autoscaling once basic lifecycle works.
## Open problems (tackle after the happy path works)
 
- Sandbox lifecycle: heartbeat-based teardown vs idle timeout
- Resource limits & autoscaling for the worker node pool
- Live file-sync into a running sandbox vs rebuild-and-redeploy per message
- Firecracker/E2B swap-in if Kubernetes pods prove too heavy per-project
## Getting started
 
```bash
pnpm install
pnpm dev        # runs all apps via turborepo
```