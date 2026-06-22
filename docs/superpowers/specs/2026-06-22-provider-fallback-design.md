# Automatic key-gated provider fallback (pipeline runs) — design spec

> **Status:** Approved design (2026-06-22). Build + deploy to dev when green. Refines
> Phase 3 of [../plans/2026-06-20-multi-provider-fallback.md](../plans/2026-06-20-multi-provider-fallback.md);
> the *why-not-9router* rationale is in [./2026-06-20-9router-evaluation.md](./2026-06-20-9router-evaluation.md).
> **Branch base:** codex-dev (currently `505881ac`).

## 1. Goal
Capture the one piece of real value a multi-provider gateway sells — **auto-fallback when a
provider errors/rate-limits** — inside Lyra's own run engine, preserving invariant 7
(per-workspace encrypted BYO keys). When a text/brain pipeline step's provider call fails with
a *retryable* error, transparently retry the same prompt on another provider the workspace
already has a key for.

## 2. Scope decisions (locked with the user)
- **Configuration:** automatic + key-gated. No per-step or per-workspace config, no UI. (Not the
  "per-step `fallback[]`" or "per-workspace chain" variants — those were the rejected options.)
- **Surface:** **pipeline runs only** — the non-streaming single-call step dispatch. NOT Chat/SSE.
- **Order:** fixed `[Anthropic, OpenAI, DeepSeek]`.
- **Phase 0 doc truth-up:** included (CLAUDE.md still claims "only Anthropic executes for real").

## 3. Non-goals (YAGNI)
Fan-out steps (already have per-item retry — `executeFanOut`; provider-switching per item deferred),
Chat/conversations, cross-modality fallback (image→text etc.), model-within-same-provider fallback,
per-step/per-workspace config + UI, Phase 2 gateway base-URLs, a Run-schema `servedBy` field /
web "fell back" badge (telemetry is log-only in v1).

## 4. Eligibility & the chain
Fallback applies only when the **primary provider is a text/brain provider**:
`TEXT_FALLBACK_ORDER = [Provider.Anthropic, Provider.OpenAI, Provider.DeepSeek]`.

A candidate `c` is **eligible** iff the workspace can call it without a missing key — reusing the
exact gate `isLocked` uses: `!providerNeedsKey(c) || keysPresent.has(keyProviderFor(c))`. For the
three text providers `keyProviderFor` is identity and all need a key, so this reduces to
`keysPresent.has(c)` (a workspace must have a DeepSeek key for DeepSeek to be a fallback, etc.).

**Chain** = `[primary, ...TEXT_FALLBACK_ORDER without primary, eligible only]`. If the primary is
not a text provider (Image/Google/Video/Crawl), or no other text provider is eligible, the chain
is just `[primary]` → today's behavior unchanged.

