# Lyra — Composable Pipelines (business model v2)

> **Status:** approved design, not yet implemented. This document **supersedes the
> fixed 8-step pipeline** described in `lyra-requirements.md` (§ the hard-coded
> `STEP_DEFS` / `STEP_PROVIDERS` run model). The 8 steps survive only as a
> **starter template**, not as the product's structure.

## 1. Why we're changing

Today a run is a **locked 8-step state machine** (find → crawl → brief → insight →
prompts → images → video → QA), hard-coded in `@lyra/shared` (`STEP_DEFS`) with
fixed gates (2/4/7) and a fixed `step.key → provider` map. That one opinionated
flow doesn't fit every goal — research, product, marketing, and ad-hoc work each
want a different shape.

**The change:** users **compose their own pipelines** from steps. Each step binds
a **prompt** (from the library we already built) to a **provider + model** and a
**gate/auto** mode. Pipelines live in a **reusable workspace library** and are
assigned to projects. Lyra becomes a lightweight **workflow builder**, not a
single pipeline.

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Prompt** | A reusable library item (content + media + tags). Existing. |
| **Step** | One node in a pipeline: a **prompt + provider + model + mode** (auto/gate). Inline in the pipeline (not a separate library entity). |
| **Pipeline** | An ordered, linear chain of steps + name/description/tags. The canonical name for what we earlier called a "sequence." A **workspace library item**. |
| **Run** | One execution of a pipeline **for a project** — a snapshot of the steps + the project's context. |
| **Project** | Owns nothing structural now; it **assigns** library pipelines and supplies run **context** (product/niche/homepage). |

## 3. Entities & relationships

```
Workspace
 ├─< Prompt            (library — content the steps run)
 ├─< Pipeline          (library — reusable, name/desc/tags + ordered Steps)
 │      └─ Step (inline)  ──▶ Prompt  +  provider·model  +  gate/auto
 ├─< Project
 │      └─< (assigned) Pipeline      (many-to-many link)
 │      └─< Run                       (executes a Pipeline for this Project)
 └─< ApiKey            (per-provider, encrypted, BYOK)

Run = snapshot(Pipeline.steps) + Project.context, walked by the run engine.
```

- **Pipeline ↔ Project** is **many-to-many** (a pipeline can be assigned to many
  projects; a project pins many pipelines).
- A **Run** references both `pipelineId` and `projectId` and **snapshots** the
  resolved steps at creation, so later edits to the pipeline never corrupt an
  in-flight or historical run.

## 4. Data model (proposed)

**Pipeline** (workspace library, `Audited`)
```
id, workspaceId
name, description, tags: string[]
steps: PipelineStep[]        // inline, ordered
active, createdBy, updatedBy, createdAt, updatedAt
```

**PipelineStep** (embedded in `Pipeline.steps`)
```
id            // stable node id (for connectors / drawer selection)
name
promptId      // ref → Prompt (the body it runs)
provider      // Provider enum
model         // string, must be in MODEL_CATALOG[provider]
mode          // 'auto' | 'gate'
```

**Project ↔ Pipeline assignment** — a small join collection `ProjectPipeline`
```
id, workspaceId, projectId, pipelineId
active, createdBy, updatedBy, createdAt, updatedAt
```
(Chosen over an array field so assignment can carry metadata later — e.g. per-project
defaults — and to scale cleanly.)

**Run** (`Audited`) — extends today's `Run`
```
id, workspaceId, projectId, pipelineId
pipelineName                 // snapshot label
context: { product, niche, homepageUrl }   // snapshot for {placeholders}
status, currentStep
steps: RunStep[]             // snapshot of resolved steps
active, createdBy, updatedBy, createdAt, updatedAt
```

