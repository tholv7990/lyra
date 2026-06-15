# Lyra — Requirements (Business + Technical)

**Version:** 1.0 (all decisions resolved)
**Stack:** Turborepo monorepo · TypeScript everywhere · React + Vite (web) · NestJS (api) · MongoDB / Mongoose · shared package for models/DTOs/utils · BullMQ + Redis (jobs, added at the render phase)

---

# Part A — Business Requirements

## A1. Goal
A multi-user web app where teams run an 8-step AI creative pipeline (find → crawl → brief → insight → prompts → images → video → assemble/QA) for a product/brand, producing on-brand images and UGC/video. Each step has an editable prompt and a stored result.

## A2. Users & access model
- **Workspace is the core unit.** Projects, API keys, runs, and assets all belong to a **workspace**, never directly to a person.
- **One model, not two account types.** A personal account is a workspace with one member; a team is a workspace with several.
- On signup, the user automatically gets a **personal workspace**; they can also create team workspaces and switch between them.
- **Roles: Owner and Member.** Plus one delegable permission: `canManageKeys`.

| Capability | Owner | Member |
|---|---|---|
| Create / run projects | ✓ | ✓ |
| Use the workspace's API keys | ✓ | ✓ |
| Add / edit / remove API keys | ✓ | only if granted `canManageKeys` |
| Invite / remove members, change roles, grant `canManageKeys` | ✓ | ✗ |
| Rename / delete the workspace | ✓ | ✗ |
| See **private** projects of other members | ✓ (owner override) | ✗ |

## A3. v1 feature scope
1. **Auth** — sign up, log in, log out, password reset, JWT session, account settings. Email + password only.
2. **Workspaces** — personal workspace on signup; create/rename/delete team workspaces; workspace switcher.
3. **Members & invites** — Owner invites by email; invitee signs up (or accepts) and joins; Owner removes members / revokes invites / changes roles / grants key management.
4. **Configuration (API keys)** — bring-your-own keys per provider (GPT-5.5, DeepSeek, image, video), stored at **workspace level**, encrypted at rest. Managed by Owner or a delegated member; used by all members.
5. **Projects** — create/rename/delete; a project = one brand/store (product, niche, homepage, brand brief); many runs per project with history.
6. **Project visibility** — three modes: **private** (creator only), **shared** (creator + named users, full access), **workspace** (all members). **Default = private.**
7. **Pipeline** — the 8-step workbench, persisted: editable prompt per step, results, gates (Steps 3/5/8), run one step / run-all / stop / reset. **Per-step key unlock.**
8. **Assets** — per-project library of generated images/video; download/export.

## A4. Out of scope for v1
- **Billing / credits / seats / usage limits** — none. Users fund their own keys; cost is not metered.
- Per-project sharing roles (view vs edit) — sharing is full-access.
- Read-only Viewer role; full Admin role.
- Notifications when long renders finish; usage/cost dashboard; quotas; activity/audit log.
- Sharing a project to people outside the workspace; Google / SSO sign-in.

## A5. Decisions (all resolved)

| # | Decision | Choice |
|---|---|---|
| 1 | Solo vs teams | Teams, via the workspace model (personal = team of one) |
| 2 | API keys ownership | Bring-your-own; **no billing** |
| 3 | Where keys live | Workspace level |
| 4 | Team setup flow | Owner-driven: create workspace → add keys → invite members |
| 5 | Members before keys exist | Steps locked until keys exist (consequence of per-step unlock) |
| 6 | Partial keys | **Per-step unlock** — a step is enabled only when its provider's key is present |
| 7 | Project visibility | private / shared (named users) / workspace (all) |
| 8 | Default visibility on create | **private** |
| 9 | Owner sees private projects | **Yes** — owner override |
| 10 | Sharing granularity | **Full access**; per-user roles deferred |
| 11 | Auth | **Email + password** (Google/SSO later) |
| 12 | Key management | Owner by default; Owner can **delegate to a member** via `canManageKeys` |

## A6. Core user flows
- **Owner sets up a team:** create workspace → add provider API keys (encrypted) → invite members by email (optionally grant a member `canManageKeys`).
- **Member joins:** open invite link → sign up or accept → lands in the team → can create/run projects on the shared keys (once keys exist).
- **Create & share a project:** member creates a project (default **private**) → optionally switch visibility to shared-with-named-users or workspace.
- **Run the pipeline:** open a project → start a run → edit prompts → run steps (auto) and approve gates (3/5/8) → review/ship assets → winners loop back into Step 5.

---

