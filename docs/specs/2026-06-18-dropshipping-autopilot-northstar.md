---
id: dropshipping-autopilot-northstar
title: Dropshipping autopilot — north-star architecture & roadmap
status: draft
kind: northstar                 # umbrella vision; child specs are the buildable units
owner: Claude (design/BA/QA)
created: 2026-06-18
---

# Dropshipping autopilot — north-star architecture & roadmap

> This is the **umbrella vision** for where Lyra is going (business model "B"):
> own the whole dropshipping funnel. It is NOT a single buildable task — it
> decomposes into the child specs listed under "Roadmap." Each child spec is the
> real source of truth for its slice. Read this for the shape; read the child
> spec for what to build.

## North star
Lyra is the **dropshipping autopilot**: from a winning product to a live store to
on-brand creative to published posts — driven by composable, prompt-first
pipelines a team can run and gate. The user's words: *"find winning product →
make store theme → branding image → UGC post → send post to many channels."*

Lyra stays a **prompt builder at heart** — the generation steps are the core —
with data-in (crawl) and content-out (publish) wrapped around it as connectors.

## The unifying model: one pipeline, three step categories
A Pipeline remains an ordered chain of **Steps** (linear today; branching is on
the roadmap). What changes: a Step now declares a **category**.

- **Source** — bring data in. Crawl trends/marketplaces, find winning products,
  import competitor/reference images. Emits data and **collections** (e.g. a list
  of product candidates, or 10 image refs).
- **Generate** — prompt → provider·model → content (text / image / video). Runs
  once, or **fans out** over a collection (one resolved prompt per item, in
  parallel). *This is today's Step, generalized — the heart of the product.* Note:
  some Generate outputs are **strategy/business** decisions (the offer, the gift,
  pricing), not just creative — AI drafts, a human approves.
- **Action** — push out / side effects. Build the Shopify store + theme, create
  products, **publish posts to channels**, schedule sends. Emits external state +
  **receipts** (URLs, post ids).

### Control primitives (cut across all categories)
- **Collections / lists** as first-class data flowing between steps (10 images as
  a set). Today `Run`/variables only carry strings — this is a model addition.
- **Fan-out / map** — run a step per item in a collection, concurrently, with a
  concurrency cap + partial-failure policy. Executed on the job queue.
- **Branching / conditions** — route on data ("many cases" — e.g. product type →
  different video template). Deferred today ("no branching/DAG").
