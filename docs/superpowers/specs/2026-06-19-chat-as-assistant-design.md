# Chat as Assistant — Prompt owns saved answers (v1 design)

- **Date:** 2026-06-19
- **Status:** Implemented (v1) on `dev` (api `6a22800`, web `d7b0a89`, + follow-ups). §12–13 record the prompt↔pipeline↔project boundary and the as-built refinements.
- **Scope:** `apps/web` (Chats, Prompt details), `apps/api` (prompts, conversations), `@lyra/shared`

## 1. Problem & intent

Chat is being reframed from a top-level nav destination into a **generic AI assistant**
reachable anywhere via the bottom-right FAB (already shipped). The relationship between a
chat and the prompt library is being made explicit: a **Prompt is the durable parent**, and
**each saved response is a child of that prompt** — no matter which (or how many) chats
produced it. A loose answer with no prompt parent cannot be saved; saving is deliberate and
per-answer.

This supersedes the conversation-level linkage described in `CLAUDE.md` (the auto-save toggle,
"Save to history", and the per-prompt conversation timeline `PromptHistory`).

## 2. Goals / non-goals

**Goals (v1)**
- Chat is a generic, always-reachable assistant (FAB); not in the nav.
- Prompt (parent) owns a curated list of **saved results** (answer children).
- Saving an answer requires a prompt parent; **Save as prompt** is the gateway in a new chat.
- Prompt **Details** shows saved results instead of a conversation history timeline.
- **Open in chat** shows the full conversation thread + a rail of the prompt's saved results.

