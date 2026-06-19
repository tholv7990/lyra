# 9router integration (experimental / learning) — the switch

Route Lyra's **OpenAI + DeepSeek** traffic through a self-hosted
[9router](https://github.com/decolua/9router) gateway. **Off by default.** This is a
*learning* integration — read the honest evaluation first:
[superpowers/specs/2026-06-20-9router-evaluation.md](superpowers/specs/2026-06-20-9router-evaluation.md).

> ⚠️ **Why it's learning-only / not for multi-tenant production.** 9router's inbound
> key is a *gate*, not a tenant selector — every workspace's traffic draws from the
> *same* provider accounts configured in 9router's dashboard. That breaks Lyra
> **invariant 7** (per-workspace BYO keys, never commingled). Fine for one developer
> learning on a single-tenant box; do **not** enable on a shared deployment.

## The switch

Two env vars on the **api** (`apps/api/.env`):

```bash
NINEROUTER_ENABLED=true                       # the switch — false/unset = fully off
NINEROUTER_BASE_URL=http://localhost:20128/v1 # optional; this is the default
```

- When **on**, `compatBaseUrl()` routes OpenAI + DeepSeek to 9router (it takes
  precedence over `LITELLM_BASE`). **Only the route changes** — the workspace's own
  decrypted provider key still flows as the `Authorization: Bearer`. Anthropic and the
  other providers are untouched.
- To **turn it off later**: set `NINEROUTER_ENABLED=false` (or remove the line) and
  restart the api. Zero code change, instant revert. Default is off.

## Run 9router

```bash
npm install -g 9router && 9router          # dashboard at http://localhost:20128
# or: docker run -d -p 20128:20128 -v "$HOME/.9router:/app/data" decolua/9router:latest
```

In its dashboard: connect a provider (e.g. an OpenAI or DeepSeek API key, or a free
provider), and note the **gate API key** (or set `REQUIRE_API_KEY=false` so loopback
calls pass without one).

## Wire Lyra to it

1. Set the two env vars above in `apps/api/.env`, restart the api.
2. The workspace **still needs an `openai` (or `deepseek`) key** — Lyra gates the step
   on it, and sends it as the bearer 9router checks. Put your **9router gate key**
   there (Connections/Settings), or any value if `REQUIRE_API_KEY=false`.
3. **Models:** Lyra sends its own model ids (e.g. `gpt-5.5`, `deepseek-chat`). 9router
   resolves models via *aliases → combos → provider/model*, so add a 9router **alias**
   mapping each Lyra model id to a real provider model — or pick Lyra models you've
   aliased. Unrecognised ids will error at 9router.
4. Test from **Chats**: pick an OpenAI/DeepSeek model and send a message. Watch the
   9router dashboard log the request.

## Notes
- `compatBaseUrl()` / `nineRouterEnabled()` live in
  `apps/api/src/runs/providers/openai-compat.client.ts` (unit-tested).
- 9router's `ENABLE_REQUEST_LOGS=true` writes full prompt/response logs to disk — keep
  it off unless debugging. Its Cloud Sync can push provider credentials off-box — leave
  it disabled.
- This shares the same injection point as the LiteLLM gateway
  ([lyra-litellm-gateway.md](lyra-litellm-gateway.md)); for anything beyond learning,
  prefer LiteLLM (it supports per-request virtual keys → preserves per-workspace
  isolation), or build in-registry fallback
  ([superpowers/plans/2026-06-20-multi-provider-fallback.md](superpowers/plans/2026-06-20-multi-provider-fallback.md)).
