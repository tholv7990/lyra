# Connectors Microservice — v2 (Publish via self-hosted Postiz) — Design

> Status: **design approved (brainstorm), 2026-06-18.** Implements the **publish
> half** of the connectors contract, the sibling to
> [2026-06-18-connectors-microservice-download-design.md](2026-06-18-connectors-microservice-download-design.md).
> This is the **microservice-proxy** build of publish (a standalone Publish tool,
> mirroring download v1). The earlier
> [2026-06-18-builtin-publish-connectors-design.md](2026-06-18-builtin-publish-connectors-design.md)
> describes publish **as a pipeline action-step** — a *later, additive* layer on the
> same `connectors-service`, explicitly out of scope here (see Non-goals). Held at the
> spec gate — no implementation until the user reviews the spec; the plan is written next.

## Goal

Make the shipped Publish + Connections UI work for real: add a **publish module** to the
existing `apps/connectors-service` (NestJS, :9100) that lists channels, uploads media,
and posts to social platforms by calling a **self-hosted Postiz** instance over its
public HTTP API — replacing the proxy's mock for the `channels`/`publish`/`jobs` endpoints.
Definition of done is a **real end-to-end post** (Lyra → Postiz → a live Bluesky/Mastodon
post), with mock mode preserved.

## Decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Architecture | **Microservice-proxy** (extend download v1): the service does the Postiz I/O; the Lyra api keeps proxying; the standalone `PublishComposer`/`Connections` pages become real. Publish-as-a-pipeline-step is deferred. |
| Backend | **Self-hosted Postiz** (AGPL) — run **unmodified behind its public HTTP API** (no copyleft on Lyra). One instance per deployment; `POSTIZ_API_URL` is infra env. Needs its own Postgres + Redis (compose profile). |
| v2 scope | **Publish-now MVP only**: caption + optional media → multiple channels → per-channel receipts. No scheduling/drafts/analytics. |
| Postiz key | **Per-workspace, encrypted in the api** (new `ConnectorCredential` store, AES-256-GCM via the existing `EncryptionService`). **Not** a `Provider` enum value. The api decrypts and forwards it to the service per request as `X-Connector-Key`. |
| Transport | **Async job** (publish → `jobId` → poll `jobs/:id`), backed by an in-memory job store in the service (mirrors download's `FileStore` + TTL). Matches the already-built web poll loop. |
| Media | **Absolute, publicly-reachable URLs** (SSRF-guarded); the service fetches → `POST /upload` → references in the post. Text-only fully supported. `data:`/relative Lyra URLs deferred. |
| Connect/remove | Postiz's public API can only **list** integrations. Connecting/removing channels happens **in the Postiz web UI**; Lyra links out (`connect-link` → `POSTIZ_PUBLIC_URL`) and lists read-only. |
| DoD | **Real e2e via Bluesky/Mastodon** (no per-platform app review needed). TikTok/Meta/X become operator setup in Postiz later — zero Lyra code change. |

## Why self-hosted Postiz behind its API

Social posting is infrastructure for Lyra, not the core product, so we **don't build
per-platform**. Postiz (NestJS, 30+ platforms, public REST API) runs as a separate
service and Lyra calls it. There are **two distinct credentials**, and conflating them is
the usual confusion:

1. **The Postiz API key** authenticates `Lyra → our Postiz`. We mint it ourselves from
   *our* instance (Settings → Public API). Nothing registers on postiz.com.
2. **Per-platform OAuth tokens** authenticate `Postiz → TikTok/Meta/X/…`. Postiz holds
   these internally after a channel is connected in its UI. Getting them for the *big*
   platforms needs a developer app + **app review** (TikTok 2–6 wks, Meta 1–4 wks/round,
   X paid) — the real-world cost, and it's on the operator, per platform. **Bluesky and
   Mastodon need none**, which is why they're the e2e target.

The integration shape Postiz exposes (`GET /integrations`, `POST /upload`, `POST /posts`)
maps cleanly onto the connectors contract the proxy already forwards.

## Architecture

```
Browser ─▶ Lyra api /workspaces/:id/connectors/{credentials,channels,publish,jobs/:id,connect-link}
            (JWT + WorkspaceGuard; canManageKeys on credentials)
              │  saveCredential → ConnectorCredential store (encrypt, never returned)
              │  channels/publish/jobs → proxy.forward(+ X-Connector-Key = decrypted Postiz key)
              ▼  HTTP (Bearer CONNECTORS_SERVICE_TOKEN)
        apps/connectors-service (NestJS, :9100)
              ├─ ServiceTokenGuard (existing)
              ├─ GET  /channels    → Postiz GET  /public/v1/integrations     → Channel[]
              ├─ POST /publish     → job: fetch media → POST /upload → POST /posts(type:'now') → Receipt[]
              ├─ GET  /jobs/:id    → { jobId, status, receipts? }   (in-memory job store + TTL)
              └─ GET  /connect-link→ { url: POSTIZ_PUBLIC_URL }
              │  Authorization: <workspace's Postiz key>
              ▼  HTTP
        self-hosted Postiz (:5000, own Postgres+Redis) ─OAuth─▶ Bluesky / Mastodon / …
```

The service is **not browser-facing** — only Lyra calls it. Postiz runs **unmodified**
behind its API (AGPL boundary respected). The per-workspace Postiz key is a transient
header on each request; the service never stores it.

## Endpoints (the service; Lyra proxy forwards)

- `GET /channels` → `{ channels: Channel[] }`
  Calls Postiz `GET /public/v1/integrations` with `Authorization: <key>`; maps each
  integration to `Channel { id, platform, displayName }` (Postiz "integration" = "channel";
  `id` is the integration id used as the publish target).
- `POST /publish { channelIds, caption, mediaUrls }` → `{ jobId, status:'queued' }`
  Creates an in-memory job and runs the post **in the background**: for each
  `mediaUrls[]` → `assertSafeUrl` → fetch bytes → `POST /public/v1/upload` (collect Postiz
  media ids) → `POST /public/v1/posts` `{ type:'now', posts:[{ integration:{id}, value:[{content, image?}] }…] }`
  → map the outcome to `Receipt[]` (`{platform, accountId, url?, postId?, status:'ok'|'failed', error?}`),
  **partial-failure tolerant** (one channel failing doesn't fail the rest). Job → `done`/`failed`.
- `GET /jobs/:jobId` → `{ jobId, status:'queued'|'running'|'done'|'failed', receipts? }`.
- `GET /connect-link?connector=postiz` → `{ url }` = `POSTIZ_PUBLIC_URL` (the Postiz web UI,
  where the user connects/removes channels).

`Channel`, `Receipt`, `PublishJob`, `PublishDto` are imported from `@lyra/shared` (single
source of truth — unchanged; they already drive the built UI).

## Components (`apps/connectors-service/src/publish/`)

- `postiz.client.ts` — thin `fetch` wrapper around the Postiz public API
  (`listIntegrations`, `uploadMedia`, `createPost`), base URL from `POSTIZ_API_URL`, key
  passed in. **Pure mappers** `mapIntegrations(json) → Channel[]` and
  `mapPostResult(json, targets) → Receipt[]` (unit-tested with fixtures, no network).
- `job-store.ts` — `uuid → { status, receipts, createdAt }`; `create()`, `get(id)`,
  `update(id, …)`; periodic **TTL sweeper** (mirrors `file-store.ts`).
- `publish.service.ts` — orchestrates: create job → background `runPublish` (media fetch
  + SSRF guard + upload + post + receipt mapping) → update job. Reads the per-request
  Postiz key.
- `publish.controller.ts` — the 4 routes above, `@UseGuards(ServiceTokenGuard)`; reads
  `X-Connector-Key`.
- `dto.ts` — `PublishBody implements PublishDto` (class-validator).
- `publish.module.ts` — wires controller + service; registered in `app.module.ts`.

`common/url.ts` `assertSafeUrl` is reused for media-URL SSRF; no new binaries (publish is
pure HTTP — unlike download, no yt-dlp/ffmpeg).

## Lyra api-side additions

1. **`ConnectorCredential` store** — `connector-credential.schema.ts`
   (`{ workspaceId, connector, encryptedKey, last4 }`, `AuditedEntity`, partial-unique
   index on active, soft-delete) + `connector-credentials.service.ts`
   (`upsert`/`getDecrypted`/`view`), reusing `EncryptionService`. Mirrors `KeysService`
   but kept separate from the AI-`Provider` key store.
2. **Controller changes** (`connectors.controller.ts`):
   - `PUT /credentials` → **real write** to the credential store (not a forward).
   - `GET /credentials` → `{ connected, last4? }` (so Connections shows state).
   - `channels`/`publish`/`jobs` → `proxy.forward` now also passes the **decrypted key**;
     a request when no key is stored returns a **clear 4xx** (no keyless Postiz call).
   - `DELETE /channels/:id` → **removed** (Postiz has no public delete; managed in its UI).
3. **Proxy** (`connectors.proxy.ts`): `forward` gains an optional `connectorKey` that it
   sets as `X-Connector-Key`. Mock mode unchanged (the existing deterministic mock keeps
   the UI working with no service/Postiz).
4. **Shared** (`@lyra/shared`): add `ConnectorCredentialInfo { connected: boolean; last4?: string }`
   (safe transport shape). Existing publish DTOs/models unchanged.

## Web-side additions

- `Connections.tsx` — real key state via `GET /credentials`; the "Connect channel" button
  opens `connect-link` (the Postiz UI); the per-channel **remove** button becomes a
  **"Manage channels in Postiz ↗"** link. Channel list stays read-only/live.
- `PublishComposer.tsx` — **no logic change** (publish → poll → receipts already built);
  only copy/empty-state polish if needed.
- `lib/connectors.ts` — add `credentialStatus(ws)`; drop `removeChannel`.

## Security

- **Token gate** (`ServiceTokenGuard`) + not browser-exposed — only Lyra calls the service.
- **Postiz key**: per-workspace, **AES-256-GCM at rest**, never returned in full (only
  `last4`), forwarded transiently as a header; never an env var; `canManageKeys`-gated to
  save.
- **SSRF guard** on every fetched media URL (`assertSafeUrl`: http/https only; reject
  loopback/private/metadata hosts).
- **Multi-tenancy**: every call carries the Lyra-asserted `workspaceId`; the key is
  resolved from *that* workspace's credential. Channels listed are exactly that
  workspace's Postiz account.
- **Always human-gated**: the Publish click is the gate (an external, irreversible effect);
  the UI already frames it that way. **Idempotency** within a job (a job posts once).

## Deployment

- **No Dockerfile change** beyond the new module (publish needs no extra binaries; the
  existing `node:20-slim` image suffices).
- **docker-compose** (`connectors` profile): uncomment/enable the **Postiz** stack
  (`postiz` + `postiz-postgres` + `postiz-redis`, already templated); add
  `POSTIZ_API_URL` + `POSTIZ_PUBLIC_URL` to `connectors-service` env.
- **Env:** service — `POSTIZ_API_URL` (e.g. `http://postiz:5000`), `POSTIZ_PUBLIC_URL`
  (e.g. `http://localhost:5000`), existing `CONNECTORS_SERVICE_TOKEN`. api — existing
  `CONNECTORS_SERVICE_URL`/`CONNECTORS_SERVICE_TOKEN`. `.env.example` updated.
- **Going live (real e2e — the DoD):**
  1. `docker compose --profile connectors up -d` (Postiz + its DB/Redis + connectors-service).
  2. Open Postiz UI, create the admin account, **connect a Bluesky or Mastodon channel**
     (minutes; no app review), copy the **Public API key** (Settings → Public API).
  3. In Lyra → Connections: paste the key (stored encrypted); the channel appears.
  4. In `apps/api/.env`: set `CONNECTORS_SERVICE_URL` + matching token; rebuild/restart api.
  5. Publish → pick the channel → caption (+ optional public image URL) → **live post**;
     the receipt links to the real post.

## Testing (mock Postiz — no network in unit tests)

- `postiz.client` mappers: an `integrations` JSON fixture → expected `Channel[]`; a
  `posts` result fixture → expected `Receipt[]`.
- **Partial failure**: 1 of N channels errors → job `done` with mixed receipts (not
  all-or-nothing).
- `job-store`: create/get/update; TTL sweep removes expired, keeps fresh.
- `assertSafeUrl` on media URLs: rejects loopback/private; accepts https (reuses existing).
- api `ConnectorCredentialsService`: upsert → `getDecrypted` round-trips; `view` exposes
  only `connected`/`last4`.
- api controller: `saveCredential` requires `canManageKeys`; `publish`/`channels` with no
  stored key → clear error; the proxy attaches `X-Connector-Key`.
- Full CI gate green (`type-check lint test build`).
- **Real e2e** (manual, the DoD): the going-live steps above → a live Bluesky/Mastodon post.

## Scope / non-goals (v2)

- **In:** `channels`/`publish`/`jobs`/`connect-link` over Postiz; real per-workspace key
  storage; the Connections/Composer wiring; publish-now with optional public-URL media.
- **Out / later:** **scheduling** & **drafts** (`type:'schedule'|'draft'`); **analytics**/
  engagement read-back; **in-Lyra channel connect/remove** (done in Postiz UI);
  **`data:`/relative Lyra media URLs** (R2 absolute URLs work today); **multiple Postiz
  instances**; **publish-as-a-pipeline-step** (the deferred Module-A layer — same service,
  added later); BullMQ-backed durable jobs (in-memory is fine for v2, like download).

## Invariants honored

- `@lyra/shared` is the single source of truth for the contract types (`Channel`,
  `Receipt`, `PublishJob`, `PublishDto`); the service imports them, doesn't redefine.
- Provider/connector secrets are **per-workspace, encrypted at rest, never returned** —
  the Postiz key follows the same rule as AI provider keys (invariant 7), via a dedicated
  store kept out of the `Provider` enum.
- The browser talks **only to Lyra**; the service is reachable only by Lyra (token-gated,
  server-to-server). Postiz runs **unmodified behind its API** (AGPL boundary).
- Multi-tenancy: every call carries the Lyra-asserted `workspaceId`; the key, channels,
  and receipts are all that workspace's.
- Swapping the publish backend stays a service-local change behind the same proxy contract
  (the proxy/contract are unchanged on the Lyra side except the additive credential routes).
