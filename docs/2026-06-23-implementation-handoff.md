# Implementation handoff — 2026-06-23 (AUDITED & CORRECTED)

> **Updated after a live audit of `codex-dev`** (code + git log + DB). Several items the first draft listed
> as "to build" are **already done** — built by the concurrent June-23 Codex session and/or run since.
> This version is reoriented around **what is NOT finished.**
> **Re-verify before building** — a Codex agent shares this tree; state changes. (See the audit method at the bottom.)
> Legend: ⛔ not built · ⚠️ built but unproven/partial · ✅ done (do not rebuild)

## Verified status

| # | Item | Status |
|---|------|--------|
| 1 | Marketplace prompt swap | ✅ done |
| 2 | Starter-kit prompts → workspace library | ✅ done |
| 3B | Image action editing (Upscale/Variation/Outpaint) | ✅ done |
| 5 | Product-research v1 spine | ⚠️ built + unit-tested — **never run against live Tavily** |
| A | Product entity shape | ✅ resolved → **project-owned** |
| 3A | Async video job model (submit→poll) | ⛔ not built |
| 4 | Storyboard artifact | ⛔ not built |
| 6 | Assistant memory layer | ⛔ not built (plan only) |
| B | Self-review / post-render asset QA | ⛔ no spec |

---

## NOT finished — the real backlog (build these, in priority order)

### P1 — Prove item 5: live Tavily smoke ⚠️ (highest value — it's built but unproven)
The "Product research" pipeline is built + unit-tested but **has never run against real Tavily** — "the
make-or-break grounding proof" (per the June-23 SESSION-HANDOFF).
- Add a **Tavily key + an AI key** to a workspace (Settings) → run the seeded **"Product research"** pipeline
  against a task → approve the save-gate → confirm a **real graded Product** with grounded evidence, live
  `SourceRow`s, `accessDate` stamps, and the dead-link sweep working.
- Fix whatever the first real run breaks. This is the gate before any more research depth.

### P2 — Research depth + 4-phase UI (deferred from item 5)
- **§1C.1 fidelity:** add `resolve-inputs`, richer `demand-gate`, `competition` (fan-out), `ground&dedupe`,
  `runScenarios`; `Run.productId?` / `Task.productId?` / `PublishedPost.productId?` + monitor `productId` back-refs.
- **3c-2 UI:** group the run's steps into the **4-phase view** (Find · Validate · Economics · Decide) in
  `RunFlow` + a tailored research-run form. Spec: `docs/specs/2026-06-22-lyra-v3-research-creative-loop.md` (§1C.1).

### P3 — Storyboard artifact ⛔ (#4)
Define `Storyboard` / `StoryboardFrame` in `@lyra/shared` (typed, schema-valid). LLM step emits a Storyboard;
per-frame visual gen writes back `frame.assetId`; HyperFrames renders from it via brand templates. It's the
**data model behind async video gen (P4)**. Doc: `docs/lyra-video-assembly.md` §5b.

### P4 — Async video job model ⛔ (#3A; image-action Upgrade B is already done)
Submit→poll for slow generation (video). Provider returns a `jobId`; a **BullMQ worker** polls + writes
`step.progress`; `completeStep` on done. Files: `step-provider.interface.ts` (async result shape),
`run.schema.ts` (`jobId`/`progress`), `runs.service.ts` (sync vs async dispatch), poll worker,
`video.provider.ts`, web `RunFlow.tsx`. Reuse the crawler `DownloadJobStore`. Scope: **slow providers only**.
Doc: `docs/superpowers/plans/2026-06-23-gen-ux-upgrades-from-mj-proxy.md` (Upgrade A).

### P5 — Assistant memory layer ⛔ (#6)
Build-ready plan with **token-saving as an explicit goal**: `docs/superpowers/plans/2026-06-23-assistant-memory-layer.md`.
Phase 0 (feed current structured state — no new system) → Phase 1 (typed `Memory` collection + `remember`/`recall`,
**non-LLM**, conflict-versioning; module `apps/api/src/memory`; `scoreMemory` pure fn in shared) → Phase 2
(`answer` + Atlas vector, only if needed). Rule: `recall` spends no key; only `answer` does.

### P6 — Self-review / post-render asset QA ⛔ (Decision B)
Designed, no spec: image-first reviewer; **soft-gate** on fail (a failed review forces the existing
`AwaitingGate` — no new run state); always-review + gate-on-by-default with a per-step off switch; inspection
via a new `/review` endpoint on the render-service (:9200). Write a spec (brainstorming → writing-plans) first.

