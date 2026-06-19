# Plan — multi-provider + in-registry fallback (9router-inspired) — June 20, 2026

**Goal:** capture the value 9router sells (reach many providers + auto-fallback)
**inside Lyra's own architecture**, preserving invariant 7 (per-workspace encrypted
BYO keys). See [../specs/2026-06-20-9router-evaluation.md](../specs/2026-06-20-9router-evaluation.md)
for *why* we are not adopting 9router itself.

**Status: NOT STARTED — plan only. Phases 2–3 touch the key/provider path → run the
`security-reviewer` subagent before merging.** Do nothing here without the user's
go-ahead.

## Current reality (corrects the stale CLAUDE.md)

The CLAUDE.md "only Anthropic executes for real" is **out of date**. As built:
- `apps/api/src/runs/providers/provider.registry.ts` maps `Anthropic→AnthropicStepProvider`,
  **`OpenAI→OpenAiCompatStepProvider`, `DeepSeek→OpenAiCompatStepProvider` (both real)**,
  `Image→ImageStepProvider` (real), `Video`/`Crawl`→mock.
- `apps/api/src/runs/providers/openai-compat.client.ts` → `compatBaseUrl(provider)`
  (lines ~5-22) resolves the base URL at call time: official API, or **`LITELLM_BASE`**
  if set (a global OpenAI-compatible gateway hook already exists).
- Per-workspace keys are decrypted at call time via
  `apps/api/src/keys/keys.service.ts` `getDecrypted(workspaceId, provider)` and handed
  to the client as `StepRunContext.apiKey` (runs) / per-call `apiKey` (conversations).

So "more providers" is mostly **catalog + keys + UI**, not new clients. The
interesting net-new work is **fallback**.

## Phase 0 — truth-up the docs (trivial, do anytime)
- Fix CLAUDE.md / SESSION notes: OpenAI + DeepSeek + Image are real; only Video/Crawl
  are mock. No code.

## Phase 1 — make the existing real providers fully usable (low risk, no key-path change)
Lets users actually pick OpenAI/DeepSeek today.
1. Verify `MODEL_CATALOG` (`packages/shared/src/constants/models.ts`) lists the models
   the operator intends to support; prune placeholders.
2. Confirm the Settings/Connections UI lets a workspace add an OpenAI and a DeepSeek
   key (per-provider key gating already exists).
3. Smoke-test a Chat + a pipeline Run on each real provider with a real key.
- **Files:** shared `models.ts`; web Settings; no api logic change. **Gate only.**

## Phase 2 — optional per-key / per-provider gateway base URL (invariant-preserving)
Lets a workspace (or the operator) route an OpenAI-compatible provider through a
gateway (LiteLLM with per-request virtual keys, OpenRouter, a self-hosted 9router for
a single-tenant deployment) **without** changing whose key is forwarded.

Two variants — ship the smaller first:
- **2a (deployment-level, safest, ~5 lines):** add `OPENAI_BASE_URL` /
  `DEEPSEEK_BASE_URL` env overrides to `compatBaseUrl()` (today only `LITELLM_BASE`,
  global). No schema, no key-path change. Pure config. `.env.example` + 1 unit test.
- **2b (per-key, more flexible):** add optional **`baseUrl?: string`** (plain text,
  non-secret) to `apps/api/src/keys/api-key.schema.ts`; extend
  `keys.service.ts:getDecrypted` to return `{ key, baseUrl? }`; thread `baseUrl` into
  `compatBaseUrl(provider, keyBaseUrl?)` at the 2 call sites
  (`runs.service.ts`, `conversations.service.ts`). The **workspace's own decrypted key
  is still what's forwarded** — only the route changes. Backward compatible (absent →
  current behavior).
- **⚠️ Security gate:** 2b changes the shape returned by the key-decryption path →
  **mandatory `security-reviewer` pass** (SSRF on an attacker-controlled `baseUrl`?
  validate scheme/host allowlist; never log the key; confirm `baseUrl` never carries a
  secret). 2a avoids this (operator-set env only).

## Phase 3 — in-registry fallback chain (the real net-new value)
Auto-fallback when a provider errors/rate-limits, **without** 9router.
- **Where:** wrap dispatch in `provider.registry.ts` / the run + conversation call
  sites, not inside each client. A small `withFallback(primary, [alts], ctx)` that
  tries the primary, and on a *retryable* error (429 / 5xx / quota) tries the next
  provider **for which the workspace has a key** (respect invariant 7 — never call a
  provider the workspace hasn't BYO'd).
- **Config:** a per-pipeline-step or per-workspace ordered fallback list (shared type).
  Keep v1 dumb: a single optional `fallback: Provider[]` on the step, gated by
  key-presence at runtime.
- **Streaming caveat:** fallback is only clean **before the first token**. If a stream
  fails mid-flight, surface the error (don't silently switch mid-answer) — matches
  Lyra's existing SSE error handling.
- **Cost/telemetry:** stamp which provider actually served (the message already records
  `provider·model`).
- **Tests:** unit-test `withFallback` selection logic (primary ok → primary;
  retryable + alt-has-key → alt; alt-without-key → skip; non-retryable → throw). Pure,
  cheap, high-value.

## Non-goals (v1)
- RTK-style token compression (irrelevant to Lyra's prompt workload).
- Subscription/free-tier routing (Lyra is BYO-key; no metering in v1).
- Cross-workspace key sharing (forbidden by invariant 5/7).

## Suggested order
Phase 0 (now, free) → Phase 1 (unlock what's built) → Phase 3 (fallback = the actual
value) → Phase 2b only if a real gateway need appears (2a if just operator routing).
Phase 3 delivers most of the 9router appeal with none of the tenancy compromise.