**RunStep** (snapshot; editable per-run like today's workbench)
```
index, name
promptId, promptTitle        // provenance
provider, model, mode
prompt                       // filled text (placeholders resolved); user-editable
status, result, assetIds, usage, error, startedAt, finishedAt
```

**Prompt** — unchanged, except `type` (StepKey) becomes a **category label** for
filtering, **decoupled** from provider selection (provider now lives on the step).

**Model catalog** — new shared constant
```
MODEL_CATALOG: Record<Provider, { id: string; label: string }[]>
// e.g. Anthropic: Opus 4.8 / Sonnet 4.6 / Haiku 4.5; OpenAI: GPT-5.5; …
```

## 5. Decision log (everything we settled)

### Architecture
1. **Steps are inline in a pipeline**, not a separate reusable entity. Reuse comes
   from the prompt library (the expensive part). Fewer moving parts, no
   edit-propagation on steps.
2. **A step runs a library prompt** (promptId) + provider + model. One source of
   truth for prompt text.
3. **The 8-step creative flow is kept as a one-click starter template** that
   creates a ready-made pipeline; users edit, clone, or ignore it.
4. **Model is chosen from a curated catalog** (`MODEL_CATALOG` in shared), shown
   as a validated dropdown — no free-text model ids.
5. **Provider + model are a per-step user choice.** `STEP_PROVIDERS` (the fixed
   key→provider map) is retired as a hard binding; `prompt.type` no longer locks a
   provider.
6. **Gates are per-step**, user-toggled (any step can pause for approval). No fixed
   gate positions.

### Library & reuse
7. **Pipelines are a workspace-level library** (like Prompts), reusable across
   projects. (Updates the earlier "project-scoped" assumption.)
8. **Assigning a pipeline to a project = a link to the shared definition.** Edit it
   once → every project using it benefits on **future** runs; past runs are safe
   (snapshots). **Duplicate** to make a project-specific variant.
9. **Project ↔ Pipeline is many-to-many** via assignment; a project pins the
   pipelines it uses.
10. **Library pipelines are visible to all workspace members**; edit/delete is
    restricted to the **creator or workspace owner**.

### UI / UX
11. **Builder = vertical, linear flow.** Start node at top → step nodes joined by
    connectors with `+` insert buttons → End node at bottom. Single path, no graph
    library, mobile-friendly. (Branching/DAG is explicitly deferred.)
12. **Editing a node = side drawer** (right panel on desktop, bottom sheet on
    mobile): prompt picker, provider, model, gate/auto.
13. **Start & End nodes are functional.** Start = run trigger + run inputs (the
    project context that fills `{product}/{niche}/{homepage}`); End = final output.
14. **Pipeline page is a unified flow**: the same view you edit lights up with live
    status when you run it (a gate node shows **Approve** inline). A small **Runs**
    history sits alongside.
15. **Mobile = one step per page** (a pager/wizard: "Step 2 of 5", `‹ Prev / Next ›`,
    Start first / End last) for **both building and running**. Desktop shows the
    full overview; mobile folds it into the pager.
16. **The Project page becomes a pipelines hub**: project info + a grid of assigned
    **Pipeline cards** + "Add from library" / "New". The old project-level
    single-run workbench is **removed**; runs belong to pipelines.
17. **Reorder** via drag-handle + the `+`-on-connector insert.
18. **Nav:** add a global **Pipelines** library section (alongside Prompts). Final
    nav: Home / Projects / Prompts / Pipelines / Settings.
19. **v1 node type:** every node is a prompt-run. No non-AI / non-prompt nodes yet.

## 6. Execution semantics

- **Create run** = pick a pipeline **in a project** → snapshot its steps, fill each
  step's prompt placeholders from the project context, copy provider/model/mode.
- The **run engine carries over** (`assertRunnable → begin → complete/fail →
  approve`, plus stop/reset). It already walks an ordered step array with gates —
  it just stops assuming a fixed length of 8 and reads **provider/model from each
  step** instead of `STEP_PROVIDERS` / a fixed model.
- **Per-step key gating** stays: a step is runnable only if the workspace has an
  `ApiKey` for that step's chosen provider.
- **Dispatch** stays the `StepProvider` interface + `ProviderRegistry` (Provider →
  impl); the Anthropic provider reads `step.model` (generalizing Phase 4).
- **Gates** pause the run (`awaiting_gate`) at any step flagged `gate`.
- RunSteps remain **editable** in the workbench before running (as today).

## 7. What changes vs. reuses

**Reused (foundation holds):** the run engine, the `StepProvider`/registry + keys,
the Prompt library (content/media/tags), audit/soft-delete/cascade, the auth &
workspace stack.

**Changes:**
- `@lyra/shared`: add `Pipeline` / `PipelineStep` / `ProjectPipeline` / `MODEL_CATALOG`;
  extend `Run`/`RunStep` (provider/model/mode/promptId/context); retire
  `STEP_PROVIDERS` as a hard binding; `STEP_DEFS` becomes template seed data.
- api: new **pipelines** module (library CRUD), **assignment** endpoints, and
  **run-from-pipeline** creation; run engine generalized to dynamic length +
  per-step provider/model; provider execution uses `step.model`.
- web: **Pipelines** library page; **Project** pipelines hub; the **builder**
  (vertical flow + drawer + start/end); **unified run** view with live status +
  inline gate approval; **mobile pager**.

## 8. Deferred (not in this iteration)

- **Branching / DAG** (parallel + conditional paths, fan-out/merge). The linear
  model and snapshots are designed so this can be added later without a rewrite.
- **Reusable standalone steps** (a step library) — folded into prompts for now.
- **Workspace-level pipeline run history / analytics**, scheduling, versioning.
- **Sending attachments to the provider** (images/PDF content blocks) — prompts
  store media now; wiring it into the provider call is a separate step.

## 9. Suggested build phases (for the pivot)

1. **Shared contracts** — Pipeline/PipelineStep/ProjectPipeline models + DTOs,
   `MODEL_CATALOG`, Run/RunStep extensions, decouple `prompt.type` from provider.
2. **api — pipelines library** — CRUD (workspace-visible, creator/owner edit) +
   tags; unit/e2e.
3. **api — assignment + run-from-pipeline** — `ProjectPipeline`; generalize the
   run engine (dynamic steps, per-step provider/model, per-step gates); create runs
   from a (project, pipeline); e2e.
4. **web — library + hub** — Pipelines nav + library page; Project pipelines hub
   (assign / add-from-library / new).
5. **web — builder** — vertical flow (Start/End, connectors, `+` insert), node
   drawer (prompt/provider/model/gate), reorder.
6. **web — unified run** — live status on nodes, inline gate approval, results;
   **mobile one-step pager** for build + run.
7. **Seed the 8-step starter template** + polish; retire the old project-run
   workbench.
