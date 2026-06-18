# Built-in Connectors — Lyra UI + thin proxy (microservice-backed) — Design

> Status: **design approved (brainstorm), 2026-06-18.**
> **Supersedes the api-resident backend approach** in
> [2026-06-18-builtin-publish-connectors-backend.md](../plans/2026-06-18-builtin-publish-connectors-backend.md):
> the connector logic now lives in a **separate microservice**; Lyra holds only the
> **UI + a thin, env-gated proxy** (with a built-in mock). Held at the spec gate.

## Decision (locked)

| Decision | Choice |
|---|---|
| Where connector logic lives | **A separate microservice** (owns the registry + Postiz + yt-dlp + credentials). Not in Lyra's api. |
| What Lyra builds | **The UI** + a **thin proxy** in Lyra's api (`/workspaces/:id/connectors/*`). |
| Browser → microservice path | **(A) Thin proxy** — browser → Lyra api (JWT + WorkspaceGuard) → microservice. No CORS; auth + service token stay server-side. |
| Works before microservice exists? | **Yes** — the proxy returns a deterministic **mock** when `CONNECTORS_SERVICE_URL` is unset (env-gated, like R2's inline fallback). |
| v1 scope | **Standalone tools** (Connections, Publish composer, Import). **Pipeline-step wiring is deferred** (microservice + run engine). |

## Architecture

```
Lyra web ──(api wrapper, JWT)──▶ Lyra api  /workspaces/:id/connectors/*
                                   │  (JwtAuthGuard + WorkspaceGuard)
                                   ├─ CONNECTORS_SERVICE_URL set? ──▶ connectors microservice ──▶ Postiz (publish) / yt-dlp (download)
                                   └─ unset ──▶ built-in MOCK responses
```

- **Lyra owns:** the React UI + a thin proxy controller. **No** connector logic, **no** Postiz + yt-dlp calls, **no** scraper deps in Lyra.
- **The microservice (separate, NOT built here):** the connector registry, Postiz + yt-dlp integration, credential storage, publish/download.
- **The proxy is where auth lives:** it authenticates the user, enforces workspace access, then forwards the **verified** `workspaceId`/`userId` to the microservice with a service token — the microservice never faces the browser.

## The contract (Lyra proxy ↔ microservice)

Lyra forwards to `${CONNECTORS_SERVICE_URL}` with `Authorization: Bearer ${CONNECTORS_SERVICE_TOKEN}` and the verified `workspaceId`/`userId`. As exposed to the browser (via the proxy) under `/workspaces/:id/connectors`:

**Publish (Postiz-backed in the microservice):**
- `PUT  .../credentials { connector: 'postiz', apiKey }` → `{ ok: true }` (microservice stores it encrypted)
- `GET  .../connect-link?connector=postiz` → `{ url }` (Postiz channel-connect UI to open)
- `GET  .../channels` → `Channel[] { id, platform, displayName }` (microservice → Postiz `GET /integrations`)
- `POST .../publish { channelIds: string[], caption: string, mediaUrls: string[] }` → `{ jobId, status: 'queued' }` (async — publish runs as a job)
- `GET  .../jobs/:jobId` → `{ status: 'queued'|'running'|'done'|'failed', receipts?: Receipt[] }` (UI polls until done; partial-failure tolerant)

> The full backend contract + comms model is owned by
> [2026-06-18-builtin-connectors-backend-architecture.md](2026-06-18-builtin-connectors-backend-architecture.md);
> this doc covers the UI + proxy that consume it.

**Download (yt-dlp-backed in the microservice):**
- `POST .../resolve { url }` → `{ items: MediaItem[] }` where `MediaItem { index, type: 'video'|'image'|'audio', thumbUrl?, filename? }`
- `POST .../download { url, indices?: number[] }` → `{ items: { url, filename }[] }` (proxied download URLs the browser fetches)

Shapes (`Channel`, `Receipt`, `MediaItem`) live in `@lyra/shared` (interfaces); the proxy's request DTOs are class-validator classes in the api.

## Lyra proxy (thin, in the api)

A `connectors` controller, routes above, guarded by `JwtAuthGuard` + `WorkspaceGuard`. Each handler:
- **If `CONNECTORS_SERVICE_URL` set** → `fetch`-forward to the microservice (inject service token + workspaceId), return its JSON.
- **Else** → return a deterministic **mock** (mock channels; `publish` → all-ok receipts; `resolve` → 1–2 mock items; `download` → mock urls). So the UI is fully exercisable with no microservice.
No connector/Postiz + yt-dlp logic in Lyra — only forward-or-mock.

## UI surfaces (Lyra web — standalone tools)

1. **Connections** (Settings tab/page): masked **Postiz API key** field → `PUT .../credentials`; **"Connect a channel"** → opens `GET .../connect-link` url in a new tab; **channel list** → `GET .../channels` (icon + name).
2. **Publish composer** (new page): caption textarea + media URLs + **channel multi-select** → **Publish** → `POST .../publish`; renders per-channel **receipts** (✓ link / ✗ error). The user's click is the gate (standalone — no run engine).
3. **Import media** (new page): paste URL → `POST .../resolve` → preview grid → **Download** selected via `POST .../download`.

All calls go through the existing `api` wrapper (reuses JWT + base origin). New nav section "Built-ins". i18n `connectors` locale (EN + VI). New pages = low collision with Codex's active prompt/project UI; only `ProviderIcon` is extended (social icons).

## Config (env, in `apps/api/.env`)
```
CONNECTORS_SERVICE_URL=        # unset = mock mode (UI works without the microservice)
CONNECTORS_SERVICE_TOKEN=      # bearer token the proxy sends to the microservice
```

## Scope / non-goals (v1)
- **Standalone tools only.** Pipeline-step (Source/Action) wiring into the run engine is **deferred** (microservice + Lyra run engine).
- **The microservice is not built here** — Lyra ships UI + proxy + mock; point the proxy at the microservice via env when it's ready.
- No persisted workspace media library (downloads go to the device); no scheduling; no analytics.

## Invariants honored
- Types/enums in `@lyra/shared` (zero-dep); request validation in the api DTOs (the proxy still validates bodies).
- Auth lives in the proxy (existing `JwtAuthGuard` + `WorkspaceGuard`); the microservice URL + service token are server-only env; the browser never holds them.
- Env-gated fallback to mock (mirrors the R2 inline-vs-R2 pattern) so the feature degrades safely and builds/tests without the microservice.
- Multi-tenancy: the proxy injects the verified `workspaceId`; every call is workspace-scoped.
