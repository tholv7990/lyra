---
id: brand-stage-image-fanout
title: Brand stage — real image generation + parallel fan-out
status: in-dev                   # Pass 1a (multi-asset foundation) landed; see status log
owner: Claude (design/BA/QA)
developer: Codex
branch: task/brand-stage-image-fanout
commit:
created: 2026-06-18
---

# Brand stage — real image generation + parallel fan-out

> Process: see [docs/workflow.md](../workflow.md). Umbrella vision:
> [dropshipping-autopilot-northstar](2026-06-18-dropshipping-autopilot-northstar.md).
> This is **sub-project #1** — the first real build of "B". It de-risks the
> hardest new engine pieces (real media generation, asset storage, the job
> queue, collections + fan-out) on one concrete outcome: **brand a whole set of
> images at once.**
>
> **N is arbitrary.** "10" anywhere in this doc is an example, never a limit. The
> primitive is *map a step over a collection of N items* — N may be 1, a dozen,
> or hundreds. Nothing may assume a fixed count.

## Goal
Make a Generate·Image step produce **real, stored images**, and support
**fan-out** — one branding prompt mapped over a collection of N source images,
run in parallel — so a run turns a set of product photos (however many) into the
same number of on-brand images, shown as assets and gated for approval.

## Context & reuse
- **Run engine:** `apps/api/src/runs/` — `run.engine.ts` (state machine),
  `runs.service.ts` (`executeStep`), `providers/` (`StepProvider` +
  `ProviderRegistry`, `MockStepProvider`). Extend, don't replace.
- **Provider contract:** `providers/step-provider.interface.ts` — `StepRunOutput`
  currently returns one `result`; extend with `assets[]`.
- **Already reserved (use as-is):** shared **`Asset`** model
  (`id, runId, workspaceId, stepIndex, type:'image'|'video'|'audio', url,
  thumbUrl?, meta?, approved?`) and **`Step.assetIds: string[]`**. Wire real
  assets into these.
- **Providers:** `Provider.Image` enum exists (mock today). Per-step key gating
  via `STEP_PROVIDERS` / `keysPresent` already locks a step when its provider key
  is missing — reuse it.
- **Web run view:** `RunFlow` / `RunStepCard` / `FlowCanvas` (`apps/web/src/components`)
  render step status + inline gate Approve; add asset thumbnails + set approval.
- **Prompt resolution:** `fillPrompt` + `resolveStepRefs` (shared) — reuse for the
  per-item prompt fill.
- **Infra (planned, hosting doc §7–8):** Cloudflare **R2** for assets, **BullMQ +
  Redis** for the queue (`docker compose --profile queue up -d`).
- **Invariants:** shared = zero runtime deps; provider keys resolved server-side,
  never returned; everything scoped by `workspaceId`; soft-delete + audit on new
  collections; swapping the image provider stays a registry one-liner.

## Open decisions (confirm before → ready-for-dev)
- **D1 · Image provider (BYOK) for v1.** Proposed: **OpenAI `gpt-image-1`**
  (supports image *edits*/img2img; key the user likely already has). Alt:
  fal.ai / Replicate (Flux) for control/quality. *Pick one to wire first.*
- **D2 · Branding technique.** Proposed: **image-to-image / edit** — feed the
  source product photo + branding prompt so the *actual product* is preserved
  (not text-to-image, which would invent a different product).
- **D3 · Where the 10 source images come from (v1).** Proposed: **uploaded at run
  start** into a collection. (Crawl-sourced images arrive with the later
  Source/Discover spec — out of scope here.)
- **D4 · Asset store.** Proposed: **Cloudflare R2** (public/CDN URL stored on
  `Asset.url`).
- **D5 · Queue.** Proposed: **BullMQ + Redis**.
- **D6 · Fan-out policy.** Proposed: concurrency cap **4** (configurable);
  per-item retry **×2**; **partial success allowed** — the step completes with
  the successful assets and surfaces per-item errors; the gate shows failures.

## Requirements
1. **Collection data on a run.** Introduce a minimal list-valued input a fan-out
   step maps over — here, a list of source image refs. Keep it minimal (image
   list only; general collections come later). **Size is arbitrary** — the
   collection, the per-item dispatch, the asset count, and the run/asset listing
   must all hold for large N (paginate/stream rather than load-all; never hard-code
   a count). The **concurrency cap** (D6) — not a fixed N — is what keeps large
   batches safe against provider limits and cost.
2. **Fan-out step config.** A pipeline step can be marked `fanOut` with the input
   collection it maps and the per-item token (e.g. `{item}`); a non-fan-out step
   behaves exactly as today.
3. **Real Image provider** implementing `StepProvider`: resolved prompt + source
   image (per D2) + decrypted key → generated image + usage.
4. **Asset storage:** upload generated images to R2; create workspace-scoped
   `Asset` docs (soft-deletable); return asset refs.
5. **Multi-asset step output:** extend `StepRunOutput` with `assets[]`; persist
   onto `Step.assetIds`.
6. **Job queue:** a fan-out step enqueues N jobs; a worker runs them at the
   concurrency cap; the run shows the step `running` until all resolve; apply the
   D6 partial-failure policy.
7. **Run view:** the image step node shows generated thumbnails; a gate on the
   step pauses with the set, and Approve marks the assets `approved` + continues.

