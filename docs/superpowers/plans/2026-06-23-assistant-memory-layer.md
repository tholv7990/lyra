# Plan — Lyra memory layer (memanto-inspired): make every AI touchpoint remember

> **Source:** deep-read of [moorcheh-ai/memanto](https://github.com/moorcheh-ai/memanto) (MIT glue over the proprietary Moorcheh engine).
> We steal the **design**, not the engine: the `remember`/`recall`/`answer` primitives, typed memory,
> recency decay, provenance/confidence, and conflict-versioning — built on Lyra's own Mongo, no Moorcheh,
> no new service, no vendor coupling.
> **Date:** 2026-06-23. **Status:** plan, nothing built.
>
> **Updated 2026-06-23:** added **entity-linked memories** (a lightweight relational graph) — the one
> takeaway worth keeping from evaluating [safishamsi/graphify](https://github.com/safishamsi/graphify)
> (GraphRAG). A graphify *service* was rejected (wrong purpose — it graphs codebases for IDE agents — and
> wrong stack); full GraphRAG is deferred (see non-goals).

## The idea (stolen + adapted)

A workspace-scoped **memory layer** so Lyra stops forgetting what the user is doing — and uses it to make
*every* AI surface smarter, not just chat. Three primitives (memanto's, but Lyra-native):
- **`remember(memory)`** — write a typed memory, with conflict-versioning (no silent overwrite).
- **`recall(query, scope)`** — cheap, **non-LLM** retrieval (recency + keyword/subject match) → top-N memories.
- **`answer(query)`** — `recall` + LLM-grounded reply, using the workspace's **existing BYO key** (inv. 7).

> **Hard rule (from your own cost discipline):** `recall` must be **non-LLM** — recency + keyword first,
> embeddings later. Only `answer` spends the workspace key. Never burn keys on retrieval.

## Why this improves Lyra (it's not just "chat remembers")

A memory layer is the substrate for the **brand-consistency wedge** in the [research-creative-loop spec](../../specs/2026-06-22-lyra-v3-research-creative-loop.md) — "Lyra learns your business." It enhances four surfaces:

| Surface | What memory adds |
|---|---|
| **The assistant** (CopilotPanel / Lyra chat) | Cross-session recall: "you're on product X, you decided Y, you prefer 9:16." No re-explaining. |
| **Prompt / creative gen** | Recall brand voice, format prefs, hooks that the user kept → smarter defaults in generated prompts. |
| **Research loop** | Remember tested products, **rejected angles**, and the "did it sell?" outcomes → don't re-surface rejects; ground next run in prior decisions. (Reuses the spec's `EvidenceClaim` provenance pattern.) |
| **Run engine** | Remember preferred `provider·model` per step + gate decisions → smarter defaults on repeat runs. |

## Integration map — one layer, every surface

The memory layer is **one workspace service** (`remember`/`recall`) that *every* feature calls — **not**
per-feature silos. The pattern is uniform: **recall-on-start** (read relevant context in) + **remember-on-decision**
(write what was decided/learned/preferred out). Memories attach to a small set of **subjects**:
Brand/Project · Product · Niche · Competitor · Pipeline.

| Surface | Reads (recall) | Writes (remember) | Payoff |
|---|---|---|---|
| **Assistant / chat** | active product+project context, user prefs | explicit "remember this" + conservative inferred prefs/decisions | no re-explaining across sessions |
| **Prompt / creative gen** | brand voice, format prefs (9:16, UGC tone), hooks kept vs rejected | which outputs the user kept/edited/rejected | on-brand output that improves with use (the brand-consistency wedge) |
| **Run engine (pipelines)** | product facts, prior gate decisions, preferred `provider·model`; **recall relevant priors instead of append-all** within a run | gate approve/reject **reasons**, run ratings, model prefs | smarter defaults + the token win |
| **Product-research loop** | known facts, **rejected candidates/angles**, "did it sell?" outcomes | research conclusions, decisions, outcomes (provenance = the `SourceRow`s) | research compounds — no re-work, no re-surfacing rejects |
| **Products module** | **everything linked to the product** (relational recall via `relatedIds`) | lifecycle changes (Candidate→…→Killed), outcomes | the Product becomes a knowledge hub |
| **Crawler / competitor monitor** | tracked competitors, niche notes | interpreted competitor insights (a 60-day ad = a winner) | competitor knowledge persists + feeds research/creative |
| **Publishing** | channel prefs, what posted well | posting decisions/results | (lower priority) |

**The flywheel (the point):** research → *remember* winners & losers → creative *recalls* brand + winners →
publish → outcomes *remembered* → next research *recalls* them. That compounding loop is "Lyra learns your
business" — the brand-consistency + grounded wedge from the v3 research-loop spec. Without the layer every
feature is stateless; with it, they feed each other.

**Boundaries (don't duplicate structured data):** memory is **not** a copy of the brandKit, project
`variables`, the Product **evidence ledger**, or monitor `AdEvent`s — those stay where they are. Memory holds
the **learned/preference/decision/outcome** knowledge + **links** to those entities. Phase 0 reads existing
structured state directly; the `Memory` collection adds the learned layer on top.

**Constraints:** one shared service (no per-feature memory) · `recall` stays **non-LLM** on every surface ·
writes are cheap + provenance-tagged · workspace-scoped (inv. 5).

## Token economics (an explicit design goal)

Saving tokens is **first-class**, not a side effect — Lyra runs many sessions and picks a `provider·model`
per step, so context is resent constantly. The layer is designed to be **net-negative on tokens**.

**Savings levers**
- **Cross-session:** recall a compact, relevant set instead of resending the whole project/brand/history
  each session. The biggest, most reliable win.
- **In-session:** cap context growth — replace old turns with a recalled summary rather than resending the
  full transcript every turn.
- **Derive-once-strong → reuse-cheap (multi-model):** establish a fact with an expensive model **once**,
  `remember` it, then later steps/sessions read it with a **cheap** model instead of re-deriving. Recall
  also fits context into small/cheap windows.
- **Run engine — recall, don't append-all:** `executeStep` currently auto-appends *every* prior step
  result; on long pipelines that balloons. Replace with a budgeted recall of the *relevant* priors.
- **Stacks with the per-step cache:** `StepResultCache` reuses identical *outputs*; memory reuses relevant
  *context*. Additive.

**Design rules that guarantee net savings** (violate these and it becomes a net cost)
- **`recall` is non-LLM** (recency + keyword; embeddings only in Phase 2) — retrieval never spends a key.
- **Recall is budgeted:** top-N memories **and** a hard token cap (`MAX_RECALL_MEMORIES`, `MAX_RECALL_TOKENS`).
  Precise beats plentiful — bloated recall *adds* tokens.
- **Writes are cheap:** `remember` is non-LLM by default; auto-inference is conservative/batched; `answer`
  (the only LLM spender) is opt-in.
- **Measure it:** record `usage` (you already track `usage.tokens`/`costUsd` per step) with and without
  recall during rollout, so the saving is provable, not assumed.

**Net rule:** saves tokens *iff* recall is precise and replaces larger resent context, while writes stay cheap.

## Data model (`@lyra/shared`, zero runtime deps — inv. 1)

```ts
enum MemoryKind { Preference, Decision, Goal, Fact, Instruction, Relationship } // 6, not memanto's 13

interface Memory extends Audited {            // soft-delete + audit like every collection
  id: string;
  workspaceId: string;
  userId?: string;                            // omitted = workspace-shared; set = personal preference
  kind: MemoryKind;
  text: string;                               // the memory itself
  subjectType?: 'project' | 'product' | 'brand' | 'pipeline' | 'global';
  subjectId?: string;                         // what it's about (links to a Lyra entity)
  relatedIds?: string[];                      // links to related memories — a lightweight graph
  confidence: number;                         // 0..1
  provenance: 'explicit' | 'inferred';        // user said it vs assistant inferred
  source?: { conversationId?: string; runId?: string };
  supersedes?: string;                        // version chain: a conflict deactivates the old, links here
  lastUsedAt?: string;
}

// pure, in shared (inv. 1): relevance = confidence × recencyDecay(updatedAt) × subjectMatch
function scoreMemory(m: Memory, ctx: { subjectId?: string; now: string }): number;
```

**Conflict-versioning (memanto gap #5):** `remember` checks for a contradicting active memory on the same
`subjectId + kind`; if found, it **deactivates the old and links `supersedes`** — contradictions never
silently coexist, and you keep the history.

**Recency (gap #2):** `scoreMemory` decays by age so yesterday's decision outranks a 6-month-old one.

**Provenance (gap #3):** every memory is tagged explicit vs inferred + its source — the assistant can say
"you told me" vs "I noticed," and you can prune inferred noise.

**Entity links (lightweight graph — the one idea worth taking from graphify):** memories link to entities
(`subjectId`) and to each other (`relatedIds`), so `recall` can do **1-hop relational expansion** — "recall
everything connected to product X" (its niche, tested angles, rejected reasons, decisions) — **without** a
graph DB, Leiden clustering, or LLM entity-extraction. ~80% of the graph benefit at ~0% added cost; links
are set explicitly at write, or inferred cheaply from `subjectId` co-occurrence — never via an LLM.

## Phased build (ponytail: each phase ships value alone)

- **Phase 0 — structured-state context. No memory system at all.** Feed the assistant the user's *current
  state*: active Project/Product, recent Runs + their decisions, last Conversation. This alone covers most
  of "don't forget what I'm doing," with **zero new collection.** Ship first — it may be enough.
  `// ponytail: current-state context before any memory engine.`
- **Phase 1 — the `Memory` collection + `remember`/`recall`.** Typed memories, conflict-versioning,
  recency+keyword recall (non-LLM). Wire into the assistant: `recall` on session start (inject relevant
  memories), `remember` after a turn (explicit "remember this" + conservative inference). Module-per-feature
  under `apps/api/src/memory`; DTOs implement shared interfaces (inv. 2).
- **Phase 2 — `answer` + semantic recall (only if needed).** LLM-grounded `answer` via the workspace key;
  **MongoDB Atlas vector search** for recall *only if* recency+keyword proves insufficient. You're already
  on Mongo — don't add a vector DB (or Moorcheh) speculatively.

## Build steps (Phase 1 — typed Memory collection + `remember`/`recall`)

**1. Shared (`@lyra/shared`)** — types + pure logic (inv. 1), added to the barrel:
- `MemoryKind` enum, `Memory` interface, `RememberDto` / `RecallDto` interfaces, and `scoreMemory(m, ctx)`
  pure fn (recency-decay × confidence × subject-match) + `MAX_RECALL_MEMORIES` / `MAX_RECALL_TOKENS`
  constants. **Vitest** for `scoreMemory` (recency ordering, subject match).

**2. api module (`apps/api/src/memory`)** — module-per-feature:
- `memory.schema.ts` — Mongoose `Memory` (AuditedEntity + soft-delete). Indexes:
  `{ workspaceId, active, subjectId }` and `{ workspaceId, kind, updatedAt }`.
- `memory.service.ts`:
  - `remember(workspaceId, dto, actor)` — **conflict-versioning**: find an active memory with the same
    `subjectId + kind` that contradicts; if found set its `active=false` and the new one's `supersedes=oldId`
    (no silent overwrite, history kept).
  - `recall(workspaceId, { subjectId?, kinds?, query? })` — filter active + scope, score with
    `scoreMemory`, return top-N within `MAX_RECALL_MEMORIES` / `MAX_RECALL_TOKENS`. **No LLM.** Optional
    **1-hop relational expansion** via `subjectId`/`relatedIds` (the entity's memories + directly-linked
    ones), still within the token budget.
  - *(Phase 2)* `answer(...)` — recall + one provider call via the workspace BYO key.
- `memory.controller.ts` — `POST /workspaces/:id/memory` (remember), `POST /workspaces/:id/memory/recall`.
  Guards: `JwtAuthGuard → WorkspaceGuard`.
- `memory.module.ts` — **import `WorkspacesModule`** so the `WorkspaceGuard`'s deps resolve (NestJS DI:
  verify with an actual boot / health-200, not just a green build).
- DTOs are class-validator classes that `implements` the shared interfaces (inv. 2).

**3. Run-engine integration (the token win):**
- In `runs.service.ts` `executeStep`, replace the "append **all** prior results" block with a **budgeted
  recall** — `recallContext(state.steps, index, { budget })` selecting the relevant priors (recency +
  subject) up to `MAX_RECALL_TOKENS`. **Behind an env/feature flag**, append-all as the fallback.
- Log `usage` both ways during rollout to prove the reduction on a long pipeline.

**4. Assistant wiring:**
- On chat/session start: `recall(subjectId = active project/product)` → inject the top-N into the system context.
- After a turn: `remember` explicit "remember this" + (conservative) inferred prefs/decisions, tagged `provenance`.

**Definition of Done:** `scoreMemory` + conflict-versioning unit-tested; `recall` provably honors the token
budget; the run-engine flag flips append-all → recall with a **measured token reduction**; the module boots
(health 200) with the guard wired.

## Benchmark & validation (do this before trusting — or upgrading — the design)

> Grounded in a deep-research pass over the 2025–2026 memory-benchmark literature (LongMemEval,
> MemoryAgentBench, BEAM, LoCoMo-Plus, Mem0; adversarially verified). **Headline: the lean non-LLM design
> is a defensible default; the evidence does NOT justify pre-emptively building vector or graph memory.**
> Numbers below are directional (recent preprints + vendor-self-reported; Mem0's ">90% savings / SOTA"
> claims were refuted) — verify on our own data.

**What the literature establishes:**
- **No architecture wins everything.** A naive non-LLM lexical baseline (BM25-class) MATCHES OR BEATS
  vector/graph/agentic systems on **factual retrieval** (MemoryAgentBench: BM25 ~60% vs Mem0 ~33%, Zep ~38%,
  long-context GPT-4o ~58%), but loses on long-range/global understanding and "cognitive" memory.
- **Selective retrieval is the token/latency win; a graph adds ~2% accuracy at ~2× tokens / ~3× latency** and
  loses on single/multi-hop — so lean captures most of the value.
- **Full long-context is not the ceiling** — it degrades ~30% as dialogues lengthen even with perfect
  retrieval. Measure it as a baseline.
- **The hard part is architecture-agnostic.** ALL systems collapse from factual → "cognitive"/implicit
  memory (user goals/preferences/state). No retrieval upgrade fixes it — the lever is **explicit typed
  schemas** (our `Preference`/`Goal`/`Decision` kinds). A graph would NOT help here.

**The harness — per-competency, not one accuracy number.** Instrument the **indexing → retrieval → reading**
stages separately (our split: `recall` = retrieval; the optional `answer` = reading):
- **Indexing** → write/ingestion cost (must stay ~non-LLM for us).
- **Retrieval** → precision/recall, latency, **retrieved-token count** per query.
- **Reading** → answer accuracy + LLM token spend (only stage that calls the model).
Run on **synthetic multi-session dropshipping conversations** (research → creative → posting, across sessions)
with **golden-recall questions**, scored per competency: **factual recall · multi-session reasoning ·
temporal reasoning · knowledge-update (overwrite stale) · abstention · preference/goal ("cognitive")** —
each reported independently. A/B four backends behind the same reading interface: **lean (ours) ·
full-context · vector RAG · graph** — same questions, same answer model — and report **accuracy AND
tokens/latency/write-cost side by side**.

**Evaluation hygiene (or the numbers lie):** prefer **objective golden-recall** (where LLM-as-judge is
trustworthy); **do NOT use BLEU/ROUGE/exact-match/F1** and **do not disclose the task type in the judge
prompt** (both systematically distort memory eval); treat any LLM-judge as bias-prone (12 documented biases)
→ position-swap + reference answers + a small panel; **measure token savings on our own traffic** (mean + p95
retrieved-tokens/query + per-session totals, with vs without memory, answer model fixed) — ignore vendor figures.

**Upgrade-decision criteria (when lean is NOT enough → escalate):**
- → **Vector recall (Phase 2)** only if factual/semantic recall on our data falls short of the lexical
  baseline, OR the multi-session-reasoning gap vs full-context is large. (Lexical is often competitive — may never trigger.)
- → **Graph / GraphRAG (deferred)** only if relational/multi-hop queries show a real gap that justifies
  ~2× tokens / ~3× latency + write-time LLM extraction. High bar — the data says it rarely pays.
- → If **preference/goal recall** is the gap, add explicit typed slots — **not** a retrieval upgrade.

**Minimal credible benchmark for us:** ~5–10 synthetic dropshipping users × multi-session histories,
~150–300 golden questions spread across the 6 competencies (avoid tiny per-competency subgroups —
LongMemEval's ±40% error on ~6-question groups is the cautionary tale), lean vs full-context vs vector,
reported per competency. Enough to decide, cheaply.

## Scope cuts / non-goals
- **No separate memory service, no Moorcheh, no Ollama/Docker engine.** It's a Mongo collection + an api service.
- **No vector DB until Phase 2, and only if recency+keyword falls short.**
- **6 memory kinds, not 13** — collapse memanto's taxonomy to what Lyra uses.
- **Workspace-scoped first**; per-user personal memory via optional `userId` only when asked.
- **Conservative inference** — explicit `remember` + light inference with `provenance:'inferred'`; avoid memory spam.
- Not a doc/knowledge-base RAG (separate concern); doesn't replace the research **evidence ledger** (complementary — shared provenance/confidence types).
- **Full GraphRAG deferred** (entity-extraction + community detection, à la graphify): over-built for a small per-user memory set and reintroduces write-time LLM cost. Revisit only if entity-links + Atlas vector prove insufficient for relational recall.

## Invariants
Workspace-scoped queries (inv. 5) · `@lyra/shared` zero runtime deps — `scoreMemory` is a pure fn (inv. 1) ·
`answer` uses BYO per-workspace keys, `recall` spends none (inv. 7) · DTOs implement shared interfaces (inv. 2) ·
soft-delete + audited (the `supersedes` chain + `active` flag).

## Open decisions
1. **Workspace-shared vs per-user memory** — recommend workspace-shared with optional `userId` for personal prefs.
2. **Auto-infer vs explicit-only** — recommend explicit + conservative inference (tagged), to avoid noise.
3. **Unify with the research evidence ledger?** — recommend separate collections, **shared** provenance/confidence types (one provenance model across Lyra).

> For phase 1, run the writing-plans skill to turn this into a granular task breakdown once approved.
