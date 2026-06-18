# Built-in Publish Connectors (Module A) — Design

> Status: **design approved (brainstorm), 2026-06-18.** Backend-agnostic abstraction
> only — the concrete channel-connection backend (hosted unified API / self-hosted
> OSS / direct) is **deferred** (see §5). Implements the **Action** slice of the
> north-star connector roadmap ([docs/specs/2026-06-18-dropshipping-autopilot-northstar.md](../../specs/2026-06-18-dropshipping-autopilot-northstar.md), roadmap item 6).
> **Held at the spec gate** — no implementation until the user says build.

## Goal

Let a pipeline **publish generated content to social channels** (YouTube / Facebook /
TikTok / Instagram …) as a step — without committing to *how* we connect to each
channel. Ship a complete, testable publish flow now on a **Mock connector**; plug a
real backend in later as a one-line registry entry.

## Guiding decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Build vs buy | **Don't build per-platform.** Posting is a *feature*, not Lyra's core ⇒ abstract behind a registry; back it with a unified provider later. |
| Backend now | **Decide later.** v1 ships a **Mock connector**; real backend deferred (§5). |
| v1 action scope | **Publish-to-channel only** (not the full Source/Generate/Action category system). |
| Approval | **Publish steps are always gated** (cannot be `auto`) — external, irreversible effect. |
| Multi-channel | **One publish step targets a set of linked accounts** (connector fans out, partial-failure tolerant) — not the generic fan-out primitive. |
| Account linking | Gated by **`canManageKeys`** (same as provider keys). |

## Why "abstract, don't build" (research, 2026-06-18)

- Social posting is **infrastructure for Lyra, not the core product** ⇒ the build-vs-buy
  consensus favors a **unified API**. DIY ≈ **6–12 months** + **$20–32K/yr** for 3
  platforms + perpetual maintenance; unified API ≈ **days** + **$1.6–5.6K/yr**.
- **The real blocker is per-platform app review**, not code: TikTok **2–6 weeks** (+
  sandbox audit + demo video), Meta/Instagram **1–4 weeks per round**
  (`instagram_content_publish`, `pages_manage_posts`), YouTube quota units, LinkedIn
  needs MDP partner approval, X is pay-per-use + BYO OAuth. A **hosted** unified provider
  that already holds these approvals removes that lead time; self-host/direct does not.
- **Integration shape** every backend follows: *generate connect URL → user authorizes →
  receive an account handle/profileKey → post via one call scoped by that key.* The
  abstraction below mirrors exactly this.

