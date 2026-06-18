# Session handoff — June 18, 2026

> Open this file first in the next session. Branch: **dev**.
> **Everything is committed** — working tree is clean, `origin/dev` is at `ff37844`. No uncommitted work, no active blocked task. Continue from the user's next request.

The big theme of this session: a complete **AI pipeline + copilot** stack on top of the composable-pipelines model, plus **i18n (EN/VI)**, **dark mode**, and **real image generation**. Design spec: [docs/specs/2026-06-18-lyra-ai-pipeline-copilot-design.md](specs/2026-06-18-lyra-ai-pipeline-copilot-design.md).

---

## 0. Resume the dev environment (do this first)

Live preview is **dev.getlyras.app** — a **cloudflared tunnel to THIS machine's dev servers** (discovered this session). It is only live while these run locally, and it shares this machine's database:
- **web** — Vite dev on `:5173` (HMR; auto-picks up web changes). **Mobile via the tunnel does NOT get HMR — full page reload.**
- **api** — `node dist/main.js` from `apps/api` on `:3001` (does **not** auto-reload).
- **mongo** — local on `:27017` (`docker compose up -d mongo`). dev.getlyras.app reads/writes this same DB.

**After any `apps/api` or `packages/shared` change you MUST rebuild + restart the api:**
```bash
pnpm --filter @lyra/shared build      # only if packages/shared changed — FIRST
pnpm --filter @lyra/api build         # (or: pnpm turbo run build --filter=@lyra/api)
# kill :3001, then start detached:
#   (PowerShell) Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
#   (bash, background) cd apps/api && node dist/main.js
# verify: curl http://localhost:3001/  -> 404 (app up); routes log on boot
```
Web changes need no restart (HMR).

**Full gate (what CI gates), all green:** `pnpm turbo run type-check lint test build` — 12 tasks, **35 api + 25 web tests**.

**Testing in your account:** use a **real login** with the user's creds (in `apps/api/.env` / provided for testing) — `POST /auth/login` for a token. (Forging a JWT from the signing secret is blocked by the auto-mode classifier; don't try it.) Workspace "Putiin's Workspace" = `6a309b8efe9ec7c83515dad5`; it has anthropic + openai + deepseek keys.

---

## 1. What shipped this session (committed `a6658bb → ff37844`)

| Commit | Feature |
|---|---|
| `a6658bb` | **Crawl provider** (`Provider.Crawl`, no key) + **per-step "View result"** modal (media inline, per-file/zip downloads, per-run history) |
| `2b6032b` | **i18n (EN/VI)** + **dark mode** + **AI Pipeline Builder Phase 1** |
| `9443439` | **Real image generation** (gpt-image-1) + **Step details** + Build-with-AI StrictMode fix |
| `2d8a483` | **Edit with AI** (revise an existing pipeline) |
| `04151c7` | **Conversational AI builder (Phase 2)** |
| `1a3327b` | **Lyra Copilot — read-only tools (Phase 3a)** |
| `249f632` | **Lyra Copilot — approval-gated actions (Phase 3b)** |
| `ff37844` | **Cloudflare R2 media storage** (env-gated, inline fallback) |

### AI pipeline builder + copilot (the core arc)
- **Build with AI** (Pipelines page → ✨): `POST /workspaces/:id/pipelines/generate { goal, current? }` → `PipelineAiService` (Claude) designs a pipeline **grounded to the public prompt library** (real prompt ids only; the server re-validates: unknown id → "gap" step with empty `promptId`; invalid provider·model → clamped to `MODEL_CATALOG`). Draft opens **editable in the builder**; save via the normal create endpoint. **Provenance**: `Pipeline.origin {source:'ai', goal, model}` + an "✨ AI-built" row badge.
- **Edit with AI** (builder toolbar): same endpoint with `current` steps → AI returns the COMPLETE revised pipeline; replaces the builder's steps.
- **Conversational (Phase 2)**: `BuildWithAiModal` is a chat — `POST …/pipelines/ai-chat { messages, current? }` → `{ reply, draft? }`. AI asks/refines across turns; "Apply to builder" drops the latest draft in.
- **Lyra Copilot** (Chats → ✨ Lyra Copilot; `CopilotPanel.tsx`): `POST /workspaces/:id/copilot { messages }` → `{ reply, tools?, actions? }`. `AnthropicClient.runWithTools` runs the agentic loop. **Read tools** (3a): `search_prompts, list_pipelines, get_pipeline, list_projects, get_project_runs, get_run_result` — grounds answers in real data. **Act tool** (3b): `run_pipeline` only **proposes** (resolves real ids → `PendingCopilotAction`); the panel shows an "Approve & run" card; on approve the **client** runs it via the existing run endpoints. The click is the gate — nothing runs unattended.
- New api: `apps/api/src/copilot/` (service/controller/module/dto) + `pipeline-ai.service.ts` (+ 5 unit tests). Shared dto: `GeneratePipelineDto`, `GeneratedPipeline/Step`, `AiChat*`, `Copilot*`, `PendingCopilotAction`, `PipelineOrigin`.

