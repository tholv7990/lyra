# Lyra video assembly — engine choice: HeyGen HyperFrames (MoneyPrinterTurbo compared)

> **Status:** Decision + proof-of-concept plan. **Nothing built yet.**
> **Decision:** Use **HeyGen HyperFrames** as Lyra's video-**assembly** engine for the render stage (step 7 render + step 8 assemble/QA). **MoneyPrinterTurbo** is the evaluated alternative (better only for narrated stock-footage shorts).
> **Date:** 2026-06-22.
> **Basis:** two deep-research passes (primary sources: each repo's own code / README / LICENSE / GitHub API / official docs; claims adversarially verified).
>
> **Revised 2026-06-23:** added **§5b — the Storyboard intermediate** (typed plan artifact between the LLM step and the render), from a deep-read of [AIDC-AI/Pixelle-Video](https://github.com/AIDC-AI/Pixelle-Video) (Apache-2.0). It resolves open decision #1 and ties this doc to the gen-UX plan.

## TL;DR / recommendation

Adopt **HyperFrames** ([`heygen-com/hyperframes`](https://github.com/heygen-com/hyperframes)) as an **optional Node/TS render microservice** behind Lyra's `StepProvider` interface, invoked through the planned **BullMQ/Redis render queue**, output to **R2/S3**. It turns **HTML/CSS + animations → deterministic MP4** (headless Chrome + FFmpeg). Chosen over MoneyPrinterTurbo because it:

- **Matches Lyra's stack** (TypeScript/Node) — no Python boundary.
- Is **deterministic + design-precise** (kinetic captions, charts, branded overlays, product cards) — ideal for *on-brand* creative composed from Lyra's own generated images.
- Is **Apache-2.0, fully open**, and **needs no API key of its own** (it renders; it calls no providers), so invariant 7 is a non-issue for the renderer.
- Fits Lyra's LLM pipeline: **an LLM step can author the HTML composition**, which HyperFrames renders frame-accurately.

**Hard limits (both engines):** HyperFrames does **no** generative AI — no image/video generation, avatars, or interpolation. So it does **not** fill **step 6 (generated images)** and is only the *assemble* half of **step 7**. Lyra still needs a separate **image generator** (step 6) and, for avatars/talking-head, HeyGen's avatar API or a text-to-video model. HyperFrames *composes* that media; it doesn't create it.

## 1. HyperFrames — what it is (verified)

HeyGen's official, **Apache-2.0** ("© 2026 HeyGen, Inc."), **TypeScript/Node 22+** framework (TS 80% / JS 18%; **not** Python/Rust; Bun-managed; needs FFmpeg). ~**29.4k★ / 2.8k forks**, created **Mar 2026**, **pre-1.0 (v0.6.x)** with a very rapid release cadence (~10 releases in 4 days — packaging still stabilizing). "Used in production at HeyGen." Tagline: **"Write HTML. Render video. Built for agents."**

> "Built for agents" = AI **coding** agents author the HTML; the engine renders. It performs **no** generative media creation (confirmed by README, HeyGen Help Center, and third-party reviews).

## 2. How it renders (the capability we want)

| Concern | Implementation |
|---|---|
| Pipeline | Seeks each frame in **headless Chrome (Puppeteer)** → encodes with **FFmpeg** → **deterministic** MP4 (same input → same output; "no wall-clock dependencies"; built for CI/regression/automated rendering). |
| Authoring model | Plain **HTML** with timing data-attributes (`data-start`, `data-duration`, `data-track-index`); **no React**, no proprietary timeline (vs Remotion, which is React). |
| Animation | **GSAP, CSS, Lottie, Three.js, Anime.js, WAAPI**, or a custom **Frame Adapter** (must be frame-accurately seekable). |
| Media inputs | Video/image/audio referenced in the HTML (e.g. `<video data-start=0 data-duration=6 src="intro.mp4">`); avatar clips consumed as inputs, not generated. |
| SDK | CLI `npx hyperframes` (init/preview/render/lint/inspect) + packages `@hyperframes/{core, engine, producer, studio, player, aws-lambda}`. `engine` = Puppeteer+FFmpeg capture; **`producer`** = capture/encode/audio-mix (the service entrypoint); **`aws-lambda`** = distributed render fan-out. Also a Claude/Cursor/Codex **skill**. |
| Output | **MP4** (exact codec/profile config **unverified** — confirm against current releases). |
| License/keys | Apache-2.0; **makes no provider API calls**, so it needs **no** workspace key. |

## 3. Fit with Lyra's 8-step pipeline

| Step | HyperFrames |
|---|---|
| 6 — images (generated) | ❌ None — no image synthesis (needs a separate image provider). |
| 7 — video | ◑ Assemble/render only (composes media → MP4), not a generative video model. |
| 8 — assemble/QA | ✅ Strong — deterministic, design-precise composition + QA-friendly (reproducible renders). |

## 4. HyperFrames vs MoneyPrinterTurbo

Both are **assembly engines with no image generation** — complementary to a generator, mutually substitutable for the assemble stage. They differ in *style*:

| | **HyperFrames** (chosen) | **MoneyPrinterTurbo** (alt) |
|---|---|---|
| Engine | HTML/CSS → MP4 via headless Chrome + FFmpeg | moviepy clip-stitching + FFmpeg |
| Stack | **Node/TS** (matches Lyra) | Python |
| License | **Apache-2.0** (fully open) | MIT — but FFmpeg (GPL/LGPL), edge-tts, and per-asset stock licenses are separate compliance items |
| Best at | **Design-precise** branded motion graphics; composing *Lyra's generated images* + kinetic text/overlays/charts | **Turnkey** narrated shorts: LLM script → TTS → stock B-roll → auto-subtitles |
| Built-in extras | Just rendering (bring media + HTML) | Script gen, TTS, stock sourcing, subtitles |
| BYO-key | None needed (renders only) | Per-provider keys (LLM/TTS/stock) |
| Maturity | ~29k★ but **pre-1.0, ~3.5mo old** (churn risk) | ~90k★, v1.3.0, more stable |

**Why HyperFrames for Lyra:** stack-matched, deterministic, design-driven, Apache-2.0, no key gating, and an LLM step can emit the HTML. **Pick MoneyPrinterTurbo instead only** if the product goal becomes stock-footage + voiceover social shorts out of the box.

## 5. Recommended architecture

```
React workbench ──REST(JWT)──▶ NestJS api ──┐
                                            ├─▶ BullMQ/Redis render queue
                                            │       │ (worker dispatches step.key='video')
                                            │       ▼
                                            │   VideoAssembleStepProvider  (StepProvider impl; ProviderRegistry, invariant 9)
                                            │       │  HTTP (X-Service-Token)
                                            │       ▼
                                            │   apps/render-service  (Node/TS worker, separate container — Chrome + FFmpeg)
                                            │       @hyperframes/core (build/lint HTML) + @hyperframes/producer (render)
                                            │       │
                                            └───────┴─▶ asset store (R2/S3) → MP4 URL back to the Run
```

- **Where the HTML comes from:** an LLM step (brief/prompts) emits an HTML composition (or fills a parameterized template) referencing Lyra's **step-6 generated images** + captions + brand tokens. `@hyperframes/core` lints it; `@hyperframes/producer` renders.
- **Separate Node worker, not in the api process:** HyperFrames pulls in headless Chrome + FFmpeg (heavy per-frame CPU/RAM) — isolate it (own container, pm2 `lyra-render`), like `connectors-service`. It's the *same language* as the api but a very different resource profile.
- **Keys:** HyperFrames needs none. Workspace BYO keys (invariant 7) are only decrypted for the **upstream** generators (image step 6) — the render worker just receives finished media + HTML.

**StepProvider sketch** (api — one-line registry swap from the mock):

```ts
// apps/api/src/runs/providers/video-assemble.provider.ts
export class VideoAssembleStepProvider implements StepProvider {
  async run(input: StepRunInput): Promise<StepResult> {
    const job = {
      html: input.options?.html ?? buildCompositionFrom(input),  // HTML authored by an LLM step / template
      assets: input.media,                                        // step-6 generated images, etc.
      aspect: input.options?.aspect ?? '9:16',
    };
    const res = await this.renderClient.post('/render', job);     // → { url, durationMs, width, height }
    return { output: res.url, assets: [{ type: 'video', url: res.url }] };
  }
}
// ProviderRegistry: STEP_PROVIDER['video'] = VideoAssembleStepProvider  (was MockStepProvider)
```

**render-service contract** (Node/TS, thin wrapper over `@hyperframes/producer`):

```
POST /render  { html, assets[], aspect, audio? }  → { url, durationMs, width, height }  # renders, uploads MP4 to R2/S3
GET  /health
```

## 5b. The Storyboard intermediate (the plan artifact)

> Added 2026-06-23 from [AIDC-AI/Pixelle-Video](https://github.com/AIDC-AI/Pixelle-Video) (Apache-2.0) — its `models/storyboard.py` is the cleanest version of this pattern.

Don't have the LLM emit raw composition HTML. Insert a **typed `Storyboard` artifact** between the script/LLM step and the HyperFrames render. It decouples *planning* from *rendering*, makes every frame **individually addressable** (regenerate / re-time / swap one frame without redoing the whole video), and feeds composition deterministically.

Types live in `@lyra/shared` (zero runtime deps — invariant 1), schema-validated like every pipeline artifact:

```ts
interface StoryboardFrame {
  index: number;
  narration: string;            // VO / on-screen text for this beat
  imagePrompt: string;          // prompt for the frame's visual
  mediaType: 'image' | 'video';
  assetId?: string;             // the generated visual (Lyra Asset) — per-frame addressable
  durationSec: number;          // derived from the narration audio (or the clip)
  templateParams?: Record<string, unknown>; // per-frame overlay overrides
}

interface Storyboard {
  title: string;
  aspect: '9:16' | '1:1' | '16:9';
  template: string;             // brand template id, e.g. 'ugc-9x16' (per-aspect, like Pixelle's 1080x1920/*.html)
  templateParams: Record<string, unknown>; // brand-kit-derived (accent color, fonts, logo)
  audio?: { voiceId?: string; speed?: number; bgmId?: string };
  frames: StoryboardFrame[];
  totalDurationSec?: number;
}
```

**Flow with this artifact:**

```
script/LLM step  ──▶  Storyboard (typed, schema-valid)
                          │  per frame:
                          ├─▶ generate visual (image step / i2v)  ──▶ Asset  ──▶ frame.assetId
                          ├─▶ TTS narration                       ──▶ frame.durationSec
                          ▼
HyperFrames render-service: brand template + frames (each frame = a template instance with
   its assetId + narration/subtitles), brand kit ▶ templateParams ▶ deterministic MP4
```

**What it buys (it ties the other plans together):**
- **Per-frame addressability** — the per-step cache + thumbnails key off `frame.assetId`; the **action-based editing** in [the gen-UX plan](superpowers/plans/2026-06-23-gen-ux-upgrades-from-mj-proxy.md) (regenerate / upscale / outpaint) operates on one frame, not the whole video.
- **Async per-frame gen** — slow visual gen runs as jobs (gen-UX plan Upgrade A) and writes back `frame.assetId` as each completes; progress = frames-done / total.
- **Brand-driven templates** — a per-aspect template (`ugc-9x16`) + `templateParams` from the brand kit (accent / fonts / logo) — exactly Pixelle's `frame_template` + `template_params`. The render-service `/render` contract takes a **`Storyboard`** (or the api compiles it to HyperFrames HTML), not freeform HTML.

This **resolves open decision #1**: the LLM emits a *structured Storyboard*; brand **templates** render the frames — not freeform HTML.

## 6. Proof-of-concept plan (phased)

**Phase A — spike (Node service, 1 endpoint, no queue).**
1. Scaffold `apps/render-service` (Node/TS, Dockerfile with **Chromium + FFmpeg**). Pin `@hyperframes/*` versions (pre-1.0). Skip the Studio UI.
2. `POST /render` that takes a hand-written HTML composition + a couple of local images → renders a 9:16 MP4 via `@hyperframes/producer`. Prove deterministic output + acceptable render time on a sample.
3. Service-token auth (reuse the `connectors-service` `ServiceToken` pattern).

**Phase B — wire into Lyra.**
4. `VideoAssembleStepProvider` + `renderClient` proxy (mirror `connectors.proxy.ts`; add `RENDER_SERVICE_URL`).
5. Swap the registry entry for `step.key='video'` mock → real, behind an env flag for rollback.
6. **HTML authoring:** add an LLM step (or template) that emits the composition HTML from the brief/prompts, embedding **step-6 generated images** as `<img>/<video>` — so the video uses *our* images, on-brand.

**Phase C — production.**
7. Run via **BullMQ/Redis** (async job + progress polling, like the crawler's `DownloadJobStore`); MP4 → **R2/S3**; per-tenant timeout + concurrency caps (Chrome is heavy). Evaluate `@hyperframes/aws-lambda` for distributed fan-out if local rendering doesn't scale.
8. pm2/Docker entry (`lyra-render`) in `ecosystem.config.js`.

## 7. Risks

- **Pre-1.0 churn** (v0.6.x; packaging still moving) → pin versions; keep strictly behind the swappable `StepProvider` so swapping engines is one line.
- **Headless-Chrome rendering is heavy** (CPU/RAM per frame) → size the queue; consider the AWS-Lambda distributed path; set per-tenant limits.
- **Output codec/profile config unverified** → confirm it emits the H.264/MP4 profile R2/S3 + target platforms expect (e.g. for TikTok/IG/YT upload via the publish step).
- **"Official" via self-attribution** (GitHub org not verified-badged) + corporate cross-links — strong, not a badge.
- **Composition reliability:** LLM-authored HTML must be linted/validated (`@hyperframes/core` linter) before render to avoid broken frames.

## 8. Open decisions

1. **HTML authoring:** **Resolved (§5b)** — the LLM emits a typed **Storyboard**, and brand **templates** render the frames (templates with LLM-filled slots, not freeform HTML).
2. **Step 6 image generator** to pair with it (HyperFrames composes but doesn't generate) — which provider/model.
3. **Avatars/talking-head:** out of scope for HyperFrames — decide separately (HeyGen avatar API as a media input, or a text-to-video model) if needed.
4. **Scale path:** local Node worker vs `@hyperframes/aws-lambda` distributed renders for multi-tenant volume.

## 9. Sources

**Storyboard pattern (added 2026-06-23):** [AIDC-AI/Pixelle-Video](https://github.com/AIDC-AI/Pixelle-Video) (Apache-2.0) — `pixelle_video/models/storyboard.py` (typed storyboard) + `services/frame_html.py` (HTML-template frames).

**HyperFrames (chosen):** [README](https://github.com/heygen-com/hyperframes/blob/main/README.md) · [repo](https://github.com/heygen-com/hyperframes) · [site](https://hyperframes.heygen.com/) · [vs Remotion](https://hyperframes.heygen.com/guides/hyperframes-vs-remotion) · [HeyGen Help Center](https://help.heygen.com/en/articles/15001510-hyperframes-x-heygen) · [CONTRIBUTING](https://github.com/heygen-com/hyperframes/blob/main/CONTRIBUTING.md) · [LICENSE (Apache-2.0)](https://github.com/heygen-com/hyperframes/blob/main/LICENSE) · GitHub API.

**MoneyPrinterTurbo (alternative):** [repo](https://github.com/harry0703/MoneyPrinterTurbo) · [task.py](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/app/services/task.py) · [video.py](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/app/services/video.py) · [config.example.toml](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/config.example.toml) · [voice.py](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/app/services/voice.py) · [LICENSE (MIT)](https://github.com/harry0703/MoneyPrinterTurbo/blob/main/LICENSE).
