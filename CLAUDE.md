# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state: docs-only, pre-scaffold

This repo currently contains **only specification documents** under `docs/` — no code, no `package.json`, no monorepo yet. Lyra has not been bootstrapped. The first substantial task is to scaffold the Turborepo monorepo per the getting-started doc. Treat the docs as the authoritative spec; nothing in them has been built or verified yet.

**Read these before doing anything** (they are the source of truth, in priority order):
- [docs/lyra-requirements.md](docs/lyra-requirements.md) — business + technical requirements, data model, API surface, all resolved decisions, and the **build-phase order (§B8)**.
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

## Commands (once the monorepo is scaffolded)

These come from the planned root `package.json` / `turbo.json` — they do not work yet because nothing is bootstrapped. Package manager is **pnpm** (v9), Node 20.

```bash
pnpm install              # install workspace deps
pnpm dev                  # turbo run dev — web + api together
pnpm build                # turbo run build (dependsOn ^build; shared builds first)
pnpm lint                 # turbo run lint
pnpm type-check           # turbo run type-check
pnpm test                 # turbo run test (whole suite; what CI gates)

# scope a task to one package
pnpm turbo run build --filter=@lyra/api
pnpm turbo run test  --filter=@lyra/shared
```

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
