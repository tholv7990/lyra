# 9router evaluation for Lyra — June 20, 2026

**Verdict: do NOT route Lyra's per-workspace AI calls through 9router.** It is an
excellent *personal* router for CLI coding tools, but architecturally mismatched as
a multi-tenant backend. Use it (optionally) for the dev workflow; build the parts
Lyra actually wants (multi-provider + fallback) inside Lyra's own `ProviderRegistry`.

> Researched from the [repo](https://github.com/decolua/9router) + source-indexed
> [DeepWiki](https://deepwiki.com/decolua/9router) ([core concepts](https://deepwiki.com/decolua/9router/3-core-concepts),
> [auth](https://deepwiki.com/decolua/9router/13.1-authentication-and-token-issues)).
> The marketing README oversells; DeepWiki (indexes the actual code) is authoritative.

## 1. What 9router is

An open-source (MIT, Node/Next.js, SQLite, ~18k★, v0.5.4 / 2026-06-18) **AI API
router + token-saver** that fronts 40+ providers behind one **OpenAI-compatible
endpoint** (`http://localhost:20128/v1`, `Authorization: Bearer` or `x-api-key`).
Built for **CLI coding tools** (Claude Code, Cursor, Codex, Cline…). Headline
features: RTK token compression, 3-tier auto-fallback (subscription→cheap→free),
format translation (OpenAI↔Claude↔Gemini), multi-account load-balancing.

## 2. The decisive problem — its key model vs Lyra invariant 7

From DeepWiki's auth page (verbatim): inbound API keys "function as a **gate
mechanism rather than tenant/user identifiers**"; "keys merely grant access, they
don't designate which provider credentials to use." Provider **accounts are chosen
by global routing strategy** (fill-first / round-robin), not by who is calling.
Provider credentials are entered through the **dashboard** (and OAuth for
subscription providers) and stored in 9router's **own SQLite**; there is **no
documented way to pass a provider key per-request**. It is **single-user** (one
`INITIAL_PASSWORD`), explicitly "not multi-tenant SaaS."

Lyra **invariant 7**: provider keys are **per-workspace, AES-256-GCM encrypted at
rest, bring-your-own, never env vars, never commingled**, and a step is gated on the
workspace having that provider's key. These models are **fundamentally incompatible**:

| | Lyra | 9router |
|---|---|---|
| Whose key runs a call | the **workspace's own** decrypted key | a **globally-configured** account, chosen by routing |
| Key storage | Lyra api, AES-256-GCM, per workspace | 9router SQLite, dashboard-entered |
| Tenancy | multi-tenant (workspace = boundary) | single-user |
| Per-request key | yes (`StepRunContext.apiKey`) | **no** |

Fronting all workspaces through one shared 9router would draw every workspace's
traffic from the **same** provider accounts → cross-tenant billing/credential
commingling. The only isolation-preserving option is **one 9router per workspace**
— operationally absurd (per-instance dashboard + OAuth).

## 3. The other "features" don't move Lyra

- **RTK token-saver** compresses `tool_result` payloads (git diff / grep / ls / tree)
  — i.e. *agentic CLI tool outputs*. Lyra sends its own composed creative prompts
  with little/no `tool_result`, so there is almost nothing to compress. "Caveman
  Mode" would *degrade* Lyra's prose outputs. **Not applicable.**
- **Format translation** — Lyra already owns this (`anthropic.client`,
  `openai-compat.client`). Duplicative.
- **Fallback / combos** — genuinely appealing, but authored only via 9router's
  dashboard/DB and bound to its (incompatible) key model. Better built in-house.

## 4. Security/privacy notes (if anyone still tries it)

- `ENABLE_REQUEST_LOGS=true` writes **full prompt/response logs** to disk (off by
  default — keep it off).
- **Cloud Sync** can push provider **credentials/OAuth tokens** off-box (target is a
  self-hostable Cloudflare Worker, not a hardcoded vendor — but opt-in vs on-by-default
  is undocumented; audit before use).
- Pre-1.0, fast-moving — fine for a personal tool, risky as a load-bearing backend.

## 5. Where 9router *is* a win — the dev workflow (no Lyra code)

9router's actual sweet spot is **routing this coding assistant (Claude Code) through
it** to save 20–40% tokens and fall back to free/cheap models. That's an *operator*
choice for the developer's own machine, **zero Lyra code**, zero invariant impact:
`npm i -g 9router` → connect providers in its dashboard → point Claude Code's
OpenAI-compatible base at `http://localhost:20128/v1`. Try it personally; it has no
bearing on the product.

## 6. What Lyra should actually do — borrow the idea, not the product

The thing 9router made us want is **"one place to reach many providers, with
fallback, while keeping per-workspace keys."** Lyra is already most of the way there:

- `apps/api/src/runs/providers/openai-compat.client.ts` → `compatBaseUrl(provider)`
  already reads **`LITELLM_BASE`** and can point OpenAI/DeepSeek at any
  OpenAI-compatible gateway **today** (see `docs/lyra-litellm-gateway.md`). Lyra could
  literally set `LITELLM_BASE=http://localhost:20128/v1` — but that re-introduces the
  shared-key problem, so prefer a **LiteLLM** gateway (which *does* support
  per-request virtual keys) or the official APIs.
- OpenAI/DeepSeek already dispatch to a **real** `OpenAiCompatStepProvider`
  (`provider.registry.ts`), so "make more providers real" is mostly catalog + keys,
  not new clients.

→ The productive follow-on is **multi-provider + in-registry fallback**, preserving
invariant 7. Specced in
[../plans/2026-06-20-multi-provider-fallback.md](../plans/2026-06-20-multi-provider-fallback.md).

## 7. Recommendation

1. **Product:** do not adopt 9router. If multi-provider/fallback is wanted, build it
   in Lyra's `ProviderRegistry` (plan above). The existing `LITELLM_BASE` hook already
   covers "front an OpenAI-compatible gateway" for the cases where that's appropriate.
2. **Dev workflow:** optionally run 9router locally for Claude Code token savings —
   personal, not committed to Lyra.
3. No code shipped from this evaluation by design — forcing a 9router integration
   would violate invariant 7 / multi-tenancy. (User granted "just do it"; the honest
   application of that grant is *not* to build the unsafe thing.)
