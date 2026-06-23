# Implementation handoff — 2026-06-23

> Output of a research + design session. This is the **prioritized backlog** for an implementing session.
> Branch: `codex-dev`. Everything below is design/docs — **no feature code written yet.**
> Legend: ✅ committed · 📄 doc written (uncommitted) · 🟡 staged (ready to run) · ⛔ blocked on a decision

## How to use this
Pick an item from **Ready to implement**, top-down. Each lists what, why, the design doc, files to touch,
scope cuts, and invariants. Items under **Blocked** need a human answer first. Build thin slices, verify,
then expand. Respect the invariants at the bottom.

---

## Ready to implement

### 1. Marketplace prompt swap 🟡 (smallest, operational)
Replace the 138 low-quality `prompts.chat` marketplace docs with 18 curated Lyra text prompts.
- **Files:** `data/lyra-marketplace-prompts.json` (the 18), `scripts/swap-marketplace-prompts.cjs` (dry-run passed).
- **Run:** `node scripts/swap-marketplace-prompts.cjs --commit` — backs up first, dev DB only, reversible from `data/prompts_2026-06-19.csv`.
- **After:** eyeball the Marketplace page renders (Lyra uses `{var}`, not `${var}` — chips come from the stored `variables` array). **Do NOT run the admin "Catalog sync"** (re-pulls prompts.chat, would wipe it).

