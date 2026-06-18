# Lyra - Prompt Testing (superseded by Chats)

> **CURRENT STATUS: SUPERSEDED.** The per-prompt testing playground and
> `prompt-tests` module described in this historical document were removed.
> Current Lyra uses **Chats** instead: `apps/api/src/conversations` and
> `apps/web/src/pages/Chats.tsx`. Chats are top-level, multi-turn, per-user,
> stream over SSE, auto-persist every turn, stamp each message with
> provider/model, and bridge back to the prompt library through **Save as
> prompt**. Library prompts use **Open in chat** as a history-aware bridge:
> if a conversation already exists for that prompt, it opens the existing thread;
> otherwise it opens `/chats` with the composer prefilled and waits for a manual
> send. It must never auto-submit.
> Do not rebuild `/prompts/:id/try` or `prompt-tests`.

---
# Lyra — Prompt Testing (Playground + history)

> **Status: BUILT** (`apps/api/src/prompt-tests`, `apps/web` Try page). A Prompt-module
> feature that complements the prompt library and reuses the run execution layer.
> **One change from this design:** runs are **ephemeral** — a test streams its answer
> but is **not** auto-saved. The user saves it to history explicitly via a green ✓
> (`POST .../tests/save`); leaving with an unsaved answer prompts a confirm. History
> is per-prompt and each entry snapshots the **prompt text + answer** at save time.

## 1. Why

The prompt library stores reusable prompts, but there's no way to **try one and
see what a model returns**. Prompt testing adds a **chat-style playground** per
prompt, with a **saved history** of every run you can **star** and **tag** — so
teams can iterate on prompts and keep the winners.

Architecturally a test is a **one-step pipeline run**: send a prompt to a chosen
**provider · model** through the same `StepProvider` + keys layer, persist the
result. Result history carries the same **tags** as prompts/pipelines, plus a
**star**.

## 2. Glossary

| Term | Meaning |
|------|---------|
| **Prompt Test** | One run of a prompt against a model → a stored result (input, output, model, usage). The unit of history. |
| **Playground** | The chat-style UI where you compose, send, and review tests for a prompt. |
| **Star** | A one-tap "keep this" mark on a test result. |

## 3. Decisions (settled)

1. **Single-turn tests.** Each test sends the prompt and shows one response,
   displayed chat-style (user bubble = the sent prompt, assistant bubble = the
   reply). Iterate by tweaking + re-running; **every run is its own history
   entry**. (Not a multi-turn conversation — keeps history = one markable result.)
2. **Mark = star/favorite + tags.** A star toggle to keep good outputs, plus
   free-form **tags** (reusing the shared tag system: normalized, deduped,
   colored). Filter history by star and tag.
3. **Placeholders handled by inline editing.** The composer is **prefilled with
   the prompt text** ({product}/{niche}/… visible); the user tweaks anything and
   sends. No structured variable form, no project context needed.
4. **Streaming responses.** Tokens stream in live (server-sent events), like
   ChatGPT/Claude.

### Assumed scope (reuse + limits)
- History is **per prompt**, workspace-scoped; entries are **soft-deletable**.
- **Provider · model** chosen from the curated `MODEL_CATALOG`; **per-provider key
  gating** applies (workspace BYOK key required).
- v1 sends **text only**; sending the prompt's **media/attachments** to the model
  is deferred (same as the brain steps today).
- **Anthropic is the only real provider now** — testing runs on Claude models;
  others stay mock until their phases.

## 4. Data model (proposed)

**PromptTest** (`Audited`)
```
id, workspaceId, promptId
provider, model
input        // the sent prompt text (after inline edits)
result       // model output
usage?       // { tokens?, costUsd? }
starred      // boolean (the "mark")
tags: string[]
error?       // set if the run failed
active, createdBy, updatedBy, createdAt, updatedAt
```

## 5. API surface (sketch)
- `POST /workspaces/:id/prompts/:promptId/tests` — run a test; **streams** tokens
  (SSE); on completion persists a `PromptTest` and emits its id + usage.
- `GET /workspaces/:id/prompts/:promptId/tests` — history (filters: `?starred`,
  `?tag`), newest first.
- `PATCH /prompt-tests/:id` — toggle `starred` / set `tags`.
- `DELETE /prompt-tests/:id` — soft delete.

Access: workspace member can run/list/read; edit/delete restricted to the
creator or workspace owner (consistent with prompts).

## 6. UI spec (chat-style)

**Entry point** — a **Test** action on a prompt (card / detail) opens the
Playground for that prompt.

**Desktop**
- **History sidebar** (left): entries show model badge, result snippet, star, tag
  chips, timestamp; filter chips for star + tags. Click to view a past result.
- **Chat area** (main): message bubbles — the sent prompt (user) and the response
  (assistant, streaming). Each result bubble has **star**, **add tags**, and
  **copy**.
- **Composer** (bottom): textarea **prefilled with the prompt**, a **provider ·
  model** dropdown (catalog, locked if no key), and **Send**. Editing + re-sending
  creates a new history entry.

**Mobile**
- Full-screen chat + composer; **history in a drawer/tab**. Same star/tags on each
  result.

## 7. Deferred / future
- Multi-turn chat threads (follow-ups in one session).
- Side-by-side model comparison (A/B).
- Sending prompt media/attachments to the provider.
- Promoting a starred test's output back into the prompt or a pipeline step.

## 8. Suggested build phases
1. **shared** — `PromptTest` model + Create/Update DTOs.
2. **api** — prompt-tests module: streaming create (Anthropic streaming client),
   list (filters), patch (star/tags), soft-delete; reuse provider/keys; e2e
   (stub the streaming client, like the runs e2e).
3. **web** — Playground: chat UI + streaming, composer with model picker, history
   sidebar, star + tags, mobile drawer.

> Implementation note: the current `AnthropicClient` is non-streaming. Testing
> needs a **streaming** variant (Messages API `stream: true`, SSE parsing) exposed
> through the api as SSE to the browser.
