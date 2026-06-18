# Connectors Microservice — v1 (Download via yt-dlp) — Design

> Status: **design approved (brainstorm), 2026-06-18.** Implements the **download
> half** of the connectors contract from
> [2026-06-18-builtin-connectors-backend-architecture.md](2026-06-18-builtin-connectors-backend-architecture.md).
> Publish (Postiz) is a separate **v2**. Held at the spec gate — no implementation
> until the user reviews the spec; the plan is written next.

## Goal

Make the shipped Import-media UI work for real: a separate **`apps/connectors-service`**
(NestJS) that resolves + downloads social/web media via **yt-dlp** and streams it back
to the user through Lyra's existing thin proxy — replacing the proxy's mock for the
`resolve`/`download` endpoints.

## Decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Location | **New app in the monorepo** — `apps/connectors-service` (own process/deployable; reuses tooling + `@lyra/shared`; extractable later). |
| v1 scope | **Download only** (`resolve` + `download` via yt-dlp). Publish (Postiz) = v2. |
| Media delivery | **Ephemeral temp dir + TTL cleanup**, streamed back **through Lyra's proxy** (`files/:id`). Nothing persisted; browser talks only to Lyra. |
| Engine | **yt-dlp** (standalone binary) + **ffmpeg**, spawned by the NestJS service (public-domain; 1,000+ sites). |
| Transport | Sync HTTP (download is interactive in v1; no job queue yet). |

## Architecture

```
Browser ─▶ Lyra proxy /workspaces/:id/connectors/{resolve,download,files/:id}
            (JWT + WorkspaceGuard; forwards w/ Bearer token + X-Workspace-Id)
              ▼  HTTP
        apps/connectors-service (NestJS, :9100)
              ├─ ServiceTokenGuard (Bearer CONNECTORS_SERVICE_TOKEN; trusts X-Workspace-Id/User-Id)
              ├─ POST /resolve   → spawn `yt-dlp -J <url>` → MediaItem[]
              ├─ POST /download  → spawn `yt-dlp -o <tmp>/…` → store temp → { fileId, filename }[]
              └─ GET  /files/:id → stream temp file (attachment); TTL-eligible after
```

The service is **not browser-facing** — only Lyra calls it. yt-dlp is **public-domain**,
so it's invoked directly (no AGPL boundary needed).

## Endpoints (the service; Lyra proxy forwards)

- `POST /resolve { url }` → `{ items: MediaItem[] }`
  Runs `yt-dlp -J --no-warnings <url>`, parses JSON: a single video → 1 item; a
  playlist/carousel (`entries[]`) → N items; maps each to
  `MediaItem { index, type:'video'|'image'|'audio', thumbUrl?, filename? }`.
- `POST /download { url, indices? }` → `{ items: { fileId, filename }[] }`
  Downloads the chosen items (`-o <tmp>/<uuid>.%(ext)s`; ffmpeg merges) into the temp
  store; returns **unguessable file ids** (the proxy rewrites these to Lyra file URLs).
- `GET /files/:id` → streams the temp file as an attachment; eligible for TTL cleanup after.

`MediaItem` is imported from `@lyra/shared` (single source of truth).

## Components (`apps/connectors-service/src/`)

- `download/ytdlp.ts` — spawn wrapper. **Arg array, never a shell string** (no injection).
  `resolveMeta(url)` (`-J`) + `download(url, indices, outDir)`. Per-call **timeout** +
  a **concurrency cap**.
- `download/file-store.ts` — `uuid → { path, createdAt }`; a periodic **TTL sweeper**
  deletes expired files; `get(id)`, `put(path)`.
- `download/download.controller.ts` + `download.service.ts` — the 3 routes; service
  orchestrates `ytdlp` + `file-store` and maps to the contract shapes.
- `auth/service-token.guard.ts` — rejects requests without
  `Authorization: Bearer ${CONNECTORS_SERVICE_TOKEN}`; reads trusted `X-Workspace-Id`/
  `X-User-Id`.
- `common/url.ts` — `assertSafeUrl(url)`: http/https only; **block private/loopback
  hosts** (SSRF guard — yt-dlp fetches arbitrary URLs).
- `main.ts` / `app.module.ts` — bootstrap on `PORT` (9100), global guard + ValidationPipe.

## Two small Lyra-side additions (separate from the service)

1. **Proxy:** add `GET /workspaces/:id/connectors/files/:fileId` — a **binary
   stream-through** to the service's `GET /files/:id` (reuses Lyra's existing run-asset
   download-streaming pattern). The `download` proxy response rewrites the service's
   `fileId` into this Lyra URL. Mock mode: unaffected (mock `download` returns example URLs;
   the files route isn't hit).
2. **Web Import page:** download via Lyra's **authed `downloadFile` helper** (fetch+blob,
   carries the JWT) for proxied file URLs, instead of a bare `<a download>` (which can't
   send the Bearer token). Keep the bare-anchor path only for absolute external URLs (mock).

## Security

- **Token gate** + not browser-exposed (only Lyra, server-to-server).
- **SSRF guard**: validate the URL (http/https; reject private/loopback/metadata hosts).
- **Injection-safe**: spawn yt-dlp with an argv array, never `sh -c`.
- **Limits**: per-download timeout, max concurrent downloads, max file size; temp files
  are uuid-named with TTL cleanup. The service trusts `X-Workspace-Id` only because Lyra
  authenticated + authorized first.

## Deployment

- **Dockerfile:** `node:20-slim` + the **yt-dlp standalone binary** + **ffmpeg** (apt or
  static); build the NestJS app; run `node dist/main.js` on `:9100`.
- The `docker-compose` `connectors-service` block (already scaffolded under the
  `connectors` profile) points here — set `build: ./apps/connectors-service`.
- **Env:** `PORT=9100`, `CONNECTORS_SERVICE_TOKEN` (must match Lyra's), `FILE_TTL`
  (e.g. 15m), `TMP_DIR`.
- Going live in Lyra: set `CONNECTORS_SERVICE_URL=http://localhost:9100` +
  `CONNECTORS_SERVICE_TOKEN` in `apps/api/.env` → the proxy forwards instead of mocking.

## Testing (mock the spawn — no network/yt-dlp in unit tests)

- `ytdlp` mapping: a sample `yt-dlp -J` JSON fixture → expected `MediaItem[]` (single +
  carousel/`entries`).
- Arg-builder: produces a safe argv (no shell metacharacters reach a shell).
- `assertSafeUrl`: accepts https; rejects `http://localhost`, private ranges, non-http.
- `file-store`: put/get; TTL sweep removes expired, keeps fresh.
- `ServiceTokenGuard`: 200 with the right token, 401 without.

## Scope / non-goals (v1)

- **In:** `resolve` + `download` + `files/:id` over yt-dlp; the two Lyra-side additions.
- **Out / later:** the **publish (Postiz) half** (v2 spec); **BullMQ** job queue (download
  is sync in v1; bulk/async later); **Cobalt** fallback; **cookies** for login-walled
  sites; a persisted workspace **media library**.

## Invariants honored

- `@lyra/shared` is the single source of truth for the contract types (`MediaItem`);
  the service imports them, doesn't redefine.
- The proxy/contract are unchanged on the Lyra side except the additive `files/:id`
  stream route; the browser still talks only to Lyra.
- Secrets/tokens server-side only; the service is reachable only by Lyra (token-gated).
- Multi-tenancy: every call carries the Lyra-asserted `workspaceId`.
