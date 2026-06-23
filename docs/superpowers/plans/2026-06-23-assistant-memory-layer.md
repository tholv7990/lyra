# Plan — Lyra memory layer (memanto-inspired): make every AI touchpoint remember

> **Source:** deep-read of [moorcheh-ai/memanto](https://github.com/moorcheh-ai/memanto) (MIT glue over the proprietary Moorcheh engine).
> We steal the **design**, not the engine: the `remember`/`recall`/`answer` primitives, typed memory,
> recency decay, provenance/confidence, and conflict-versioning — built on Lyra's own Mongo, no Moorcheh,
> no new service, no vendor coupling.
> **Date:** 2026-06-23. **Status:** plan, nothing built.

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
    `scoreMemory`, return top-N within `MAX_RECALL_MEMORIES` / `MAX_RECALL_TOKENS`. **No LLM.**
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

## Scope cuts / non-goals
- **No separate memory service, no Moorcheh, no Ollama/Docker engine.** It's a Mongo collection + an api service.
- **No vector DB until Phase 2, and only if recency+keyword falls short.**
- **6 memory kinds, not 13** — collapse memanto's taxonomy to what Lyra uses.
- **Workspace-scoped first**; per-user personal memory via optional `userId` only when asked.
- **Conservative inference** — explicit `remember` + light inference with `provenance:'inferred'`; avoid memory spam.
- Not a doc/knowledge-base RAG (separate concern); doesn't replace the research **evidence ledger** (complementary — shared provenance/confidence types).

## Invariants
Workspace-scoped queries (inv. 5) · `@lyra/shared` zero runtime deps — `scoreMemory` is a pure fn (inv. 1) ·
`answer` uses BYO per-workspace keys, `recall` spends none (inv. 7) · DTOs implement shared interfaces (inv. 2) ·
soft-delete + audited (the `supersedes` chain + `active` flag).

## Open decisions
1. **Workspace-shared vs per-user memory** — recommend workspace-shared with optional `userId` for personal prefs.
2. **Auto-infer vs explicit-only** — recommend explicit + conservative inference (tagged), to avoid noise.
3. **Unify with the research evidence ledger?** — recommend separate collections, **shared** provenance/confidence types (one provenance model across Lyra).

> For phase 1, run the writing-plans skill to turn this into a granular task breakdown once approved.
