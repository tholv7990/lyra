# MCP connector — exploration & parked decision

**Date:** 2026-06-17 · **Status:** 🅿️ **Parked.** Decision: **stay on API/BYOK for now**; revisit this when there's appetite to reduce per-token cost by leveraging users' own LLM subscriptions. No code written.

**Why this exists:** captures a long design conversation so a future session can resume without re-deriving the constraints. The goal that started it: *let users do more work without paying per-token API costs, because a flat subscription (Claude Pro/Max, ChatGPT Plus) is cheaper than the API — while keeping Lyra's flow/results.*

---

## 1. The hard constraints (the wall — read this first)

These are non-negotiable facts that killed several appealing-but-impossible ideas:

1. **A subscription cannot be billed for API usage.** Claude Pro/Max and ChatGPT Plus are *separate products* from the API, with separate billing. There is **no supported way** to make a server's API call draw from a user's subscription. (Claude Code can run on Pro/Max, but that's Anthropic's own first-party tool with a special entitlement — third parties can't replicate it.)

2. **MCP is the *opposite direction* from what you'd intuitively want.**
   - **API** = *Lyra → calls → provider.* Lyra is the caller, picks the model, pays per token.
   - **MCP** = *Claude/ChatGPT (the app, where the user + subscription live) → calls → Lyra's tools.* Lyra is a **toolbox the host LLM uses**, not something that can "call Claude."
   - There is **no "Claude MCP" / "ChatGPT MCP"** that Lyra connects to, picks a model, and runs a prompt on. That capability is the **API** (paid).

3. **The one exception — MCP "sampling":** an MCP *server* can ask the *host's* LLM to run a completion. So while a user is inside Claude, Lyra (a tool they invoked) **can** have Claude generate content on the user's subscription. Caveats: **Claude supports sampling; ChatGPT's support is uncertain (Claude-first)**; the model is **the host's single model** (you can only *hint* `modelPreferences`, not pick); may carry per-request user consent. *(Verify current sampling support against the official MCP spec + Anthropic docs before building.)*

4. **Token-reuse / account-rotation tools (e.g. "Cockpit Tools") are a dead end for a real product.** They replay subscription OAuth tokens (Cursor/Copilot/Claude Code/etc.) and rotate accounts to dodge usage caps. This **violates provider ToS, gets *users'* accounts banned, is fragile (private endpoints + rotating tokens break constantly), and is a security/legal liability for a hosted SaaS** (you'd be storing users' login tokens). Rejected.

**Net:** the only legitimate way to put inference on a user's subscription is **inside their own LLM app** — either the user runs it manually, or via an MCP connector where the host LLM does the work.

---

## 2. The trade-off triangle (the core decision for pipelines)

You can have any **two**, never all three:

```
        🔀 Different provider per step
                  /        \
   💸 Free  ◄──────────────────►  🤖 Auto-capture
 (subscription)                 (Lyra grabs the result)
```

| Want | Get | How |
|---|---|---|
| **🔀 + 💸** cross-provider, subscription | ✋ **manual capture** | user runs each step in the matching app, **pastes the result back** (or tells that app's connector to save it). Lyra chains `{input}` + stores. No auto-grab. |
| **🤖 + 💸** auto-capture, subscription | 🔒 **one provider per run** | user runs the whole pipeline inside ONE app via the connector; Lyra auto-captures. Per-step model choice works *within* that app, not across providers. |
| **🔀 + 🤖** cross-provider, auto-capture | 💸 **API/BYOK (paid)** | Lyra runs each step itself via the provider API. **This is today's pipeline.** |

**Why:** auto-capture requires the result to travel back **over MCP**, which is locked to the **one app** the user is in. Switch to a different provider's app → you've left that MCP session → Lyra can't auto-grab it.

The user's instinct was 🔀 + 🤖 + 💸 (cross-provider, auto, free) — which is impossible. When forced to pick two, they chose **🔀 + 💸 (cross-provider + free, manual capture)** for the pipeline.

---

## 3. The viable shapes (what we'd actually build, when we come back)

### A. Chat prompt-capture connector (smallest, cleanest)
Replace the in-app **Chats** playground: the user iterates prompts in their **own** Claude/ChatGPT (subscription), and saves winners to Lyra's library.
- **Works on Claude *and* ChatGPT** (single-app, so no sampling/triangle issues).
- MCP tools: `save_as_prompt(content, model, title?, tags?)` (Lyra auto-stamps the **provider** from the connected app), plus `list_prompts` / `get_prompt` to pull library prompts back in to iterate (bidirectional bridge).
- Immediate cost win — the Chats feature today burns API to do exactly this iteration.

### B. Manual "bring-your-own-LLM" pipeline run mode (NO MCP needed)
This is the realization of **🔀 + 💸** — and it needs **no MCP, no OAuth, no sampling**. It reuses the existing run engine wholesale; the only change is one branch in `executeStep`:
> instead of *"Lyra calls the provider API"* → *"Lyra shows the resolved prompt + recommended provider/model; the user runs it in their app; pastes the answer back; Lyra stores it and chains it into the next step."*

```
Run "Ad pipeline"   ·   mode: bring-your-own-LLM (manual)
Step 1 · Brief        recommended: Claude · Opus 4.8
   prompt "…"  [Copy] → run in Claude → paste answer [____]  [Save → next]
Step 2 · Insights     recommended: ChatGPT · gpt-…
   prompt "From «step-1 result» …"  [Copy] → run in ChatGPT → paste [____]  [Save → next]
```
Reuses `fillPrompt` + `resolveStepRefs` (the variable pool) to inline prior results. Cross-provider, $0 API, ToS-clean. **This is the cheapest, safest path to the original cost goal** if revisited.

### C. Subscription pipeline via MCP sampling (🤖 + 💸, Claude-first)
Lyra orchestrates the run server-side; for each step it uses **sampling** to have the user's Claude generate the content (on their subscription); auto-captures; chains; stores. Single host model (no per-step provider). Claude-first (sampling). More complex; depends on host sampling support + consent UX.

---

## 4. When we come back — concrete design sketch

**Architecture:** MCP server as a **NestJS module inside `apps/api`** (the only tier with keys + run engine), reusing `PromptsService` / `PipelinesService` / `RunsService` / `ProviderRegistry` / `KeysService`. Transport: **Streamable HTTP** (`/mcp`) via the official **TypeScript MCP SDK**.

**Tool surface (full vision):**
- `list_prompts(query?)` · `get_prompt(id)` — read library (public prompts).
- `list_pipelines(query?)` · `get_pipeline(id)` — read pipelines + their variables.
- `save_as_prompt(content, model, title?, tags?)` — write to library (provider auto-stamped from connected app).
- *(pipeline, shape C)* `start_run(pipelineId, variables)` → `{runId, step1Prompt}`; `submit_step_result(runId, content)` → next resolved prompt or `done`; `get_run(runId)` → status + results.

**Auth — the main lift:** per-workspace **OAuth 2.1** (PKCE + dynamic client registration + the two `.well-known` metadata docs). User connects Claude/ChatGPT → logs into their existing Lyra account → picks a workspace → token scoped to user+workspace; every tool call runs through the existing membership check. **Strong recommendation: use a managed provider (WorkOS AuthKit / Stytch Connected Apps / Auth0) rather than hand-rolling the AS** — it collapses the biggest risk into config. BYOK keys unchanged.

**Gotchas to remember:**
- **Gates:** in a connector run the human reviews each step inline → treat steps as auto (no separate approval), or surface a note.
- **Render steps (image/video):** can't ride a chat subscription via tools → stay on API/BYOK or are skipped in connector runs.
- **Provider/model is a label, not a router** on any subscription path — it records intent; the actual engine is whatever the user's app runs.
- **Host-LLM compliance:** shapes A/C depend on the host LLM actually calling the tools / following the guided loop — needs a tight workflow prompt + validation.
- **Reuse:** the run state machine, `fillPrompt` + `resolveStepRefs` (variable pool), gates, and persistence all carry over; only the per-step "execute" changes.

**Suggested first slice when revisited:** **B (manual run mode)** for the cost goal (no MCP), or **A (chat capture connector)** to prove OAuth + the connector cheaply — *not* the full sampling pipeline first.

---

## 5. Meanwhile, on API/BYOK — interim cost levers

Since we're staying on API/BYOK, the cost can still come down without any of the above:
- **Prompt caching on the shared prefix.** Add `cache_control` to the brand/product/context block so steps 2…N bill that prefix at ~10% (cache-read) instead of full price. Concrete, safe, ~immediate. *(See the cost section of [docs/dify-comparison.md](dify-comparison.md).)*
- **Right-size models per step** — Haiku/Sonnet/DeepSeek for steps that don't need Opus.
- **Async/batch** where latency allows.

---

## 6. Decision log
- ❌ Reuse/rotate subscription tokens (Cockpit-style) — ToS violation, ban risk, fragile, SaaS-mismatch.
- ❌ "Lyra loads Claude MCP, picks model, runs prompt" — doesn't exist; that's the API.
- ❌ Cross-provider + auto-capture + free — impossible (triangle).
- ✅ For the pipeline goal, the realistic legit shape is **manual run mode (B)** or **single-app sampling (C)**.
- ✅ **Current decision: keep API/BYOK.** Revisit this doc when cost pressure justifies the connector/manual-mode build.
