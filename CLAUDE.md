# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state: Phases 0–4 complete (brain steps run on Claude)

Built and verified: **Phase 0** (monorepo + auth), **Phase 1** (workspaces/memberships/invites), **Phase 2** (projects + encrypted per-workspace keys), **Phase 3** (run state machine + gates), and **Phase 4** (brain steps brief/insight/prompts execute on Claude via the `StepProvider` interface). Plus two out-of-band additions: a **Prompt library** (`apps/api/src/prompts`, `apps/web` Prompts page — draft/public, step-typed, media + tags) and the **brand kit** (favicon + auth-page logo). The web UI is **light/Linear-style** (the design-system doc's dark tokens are superseded for now).

**⚠️ Business model v2 (composable Pipelines) is now BUILT — read [docs/lyra-pipelines.md](docs/lyra-pipelines.md).** The fixed 8-step pipeline is superseded by **user-composable Pipelines**: a workspace **Pipeline Library** (`apps/api/src/pipelines`, `apps/web` Pipelines page + vertical-flow builder) of linear flows whose **Steps** bind a library **Prompt** to a chosen **provider·model** + gate/auto; pipelines are assigned to projects (`ProjectPipeline` join) and **run in a project's context** via the generalized run engine (per-step provider/model, `{input}`/`{step:Name}` chaining). The project page is now a **pipelines hub + run workbench**. The builder is the single **create + edit** surface (`/pipelines/new` opens it; first save creates — no separate create form), with a searchable **`PromptPicker`** (public prompts only) in the step drawer. The **unified run view** is built: `RunFlow` lights up the same vertical flow with live per-step status + inline gate **Approve** + expandable results, runnable from **both** the project hub and the **builder** (project picker → Run), and there's a **mobile one-step pager** (`FlowPager`) for build + run. Shared run plumbing lives in `apps/web/src/lib/useRunActions.ts`; key web components: `apps/web/src/components/{RunFlow,FlowPager,PromptPicker,EditorShell}.tsx`. Also built: **Chats** (`apps/api/src/conversations`, `apps/web` Chats page) — a top-level, Claude-style **multi-turn** chat workbench that **supersedes** the old per-prompt testing playground (`prompt-tests` is removed). A `Conversation` (new collection, embedded `messages[]`, per-user, soft-deleted) streams replies over SSE with prior turns as context; **every turn auto-persists** (no manual save). Each message stamps its `provider·model`, shown via a brand `ProviderIcon`. The bridge to the library: **Save as prompt** (`SaveAsPromptModal` → `POST /workspaces/:id/prompts`, carrying the message's provider·model) and **Open in chat** on a library prompt (creates a conversation seeded with the prompt). Web: `apps/web/src/pages/Chats.tsx`, `components/{ProviderIcon,SaveAsPromptModal}.tsx`. The streaming clients (`anthropic.client`, `openai-compat.client`) gained an optional `history` for multi-turn. Plus a curated `MODEL_CATALOG` in shared. Remaining (not blocking): the one-click **8-step starter template** (deferred); only **Anthropic** executes for real (others MockStepProvider). The 8 `STEP_DEFS` survive only as seed/reference.

Step execution goes through `apps/api/src/runs/providers/` (`StepProvider` interface + `ProviderRegistry`); only Anthropic is real — openai/deepseek/image/video still use `MockStepProvider`. Wiring a real provider = add its impl + map it in the registry (one line).

## Recent UI/API updates (June 17, 2026)

- Library pages (`/prompts`, `/pipelines`, `/projects`) now share a compact
  Linear-style list/card treatment. Filter popovers are viewport-clamped, have a
  disabled/enabled **Clear** action, and collapse long groups such as tags and
  created-by into dropdown sections.
- Prompt filters are multi-select. Semantics are **OR within a filter group** and
  **AND between groups**; prompt tag filtering is explicitly "any selected tag"
  and case-insensitive in `apps/api/src/prompts/prompts.service.ts`.
- Prompt rows: mobile is four rows (title/actions, description + eye, labels/status,
  updated-by/date + provider/model). The eye opens `PromptDetails`, a full prompt
  modal that can edit the prompt body. Description text is clamped to two lines.
- Pipeline rows intentionally have **no detail popup**. Editable users can inline
  rename a pipeline and edit tags directly from the list using `LabelPicker`;
  rows show step count, creator/date, open, and delete.
- Project create/edit (`apps/web/src/pages/ProjectEditor.tsx`) was redesigned on
  `EditorShell`: name in the header, grouped context fields (`product`, `niche`,
  `homepageUrl`), and visibility as selectable cards. These fields feed pipeline
  placeholders such as `{product}`, `{niche}`, and `{homepage}`.

**Read these before doing anything** (source of truth, in priority order):
- [docs/lyra-pipelines.md](docs/lyra-pipelines.md) — **composable Pipelines (business model v2)**: entities, full decision log, UI spec, build phases. Supersedes the fixed-pipeline model.
- [docs/lyra-prompt-testing.md](docs/lyra-prompt-testing.md) — **superseded.** The per-prompt testing playground it describes was replaced by **Chats** (top-level, multi-turn, auto-persisted conversations in `apps/api/src/conversations` + `apps/web/src/pages/Chats.tsx`); good prompts are promoted to the library via **Save as prompt**. Read the doc only for historical context.
- [docs/lyra-requirements.md](docs/lyra-requirements.md) — business + technical requirements, data model, API surface, resolved decisions, **build-phase order (§B8)**. (Fixed 8-step run model is superseded by lyra-pipelines.md.)
- [docs/lyra-getting-started.md](docs/lyra-getting-started.md) — the concrete kickoff: exact bootstrap commands, root config files, and **copy-paste-ready `@lyra/shared` contracts (§5)**. Build Phase 0 (Monorepo + Auth) from this.
- [docs/lyra-design-system.md](docs/lyra-design-system.md) — the dark, Apple-style design tokens for the web UI. Honor these tokens when building React components.
- [docs/lyra-hosting-cicd.md](docs/lyra-hosting-cicd.md) — hosting topology, GitHub Actions CI, Dockerfile, required Mongo indexes, deploy flow.

> Note: the getting-started doc predates the Anthropic provider correction. The pipeline uses **5 providers** (openai, anthropic, deepseek, image, video), not 4 — the Brain steps (brief/insight/prompts/qa) run on Claude.

## What Lyra is

A multi-user web app where teams run an **8-step AI creative pipeline** (find → crawl → brief → insight → prompts → images → video → assemble/QA) for a brand/product, producing on-brand images and UGC/video. Each step has an editable prompt and a stored result. A run is a **state machine** persisted in the `Run` document; steps 3/5/8 are **gates** that pause for approval.

## Planned architecture

```
React workbench ──REST (JWT)──▶ NestJS API ──▶ MongoDB
(SPA, Vite)                        │
                                   ├─▶ Job worker (BullMQ/Redis, render phase) ─▶ GPT-5.5 · DeepSeek · Claude · Image · Video
                                   └─▶ Asset store (Cloudflare R2 / S3 / Cloudinary)
```

Turborepo (pnpm workspaces) with three workspace members:
- `apps/web` — React 18 + Vite + React Router + @tanstack/react-query (the workbench SPA).
- `apps/api` — NestJS 10 + Mongoose + Passport-JWT + argon2 + class-validator. **The only tier that holds keys, crawls, and calls the AI providers.**
- `packages/shared` (`@lyra/shared`) — TypeScript types, enums, constants, pure utils. Built with tsup.

## Non-negotiable invariants

These cut across multiple files and are the easiest things to get wrong. They define the project's integrity:

1. **`@lyra/shared` is the single source of truth and has ZERO runtime dependencies.** It holds only types, enums, constants (`STEP_DEFS`, `STEP_PROVIDERS`), and pure utils (`canViewProject`, `canEditProject`, `canManageKeys`, `fillPrompt`). Never add a runtime dep or a validation library here. Never duplicate these types/enums/helpers inside an app — import them.

2. **Validation lives in the api, typed against shared.** DTO *interfaces* live in `@lyra/shared/dto`; the api implements them as **class-validator classes that `implements` the shared interface** (e.g. `class SignupBody implements SignupDto`). The `implements` link is what prevents the request shape from drifting from the contract.

3. **Server-only fields never leave the api.** `passwordHash`, `encryptedKey`, and `tokenHash` exist only in the api's Mongoose schemas — never in `shared`, never in any API response. Shared models are the *safe transport shapes* (e.g. `ApiKeyInfo` exposes `last4`, never the key). `ids` are `string` in shared (serialized ObjectId).

4. **Access control is enforced from shared helpers.** The api enforces and the web reflects the *same* `canViewProject` / `canEditProject` / `canManageKeys` rules because both import them from shared — no parallel reimplementation. Guard order in the api: `JwtAuthGuard` → `WorkspaceGuard` (membership + role + `canManageKeys`) → `ProjectAccessGuard` (visibility).

5. **Multi-tenancy: workspace is NOT in the JWT.** The JWT payload is `{ sub: userId }` only. Every request targets a workspace (`/workspaces/:id/...` or `X-Workspace-Id`) and a guard verifies membership per request. Every Mongo query is scoped by `workspaceId`. The workspace — not the user — owns projects, keys, runs, and assets.

6. **Auth token strategy.** Access token: JWT (~15 min), held in memory client-side, sent as `Authorization: Bearer`. Refresh token: opaque, in an httpOnly/Secure/SameSite=Strict cookie, **rotated on every refresh**, stored **hashed** server-side for revocation. Passwords hashed with **argon2id**. On web load, call `/auth/refresh` to silently restore the session — never store the access token in localStorage.

7. **Provider keys are per-workspace and encrypted at rest** with AES-256-GCM (master key from `ENCRYPTION_KEY` env). They are bring-your-own (no billing/metering in v1), never env vars, and never returned in full. **Per-step key gating:** a step is runnable only if the workspace has an `ApiKey` for that step's provider (mapped via `STEP_PROVIDERS` in shared).

8. **Project visibility defaults to `private`.** Modes: `private` (creator only), `shared` (creator + named `sharedWith` users, full access), `workspace` (all members). Owner has override and sees all projects. Sharing is full-access; per-user view/edit roles are deferred.

9. **Swapping a model is a one-line change.** Steps execute through a single `StepProvider` interface, dispatched via the `step.key → provider` registry in shared. Don't hard-code provider calls into orchestration logic.

## Build phases (do them in order)

Build **one phase at a time**; each has a Definition of Done. See [docs/lyra-requirements.md §B8](docs/lyra-requirements.md) and the getting-started doc for the per-phase spec.

0. **Monorepo + Auth** — scaffold Turborepo + shared contracts; users, signup/login, JWT access + rotating refresh.
1. **Workspaces** — workspaces, memberships (`canManageKeys`), invites; personal workspace on signup; switcher.
2. **Projects + Keys** — projects with visibility/sharedWith (default private); encrypted workspace-level keys.
3. **Run state machine (fake results)** — persist the workbench; gates, run-all, stop, reset. **No AI spend.**
4. **Brain steps (Claude)** — steps 3/4/5 real via the `StepProvider` interface.
5. **Source steps** — GPT-5.5 (step 1) + DeepSeek crawl (step 2).
6. **Render steps + queue** — image (6) + video (7); BullMQ/Redis; assets to R2/S3.
7. **Assemble/QA + loop + harden** — step 8; learnings loop into step 5; rate limits, deploy.

## Commands

Phase 0 is scaffolded. Package manager is **pnpm** (v10), Node 20+ (developed on 24).

```bash
pnpm install              # install workspace deps
pnpm dev                  # turbo run dev — web (:5173) + api (:3001) together
pnpm build                # turbo run build (dependsOn ^build; shared builds first)
pnpm lint                 # turbo run lint
pnpm type-check           # turbo run type-check
pnpm test                 # turbo run test (whole suite; what CI gates)

# scope a task to one package
pnpm turbo run build --filter=@lyra/api
pnpm turbo run test  --filter=@lyra/shared
pnpm --filter @lyra/api test:e2e          # auth e2e (spins up in-memory MongoDB)
```

### Local services

The api needs MongoDB to run (`pnpm dev`); the e2e tests spin up their own
in-memory MongoDB, so they need no external DB. For dev, use Docker:

```bash
docker compose up -d mongo                # MongoDB single-node replica set (rs0)
docker compose --profile queue up -d      # + Redis (from Phase 6)
```

Mongo is a single-node replica set so transactions work (Phase 1+). Dev URI:
`mongodb://localhost:27017/lyra?replicaSet=rs0`. Alternatively point `MONGODB_URI`
at a MongoDB Atlas SRV string. Provider keys are **never** env vars (see invariant 7).

CI runs `pnpm turbo run lint type-check test build` on every PR and push to `main`. Nothing is "done" until those pass **and** the phase's Definition of Done is met.

## Testing strategy

- **shared** — Vitest unit tests for the pure helpers (`canViewProject`, `canEditProject`, `canManageKeys`, `fillPrompt`). Cheap, high-value.
- **api** — Jest unit tests for services, guards, and the run-orchestrator transitions; **supertest** e2e for auth endpoints against **mongodb-memory-server** (tests never hit a real DB).
- **web** — Vitest + React Testing Library for `AuthContext` and the auth forms; Playwright for login→dashboard once stable.
- Run a single test the standard way for the runner — e.g. `pnpm --filter @lyra/shared test -- canViewProject` (Vitest) or `pnpm --filter @lyra/api test -- auth.service` (Jest `-t`/path filter).

## Conventions

- **TypeScript strict everywhere.** Settle the shared types/DTOs/endpoints contract *before* implementing a feature, so api and web build against a fixed shape.
- **api** — module-per-feature (NestJS). Keep business logic in services/guards, not controllers.
- **web** — no business logic in components; import DTO/model types from `@lyra/shared`; the server is the source of truth for validation (do only light inline form checks).
- Per-package `CLAUDE.md` files are planned (`apps/api`, `apps/web`, `packages/shared`) — create/update them as conventions emerge so rules apply where they're relevant.
- Disable Mongoose auto-indexing in production; manage indexes/migrations with **migrate-mongo** (required indexes listed in the hosting doc §7).