### P7 — Robust fetch backend (products-import) ⛔
The naive `crawl` fetch is **blocked on Amazon/Walmart/AliExpress** (empirically tested — IP-reputation + captcha, UA-independent). **Tavily** (research) and the **yt-dlp crawler** (TikTok/FB/YT) are fine — the gap is only the **products-import** marketplace fetch.
- **Doc:** `docs/superpowers/plans/2026-06-23-robust-fetch-backend.md`.
- **Decision:** a swappable `FetchBackend` — `direct → Firecrawl (DEFAULT) → Apify (FALLBACK) → manual entry`. Both **BYO-key (Lyra pays $0)**; Firecrawl's 1,000 free pages/mo covers low, human-reviewed volume.
- **Build:** extend the connectors-service; cache results; **never hard-fail an import** (degrade to manual). Don't self-host a scraper (won't beat the IP/captcha wall) and don't add ScrapFly/Oxylabs (pricier; Firecrawl+Apify cover it).

---

## Already done — DO NOT rebuild (audit evidence)

- **#1 marketplace swap** — `lyra.marketplaceprompts` = **18 `source:'Lyra'`, 0 `prompts.chat'`**. Script + data: `scripts/swap-marketplace-prompts.cjs`, `data/lyra-marketplace-prompts.json`.
- **#2 starter kit → library** — `lyra.prompts` holds the exact 18 titles (12 image + 6 video): "White-background catalog hero" … "Ad: why I switched". Source: `docs/prompt-library-starter-kit.md`.
- **#3B image action editing** — `ImageOp` enum + presets + `Step.inputAssetIds` + `ImageActionDto` (`726bc5f0`); `POST runs/:id/actions/image` (`c823651a`); web Upscale/Variation/Outpaint bar (`2cb1f9c7`).
- **#5 product-research spine** — `apps/api/src/products` (project-owned), `@lyra/shared` `research.ts` (`EvidenceClaim`/`SourceRow`/`UnitEcon`/`weightedScore`/`gradeConfidence`/`decide`/`WEIGHTS`), `ResearchStepProvider` + Tavily, evidence ledger (`assembleLedger`/`RunLedger`), `seed-research` pipeline, Products board + evidence-ledger modal UI. Commits `5990ddd1` `7bf71cf4` `47f816d7` `02520fe2` `d4d5a46a`.
- **Decision A** — Product is **project-owned** (`projectId`, peer of `Task`); the workspace-pool/copy/drift model was **not** built.

---

## Deploy / verify (from the June-23 SESSION-HANDOFF — read it for full detail)
- **Deploy** = ff `codex-dev` ← feature branch → for **shared/api** changes `pnpm --filter @lyra/shared build && --filter @lyra/api build` + `pm2 restart lyra-api` + **boot-verify** ("Nest application successfully started") → `git push origin codex-dev:dev` (live = `origin/dev`). Web-only → vite HMR, no restart.
- **Never `git add -A`** (shared tree — a Codex agent works here too); stage explicit files.
- **Commit/push only when the user asks.** A guarded api module must import the module exporting its guard's deps — only a real boot/health-200 catches a miss, not a green build.
- Worktree e2e needs `ENCRYPTION_KEY` (64-hex) set or it fails. Verify mobile at 390px **and** 440px.
- Design = Notion (`docs/notion-design.md`), accent `#0075de`; every dropdown = shared `MenuPicker`.

## How this was audited (re-run before building)
- `git log --oneline` since the handoff; `ls apps/api/src` for modules; grep `@lyra/shared` for the type/enum/fn names per item; grep `runs/` for `jobId`/`progress`/`operation`; query `lyra.marketplaceprompts` (by source) and `lyra.prompts` (by type/title); for item 5 confirm `products` module + `research.ts` + `Provider.Research`.

## Session docs (all committed at `6dc866e4`, on `origin/codex-dev` — NOT on `origin/dev`)
`docs/2026-06-23-implementation-handoff.md` (this file) · `docs/prompt-library-starter-kit.md` ·
`docs/superpowers/plans/2026-06-23-gen-ux-upgrades-from-mj-proxy.md` ·
`docs/superpowers/plans/2026-06-23-assistant-memory-layer.md` · `docs/lyra-video-assembly.md` (§5b) ·
`data/lyra-marketplace-prompts.json` · `scripts/swap-marketplace-prompts.cjs`.
Research-loop spec committed at `1e3a2b8e`.
