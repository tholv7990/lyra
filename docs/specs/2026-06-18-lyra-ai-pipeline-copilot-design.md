# Lyra AI Pipeline Builder → Copilot — Design

> Status: **design approved (brainstorm)**, ready for an implementation plan.
> Date: 2026-06-18. Supersedes nothing; extends the composable-Pipelines model
> ([docs/lyra-pipelines.md](../lyra-pipelines.md)) and feeds the dropshipping
> autopilot north-star ([docs/specs/2026-06-18-dropshipping-autopilot-northstar.md](2026-06-18-dropshipping-autopilot-northstar.md)).

## Goal

Let a user describe **what they want a pipeline to do**, have AI **design a
runnable pipeline from their own prompt library**, preview/edit it, and save it —
then evolve that one-shot generator into a **two-way copilot** that reads Lyra's
real state and (with approval) acts on it.

## Guiding decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Missing prompts | **Library-only; flag gaps** (placeholder "needs a prompt" steps). AI never invents prompt text in v1. |
| Preview | **Editable in the existing builder** (pre-filled steps). |
| Step config (v1) | **prompt + order + provider·model + gate/auto.** Fan-out/conditions deferred. |
| Feedback loop | **Capture provenance now**; explicit ratings + few-shot retrieval later. Implicit signals (runs, gate/asset approvals) are the real "how good". |
| Sequencing | **One-shot first, then evolve to the copilot.** Each phase reuses the prior backend. |
| Copilot surface | **Extend Chats** with a pipeline canvas (reuse multi-turn + SSE). |

## Architecture fit (what we reuse)

- **Claude calls:** `AnthropicClient.complete()` (one-shot, non-streaming) already
  exists and is used by Chats. No new AI plumbing for v1.
- **Library:** `PromptsService` — load **public** prompts (the same set pipelines
  bind via `PromptPicker`).
- **Keys:** existing per-workspace encrypted key service — the generator requires
  the workspace's **Anthropic** key.
- **Catalog/validation:** shared `MODEL_CATALOG`, `modelExists`, `normalizeSteps`.
- **Save + run:** existing `POST /workspaces/:id/pipelines` and the run engine —
  a saved AI pipeline is a normal pipeline, nothing special at run time.
- **Builder:** `apps/web/src/pages/PipelineBuilder.tsx` (create+edit surface) renders
  the draft for editing; the "PROMPT-DELETED"/dangling-prompt badge is reused for gaps.

---

## Phase 1 — Grounded one-shot generator (build now)

### API

`POST /workspaces/:id/pipelines/generate` (guard: `WorkspaceGuard`)
- Body: `GeneratePipelineDto { goal: string }`.
- Returns: `GeneratedPipeline { name, description, steps: PipelineStepInput[], gaps: GapNote[], origin }` — **not persisted**.

`PipelineAiService.generate(workspaceId, goal, actorId)`:
1. Resolve the workspace **Anthropic** key (decrypt). If absent → `400` "Set your
   Anthropic key to build with AI."
2. Load **public** prompts → a compact catalog entry per prompt:
   `{ id, title, tags, snippet(content, ~400 chars), provider?, model? }`. Cap at
   ~60 newest; if truncated, say so in the system prompt.