### 2. Seed the prompt library starter kit (Path A) 📄
18 image/video **CC0** templates + a "how to write a prompt" guide, grounded in Google Gemini/Veo + TikTok/Meta best practice.
- **Doc:** `docs/prompt-library-starter-kit.md`.
- **Implement:** seed the 18 as workspace library `Prompt` docs (`type: image|video` — already supported, **no schema change**). Decide delivery: default-on-workspace-create vs a one-off import. The guide section → in-app "How to write a prompt" helper.
- **Note:** these belong in the per-workspace **library**, not the marketplace (marketplace `type` is `text|structured` only — can't hold image/video without a code change we chose to skip).

### 3. Gen-UX upgrades 📄 (from the MJ-proxy research, MIT)
- **Doc:** `docs/superpowers/plans/2026-06-23-gen-ux-upgrades-from-mj-proxy.md`.
- **Upgrade A — async submit→poll job model** for slow gen (video). Reuse the crawler `DownloadJobStore` + the planned BullMQ queue. Files: `step-provider.interface.ts` (async result shape), `run.schema.ts` (`jobId`,`progress`), `run.engine.ts` (Running+progress), `runs.service.ts` (sync vs async dispatch), a poll worker, `video.provider.ts`, web `RunFlow.tsx` (progress bar). Scope: **slow providers only**.
- **Upgrade B — action-based image editing** (Upscale / Variation / Outpaint on a result asset). Extend `gemini-image.provider.ts` with an `operation`, reuse `image-inputs.ts`, add a result action bar + a "create follow-up step from action" hook in `useRunActions.ts`. Scope: **no mask editor** (defer inpaint/partial-redraw).
- **Order:** A (video async) first, then B.

### 4. Storyboard artifact for the video pipeline 📄 (from the Pixelle research, Apache-2.0)
- **Doc:** `docs/lyra-video-assembly.md` §5b.
- Define `Storyboard` / `StoryboardFrame` in `@lyra/shared` (typed, schema-valid). The LLM step emits a Storyboard; per-frame visual gen writes back `frame.assetId`; HyperFrames renders from it via brand templates. **This is the data model behind #3** (per-frame addressability for async gen + action editing).

### 5. Product-research v1 (research → creative loop) ✅ spec committed (`1e3a2b8e`)
- **Spec:** `docs/specs/2026-06-22-lyra-v3-research-creative-loop.md` (§1C.1 is the **v1 thin slice**).
- **Build order (spec §6):** (a) Product entity + `EvidenceClaim`/`SourceRow` types + money-math/scoring/grading/decision **pure functions in `@lyra/shared`** (with Vitest) → (b) grounded **web-research provider** (search→fetch→reflect on top of `crawl` — the biggest, riskiest build; grounding is make-or-break) → (c) v1 pipeline template (steps 1,2,3,5,6,7,10,13,14,15) surfaced as the **4-phase user view** → (d) monitor trim → (e) creative loop.
- **Decision-support, not an oracle:** all math/scoring in code; the LLM only grounds + extracts; every claim cites a fetched source. No fake numbers.
- ⚠️ **Blocked sub-item:** the Product **entity shape** — see decision A.

### 6. Assistant memory layer (memanto-inspired) 📄
Make Lyra remember what the user is doing across sessions, and feed it to the assistant, prompt gen, research loop, and run defaults. Steals memanto's design (remember/recall/answer, typed memory, recency, provenance, conflict-versioning) — built on Mongo, **no Moorcheh, no new service**.
- **Doc:** `docs/superpowers/plans/2026-06-23-assistant-memory-layer.md`.
- **Phase 0 (ready, no new system):** feed the assistant the user's current structured state (active Project/Product, recent Runs + decisions, last Conversation). Covers most of "don't forget."
- **Phase 1:** typed `Memory` collection (workspace-scoped, 6 kinds) + `remember`/`recall` (recency+keyword, **non-LLM**) + conflict-versioning; wire into the assistant. Module `apps/api/src/memory`; `scoreMemory` pure fn in `@lyra/shared`.
- **Phase 2 (only if needed):** `answer` (LLM-grounded, BYO key) + MongoDB Atlas vector recall.
- **Rule:** `recall` is non-LLM (no key spend); only `answer` uses the workspace key.
- **Token-saving is an explicit design goal** — cross-session no-re-explain · derive-once-strong→reuse-cheap (multi-model) · run-engine recall-vs-append-all · budgeted top-N recall. The plan now has a **Token-economics section + Phase-1 build steps + DoD** — build-ready.

---

## Blocked — needs a decision first

### A. Product entity shape ⛔ (gates #5 and the Products module)
**Project-owned** (the spec's leaner model: `projectId` on Product) **vs workspace-pool many-to-many with per-project copies** (the Products-module discussion: lean fields `title/images/category/price/compareAtPrice/offer/source`, copy-on-select + frozen + opt-in refresh + drift badge, Crawler-based AliExpress/Amazon import).
**Recommendation:** project-owned (leaner; drop the copies/drift machinery unless "sell the same product across multiple brands" is a real workflow). Decide before building the Product entity.

### B. Self-review feature ⛔ (no spec written yet)
**Decided:** image-first generic reviewer; **soft-gate** on fail (a failed review forces the existing `AwaitingGate` — reuses gate machinery, no new run state); always-review + gate-on-by-default with a **per-step off switch**; inspection via a new **`/review` endpoint on the render-service (:9200)**.
**Next:** write a spec (brainstorming → writing-plans) before implementing.

---

## Invariants (bind all work)
Swapping a model = one-line registry change (inv. 9) · BYO per-workspace **encrypted** keys, no metering (inv. 7) · workspace-scoped queries (inv. 5) · `@lyra/shared` **zero runtime deps** (inv. 1) · DTOs = class-validator classes that `implements` shared interfaces (inv. 2) · server-only fields never leave the api (inv. 3) · soft-delete + audited collections · TypeScript strict.

## Files produced this session
- `docs/specs/2026-06-22-lyra-v3-research-creative-loop.md` — committed (`1e3a2b8e`), §1C revised (4-phase view + trimmed recipe + v1/v2).
- `docs/prompt-library-starter-kit.md` — guide + 18 image/video CC0 templates.
- `docs/superpowers/plans/2026-06-23-gen-ux-upgrades-from-mj-proxy.md` — gen-UX plan.
- `docs/superpowers/plans/2026-06-23-assistant-memory-layer.md` — memory layer plan.
- `docs/lyra-video-assembly.md` — §5b Storyboard added.
- `data/lyra-marketplace-prompts.json` + `scripts/swap-marketplace-prompts.cjs` — the marketplace swap.
- `docs/2026-06-23-implementation-handoff.md` — this file.