Each **fallback** provider runs with **its own `defaultModel(c)`** from `MODEL_CATALOG` (the
primary's model id is provider-specific). This is the accepted "silently different model" tradeoff.

## 5. Retryable classification
`isRetryableProviderError(err): boolean`.
- **Retryable (try next):** HTTP `429`, any `5xx` (incl Anthropic `529` overloaded), network /
  timeout (`ECONNRESET`/`ETIMEDOUT`/`fetch failed`/`socket hang up`), and quota markers
  (`insufficient_quota`, `quota`, `rate limit`).
- **Non-retryable (throw immediately, no fallback):** `400/401/403/404/422` — a malformed prompt or
  a bad/again-bad key; falling back would only mask a config error.
- Detection: the AI clients throw `Error` (and Nest `HttpException` from the connectors proxy) —
  classify on `err.status`/`err.statusCode` when present, else substring-match the message. Default
  **unknown → non-retryable** (conservative: don't fan a mystery error across every provider).

## 6. Control flow (loop)
Try chain entries in order: first success returns its output + which provider served. A retryable
error advances to the next entry; a non-retryable error throws at once; an exhausted chain throws
the **last** error. The primary is the first attempt (so a healthy primary costs nothing extra).

## 7. Where it lives
- **`fallbackChain(primary, isEligible): Provider[]`** — pure, in `@lyra/shared`
  (`src/utils/index.ts`, zero runtime deps). Unit-tested.
- **`isRetryableProviderError(err): boolean`** — api util
  (`apps/api/src/runs/providers/`), unit-tested. (Lives in the api, not shared — it inspects
  Error/HttpException shapes.)
- **`executeWithFallback(...)`** — a private method in `apps/api/src/runs/runs.service.ts` wrapping
  the single-call dispatch (currently the one-line `this.registry.get(provider).execute({...})` at
  ~L305). It decrypts each candidate's key lazily via `keys.getDecrypted(ws, keyProviderFor(c))`,
  builds the per-candidate `step` (`{ ...stepForRun, provider: c, model: defaultModel(c) }`), and
  returns `{ output, servedBy }`.

## 8. Cache interaction
The per-step cache (`stepCacheKey`, keyed on `workspaceId+provider+model+prompt+context`) is read as
today (primary key). **Write the cache only when the primary served** — a transient fallback must
not poison the 30-day cache key with a different provider's answer.

## 9. Telemetry (log-only, v1)
On a fallback, emit one server log line: `run <id> step "<name>": <primary> <reason> → served by
<provider>`. No Run-schema field, no API-response change, no web change (silent provider switching is
the accepted tradeoff). Upgrade path: add `step.servedBy` + a run-view badge when UI visibility is
wanted.

## 10. Phase 0 — doc truth-up (no code)
Fix root `CLAUDE.md` (and note in the next SESSION-HANDOFF entry): OpenAI + DeepSeek (via
`OpenAiCompatStepProvider`) + Image (`gpt-image-1`) + Google/Gemini image are **real**; only Video
and Crawl-as-mock remain mock. The "only Anthropic executes for real" line is stale.

## 11. Error handling
- A non-retryable primary error behaves exactly as today (fails the step, persisted, shown in the
  workbench) — no new path.
- All-providers-exhausted surfaces the last error via the existing `failStep(errMessage(err))`.
- A candidate key decrypt returning `null`/`''` ⇒ candidate is skipped by the eligibility gate
  before any call (it would have been filtered out of the chain).

## 12. Testing
- **shared (Vitest):** `fallbackChain` — text primary + all keys → `[primary, ...others in order]`;
  text primary + no other keys → `[primary]`; text primary, primary itself appears once & first;
  non-text primary → `[primary]`; order is always Anthropic→OpenAI→DeepSeek among eligibles.
- **api (Jest):** `isRetryableProviderError` — 429/500/503/529/`ETIMEDOUT`/`insufficient_quota` →
  true; 400/401/403/404 → false; unknown → false. Plus a `RunsService.executeWithFallback` unit
  (mock registry + keys): primary ok → primary, no extra call; primary 429 + DeepSeek keyed → DeepSeek
  output, `servedBy=DeepSeek`; primary 429 + no other key → throws; primary 400 → throws without
  trying others; cache write skipped when a fallback served.
- No web tests (no web change). No new e2e required.

## 13. Inherited invariants + deploy
- `@lyra/shared` stays zero-runtime-dep (`fallbackChain` is pure).
- **Invariant 7:** the eligibility gate guarantees a provider is only called when the workspace has
  its key (or it needs none). No key is ever logged. No cross-workspace key access (keys resolved by
  `doc.workspaceId` only, as today).
- **Mandatory `security-reviewer` pass** before merge (it touches the key-decrypt path on the run
  engine): confirm no key logged, eligibility gate sound, fallback never reaches a non-BYO'd
  provider, classification can't be coerced into spending on every provider via a crafted error.
- **Deploy (authorized — not held):** touches shared + api → rebuild `@lyra/shared` + api dist,
  `pm2 restart lyra-api` (web unaffected), confirm `lyra-api` boots clean (Nest started + routes),
  then `git push origin codex-dev:dev`.

## 14. Open decisions for the plan
1. Home for `isRetryableProviderError` — a new `apps/api/src/runs/providers/retryable.ts` (+ `.spec`)
   vs folding into an existing util. Prefer a small dedicated file (pure, testable).
2. Exact log channel — Nest `Logger` instance on `RunsService` vs `console.warn`. Prefer Nest
   `Logger`.
3. Whether `executeWithFallback` also wraps the fan-out per-item call in a follow-up (out of scope
   here; fan-out already retries the *same* provider).
