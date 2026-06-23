# Plan — applying chatgpt-web-midjourney-proxy learnings to Lyra

> **Source:** deep-read of [Dooy/chatgpt-web-midjourney-proxy](https://github.com/Dooy/chatgpt-web-midjourney-proxy) (MIT). The
> learnable core is [`src/api/mjapi.ts`](https://github.com/Dooy/chatgpt-web-midjourney-proxy/blob/main/src/api/mjapi.ts) — `subTask()` (submit) + `flechTask()` (5s poll) and the
> action model (imagine → U/V/vary/zoom/pan/inpaint/reroll/describe/blend).
> **Date:** 2026-06-23. **Status:** plan, nothing built.
> **License note:** MIT — unlike OpenMontage (AGPL), code here can be referenced/adapted with attribution.

## What we're adopting (and not)

Two patterns are worth real work; the rest is small or skip.

- ✅ **A. Async submit→poll job model** for slow generation (video, batch image).
- ✅ **B. Action-based iterative image editing** (upscale / variation / outpaint / reroll on a *result*).
- ◐ **C.** Reusable generation-panel UX shell · **D.** unified-gateway (one-api/new-api) BYO base-url. (Optional.)
- ❌ **Skip:** Midjourney itself (needs a gray-area Discord-automation proxy — ToS-risky, fragile; we have
  proper-API providers). Skip local-first `localforage` storage (Lyra is server-authoritative).

---

## Upgrade A — async job + progress for slow generation

**Problem.** `RunsService.executeStep()` ([runs.service.ts:218](../../../apps/api/src/runs/runs.service.ts)) calls
`provider.execute(ctx)` and **awaits the full result synchronously**. Fine for Claude/Gemini (seconds);
**wrong for video gen** (Kling/Veo take minutes) — it blocks the request and gives the user no progress.
The mj-proxy answer is the standard one: submit returns a `taskId`, then poll until done.

**Lyra already has the precedent** — the crawler's `DownloadJobStore` does exactly this, and the
[video-assembly doc](../../lyra-video-assembly.md) already plans a BullMQ render queue. This formalizes it for *generation* steps.

**Design.**
1. Give `StepProvider` an optional async path. A slow provider's `execute()` returns
   `{ status: 'pending', jobId, ... }` instead of a final `StepRunOutput`. (Extend the
   `StepProvider`/`StepRunOutput` contract in [step-provider.interface.ts](../../../apps/api/src/runs/providers/step-provider.interface.ts).)
2. The engine marks the step `Running` with `step.jobId` + `step.progress` (new optional fields on the
   step schema; `completeStep` unchanged for the sync path).
3. A **BullMQ worker** polls the provider's task endpoint on an interval (the `flechTask` 5s loop),
   writes `step.progress`, and on completion runs the existing `completeStep` + `saveAssets`.
4. `RunFlow` shows a live progress bar per running step (workbench already polls the run; add the % read).

**Files:** `step-provider.interface.ts` (async result shape), `run.schema.ts` (`jobId`, `progress`),
`run.engine.ts` (a `Running`+progress transition; `completeStep` reused on poll-complete),
`runs.service.ts` (dispatch sync vs async by a provider capability flag), a new poll worker (model on
the crawler's job store), `video.provider.ts` (return a `jobId`), web `RunFlow.tsx` (progress bar).

**Scope cut (ponytail).** Async path **only** for providers that need it (video, large fan-out). Text and
single-image stay synchronous — don't make the whole engine async. `// ponytail: async only where the
provider is actually slow.`

---

## Upgrade B — action-based iterative image editing

**Problem.** The image step is **single-shot**: generate, or re-prompt via `{input}`/`{step:Name}`
chaining. MJ's real value is **acting on a result** — upscale this one, vary it, outpaint it, reroll —
which is how you iterate *toward* an ad shot instead of re-rolling the dice.

**This is buildable on what you have.** [image-inputs.ts](../../../apps/api/src/runs/providers/image-inputs.ts) already feeds a prior step's
image (as base64) into the next image step. [gemini-image.provider.ts](../../../apps/api/src/runs/providers/gemini-image.provider.ts) already does generate **+ edit**.
Gemini/Nano-Banana natively supports edit, variation, and reference consistency. So an "action" is just
**an image step seeded by an existing Asset + an `operation`**.

**Design.**
1. Add an `operation` to the image provider input: `generate | edit | variation | upscale | outpaint`
   (extend gemini-image; it already branches generate vs edit).
2. In the run/asset UI, a result image grows an **action bar** (Upscale · Variation · Outpaint · Reroll),
   like RunFlow's result expansion. An action spawns a follow-up image step with the source asset as its
   input and the chosen `operation` — reusing the whole `executeStep → saveAssets` path.
3. Each action is a normal step result (cached, thumbnailed) — your per-step cache + thumbnails already
   cover it.

**Files:** `gemini-image.provider.ts` + `image.provider.ts` (`operation` param), `image-inputs.ts`
(pass the source asset for an action), the web result component (action bar), a small "create follow-up
step from action" hook in `useRunActions.ts`.

**Scope cut.** v1 = **Upscale + Variation + Outpaint** (highest value for ad creative, Gemini-native).
**Inpaint / partial-redraw needs a mask UI — defer it.** `// ponytail: ship the buttons that need no
mask editor first.`

---

## C / D — optional, after A & B

- **C. Generation-panel shell.** mj-proxy reuses one skeleton (prompt → progress → result grid → action
  bar → gallery) across `views/{mj,kling,luma,suno}`. Lyra analog: factor a single generation-result
  component reused across image/video/music steps. Do this only once A+B exist and the duplication is real.
- **D. Unified-gateway (one-api/new-api) compat.** Per-provider **base-URL override** so one BYO key+URL
  can front many models — the gateway idea already on your roadmap (the LLM-gateway eval note). Small:
  add an optional `baseUrl` to the provider config; most clients already accept it.

---

## Build sequence (risk-ordered, thin slices)

1. **Async job + progress for the video step** — the real unblocker for video generation. Reuse the
   crawler job-store + BullMQ pattern; prove it end-to-end with one provider (e.g. a fal/Kling job).
2. **Image actions: Upscale + Variation** — cheapest, Gemini-native, surfaced on result assets.
3. **Outpaint** (image actions cont.).
4. **(Optional)** generation-panel shell refactor · unified-gateway base-URL.

## Non-goals

No Midjourney/Discord proxy. No client-side `localforage` storage. No inpaint mask editor in v1. No making
the whole run engine async — only the slow providers.

## Invariants that still bind

Swapping a model stays a one-line registry change (inv. 9); BYO per-workspace encrypted keys (inv. 7);
workspace-scoped queries (inv. 5); `@lyra/shared` zero runtime deps (inv. 1); assets server-authoritative
(no client-trusted media). The async path is additive — the existing synchronous `completeStep` flow is
untouched for fast providers.

---

> Want this turned into a granular, executable implementation plan (TDD task breakdown) for phase 1?
> Run it through the writing-plans skill once the phase is chosen.
