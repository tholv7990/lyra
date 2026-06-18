# Built-in Connectors — Frontend Design (Lyra web)

> Status: **design approved (visual brainstorm), 2026-06-18.** Companion mockups live
> in `.superpowers/brainstorm/834-1781785093/content/` (`nav-placement`, `connections`,
> `publish-composer`, `import-media-v2`).
> Pairs with the backend
> [2026-06-18-builtin-connectors-backend-architecture.md](2026-06-18-builtin-connectors-backend-architecture.md)
> and the proxy/contract in
> [2026-06-18-builtin-connectors-ui-proxy-design.md](2026-06-18-builtin-connectors-ui-proxy-design.md).
> Held at the spec gate — no implementation until the user says build.

## Overview

Three **standalone built-in tools** in the Lyra web app, all calling Lyra's api at
`/workspaces/:id/connectors/*` (the thin, JWT-guarded proxy → connectors microservice;
**mock-gated** so the UI works before the microservice exists). Light/Linear style,
honoring the design tokens (orange `#FF6B1A` accent, scarce; 14px-ish card radii; dark
mode via tokens).

## Navigation / IA — approved: a dedicated "Built-ins" group

A new left-nav section **Built-ins** containing **Publish**, **Import media**, and
**Connections** (chosen over scattering them or burying under Settings — most
discoverable, signals a coherent suite). Touches only the nav/layout component.

## Screen 1 — Connections

Two sections (mockup: `connections.html`):
- **Publishing** — a masked **Postiz API key** field (Update), and **connected channels**
  as cards (platform icon + name, removable), plus a **"Connect a channel"** button that
  opens the Postiz instance to authorize. Header badge shows Postiz connected/mock.
- **Media import** — **Cobalt** shown as an infra-level "connected" status (no per-account
  login; just a note pointing to the Import tool).

| UI action | api call |
|---|---|
| Save/Update Postiz key | `PUT /workspaces/:id/connectors/credentials { connector:'postiz', apiKey }` |
| Connect a channel | open `GET /workspaces/:id/connectors/connect-link?connector=postiz` → `{ url }` in a new tab |
| List connected channels | `GET /workspaces/:id/connectors/channels` |
| Remove a channel | `DELETE /workspaces/:id/connectors/channels/:channelId` *(add to contract)* |

Linking actions gated by `canManageKeys` (server-side, in the proxy).

## Screen 2 — Publish composer (the core interaction)

Single-column composer (mockup: `publish-composer.html`):
- **Post to** — channel **multi-select chips** (connected channels; orange when on).
- **Caption** textarea + character count.
- **Media** — thumbnails (from Import or upload) + an add tile.
- Footer: a **🔒 "review before posting"** gate note + **Publish to N channels** button —
  the click *is* the gate (standalone; no run engine).
- **Results** panel — after Publish, per-channel **receipts** stream in: ✓ Posted + "View
  post ↗" link, or ✗ Failed + reason/retry. **Partial failure is shown, not fatal.**

| UI action | api call |
|---|---|
| Load channels | `GET /workspaces/:id/connectors/channels` |
| Publish | `POST /workspaces/:id/connectors/publish { channelIds[], caption, mediaUrls[] }` → `{ jobId, status:'queued' }` |
| Stream receipts | **poll** `GET /workspaces/:id/connectors/jobs/:jobId` until `status:'done'|'failed'` → `{ receipts }` |

(Async per the backend doc — publish runs as a job; the UI polls. SSE is a later upgrade.)

## Screen 3 — Import media

(Mockup: `import-media-v2.html`, taller portrait-friendly tiles ~168px):
- **URL input** + **Fetch**; a supported-platforms hint.
- **Resolved preview grid** — every item (carousels show all photos + any video), each
  tile labeled VIDEO/IMG with an individual **↓**.
- **Download all (.zip)** + a small **rights/ToS notice** beside the action.

| UI action | api call |
|---|---|
| Fetch / preview a URL | `POST /workspaces/:id/connectors/resolve { url }` → `{ items: MediaItem[] }` |
| Download item(s) / zip | `POST /workspaces/:id/connectors/download { url, indices? }` → `{ items: { url, filename }[] }` (browser downloads) |

## Components & conventions

- **New pages:** `apps/web/src/pages/{Connections,PublishComposer,ImportMedia}.tsx` + a
  **Built-ins** nav group entry (the only edit to the existing layout/nav file).
- **New components:** `ChannelChips`/`ChannelCard`, `ReceiptList`, `MediaResolveGrid`.
- **Reuse:** the `api` fetch wrapper (JWT + base origin), `ProviderIcon` (extend with
  social-platform icons), card/list treatment, gate/badge styles, dark-mode tokens.
- **i18n:** new `connectors` locale namespace (EN + VI).
- **Collision:** all three are **new files** → low overlap with Codex's prompt/project UI;
  only the nav/layout addition is a shared touch (small, coordinate).

## Scope / non-goals (v1)
- **Standalone tools only** (no pipeline-step wiring — that's the run engine + microservice, deferred).
- **Mock-backed** until `CONNECTORS_SERVICE_URL` is set; no persisted media library (downloads go to the device); no scheduling/analytics.
- Live previews per platform in the composer are deferred (caption + receipts only in v1).

## Invariants honored
- All data flows through the `api` wrapper (JWT in memory; never `localStorage`); only
  light inline form checks client-side — the api/proxy + microservice are the source of truth.
- No business logic in components; DTO/model types imported from `@lyra/shared`.
- Secrets (Postiz key) never rendered in full; only masked + status.
