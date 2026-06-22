# Multi-platform account/connection model (derived grouping) — design spec

> **Status:** Approved (2026-06-22). **Approach: derived grouping — no data migration, no new collection, no backend change.**
> **Design source:** the new-design Connections + Publish mockups (one *connection* owns multiple platform *accounts*) expressed as a **view over the existing flat `Channel` model**, not a schema change.
> **Branch base:** codex-dev.

## 1. What this is / isn't
- **Is:** a presentation/grouping layer that reframes the existing flat `Channel` list as **Connections → Accounts**, plus an "add another account to an existing GoLogin profile" flow that reuses the current create endpoint. All changes are in `apps/web`.
- **Isn't:** a `Connection`/`Account` Mongo collection, a data migration, a shared-model/DTO/API change, a live connection health probe, or a persisted connection rename. `PublishedPost.channelIds` and `Project.channels: string[]` are untouched.

## 2. The model (derived, nothing persisted)
- **Account** = the existing `Channel` (unchanged): `{ id, type, platform, displayName, profileId?, proxy?, postCount?, lastPostAt?, createdAt? }`.
- **Connection** = a derived grouping of accounts:
  - **GoLogin** (`type='gologin'`): group by `profileId` → one connection per browser profile; its accounts are its per-platform channels.
  - **Postiz** (`type='postiz'`): group all under a single **"Postiz pool"** connection; its accounts are the live-fetched Postiz channels.
- **Connection view shape** (web-only type in `apps/web/src/lib/connections.ts`):
  ```ts
  interface Connection {
    key: string;            // groupBy key: profileId (gologin) | 'postiz' (pool)
    connector: ChannelType; // ChannelType.GoLogin | ChannelType.Postiz
    profileId?: string;     // gologin only
    proxy?: string;         // gologin only (from the first account that has one)
    label: string;          // derived: gologin -> "Browser profile · <id-prefix>"; postiz -> "Postiz pool"
    accounts: Channel[];    // the grouped channels
    postCount: number;      // sum over accounts
    lastPostAt?: string;    // max over accounts
  }
  ```
- **Status** is derived, not probed: Postiz accounts render as *connected* (they came from the live pool); GoLogin renders as *ready*. **ponytail: no live GoLogin health probe — add when a probe endpoint exists.**

## 3. "Add account" / "New connection" flows (reuse existing endpoint)
- The current create flow already accepts `profileId` (`CreateChannelDto { platform, displayName, profileId, proxy? }` → `POST /workspaces/:id/channels` → `ChannelsService.create`). So:
  - **"+ Add account"** on a GoLogin connection: open the existing create-channel form with `profileId` **locked** to that connection; user picks platform + displayName → `POST channels`. The new channel joins the group automatically (same `profileId`). **No backend change.**
  - **"+ New connection"**: the current "add GoLogin channel" path (a fresh `profileId`).
  - **Postiz** connections have no add affordance (the pool is external).

## 4. Consumers to rewire (all `apps/web`, presentation only)
1. **Grouping helper** — `apps/web/src/lib/connections.ts`: pure `groupChannels(channels: Channel[]): Connection[]` (+ a `renderToStaticMarkup`/node smoke test).
2. **Connections page** — render connections → nested account rows (the shipped stat strip + grouped layout stays; swap "group by `type`" for real `groupChannels`, add the "+ Add account" affordance per GoLogin connection).
3. **Publish "Post to"** — the channel multiselect groups options under connection headers; **still emits `channelIds`** (no payload change).
4. **Project Detail** per-project channel picker — same grouped display; **still stores `Project.channels: string[]`** (no change). Per the per-project-channels-model decision: pool at workspace, selection at project — already built; this only restyles the picker.

## 5. Out of scope / non-goals
Mongo migration; a `Connection`/`Account` collection; any `@lyra/shared`, DTO, API, or schema change; persisted connection labels/rename; live health probing; changes to `PublishedPost.channelIds` or `Project.channels` shapes; multi-account on Postiz (pool is external).

## 6. Constraints
- **No backend change**: no api/DTO/Mongo/`@lyra/shared` edits. The `Connection` view type lives in `apps/web` only (keeps shared zero-dep + untouched, invariant 1).
- Workspace-scoped data unchanged (channels already listed per workspace).
- Token-only styling via existing `:root` (Notion design system); reuse shared web primitives; no hardcoded colors. Responsive (group headers + nested rows must not overflow on ~390px — `minmax(0,1fr)`/`min-width:0` per the mobile lesson).
- i18n en + vi for new copy. Web tests via `renderToStaticMarkup` (node env, no RTL/jsdom).
- Deploy: web HMRs (no dist rebuild). Per-task LOCAL commits; explicit `git add <paths>` (never `-A`); **deploy/push HELD for the user**.

## 7. Open decisions for the plan
1. Confirm the current Connections page file + how it currently groups channels (by `type`), and the create-channel form component it uses.
2. Confirm the Publish + Project channel-picker components (so grouping wraps the existing selectors, not a rewrite).
3. Connection label format for GoLogin when `profileId` is long — use a short prefix; flag if a friendlier label is wanted later (no persisted name in scope).