# Part B — Technical Requirements

## B0. Monorepo (Turborepo + TypeScript)
```
lyra/
├─ apps/
│  ├─ web/                   # React + Vite — the workbench
│  └─ api/                   # NestJS
├─ packages/
│  ├─ shared/                # @lyra/shared — single source of truth
│  │  └─ src/
│  │     ├─ models/          # User, Workspace, Membership, Invite, ApiKey, Project, Run, Step, Asset
│  │     ├─ enums/           # Role, ProjectVisibility, RunStatus, StepStatus, StepKey, Provider
│  │     ├─ dto/             # login, signup, createProject, updateProject, runStep, approveGate, invite
│  │     ├─ constants/       # STEP_DEFS (8 steps + prompt templates), STEP_PROVIDERS map
│  │     └─ utils/           # canViewProject(), canEditProject(), canManageKeys(), fillPrompt()
│  ├─ tsconfig/              # base / react / node presets
│  └─ eslint-config/         # shared lint rules
├─ turbo.json                # build (dependsOn ^build), dev, lint, type-check, test — cached
├─ pnpm-workspace.yaml       # pnpm workspaces
└─ package.json
```
- **pnpm** package manager (standard Turbo pairing).
- **No validation library in `shared`** — it holds only types, enums, constants, and pure utils (zero runtime deps). Request validation lives in the api with **class-validator** DTO classes that `implements` the shared DTO interfaces, so they can't drift.
- Access logic (`canViewProject`, `canEditProject`, `canManageKeys`) and `STEP_DEFS` / `STEP_PROVIDERS` live in `shared`, so the API enforces and the web reflects the exact same rules — no drift.
- `shared` built with **tsup** so both Vite and Nest consume clean types + JS.

## B1. Architecture
```
 React workbench ──REST(JWT)──▶ NestJS API ──▶ MongoDB
 (SPA, Vite)                       │
                                   ├─▶ Job worker (BullMQ/Redis) ─▶ GPT-5.5 · DeepSeek · Claude · Image · Video
                                   └─▶ Asset store (Cloudinary / S3)
```
The API is the only tier that holds keys, crawls, and calls AIs. The queue is introduced at the render phase.

## B2. Authentication & authorization
- **Access token:** JWT, ~15 min, payload `{ sub: userId }`, `Authorization: Bearer`, held in memory client-side.
- **Refresh token:** ~7–30 days, **httpOnly + Secure + SameSite=Strict** cookie, **rotated** each refresh, stored **hashed** server-side for revocation. `/auth/refresh` issues new access tokens.
- **Passwords:** hashed with **argon2id** (or bcrypt).
- **Invites:** separate one-time random token, stored hashed with `expiresAt`, `workspaceId`, `email`, `role`; delivered as an email link.
- **Multi-tenancy:** workspace is **not** in the JWT. Each request targets a workspace (`/workspaces/:id/...` or `X-Workspace-Id`); a guard verifies membership before serving.
- **Guards (NestJS):** `JwtAuthGuard` → `WorkspaceGuard` (membership + role + `canManageKeys`) → `ProjectAccessGuard` (visibility).

## B3. Data model (MongoDB)
```ts
User       { _id, email (unique), passwordHash, name, createdAt }
RefreshToken { _id, userId, tokenHash, expiresAt, createdAt }

Workspace  { _id, name, type:'personal'|'team', createdBy, createdAt }
Membership { _id, workspaceId, userId, role:'owner'|'member',
             canManageKeys:boolean,          // delegated key management (default false)
             createdAt }                      // unique (workspaceId,userId)
Invite     { _id, workspaceId, email, role, tokenHash,
             status:'pending'|'accepted'|'revoked', invitedBy, expiresAt, createdAt }

ApiKey     { _id, workspaceId, provider:'openai'|'deepseek'|'image'|'video',
             encryptedKey, last4, updatedBy, updatedAt }   // one per provider per workspace

Project    { _id, workspaceId, createdBy, name, product, niche, homepageUrl,
             brandBrief, learnings:[string],
             visibility:'private'|'shared'|'workspace',     // default 'private'
             sharedWith:[userId],                           // only when visibility==='shared'
             createdAt }

Run        { _id, projectId, workspaceId, createdBy,
             status:'idle'|'running'|'awaiting_gate'|'done'|'error',
             currentStep, steps:[Step], createdAt, updatedAt }
Step       { index, key, mode:'auto'|'gate',
             status:'idle'|'queued'|'running'|'waiting'|'done'|'error',
             model, prompt, result?, assetIds?:[ObjectId],
             usage?:{tokens,costUsd}, error?, startedAt?, finishedAt? }

Asset      { _id, runId, workspaceId, stepIndex, type:'image'|'video'|'audio',
             url, thumbUrl, meta, approved }
```