**Non-goals (deferred — see §9)**
- Formal prompt versioning (we use a per-answer prompt **snapshot** instead).
- App context-awareness for the assistant (it's generic in v1).
- In-chat thread switcher (the "chooser" upgrade for Open-in-chat).
- Compare grids / rating analytics / auto-logging every generation (firehose).

## 3. The model

```
Prompt (durable parent)
  └── results[]  ← children: each a saved answer, gathered across ALL chats
                   { output, provider·model, promptSnapshot, rating?, note?,
                     sourceConversationId?, createdBy, savedAt }

Conversation (per-user, disposable scratchpad)
  ├── originPromptId?   ← provenance + "resume" target; NOT shown as prompt history
  └── messages[]        ← each stamps provider·model (unchanged)
```

A prompt accumulates results from many conversations over time. Conversations remain the
working surface; only **deliberately saved** answers become children (curated, not a firehose).

## 4. Save gating & flows

- An answer is savable **only when the chat has a prompt parent** (`originPromptId`).
- **New / parentless chat:** the per-message **Save** action is disabled. **Save as prompt**
  is the gateway: the user's instruction becomes a new Prompt, the answer attaches as its
  **first result**, and the chat becomes prompt-linked → subsequent answers are savable.
- **Chat opened from a prompt:** already parented → answers savable immediately.

```
A) Open in chat (from Prompt)        B) FAB / new chat (no parent)
   chat born WITH a parent              chat freely; Save = OFF
   Save answer → child                  to keep a result:
                                          Save as prompt  ← gateway
                                          → Prompt created, answer = first child
                                          → chat now parented; Save = ON
```

## 5. Data model changes

### `@lyra/shared`
- New `SavedResult` interface (transport shape, no server-only fields):
  `{ id: string; output: string; provider: Provider; model: string;
     promptSnapshot: string; rating?: number; note?: string;
     sourceConversationId?: string; createdBy: { id: string; name: string };
     savedAt: string }`  (createdBy mirrors the existing `Prompt.createdBy` author shape)
- `Prompt` gains `results: SavedResult[]`.
- DTO interfaces: `SaveResultDto` (append), `UpdateResultDto` (rating/note — optional v1).

### `apps/api`
- `Prompt` Mongoose schema: embedded `results` subdocument array (curated set, small).
- `prompts.service`: `addResult`, `removeResult`, (optional) `updateResult`. Workspace-scoped,
  permission-checked (only members who can view the prompt; creator/editor to mutate).
- `prompts.controller`:
  - `POST   /workspaces/:id/prompts/:promptId/results`
  - `DELETE /workspaces/:id/prompts/:promptId/results/:resultId`
  - `PATCH  /workspaces/:id/prompts/:promptId/results/:resultId` (rating/note — optional v1)
- `conversations`: keep `originPromptId`; keep the "latest conversation for a prompt" lookup
  used by Open-in-chat resume. **Retire** `listForPrompt` (the prompt-history list) from the
  Details surface (endpoint may stay until the web no longer calls it, then removed).

### Snapshot, not versioning
`promptSnapshot` stores the prompt text used to produce the answer, so an edited prompt does
not make old results misleading — the lazy stand-in for versioning (§9 graduation path).

## 6. UI surfaces

### Prompt Details (`apps/web/src/components/PromptDetails.tsx`)
- Prompt body + meta + tags — unchanged.
- **Remove** the conversation-history timeline (`PromptHistory.tsx`).
- **Add** a **Saved results** list (new `SavedResults.tsx`): each row =
  `rating · provider·model · output snippet · savedAt · ↗ chat` (back-link to
  `sourceConversationId`). Delete-result affordance for editors.

### Open in chat (`apps/web/src/pages/Chats.tsx`)
- Behavior **(a):** resume the **most recent** conversation for the prompt (or a fresh draft if
  none) + a **New chat** button. (Matches today's "open latest or draft".)
- Main pane = full conversation. Side rail = the prompt's saved results (same data as Details).
- Each AI message gets a **Save** action → `POST …/results` (gated per §4).
- **Retire** the auto-save toggle and the "Save to history" button (conversation-level linking).

### Assistant (FAB) — generic
- FAB opens `/chats` (shipped). No app context injected in v1; the user supplies context by
  typing or by opening from a prompt.

### Save as prompt (`apps/web/src/components/SaveAsPromptModal.tsx`)
- On save, also append the originating answer to the new prompt's `results[]` (first child) and
  link the conversation (`originPromptId`).

## 7. What is removed / retired

- Chats nav item → FAB (already done).
- `PromptHistory` conversation timeline → `SavedResults`.
- Chats auto-save toggle + "Save to history" → deliberate per-answer **Save**.

## 8. Migration

- New `results` arrays start empty; no backfill required.
- Existing conversations keep `originPromptId` (resume still works). Past conversations simply
  stop appearing on the prompt as "history"; they remain in the global Chats list.
- Remove the prompt-history list endpoint/component only after the web no longer references it.

## 9. Deferred / graduation paths

- **Versioning:** if diff/rollback is ever needed, promote `promptSnapshot` to real version
  objects (PromptLayer/Langfuse style) with answers pinned to a version.
- **Context-aware assistant:** feed current project (`{product}`/`{niche}`), page, or pipeline
  into the system prompt.
- **Thread switcher:** non-blocking in-chat picker of past conversations (option "c" power
  without the gate).
- **Compare grid / ratings analytics**, and optional auto-logging.

## 10. Testing

- **shared:** `SavedResult` type compiles; any pure helper (e.g. snippet/rating clamps).
- **api:** `prompts.service` add/remove result (unit), workspace scoping + permission guard,
  gating contract (no result without a prompt). e2e on the new routes.
- **web:** Chats Save-action enabled only when prompt-parented; PromptDetails renders results;
  Save-as-prompt attaches the first result; Open-in-chat resumes latest + New-chat starts fresh.

## 11. Open questions (to confirm during planning)

- Rating UI in v1 (capture on save vs. inline on the results list) — default: optional, inline.
- Exact permission to add/remove a result (any viewer vs. prompt creator/editor) — default:
  align with prompt edit permission for mutate, view for read.

## 12. Prompt ↔ Pipeline ↔ Project boundary (decided)

Three **isolated lanes** — no carry-over, no bridge in v1 (confirmed with the owner):

- **Chat lane:** prompt → `results[]` (chat-curated answers). Workspace-library scope.
- **Pipeline** is a reusable **template** (binds prompts to steps). It runs the prompt's *content*
  by reference; it **never reads `results[]`**. Adding saved results changed nothing about how
  pipelines run.
- **Project lane:** project + pipeline → **Runs** (per-step outputs), scoped to the
  *(project, pipeline)* pair and **fresh** when a pipeline is first assigned. Run history lives in
  the Run document (`historyForStep` shows prior runs of that step *in that project*), never pulls
  a prompt's chat results, and never crosses projects.

No "save a run output back to the prompt" bridge yet — the api `POST /prompts/:id/results` makes
it cheap to add later (snapshot the *filled* prompt). Cross-project / cross-pipeline analytics
("this prompt's results everywhere") is also deferred.

## 13. As-built notes (what shipped vs. the plan above)

- **Routes** are mounted at `prompts/:id/results` (reusing `PromptAccessGuard`), not workspace-
  nested. **Add** = any member who can *view* the prompt (the chat flow). **Remove/update** =
  the result's author **or** the prompt owner (refines §11's default).
- `results` are included in the Prompt view for both list and get (curated handful — fine).
- The chat **results rail** is desktop-only (≥1101px); below that the results live in Prompt
  details. The whole feature is built on the canonical modal/affordance vocabulary.
- **Rating UI deferred** — the backend stores `rating`/`note` (DTO + schema), but no UI yet.
- **Cleanup still pending** (per §8): the `conversations/prompt-history-list` endpoint and a few
  now-unused `chats.*` i18n keys (`autoSave`, `saveToHistory*`, `couldNotSave`) are dead.