Sources: [build-vs-buy](https://bundle.social/blog/social-media-api-startups-build-vs-buy),
[unified API guide](https://zernio.com/blog/unified-social-media-api),
[TikTok posting API](https://zernio.com/blog/tiktok-posting-api),
[Instagram API](https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy),
[platform guide](https://www.blotato.com/blog/social-media-api),
[Ayrshare multi-user linking](https://www.ayrshare.com/implementing-multi-user-social-account-linking-with-ayrshare/),
[Postiz (OSS)](https://github.com/gitroomhq/postiz-app),
[AGPL-3.0](https://fossa.com/blog/open-source-software-licenses-101-agpl-license/).

---

## 1. Requirements

**Functional**
1. **Connect accounts** — a workspace links external channel accounts via a
   connector-driven flow (connect-URL → authorize → store handle + encrypted
   credential) and can list/remove them. Linking gated by `canManageKeys`.
2. **Publish as a step** — a pipeline step can be an **Action: Publish** that takes
   upstream content (caption text + media assets from a prior Generate step) and posts
   to one or more linked accounts.
3. **Multi-channel in one step** — a publish step targets a **set** of accounts; posts
   to each with **partial-failure tolerance** (one fails → others still post); records
   per-channel outcome.
4. **Receipts** — each post stores a receipt `{platform, accountId, url, postId, status,
   error?}` on the run step, shown in the run view + step-details.
5. **Swappable backend** — all posting goes through a `PublishConnector` interface +
   registry; v1 ships a **Mock connector** so the whole flow runs/tests with no vendor.

**Non-functional / guardrails**
6. **Always human-gated** — a Publish step is forced to `gate`; the engine refuses to
   auto-run an action step.
7. **Secrets server-side, encrypted** — connector credentials + account tokens stored
   AES-256-GCM per-workspace (reuse the encryption service); never returned in full.
8. **Idempotency** — approving/running a publish step posts **once**; re-runs don't
   double-post (per-step "published" marker keyed by account).
9. **Multi-tenancy** — connected accounts, credentials, and receipts are all
   `workspaceId`-scoped; access via the shared helpers.

## 2. Architecture

- **Step `category`** — add `category: 'generate' | 'action'` to the step model
  (`PipelineStep` + `RunStep`), defaulting to `generate` (no migration pain). An action
  step carries `action: { connector: string; accountIds: string[]; caption?: string }`,
  where `caption` is a template (placeholders `{input}`/`{step:Name}`/vars) that
  **defaults to `{input}`** = the immediately-preceding step's text output. This is the
  minimal slice of the north-star's Source/Generate/Action.
- **`PublishConnector` interface** (mirrors `StepProvider`):
  - `linkUrl(ctx) → { connectUrl }` — start account linking.
  - `listAccounts(cred) → ConnectedAccount[]` — accounts reachable with a credential.
  - `publish({ text, assets, account }) → Receipt` — post once to one account.
  A **`ConnectorRegistry`** dispatches by connector id (swap = one line, invariant 9).
  **`MockPublishConnector`** is the v1 impl (logs, returns fake receipts) — like
  `MockStepProvider`.
- **`ConnectedAccount`** — new collection, workspace-scoped, audited, soft-deleted:
  `{ id, workspaceId, connector, platform, displayName, externalId, credentialRef }`.
  The encrypted credential lives in the keys store; the row holds only safe display
  fields + a ref. Safe transport shape never carries the credential.
- **Run-engine wiring** — `executeStep` branches on `step.category`:
  - `action` → resolve connector + decrypted credential + target accounts → call
    `publish` per account (capped concurrency + partial-failure, reusing the fan-out
    pool helper) → collect receipts. Content = the resolved **`caption`** template (text)
    + the **immediately-preceding step's `assetIds`** (media); a referenced-step media
    source is deferred.
  - else → the existing provider path (unchanged).
- **Receipts** — `RunStep.receipts: Receipt[]`, rendered in the run view +
  `StepResultModal`.
- **Gate** — the builder marks Publish steps as gate (locked, non-overridable in v1);
  the engine asserts an action step is gated before running.

## 3. Contracts (shared)

Interfaces in `@lyra/shared` (api implements class-validator DTO classes that
`implements` them):
- `enum StepCategory { Generate='generate', Action='action' }`
- `ConnectedAccount` (safe transport shape — no credential)
- `Receipt { platform, accountId, url?, postId?, status: 'ok'|'failed', error? }`
- `PublishConnector` types; `PublishStepConfig { connector, accountIds, caption? }`;
  `StartLinkDto`; connected-account DTOs.

## 4. Testing (no real posting)

- Registry dispatch resolves a connector by id.
- Engine runs an action step via the Mock connector → receipts recorded on the step.
- Partial failure: 1 of N accounts fails → step completes with mixed receipts (not an
  all-or-nothing error).
- Idempotent re-run: a step already published to an account does not re-post it.
- A Publish step set to `auto` is rejected (must be `gate`).
- `canManageKeys` gates account linking; non-privileged member → 403.

## 5. Deferred decision — the connection backend (choose later)

The `PublishConnector` registry makes this a swap-in choice. The researched menu:

| Option | Pros | Cons |
|---|---|---|
| **Hosted unified API** (Ayrshare / Post for Me / bundle.social) | Ships in days; **they own OAuth + app review** (skip weeks–months); per-platform quirks hidden | 3rd-party dependency; **cost scales per connected profile** (~$770/mo at 50 profiles); some BYO creds (X) |
| **Self-host Postiz (OSS)** | 30+ platforms; same stack (NestJS); public API; no per-profile fee | **You still register + get app-reviewed per platform**; you operate it; **AGPL-3.0** — run **unmodified, as a separate service behind its API** (don't modify-and-embed) |
| **Direct platform APIs** | Full control; free APIs | 6–12 mo + app review per platform + perpetual maintenance — only if posting becomes core |

The abstraction is designed so picking any of these is a registry implementation, not a
redesign. The Mock connector keeps v1 fully functional until then.

## 6. Non-goals (v1)

Any specific real backend (Mock only); Source/Shopify actions (publish-only);
scheduling/triggers; analytics/engagement read-back; ad spend (separate hard-gated
subsystem); a connect-flow UI polish pass beyond a basic "Connect account" screen.

## 7. Invariants honored

Validation in api / types in shared (zero-dep); credentials are server-only, encrypted,
never returned (like provider keys); everything `workspaceId`-scoped; publishing stays
human-gated (north-star money/brand invariant); swapping a connector is a registry
one-liner; soft-delete + audit on the new collection.