- **Triggers / schedule** — start a pipeline on an event or schedule (daily "find
  a winner"; "abandoned-checkout"-style automations). None today.
- **Composition** — a pipeline can **seed/launch other pipelines**: one chosen
  product fans out into separate theme / offer / image / UGC / gift flows. The
  unit of reuse is the pipeline, not just the step. None today.
- **Feedback loops** — re-run / iterate driven by **results** (ad metrics,
  engagement) rather than a fixed sequence: kill losers, scale winners, generate
  more variants of what worked. This is what makes "autopilot" real, and the
  linear model lacks it entirely.
- **Gates** — human approve/reject at any step. ✅ already in the run engine.

### Two kinds of connectors (the big new subsystem)
- **Model providers** — OpenAI / Anthropic / DeepSeek / Image / Video, behind the
  existing `StepProvider` interface (`apps/api/src/runs/providers`). Power
  **Generate**. BYOK = encrypted API keys per workspace (have this).
- **Integration connectors** — Shopify, TikTok, Instagram, Facebook, crawlers.
  Power **Source** and **Action**. These need **per-workspace OAuth tokens**, not
  just API keys — an extension of the keys subsystem (encrypted token storage +
  refresh). This OAuth layer is the single biggest lift that makes "B" much
  heavier than a generation-only product.
- **Ads platforms** (Meta / TikTok Ads) are a distinct, **money-sensitive**
  connector class: AI makes the creative + copy, but spend, audiences, and
  scaling are real budget decisions. Always behind a **hard human gate** — never
  autonomous.

## The funnel as five stage-pipelines
1. **Discover** — Source (crawl) → Generate (rank candidates) → Gate (pick winner)
2. **Store** — Action (Shopify: create theme + product) + Generate (copy)
3. **Brand** — Source (import N imgs) → **fan-out** Generate (brand each) → Gate
4. **UGC** — Generate (script, **branch** by product type) → Generate video → Gate
5. **Distribute** — **fan-out** Action (publish to N channels, scheduled)

These ship as packaged **starter templates** once the primitives exist.

## What exists today vs. the gaps
- ✅ Linear pipeline + run state machine + gates; `StepProvider` registry;
  per-workspace encrypted **API keys**; project **variables** (string key→value);
  shared **`Asset`** model (`id, runId, workspaceId, stepIndex, type, url,
  thumbUrl, meta, approved`) and `Step.assetIds[]` — already reserved for media.
- ❌ Real image/video generation (Image/Video are `MockStepProvider`).
- ❌ Multi-output from a step (`StepRunOutput` returns one `result`, no assets).
- ❌ Collections / lists as data; fan-out/map; branching; triggers/scheduler.
- ❌ Asset storage (R2/S3) and the job queue (BullMQ/Redis) — both *planned*
  (hosting doc §7–8) but not built.
- ❌ Integration connectors (Shopify/social) + OAuth token storage.

## Honest framing: AI-accelerated, human-gated — not autonomous
Two truths so we build the realistic product, not a demo:
- **"Using AI" is the creative + reasoning engine, inside a system whose value is
  the data and connectors.** "Find a winning product" is only as good as the
  trend / marketplace / ad-library data we feed it; "post to channels" / "make
  ads" live on the channel + ads connectors. Prompts don't make those work.
- **Humans stay on the money/brand decisions.** Pick-the-product, approve-the-offer,
  and especially approve-ad-spend stay gated. Fire-and-forget ad buying is burning
  money unsupervised. The product is AI that does ~90% of the work and pauses for
  the few decisions that matter.

## Feasibility audit — the full workflow mapped
Each item the owner described, mapped to the model. **Status:** ✅ works with the
current model (+ Brand-stage spine) · ◑ needs a new primitive · ❌ needs an
integration/connector build.

| # | Workflow item | Shape in the model | New primitive(s) | Connector / data | Human gate |
|---|---|---|---|---|---|
| 1 | Find winning product | Source pipeline + research **loop** | ◑ Source step · collections · loop | ❌ trend / marketplace / ad-library feeds | ✋ pick the winner |
| 2 | Store theme | **Action** + Generate (copy) | ◑ Action step | ❌ Shopify (OAuth) | ✋ approve store |
| 3 | Offer | Generate (**strategy** text) | ✅ Generate | — | ✋ approve offer ($) |
| 4 | Branding images | **Fan-out** Generate (image) | ◑ fan-out · collections · multi-asset · queue | ❌ image provider (BYOK) · R2 | ✋ approve set |
| 5 | UGC | Generate (video), **branch** by product type | ◑ video step · branching | ❌ video provider | ✋ approve |
| 6 | Gift / lead magnet | Generate (asset/offer) + Action (attach) | ◑ Action | ❌ Shopify / email | ✋ approve |
| 7 | Channels (organic, ongoing) | **Campaign** (scheduled, **looping**) | ◑ triggers · campaign · feedback loop | ❌ TikTok / IG / FB / YouTube (OAuth) | ✋ approve cadence |
| 8 | Per-channel video/image | Fan-out Generate over channels · **composition** | ◑ composition · fan-out | reuses providers | ✋ approve |
| 9 | Make ads | Generate variants (fan-out) + **Ads campaign** w/ feedback | ◑ ads subsystem · feedback loop · budget | ❌ Meta / TikTok Ads (OAuth + $) | ✋✋ hard gate on spend |

**Reading it:**
- **✅ already our wheelhouse:** the pure Generate steps (offer copy, captions) —
  and *all* the creative once Brand-stage lands the fan-out / asset / queue spine.
- **◑ new primitives** (engine work, rough order): fan-out *(sub-project #1)*,
  branching, composition, campaigns + triggers + feedback loops, the ads subsystem.
- **❌ integration builds** (the heavy, defensible part): research data feeds,
  Shopify, channel connectors, ads platforms — all behind per-workspace OAuth.

**Takeaway:** every item *fits the model* — nothing is impossible — but the right
unit is **many composable pipelines + a campaign/feedback layer**, not one
pipeline, and the real cost and moat live in the ❌ integration column, not the
prompts.

## Roadmap (dependency-ordered child specs)
1. **Brand stage — image gen + fan-out** *(first; spec drafted:
   `2026-06-18-brand-stage-image-fanout.md`)* — real image provider, asset store
   (R2), job queue (BullMQ), collections + fan-out + multi-asset step output. The
   concrete outcome (an **arbitrary-N** branded image set, in parallel — not a
   fixed count) de-risks the hardest new engine pieces; everything below reuses them.
2. **UGC video (single case)** — real video provider; assemble script→scenes→clip.
3. **Branching / conditions** — the "many cases" primitive. *Guard/skip form
   complete* (a step carries a `condition`; it's skipped when the guard fails —
   linear, no DAG; engine + `evalCondition` + e2e + **builder condition editor**).
   Full True/False **routing** (a real DAG) is the larger follow-on.
4. **Composition** — pipelines that seed/launch other pipelines (one product →
   separate theme / offer / image / UGC / gift flows). *v1 landed*: a project
   **"Run all"** (`POST /projects/:id/runs/all` + button) launches every assigned
   pipeline at once in the project's context, each its own run + e2e. Richer forms
   (named campaigns, per-pipeline inputs, dependencies, nested-step composition)
   are the follow-on.
5. **Source / crawl + research data feeds** — Discover stage (find winning
   product); AI ranks over real data, so the feeds are the work.
6. **Action / Shopify + channel connectors + OAuth** — Store + Distribute stages
   (build store/theme; publish to N channels). The integration-heavy payoff.
7. **Campaigns + triggers/scheduler + feedback loops** — the ongoing organic
   engine (scheduled posting, iterate on performance).
8. **Ads subsystem** — ad-platform connectors (Meta/TikTok) + budget + performance,
   behind a hard spend gate. Money-sensitive; last and most carefully gated.
9. **Dropshipping starter templates** — package the stages as one-click pipelines.

## Invariants to preserve across all of B (`/CLAUDE.md`)
- `@lyra/shared` stays zero-runtime-dep (types/enums/pure helpers only).
- Server-only secrets (API keys, **OAuth tokens**) never leave the api; encrypted
  at rest (AES-256-GCM). Connectors resolve them server-side, like providers do.
- Multi-tenancy: everything scoped by `workspaceId`; access via the shared helpers.
- Swapping a model/connector stays a registry one-liner (don't hard-code calls).
- Soft-delete (`active`) + audit envelope on every new collection.

## Status log
- 2026-06-18 — Claude — folded in 4 refinements (composition, feedback loops,
  offer/gift as strategy, ads subsystem) + added the honest-framing and
  feasibility-audit sections; expanded the roadmap to 9 child specs (status: draft).
- 2026-06-18 — Claude — north-star drafted after the A/B decision (B chosen);
  first slice = Brand stage (status: draft, awaiting review).
