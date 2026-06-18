# Ratings + few-shot retrieval — Design

> Status: **design approved** (brainstorm, 2026-06-18). Ready for an implementation plan.
> Extends the AI pipeline builder/copilot work
> ([docs/specs/2026-06-18-lyra-ai-pipeline-copilot-design.md](../../specs/2026-06-18-lyra-ai-pipeline-copilot-design.md)),
> specifically its "Feedback / learning loop §3 (later, explicit)" item. This is the
> **safe, no-autonomous-spend** half of the feedback loop — distinct from Phase 4
> (the closed loop), which requires a separate guardrail design.

## Goal

Let users rate a run's output 👍/👎, then feed the workspace's best-rated pipelines
into the AI pipeline builder as **few-shot examples** so generated designs improve
over time. No autonomous spend, no new provider calls beyond the existing generate
path.

## Guiding decisions (locked in brainstorming)

| Decision | Choice |
|---|---|
| Rating unit | **Per-run** (one overall verdict per run), not per-step or per-user. |
| Retrieval selection | **Global top-rated** pipelines (no goal-similarity / embeddings in v1). |
| Storage | **Embedded on the Run document** — no new collection. |
| Multi-user | **One verdict per run, last-writer-wins**; record `by`/`at`. Per-user ratings deferred. |
| Rateable when | Only after the run has **at least one completed step**. |
| Scoring | **Explicit thumbs only**: net = (#up − #down); run-count as tiebreaker. Implicit-signal blending deferred. |
| Examples fed | **Top 3** pipelines with net > 0. |

## Architecture fit (what we reuse)

- **Run document** (`apps/api/src/runs/run.schema.ts`) — embed the rating; runs already
  carry `pipelineId`, so ratings aggregate to a pipeline cleanly.
- **`RunAccessGuard`** — already gates `/runs/:id/*`; the rating write path reuses it.
- **`PipelineAiService`** (`apps/api/src/pipelines/pipeline-ai.service.ts`) — already
  builds the designer system prompt from the public-prompt catalog; few-shot examples
  inject into the same place, and the existing `repairSteps` re-validates output (so
  examples can never bypass grounding).
- **`Pipeline.origin { source, goal, model }`** — already persisted; supplies each
  example's "goal" line. Manual pipelines (no `origin.goal`) fall back to name +
  description.
- **Run toolbar** (`run-bar run-view-bar` in `apps/web/src/pages/ProjectDetail.tsx`) —
  existing run-level chrome (status badge + Run all / Stop / Reset); the thumbs live here.
- **`api` fetch wrapper** + **react-i18next** (EN/VI) — existing web plumbing.

---

## 1. Data model

`Run` gains an optional embedded rating (no new collection):

```ts
// apps/api/src/runs/run.schema.ts (Run class)
@Prop({ type: Object })
rating?: { value: 'up' | 'down'; by: string; at: string };
```

```ts
// packages/shared/src/models/index.ts (Run interface)
export interface RunRating {
  value: 'up' | 'down';
  by: string;   // userId that set it
  at: string;   // ISO timestamp
}
// Run interface gains:  rating?: RunRating;
```

- **One verdict per run, last-writer-wins.** The run is a shared artifact; any member
  with run access sets/overwrites the team's "was this output good?" verdict.
- `by` is a raw userId (not an expanded `UserRef`) — the verdict is a signal, not a
  social feature; no need to populate the actor. (Upgrade path: a `Rating` collection
  keyed by `{ runId, userId }` if per-user ratings are ever wanted.)
- `run.views.ts#toRun` maps `doc.rating` straight through.

## 2. API — write path

```
PATCH /runs/:id/rating      (guard: RunAccessGuard)
```

- DTO (shared interface + api class):
  ```ts
  // shared/dto: interface RateRunDto { value: 'up' | 'down' | null }
  // api: class RateRunBody implements RateRunDto  (class-validator: @IsIn(['up','down']) on a nullable field)
  ```
  `value: null` **clears** the rating (toggle-off from the UI).
- `RunsController.rate(@CurrentRun() run, @Body() body, @CurrentUser() user)` →
  `RunsService.rate(doc, value, actorId)`.
- `RunsService.rate`:
  - **Reject with 400** if the run has no completed step
    (`!doc.steps.some(s => s.status === 'done')`) — rating idle output is meaningless.
  - `value === null` → unset `doc.rating`; else set `{ value, by: actorId, at: iso(now) }`.
  - `doc.updatedBy = actorId`, save, return `this.toView(doc)`.

## 3. API — retrieval (read path)

A read-only Mongo aggregation over runs, grouped by `pipelineId`, joined to pipeline docs.
Lives in `PipelineAiService` to keep it next to its only consumer and to **avoid a
circular module dependency** with `RunsService`.

- **Module wiring:** register the `Run` schema in `PipelinesModule`'s
  `MongooseModule.forFeature` and inject the **Run model** (`@InjectModel(Run.name)`)
  into `PipelineAiService`. Registering the same schema in two modules is supported (one
  connection, separate injection token) and sidesteps importing `RunsService` (which
  would form a `pipelines ↔ runs` cycle, since `RunsController` already uses
  `PipelinesService`). `PipelineAiService` also injects `PipelinesService` (same module)
  to load the example pipeline docs.

- **Aggregation** (`private async topRatedPipelineIds(workspaceId, limit = 3)`):
  ```
  match { workspaceId, rating: { $exists: true }, pipelineId: { $exists: true } }
  group by pipelineId:
    up   = sum(rating.value == 'up'  ? 1 : 0)
    down = sum(rating.value == 'down'? 1 : 0)
    runs = sum(1)
  addFields net = up - down
  match net > 0
  sort { net: -1, up: -1, runs: -1 }
  limit
  → [{ pipelineId, net, up, down, runs }]
  ```

- **`private async topExamples(workspaceId, catalogById)`** → formatted few-shot block
  (string) or `''` when none qualify:
  - Load the qualifying pipeline docs via `PipelinesService` (skip any missing/empty).
  - For each, emit a compact entry:
    ```
    Goal: <origin.goal ?? `${name} — ${description}`>
    Steps:
      1. <name> [<provider>/<model>] <mode> — prompt "<title>" (id: <promptId>)
      ...
    ```
    Resolve `<title>` from the catalog `byId` map already built in `generate()`/`chat()`;
    a step whose `promptId` isn't in the public catalog shows `(prompt unavailable)` but
    still conveys the step shape. Gap steps (`promptId === ''`) show `(gap)`.
  - No prompt snippets in examples — titles only — to keep tokens bounded (`maxTokens`
    stays 2000).

## 4. AI builder integration

**Reorder note:** today `generate()`/`chat()` build the catalog `byId` map *after* the
`complete()` call. Move `byId` construction up so it (and `examples`) exist *before* the
system prompt is built: `catalog → byId → examples = await topExamples(workspaceId, byId)
→ designerPrompt(catalog, current, examples) → complete(...)`. `repairSteps` keeps using
the same `byId`.

`generate()` and `chat()` compute `const examples = await this.topExamples(...)` after
building the catalog `byId` map, and pass it into the prompt builders.

`designerPrompt()` and `chatDesignerPrompt()` insert, **after the CATALOG block and
before the task/behaviour block**, when `examples` is non-empty:

```
EXAMPLES OF WELL-RATED PIPELINES IN THIS WORKSPACE (use as inspiration for structure
and prompt selection; you may reuse their prompt ids when they fit the goal):
<examples block>
```

When `examples` is empty the section is omitted entirely (no behavioural change vs today).
The model's output is still fully re-validated by `repairSteps` — examples can only
suggest, never bypass the prompt-id grounding or the model-catalog clamp.

**Scoring is explicit-thumbs-only for v1** (net up−down). Blending the other implicit
signals (run completion, gate/asset approvals) into the rank is a deferred refinement.

## 5. Web

- **Thumbs in the run toolbar.** In `ProjectDetail.tsx`, beside the status badge in
  `run-bar run-view-bar`, render a 👍 / 👎 pair (icon buttons) reflecting `run.rating`:
  - The active value is highlighted; clicking it again clears (PATCH `value: null`).
  - Visible only once the run has a completed step (matches the server gate).
  - Optimistic update via the `api` wrapper; on error, revert + surface inline.
- A tiny shared handler (in `ProjectDetail` or `useRunActions.ts`) keeps the logic out
  of presentational components, consistent with the web "no business logic in
  components" rule.
- i18n: add keys under `apps/web/src/i18n/locales/{en,vi}/run.*` (e.g.
  `run.rateUp`, `run.rateDown`, `run.rated`). Vitest setup already loads real strings.
- **Out of scope (optional follow-up):** a pipeline's aggregate rating badge on the
  Pipelines library list — keeps v1 tight.

## 6. Testing

- **shared** — type-only change; no new unit tests.
- **api**
  - `RunsService.rate`: sets a rating; clears on `null`; **rejects when no step has
    completed**; stamps `by`/`at`.
  - `topRatedPipelineIds` aggregation: net = up−down, filters net ≤ 0, sorts + limits,
    tiebreak by up then runs. (Jest with a mocked Run model, or a focused
    mongodb-memory-server test if the aggregation pipeline is easier verified live.)
  - Extend `pipeline-ai.service.spec.ts`: examples injected into the system prompt when
    present; section omitted when none qualify; generation still validates as before.
- **web** — a RunFlow/run-view test: thumbs render once a step is done, fire the PATCH,
  reflect/clear the active state.
- **Full gate before any commit:** `pnpm turbo run type-check lint test build`
  (rebuild + restart the api after `apps/api`/`packages/shared` changes).

## 7. Non-goals (v1)

- Goal-similarity or embedding-based retrieval.
- Per-step or per-user ratings (per-run, last-writer-wins only).
- Blending implicit signals (completion, approvals, downloads) into the score.
- Pipeline-rating badges in the library.
- Any autonomous / closed-loop behaviour (Phase 4 — needs its own guardrail design).

## Invariants honored

- **Validation in the api, types in shared:** `RateRunDto` is an interface in
  `@lyra/shared`; the api implements a class-validator class that `implements` it.
- **Server is the source of truth:** the rateable-when gate and the few-shot scoring run
  server-side; the AI's output is still re-validated against real prompt ids + the model
  catalog.
- **No server-only fields in shared:** the rating is a safe transport shape (`value`,
  `by` userId, `at`); no secrets involved.
- **Multi-tenancy:** the aggregation matches on `workspaceId`; the write path is gated by
  `RunAccessGuard` (run → project/workspace access). Every query stays workspace-scoped.
- **A rated pipeline is still an ordinary pipeline** — no special run path; few-shot
  examples only shape the designer prompt.