## Out of scope
- Source/crawl connectors; channels/Action; **video**; branching/conditions;
  triggers/scheduler. General-purpose collections beyond an image list.
  Multi-provider image (one provider wired first).

## UX / design
- Builder: a **Fan-out** toggle on an Image step (Linear-light styling, like the
  existing step drawer). When on, show the per-item token hint (`{item}`).
- Run view: the Image node renders a small thumbnail grid of its assets; a failed
  item shows an error chip + retry. A gate renders the grid with **Approve set**
  (and ideally per-asset reject — may defer per-asset to a follow-up).
- States: queued (n/N done) · running · awaiting gate · done · error. Reuse the
  existing run status chips/colors.

## Acceptance criteria  ← the contract
- [ ] AC1: An Image step in a pipeline can be set `fanOut` bound to a prompt +
  `Provider.Image` + model; a non-fan-out step still runs once (no regression).
- [ ] AC2: Running a fan-out Image step over a collection of N source images makes
  N provider calls (≤ concurrency cap at a time); the per-item prompt = the step
  template filled with that item; N images are stored (R2 URL on `Asset.url`) and
  attached to the step (`assetIds.length === successful N`).
- [x] AC3: `StepRunOutput.assets[]` is populated and persisted; each `Asset` is
  workspace-scoped, typed `image`, and soft-deletable. ✅ Pass 1a.
- [ ] AC4: Partial failure — if k of N items fail after retries, the step completes
  with N−k assets and surfaces k per-item errors (run not wedged).
- [ ] AC5: A gate on the step pauses the run with the N assets visible; Approve
  marks them `approved` and advances `currentStep`.
- [ ] AC6: The image provider key is resolved server-side (BYOK) and never
  returned to the client; the step is locked (400 on run) when the key is absent.
- [ ] AC7: `pnpm turbo run lint type-check test build` green; an e2e covers
  create → run fan-out → N assets → gate approve, using a **stubbed image
  provider** (deterministic fake bytes/URL — no real spend, no network).

## Files likely touched
- **shared:** `enums` (maybe `StepKind`/fan-out marker), `models` (collection +
  asset output shapes), `dto` (pipeline step fan-out fields). Keep zero-dep.
- **api:** `runs/providers/step-provider.interface.ts` (+`assets`),
  `runs/providers/image.provider.ts` (real impl), `runs/runs.service.ts`
  (fan-out dispatch), `run.engine.ts` (multi-asset step state), a new
  `assets/` module (R2 upload + `Asset` schema/service), a `queue/` module
  (BullMQ), `pipelines` step schema/dto (fan-out config).
- **web:** `components/RunStepCard.tsx` / `FlowCanvas` nodes (asset grid + gate
  set approval), pipeline builder step drawer (fan-out toggle), run-start upload.
- **infra/docs:** R2 + Redis env in hosting doc; `docker-compose` queue profile.

## Build in two passes (suggested)
- **Pass 1a — single real image:** image provider + R2 assets + `StepRunOutput.assets`
  + node thumbnails (no fan-out yet). Proves real generation + storage.
- **Pass 1b — fan-out:** collections + the queue + concurrency/retry + set gate.
Lands value early and isolates the queue work.

## Test plan (how QA verifies)
- AC1/AC2 → api e2e: build a pipeline with a fan-out Image step (stub provider),
  POST a run with a 3-image collection, assert 3 `Asset` docs + `assetIds`,
  per-item prompt observed via the stub echoing its prompt.
- AC4 → stub fails 1 of 3 → assert 2 assets + 1 surfaced error, run not wedged.
- AC5 → gate step: run pauses `awaiting_gate`; approve → `done`, assets `approved`.
- AC6 → no key → run step 400; key present → runs. Key never in any response body.
- AC7 → gates + the above e2e green.

## Notes for Codex
- Don't break the single-shot path: fan-out is additive; a normal step still
  returns one `result`.
- Image generation is **async/slow** — it MUST run on the queue, not inline in the
  request; the run row reflects progress and the worker writes assets + flips
  status. Mirror the existing engine transitions.
- Reuse the existing key-gating (`keysPresent`/`STEP_PROVIDERS`) for `Provider.Image`.
- Confirm D1–D6 with the owner before starting; they change the provider impl,
  the input model, and infra.

---

## Status log
- 2026-06-18 — Claude — **Pass 1a landed** (decision-independent foundation, no
  D1–D6 lock needed): added `StepRunOutput.assets[]`; new **Asset module**
  (`apps/api/src/assets/*` — schema/service/module, workspace-scoped, audited,
  soft-deletable + cascade on workspace/project delete); the **mock image/video
  provider** emits a placeholder asset; run steps persist assets onto
  `Step.assetIds`; new **`GET /runs/:id/assets`**; e2e proves an image step run
  persists + lists its asset. Full gates + api e2e green (75). **AC3 met; AC6
  reused.** Remaining (await **D1/D4/D5**): real image provider, R2 upload,
  fan-out + BullMQ queue (Pass 1b), and run-view thumbnails (status: in-dev).
- 2026-06-18 — Claude — spec drafted; first slice of the "B" north star. Awaiting
  owner review + decisions D1–D6 before ready-for-dev (status: draft).

## QA log
<!-- Claude appends a QA round per pass; newest on top. -->