3. Build the **designer system prompt**: role = pipeline designer; the catalog;
   hard rules — *use only these prompt ids*; output **strict JSON** matching the
   step schema; choose `provider·model` from the allowed catalog (prefer each
   prompt's default); `mode ∈ {gate, auto}`; emit a **gap step**
   (`promptId: null, suggestedTitle, reason`) when no prompt fits; order logically
   (source → transform → render).
4. `AnthropicClient.complete({ apiKey, model: <top Anthropic model>, system, prompt: goal, maxTokens })`.
5. **Parse + validate + repair** (server is the source of truth — the model cannot
   be trusted to be valid):
   - Extract the JSON block robustly.
   - Each step: keep `promptId` only if it exists in the loaded catalog; otherwise
     convert to a **gap** (carry the model's `suggestedTitle`).
   - Clamp `provider·model` to a valid `MODEL_CATALOG` pair (fall back to the
     prompt's default, then a sane default).
   - Default `mode` to `auto` unless the model said `gate`.
   - Drop empty / malformed steps.
6. Return the draft + `origin { source: 'ai', goal, model }`.

**Edge cases:** empty library → return a friendly "create some prompts first";
model returns junk → repaired, or `422` to retry; all-gaps is allowed (the user
fills them in).

### Web

- **"✨ Build with AI"** button on the Pipelines page, next to "New pipeline".
  Disabled with a tooltip when the workspace has no Anthropic key.
- A small **modal**: textarea "Describe what this pipeline should do…" + **Generate**
  (loading state; errors inline).
- On success → `navigate('/pipelines/new', { state: { draft } })`. The builder reads
  `location.state.draft` and pre-fills steps (editable). **Gap** steps render with a
  "needs a prompt" badge (reuse the dangling-prompt treatment) and block save until
  filled or removed.
- **Save** uses the existing create endpoint, carrying `origin` through.

### Provenance (feedback seed — no new UI work)

- `Pipeline.origin?: { source: 'ai' | 'manual'; goal?: string; model?: string }`
  added to the schema + shared model + create DTO. Manual pipelines omit it.
- Threaded: `generate` returns it → builder holds it → save persists it.
- Free nice-to-have: a small **"✨ AI-built"** badge on AI-origin pipeline rows.

### Shared / contracts

- `GeneratePipelineDto`, `GeneratedPipeline`, `GapNote`, and `PipelineOrigin` in
  `@lyra/shared` (interfaces only; api implements DTO classes that `implements` them).

---

## Later phases (roadmap — not built now)

- **Phase 2 — Conversational:** same `PipelineAiService`, but multi-turn — the AI
  asks clarifying questions and refines the draft across turns before you accept.
  Reuses Chats' history mechanism.
- **Phase 3 — Two-way copilot (the real "AI ↔ Lyra"):** Anthropic **tool use**.
  The loop: model emits `tool_use` → api executes against existing services →
  `tool_result` back → model continues.
  - *Read tools (free):* `search_prompts`, `get_pipeline`, `list_pipelines`,
    `get_run`, `get_run_result`, `get_project`.
  - *Act tools (approval-gated):* `save_pipeline`, `run_pipeline`, `approve_gate`,
    `update_step` / `update_prompt`.
  - **Safety:** every side-effecting tool call surfaces an explicit Approve prompt
    ("Lyra wants to run pipeline X — will spend OpenAI credits"). The human disposes.
  - **Surface:** the **Chats** workbench gains a pipeline canvas beside the
    conversation.
- **Phase 4 — Closed loop:** AI runs → reads results/errors → edits the step/prompt
  → re-runs → converges. Hard caps on cost + iterations. Lands the dropshipping
  autopilot.

## Feedback / learning loop (how "good" is measured)

1. **Now:** provenance (above) — the seed that makes learning possible.
2. **Implicit signals (primary):** run count, run completion/success, gate
   **approvals**, asset **approvals/downloads** — already stored, objective,
   hard to game.
3. **Later (explicit):** a 👍/👎 on a **run's result** (output quality, not the
   diagram). Then, at generate time, **retrieve top-scoring pipelines for a similar
   goal** and feed them to Claude as **few-shot examples** → designs improve over time.

## Non-goals (v1)

- AI writing new prompt content (gaps are flagged, not filled).
- Fan-out / conditions in generated steps.
- Tool use / autonomous runs / closed loop (Phases 3–4).
- Explicit rating UI (provenance only).
- Project-context grounding in the goal (deferred; goal text only for v1).

## Invariants honored

- Validation lives in the api; shared holds only types/enums (`GeneratePipelineDto`
  is an interface in shared, a class in the api).
- Server is the source of truth: the model's output is fully re-validated against
  real prompt ids + the model catalog before it reaches the client.
- Keys never leave the server; the generator decrypts the Anthropic key server-side.
- A saved AI pipeline is an ordinary `Pipeline` — no special run path.
