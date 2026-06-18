# Built-in Connectors — Backend Architecture (microservice + Lyra proxy)

> Status: **architecture settled (brainstorm), 2026-06-18.** Authoritative backend
> reference for the "built-in" suite (Source = download, Action = publish).
> **Supersedes** the api-resident approach in
> [2026-06-18-builtin-publish-connectors-backend.md](../plans/2026-06-18-builtin-publish-connectors-backend.md)
> (connector logic now lives in a **separate microservice**, not Lyra's api).
> Frontend is documented separately (next).

## 1. Summary of decisions

| Decision | Choice |
|---|---|
| Where connector logic lives | A **separate microservice** ("Connectors Service") — owns the connector registry, Postiz/Cobalt integration, credentials, and publish/download jobs. |
| What Lyra owns | The **UI** + a **thin proxy** in Lyra's api (`/workspaces/:id/connectors/*`). No connector logic in Lyra. |
| Backends behind the microservice | **Publish → self-hosted Postiz**; **Download → self-hosted Cobalt** (both AGPL, run as separate containers, called over their HTTP APIs). |
| Lyra api ↔ microservice transport | **HTTP** (sync) for interactive ops; **async job** for publish (and bulk download). |
| Async/job tech | **BullMQ on Redis**, internal to the microservice (matches Lyra's planned queue stack). **Not** RabbitMQ/Kafka. |
| Why not a broker between api↔service | The bottleneck is the **external platform APIs (seconds)**, not the internal hop (ms); volume is tiny (Postiz ~90 posts/hr). A broker adds latency + ops for no gain here. NATS is a reasonable *future* event backbone if the platform goes event-driven — deferred. |
| Works before the microservice exists | Yes — the Lyra proxy returns a **mock** when `CONNECTORS_SERVICE_URL` is unset (env-gated, like R2's inline fallback). |

## 2. Topology

```
                 ┌────────── Lyra (this repo) ──────────┐
Browser ─JWT─▶ Lyra web ─api wrapper▶ Lyra api
                                       /workspaces/:id/connectors/*   (thin proxy)
                                       │  JwtAuthGuard + WorkspaceGuard
                                       │  CONNECTORS_SERVICE_URL set?
                                       │     ├─ no  → MOCK response
                                       │     └─ yes → forward (Bearer CONNECTORS_SERVICE_TOKEN + workspaceId/userId)
                                       ▼
                 ┌──────── Connectors Service (separate microservice) ────────┐
                 │  REST API + connector registry + credential store          │
                 │  BullMQ worker (Redis) for publish/bulk jobs               │
                 └───┬───────────────────────────────┬────────────────────────┘
                     │ HTTP                            │ HTTP
                     ▼                                 ▼
              Postiz (self-host:                 Cobalt (self-host:
              Next+NestJS+Postgres               cobalt api container)
              +Redis+Temporal)                   POST / → tunnel/redirect/picker
              public API /public/v1              GET /tunnel
                     │ OAuth (native)
                     ▼
              TikTok / IG / YouTube / FB / X …
```

Lyra never imports Postiz/Cobalt code — only HTTP calls. The **AGPL boundary** is the network: both run unmodified as their own containers behind their APIs.

## 3. The Connectors Service (microservice) — responsibilities

- **Connector registry** — `PublishConnector` (Postiz) + `MediaSourceConnector` (Cobalt), swappable by id (mirrors Lyra's `StepProvider` registry idea).
- **Credential storage** — per-workspace connector secrets (e.g. the workspace's **Postiz API key**), encrypted at rest (AES-256-GCM) in the service's own store. Lyra never holds these.
- **Publish path (Postiz):** `listChannels` (→ Postiz `GET /public/v1/integrations`), `publish` (upload media → `POST /public/v1/posts` per channel, partial-failure tolerant, rate-limit backoff). Runs as a **BullMQ job**.
- **Download path (Cobalt):** `resolve(url)` (→ Cobalt `POST /` → tunnel/redirect/picker), `download` (proxy the bytes). `resolve` is sync; bulk download can be a job.
- **Workspace scoping** — every operation is scoped by the `workspaceId` the proxy asserts (trusted via the service token).

## 4. Communication patterns

**Sync HTTP (user is waiting):** `credentials`, `connect-link`, `channels`, `resolve`. Lyra proxy forwards and returns the JSON. Low latency, simplest.

**Async job (slow, retryable):** `publish` (and bulk `download`).
1. `POST .../publish` → microservice enqueues a BullMQ job → returns **`{ jobId, status: 'queued' }`** immediately.
2. Worker uploads media + posts to each channel (retries/backoff, partial failure) → stores `receipts`.
3. **Result delivery:** Lyra polls `GET .../jobs/:jobId` → `{ status, receipts? }` (simple v1), **or** the microservice webhooks Lyra `POST {LYRA}/connectors/jobs/:jobId/callback` and Lyra pushes to the UI via **SSE** (Lyra already uses SSE for chat). v1 default = **poll**.

> Rationale: the only operation worth making async is publish (multi-channel, rate-limited, retryable). Keeping that queue **inside** the microservice means Lyra↔service stays plain HTTP.

## 5. API contract (proxy ↔ microservice)

Lyra forwards to `${CONNECTORS_SERVICE_URL}` with `Authorization: Bearer ${CONNECTORS_SERVICE_TOKEN}` + verified `workspaceId`/`userId`. Browser-facing paths are under `/workspaces/:id/connectors`.

**Publish (Postiz):**
- `PUT  .../credentials { connector:'postiz', apiKey }` → `{ ok: true }`
- `GET  .../connect-link?connector=postiz` → `{ url }`
- `GET  .../channels` → `Channel[] { id, platform, displayName }`
- `POST .../publish { channelIds:string[], caption:string, mediaUrls:string[] }` → `{ jobId, status:'queued' }`
- `GET  .../jobs/:jobId` → `{ status:'queued'|'running'|'done'|'failed', receipts?: Receipt[] }`

**Download (Cobalt):**
- `POST .../resolve { url }` → `{ items: MediaItem[] }`, `MediaItem { index, type:'video'|'image'|'audio', thumbUrl?, filename? }`
- `POST .../download { url, indices?:number[] }` → `{ items: { url, filename }[] }`

`Channel`, `Receipt { platform, accountId, url?, postId?, status:'ok'|'failed', error? }`, `MediaItem` are interfaces in `@lyra/shared`; the proxy's request bodies are class-validator DTOs in the api.

## 6. Lyra api thin proxy

A `connectors` controller, routes above, guarded by `JwtAuthGuard` + `WorkspaceGuard`. Each handler:
- **`CONNECTORS_SERVICE_URL` set** → `fetch`-forward to the microservice (inject service token + workspaceId), return its JSON.
- **unset** → deterministic **mock** (mock channels; `publish` → a fake `jobId` then `done` with all-ok receipts; `resolve` → 1–2 items; `download` → mock urls).

This is the *only* backend code added to Lyra — forward-or-mock, no connector logic.

## 7. Deployment (one stack)

`docker-compose` services (behind a reverse proxy / one domain):
- `lyra-api`, `lyra-web`, `mongo` (existing).
- `connectors-service` (the microservice) + `redis` (its BullMQ jobs).
- `postiz` (+ its own postgres/redis/temporal) — publish backend.
- `cobalt` — download backend.

Env:
- **Lyra api:** `CONNECTORS_SERVICE_URL`, `CONNECTORS_SERVICE_TOKEN` (unset URL ⇒ mock mode).
- **Connectors service:** `POSTIZ_API_URL`, `COBALT_API_URL` (+ optional `COBALT_API_KEY`), `REDIS_URL`, an encryption key for credentials, and the shared `CONNECTORS_SERVICE_TOKEN`.

## 8. Security

- **Browser → Lyra api:** existing JWT (`JwtAuthGuard`) + `WorkspaceGuard` (membership + `canManageKeys` for credential/link routes).
- **Lyra api → microservice:** `Bearer CONNECTORS_SERVICE_TOKEN`; the proxy passes only the **verified** `workspaceId`/`userId` (the microservice trusts Lyra's assertion). The microservice is **not** exposed to the browser.
- **Credentials** (Postiz key) live encrypted **in the microservice**, never in Lyra, never returned to the client.
- **AGPL:** Postiz/Cobalt run unmodified as separate containers, called over HTTP — no source linking into Lyra or the microservice.
- **Multi-tenancy:** every call carries a `workspaceId`; the microservice scopes all data by it.

## 9. Performance rationale (why HTTP + BullMQ, not Kafka/RabbitMQ)

- The latency that the user feels is the **external platform call** (Postiz→TikTok, Cobalt scrape) — **seconds**. The Lyra↔microservice transport is **single-digit ms** on HTTP; a broker would shave microseconds off a multi-second op — wrong layer.
- For request/response, **HTTP/gRPC has lower latency than a broker** (fewer hops). **Kafka is throughput-optimized, not low-latency**; RabbitMQ adds ack/persistence overhead.
- Volume is tiny (Postiz caps ~90 posts/hr) — no throughput problem for a broker to solve.
- A broker's real wins (durability, decoupling, fan-out) matter only at scale; when needed, prefer **NATS** (lightweight, low-latency, NestJS-native) over Kafka/RabbitMQ — and you'd still use BullMQ for jobs. **Deferred.**

## 10. Scope / non-goals / future

- **In scope:** the microservice architecture + contract + the Lyra proxy + mock. (The **microservice itself is built separately**; this doc is the spec it implements + the contract Lyra codes against.)
- **Deferred:** wiring publish/download into **pipeline steps** (Source/Action in Lyra's run engine); a persisted workspace **media library**; the **NATS** event backbone; analytics/engagement read-back.
- **Future swaps:** Postiz→hosted unified API or direct platform APIs; Cobalt→another resolver — all one-line registry changes in the microservice; Lyra unaffected.

## 11. Invariants honored

- `@lyra/shared` holds the contract types (zero-dep); request validation in Lyra api DTOs.
- Auth lives in the Lyra proxy (existing guards); service token + service URL are server-only env; the browser never holds them.
- Env-gated mock fallback (mirrors R2) so Lyra builds/tests without the microservice.
- Everything workspace-scoped; secrets encrypted server-side; AGPL kept at the network boundary.