### Real image generation
- `image` provider is **real** now: `ImageStepProvider` → OpenAI **gpt-image-1** / DALL·E 3. It **reuses the workspace OpenAI key** — there is **no separate "image" key**. `keyProviderFor(provider)` (shared) maps `image → openai` for key resolution AND lock/gating across api + web. `MODEL_CATALOG[Image] = gpt-image-1 / dall-e-3`. **video is still a mock.**
- Storage: generated bytes go through `AssetStorageService.store()` → **R2 URL when the `R2_*` env is set, else an inline `data:` URL** (works for display + download; Node `fetch` handles `data:` URLs). To enable R2: set `R2_ENDPOINT / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL` in `apps/api/.env` (see `.env.example`), restart api. No code change to activate.

### Step details
- The "View result" modal is a full **step-details** view: meta strip (mode · tokens · duration) + Output/files + collapsible **Prompt sent** + **Input**. The run engine records `RunStep.sentPrompt` (the resolved prompt actually sent, with `{input}`/`{step:X}`/`{vars}` filled); falls back to the template on older runs.

### i18n + dark mode
- **react-i18next**, EN + VI, browser-default + persisted override. Per-area locale files under `apps/web/src/i18n/locales/{en,vi}/` (`common/nav/auth/home/settings/run/projects/pipelines/prompts/chats/copilot`). Header **flag toggle** (EN/VN) + borderless **theme toggle**; full controls in Settings → Preferences. Vitest setup `src/test/i18n-setup.ts` so tests assert real strings.
- **Dark mode**: `[data-theme="dark"]` token block in `index.css`; ~110 hardcoded `#fff`/disabled/placeholder values tokenized so cards/dialogs/fields flip. Follows OS (`prefers-color-scheme`), no-flash inline script in `index.html`, persisted (`src/lib/prefs.ts`).

---

## 2. AI roadmap — done vs next

- ✅ **Phase 1** — one-shot AI builder, image gen, step details, Edit-with-AI
- ✅ **Phase 2** — conversational builder
- ✅ **Phase 3a** — read-only copilot (tool grounding)
- ✅ **Phase 3b** — approval-gated act (run a pipeline) — the two-way is real
- ⏭️ **Phase 4 — closed loop**: copilot runs → reads results → improves the pipeline/prompt → re-runs → converges (the dropshipping-autopilot north-star, [docs/specs/2026-06-18-dropshipping-autopilot-northstar.md](specs/2026-06-18-dropshipping-autopilot-northstar.md)). **AUTONOMOUS + spends real money in a loop** — DO NOT build without the user setting guardrails (max iterations, budget cap, approval cadence). Build on the existing tool loop + `PendingCopilotAction` pattern.
- ⏭️ **Ratings + few-shot retrieval** — the "rate later" half of the feedback loop: thumbs on a run's **result** (not the pipeline), then feed top-signal pipelines into `PipelineAiService` as few-shot examples. Self-contained, no autonomous spend. Provenance (`origin`) is already captured as the seed.

> When "Keep going" was last said, the agreed default for the next safe step was **Ratings + few-shot retrieval**. Phase 4 needs a guardrail design first.

---

## 3. Gotchas / things not to break
- **Build-with-AI draft handoff**: the builder consumes the AI draft from `location.state` via a **ref-guard + `window.history.replaceState`** (NOT `navigate()` inside the mount effect — that raced `setSteps` under React StrictMode and dropped the steps). The modal **navigates before closing**. Don't reintroduce navigate-in-effect.
- **Gap steps persist**: `RunStep.promptId` and `PipelineStepItem.promptId` are **not `required`** (Mongoose String `required` rejects `''`); a gap step has `promptId: ''`. The `PipelineStepBody` DTO dropped `@MinLength(1)` on `promptId` too.
- **Copilot act = propose only**: `run_pipeline` never executes server-side; it returns a `PendingCopilotAction` and the client runs it on approval. Keep that boundary for any future act tools.
- **Image key**: image steps use the **OpenAI** key via `keyProviderFor`; don't add a separate image-key concept.

---

## 4. Still-pending (from earlier, unchanged)
- **Google sign-in** + **password-reset email** are code-complete but need secrets in `apps/api/.env` (`GOOGLE_CLIENT_ID`/`SECRET`; `SMTP_PASS`). Until set: Google button → `/login?error=google_unavailable`; mailer logs the reset link to a dev stub. **Never paste secrets in chat** — `apps/api/.env` only; rotate the tester creds.
- **Providers**: anthropic + openai/deepseek + crawl + **image (gpt-image-1)** are real; **video is still a mock**.
- The prior handoff's "pipeline should work like an image" exploration is **no longer the active task** (the session went the AI-builder direction).

## 5. Source-of-truth docs
`CLAUDE.md` (root) · `docs/lyra-pipelines.md` (composable pipelines) · **`docs/specs/2026-06-18-lyra-ai-pipeline-copilot-design.md`** (the AI builder/copilot design + roadmap) · `docs/specs/2026-06-18-dropshipping-autopilot-northstar.md` · `docs/lyra-requirements.md` · `docs/lyra-hosting-cicd.md`.
