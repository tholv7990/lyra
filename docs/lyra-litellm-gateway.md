# LiteLLM gateway + self-hosted models (cost reduction)

Route Lyra's OpenAI-compatible providers through a local **LiteLLM** gateway so you can:
- run **DeepSeek / Llama on Ollama** ($0/token) for cost-sensitive steps,
- keep **GPT on the official OpenAI API** (automatic prompt caching),
- keep **Claude on Lyra's native Anthropic client** with **prompt caching** (best fidelity),
- get gateway-level **retries + fallbacks**.

This is fully ToS-compliant: official APIs use API keys; open models are self-hosted. (It deliberately does **not** proxy Claude Pro / ChatGPT Plus consumer subscriptions — that violates those providers' terms.)

## Topology

```
Lyra API (StepProvider.execute)
   │  OpenAI-compatible HTTP (OpenAiCompatClient)
   ▼
LiteLLM gateway (:4000)            ← model → backend, retries, fallbacks
   ├─ gpt-*            → OpenAI API (official key; auto prompt caching)
   ├─ deepseek-v3-local → Ollama (:11434)   ($0/token)
   ├─ llama-3.3-local   → Ollama (:11434)   ($0/token)
   └─ deepseek-*        → DeepSeek API (optional)

Claude → native AnthropicClient (official key + prompt caching) — not via the gateway
```

## Run it

```bash
# 1. Ollama — self-hosted open models
ollama pull deepseek-v3 && ollama pull llama3.3        # serves on :11434

# 2. LiteLLM gateway (config: ../litellm.config.yaml at the repo root)
pip install 'litellm[proxy]'
export OPENAI_API_KEY=...  DEEPSEEK_API_KEY=...  LITELLM_MASTER_KEY=sk-local-...
litellm --config litellm.config.yaml --port 4000       # OpenAI-compatible at :4000/v1

# 3. Lyra API — opt in
#   apps/api/.env:
#     LITELLM_BASE=http://localhost:4000/v1
#   then rebuild + restart the api (node dist/main.js)
```

Smoke test the gateway:
```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "content-type: application/json" \
  -d '{"model":"deepseek-v3-local","messages":[{"role":"user","content":"hi"}]}'
```

## Keys & multi-tenancy (invariant 7)

LiteLLM holds the real OpenAI/DeepSeek keys centrally, which collides with Lyra's
per-workspace BYOK. Reconcile by minting a **LiteLLM virtual key per workspace** and
storing *that* (encrypted, as today) as the workspace's `openai`/`deepseek` key:
- `ctx.apiKey` flows through `OpenAiCompatClient` unchanged — it's just the virtual key now.
- Per-workspace gating, budgets, and rate limits keep working (LiteLLM enforces them per virtual key).
- **Claude stays true BYOK** on the native path.

For a single-tenant/dev setup, the `master_key` is enough — store it as the workspace key.

## Models

`MODEL_CATALOG` (shared) now lists `deepseek-v3-local` and `llama-3.3-local` under
DeepSeek (the open-model slot). "Refresh models" on the Settings page hits the
gateway's `GET /models` and discovers whatever you configured in `litellm.config.yaml`,
so new gateway models appear without code changes. The `model_name` in the config
must match the id Lyra sends.

## Prompt caching

- **Claude** — `AnthropicClient` now marks the system prompt with `cache_control: ephemeral`.
  Reused templates/context across steps/runs hit the cache (~0.1× input cost; below the
  model's minimum cacheable size it just isn't cached — no error, no premium). Verify via
  the response's `cache_read_input_tokens`. Min prefix ≈ 4096 tokens (Opus 4.8), ≈ 2048 (Sonnet 4.6).
- **GPT** — OpenAI auto-caches prompts > ~1024 tokens; nothing to configure.
- **Ollama** — free; local KV cache, nothing to do.

## What changed in the codebase

- `litellm.config.yaml` (repo root) — the gateway config.
- `openai-compat.client.ts` — `compatBaseUrl(provider)` routes OpenAI/DeepSeek through
  `LITELLM_BASE` when set (else the official APIs). Used by the run engine, the playground,
  and model refresh.
- `anthropic.client.ts` — `cache_control` on the system prefix (prompt caching).
- `MODEL_CATALOG` (shared) — added the local Ollama models.
- `apps/api/.env.example` — documented `LITELLM_BASE`.

Unset `LITELLM_BASE` ⇒ Lyra behaves exactly as before (official APIs, direct).