## B4. Access-control rules
- Every query scoped by `workspaceId`; user must hold a membership (`WorkspaceGuard`).
- **Project list visible to a user** within a workspace:
```js
{ workspaceId, $or: [
    { visibility: 'workspace' },
    { createdBy: userId },
    { visibility: 'shared', sharedWith: userId },
]}
// if membership.role === 'owner' → return all projects (owner override)
```
- **API keys:** read/use = any member; create/update/delete = `role === 'owner' || membership.canManageKeys`.
- **Members, invites, role changes, granting `canManageKeys`:** Owner only.
- **Run a step:** user can access the project **and** the workspace has the provider key that step needs (per-step unlock); else the step is locked.

## B5. API surface
```
# Auth
POST   /auth/signup        POST /auth/login      POST /auth/refresh
POST   /auth/logout        GET  /auth/me         POST /auth/forgot   POST /auth/reset

# Workspaces
POST   /workspaces         GET /workspaces       GET /workspaces/:id
PATCH  /workspaces/:id [O] DELETE /workspaces/:id [O]

# Members & invites
GET    /workspaces/:id/members
POST   /workspaces/:id/invites [O]            POST /invites/accept (token)
DELETE /workspaces/:id/invites/:iid [O]
DELETE /workspaces/:id/members/:uid [O]       PATCH /workspaces/:id/members/:uid [O]   # role + canManageKeys

# API keys (last4 only on read)
GET    /workspaces/:id/keys                   PUT /workspaces/:id/keys/:provider [O|canManageKeys]
DELETE /workspaces/:id/keys/:provider [O|canManageKeys]

# Projects
POST   /workspaces/:id/projects               GET /workspaces/:id/projects   # visibility-filtered
GET    /projects/:id     PATCH /projects/:id [creator/O]    DELETE /projects/:id [creator/O]

# Runs
POST   /projects/:id/runs                      GET /runs/:id
PATCH  /runs/:id/steps/:i/prompt               POST /runs/:id/steps/:i/run
POST   /runs/:id/steps/:i/approve              POST /runs/:id/run-all    POST /runs/:id/stop
```
`[O]` = Owner only · `[O|canManageKeys]` = Owner or a member granted key management.

## B6. Pipeline orchestration
- A run is a **state machine** stored in the Run document.
- A step executes the mapped provider (in-process early, BullMQ job from the render phase), assembling input from the step's prompt + prior results.
- AUTO done → advance; **GATE** (3/5/8) → `awaiting_gate`, stop until `approve`.
- One `StepProvider` interface; a `step.key → provider` registry (from `shared`), so swapping a model is a one-line change.
- **Per-step key gating:** a step is runnable only if the workspace has an `ApiKey` for its provider.

## B7. Security & non-functional
- API keys encrypted at rest (**AES-256-GCM**, master key from env/KMS); never returned in full — only `last4`.
- Refresh token httpOnly/Secure/SameSite cookie; access token in memory; rotation + hashed storage for revocation.
- All routes behind `JwtAuthGuard` except signup/login/refresh/invite-accept/forgot/reset.
- Request validation via **class-validator** DTOs; CORS locked to the web origin; rate limiting (`@nestjs/throttler`) on auth + run endpoints.
- Each provider call wrapped with timeout + retry/backoff; step failures recorded on the Step, not fatal to the run.

## B8. Build phases
0. **Monorepo + Auth** — Turborepo (apps/web, apps/api, packages/shared, tsconfig, eslint-config, pnpm); users, signup/login, JWT access+refresh.
1. **Workspaces** — workspaces, memberships (with `canManageKeys`), invites; personal workspace on signup; switcher.
2. **Projects + Keys** — projects with visibility/sharedWith (default private); encrypted workspace-level API keys.
3. **Run state machine (fake results)** — port the workbench to persisted state; gates, run-all, reset. No AI spend.
4. **Brain steps (Claude)** — Steps 3/4/5 real via the provider interface.
5. **Source steps** — GPT-5.5 (Step 1) + DeepSeek crawl (Step 2).
6. **Render steps + queue** — image (6) + video/UGC (7); BullMQ/Redis; assets to Cloudinary/S3; image grid + video tiles in results.
7. **Assemble/QA + loop + harden** — Step 8; learnings loop into Step 5; rate limits, cost capture, deploy.
