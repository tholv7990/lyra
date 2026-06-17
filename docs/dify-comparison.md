# Dify ↔ Lyra: architecture comparison & what to borrow

**Date:** 2026-06-17 · **Status:** research/advisory (no code changed) · Sources: `langgenius/dify@main` (read via GitHub), Lyra source.

Scope: how Dify integrates with AI providers, how it encrypts credentials, and — most important for us — how its **workflow engine** works, versus Lyra's. Plus a concrete, prioritized list of what we should and should **not** copy.

---

## 0. TL;DR

| Area | Dify | Lyra (today) | Verdict |
|---|---|---|---|
| **Provider integration** | 6 model types, rich base classes, declarative credential + parameter schemas, mandatory error normalization, **out-of-process plugin daemon (Go)** | One `StepProvider.execute(ctx) → {result, usage}` interface; `Record<Provider, impl>` registry | Keep Lyra's simplicity. **Borrow** 2 patterns: error normalization + declarative model/param schemas. **Skip** the plugin daemon. |
| **Credential encryption** | Hybrid **RSA-2048 + AES-128-EAX**, per-tenant keypair; private key stored **unencrypted** in blob storage; Redis cache | **AES-256-GCM**, single master key (`ENCRYPTION_KEY`), per-workspace BYOK keys encrypted at rest | **Do not copy Dify here** — Lyra's is simpler and uses stronger AES. Optional hardening: HKDF per-workspace subkeys + KMS-wrapped master + key-version tag. |
| **Workflow / pipeline** | True **DAG**: nodes+edges JSON, branch handles, variable pool, queue/event execution engine, parallel + iteration + loop + skip-propagation, per-node execution records | **Linear array** `steps: Step[]`, `currentStep` increments by 1, `{input}`/`{step:Name}` chaining, gates pause | **Highest-value learning.** Our new React-Flow canvas is already DAG-ready; the gap is the *data model + run engine*. Clear migration path below. |

**The one big takeaway:** we just shipped an n8n-style canvas over a *linear* chain (deliberately — the user chose "look, one path"). Dify is the reference for the **"real branching"** option we deferred. The UI substrate (React Flow, edges, handles) is already capable of branching; turning Lyra into a real workflow tool is now a **backend** project (Pipeline data model + `run.engine.ts`), not a UI rewrite.

---

## 1. AI provider integration

### Dify
- **Two coexisting tracks** on `main`: the in-repo `api/core/model_runtime/` (YAML manifest + Python class per provider) **and** a newer **plugin system** — providers ship as `.difypkg` packages run by a separate **`dify-plugin-daemon`** (Go), which the Python API calls over HTTP; the daemon runs each plugin as a subprocess (stdio), TCP (debug), or Lambda (serverless).
- **Interface:** every model type has a base class with a public `invoke()` → abstract `_invoke()`. Six model types: `llm`, `text-embedding`, `rerank`, `speech2text`, `tts`, `moderation`. LLM `_invoke` returns `LLMResult` or a `Generator[LLMResultChunk]` for streaming.
- **Declarative schemas:** `provider_credential_schema` (field types `secret-input`/`text-input`/`select`/…, validated by `validate_provider_credentials`) and per-model `parameter_rules` (temperature/max_tokens/… with `min`/`max`/`default`/`use_template`).
- **Mandatory error normalization:** providers must map SDK exceptions into 5 standard errors (`InvokeConnectionError`, `InvokeRateLimitError`, `InvokeAuthorizationError`, `InvokeServerUnavailableError`, `InvokeBadRequestError`).
- Key files: `api/core/model_runtime/model_providers/__base/large_language_model.py`, `api/core/provider_manager.py`, `api/core/model_manager.py`, `api/core/plugin/plugin_service.py`.

### Lyra
- One interface — [`StepProvider.execute(ctx) → {result, usage}`](apps/api/src/runs/providers/step-provider.interface.ts), `ctx = { step, apiKey, priorResults }`. The service decrypts the per-workspace key and passes it in (providers never read keys).
- [`ProviderRegistry`](apps/api/src/runs/providers/provider.registry.ts) is a literal `Record<Provider, StepProvider>` (Anthropic real; OpenAI/DeepSeek via one OpenAI-compatible impl; image/video mock). Swapping a model is a one-line change — exactly invariant #9.

### What to borrow (and not)
- ✅ **Error normalization.** Add a small typed error set (`ProviderAuthError`, `ProviderRateLimitError`, `ProviderBadRequestError`, `ProviderUnavailableError`) and have each provider map its SDK errors into it. Today a provider failure becomes a generic `failStep(message)`; typed errors let the UI show "key invalid" vs "rate-limited, retry" and let the engine auto-retry transient ones. Low effort, high UX/robustness payoff.
- ✅ **Declarative model + parameter metadata.** We already have a `MODEL_CATALOG` in shared; extend it with per-model `parameter_rules` (max_tokens ceiling, temperature range, supports-vision/tools flags) so the composer/step drawer can render correct controls and we validate before spending. This is the useful half of Dify's manifest system without the YAML/plugin machinery.
- ❌ **Plugin daemon.** A separate Go process running providers as subprocesses is the right call at Dify's marketplace scale and wrong at Lyra's. Our in-process registry is correct; don't add it.
- ◻️ **Model-type split** (embedding/rerank/tts/…). Only worth it if/when Lyra makes those first-class step types. For now, one text-in/text-out `execute` is fine. If we add image/video for real (phase 6), give them their own `StepProvider` impls rather than overloading the text shape.

---

## 2. Credential encryption

### Dify
- **Hybrid RSA-2048 + AES-128-EAX**: random 16-byte AES key encrypts the payload (EAX, authenticated); the AES key is wrapped with the tenant's RSA public key (PKCS#1 **OAEP/SHA-1**). Wire format `HYBRID:` + wrapped-key + nonce + tag + ciphertext, base64'd.
- **Per-tenant keypair**, generated at tenant creation. **Public key** in the `Tenant` DB row; **private key** stored as a **plaintext PEM file in blob storage** (`privkeys/{tenant}/private.pem` via the storage abstraction — local/S3/GCS/…). **No server-side wrapping of the private key.** Decrypted private key cached in Redis ~120s.
- Masking at serialization: first-6/last-2 with stars.
- Key files: `api/libs/rsa.py`, `api/core/helper/encrypter.py`, `api/core/helper/provider_encryption.py`.

### Lyra
- [`EncryptionService`](apps/api/src/keys/encryption.service.ts): **AES-256-GCM**, single master key from `ENCRYPTION_KEY` (32 bytes), format `iv:authTag:ciphertext` (hex). Per-workspace BYOK keys encrypted at rest; only `last4` ever leaves the API (invariant #3/#7).

### Assessment — **don't copy Dify here**
Dify's per-tenant isolation is appealing, but its weakest link is real: the **private key sits unencrypted in object storage**, so confidentiality rests entirely on storage ACLs — and it uses AES-**128** and SHA-1 OAEP. Lyra's single-master-key AES-256-GCM is simpler, uses a stronger cipher, and keeps the root secret out of the DB/storage entirely. The only thing Dify clearly wins is **blast radius** (per-tenant key compromise ≠ all tenants).

If we want that isolation without Dify's downsides, two cheap hardening steps:
1. **HKDF per-workspace subkeys.** Derive `key_ws = HKDF(masterKey, salt=workspaceId)` and encrypt each workspace's secrets with its subkey. One root secret, still AES-256-GCM, but a single leaked ciphertext/derived key doesn't generalize across workspaces. ~30 lines, no new infra.
2. **Versioned key + KMS.** Prefix the stored blob with a key-id (`v1:iv:tag:ct`) so we can rotate `ENCRYPTION_KEY` without a flag-day, and wrap the master key in a cloud KMS in prod. Addresses rotation (which neither system does gracefully today).

---

## 3. Workflow engine — the important one

### Dify's model
- **Graph JSON**: `{ nodes:[{id,type,data,position}], edges:[{source,target,sourceHandle,targetHandle}] }`. A DAG (cycle detection via BFS in `graph_topology.py`); loops are a *node type* whose body is a child sub-graph, not a real cycle.
- **~25 node types**: `start`/`end`/`answer`, `llm`, `if-else`, `question-classifier`, `parameter-extractor`, `code`, `template-transform`, `http-request`, `tool`, `agent`, `knowledge-retrieval`, `variable-aggregator`, `variable-assigner`, `iteration`, `loop`, `list-operator`, `human-input`, triggers (`webhook`/`schedule`), …
- **Variable pool + selectors**: values flow via a central `VariablePool` keyed by `[nodeId, outputName]`; referenced in prompts/conditions as `{{#nodeId.output#}}`, plus namespaces `sys` / `env` / `conversation`. Each node declares its input selectors; on completion its outputs are written to the pool for any downstream node.
- **Execution = queue/event engine** (`GraphEngine`), not a topo-sort loop: a **ready queue** holds nodes whose predecessors are done; a **worker pool** runs them concurrently (→ parallel fan-out for free); the **EdgeProcessor** reads each completed node's branch `sourceHandle` to enqueue only the taken path, and a **SkipPropagator** marks untaken branches skipped so convergence nodes don't deadlock. Iteration/Loop spawn **child engines**.
- **Persistence**: `workflow_runs` (one per run, full graph snapshot + IO + status) and `workflow_node_executions` (one row per node per run, with `predecessor_node_id`, inputs, outputs, status, tokens).
- **Workflow vs Chatflow**: `end` node (collect outputs) vs `answer` node (stream to chat); chatflow adds persistent `conversation` variables.

### Lyra's model
- `Pipeline.steps: PipelineStep[]` — an ordered array; a run is [`RunState = { status, currentStep, steps }`](apps/api/src/runs/run.engine.ts) advanced strictly by `currentStep += 1`. Chaining is implicit "previous step → next step" (`priorResults` + `fillPrompt` `{input}`/`{step:Name}`). Gate steps pause for approval. No edges, branches, parallelism, loops, or variable pool.

### What a linear array **cannot** do (and the smallest fix)
Capabilities we structurally can't express today: conditional branching (IF/ELSE, classifier-routing), parallel fan-out, fan-in/convergence, iteration/loop over a sub-graph, skip-propagation, multiple/triggered entry points.

**Minimum data-model + engine changes to become a real DAG** (this is the deferred "real branching" option, now scoped):
1. **Add explicit edges** to `Pipeline`: `edges: { source, target, sourceHandle? }[]`; steps become a keyed map `{ [id]: StepDef }` instead of an array. (Ordering becomes the edges, not the index.)
2. **Add a node `type`** to `StepDef` (`action` | `branch` | `aggregator` | … ), starting with `branch` carrying `{ handle, condition }[]`.
3. **Introduce a variable pool** to replace implicit prior-step chaining: generalize `fillPrompt` from `{input}`/`{step:Name}` to selector refs like `{{step-id.output}}` resolved against a per-run pool (a clean superset — current syntax can desugar to it).
4. **Rewrite the run loop** in `run.engine.ts` from "increment `currentStep`" to a **ready-queue driven by edges** (a node is runnable when all its incoming edges' sources are `Done`/skipped). Gates stay as a per-node pause; the queue just doesn't advance past a waiting gate.
5. **Add a `Skipped` step status** + skip-propagation so untaken branches don't block convergence (aggregator fires when its one live predecessor completes).
6. *(Optional, later)* per-node execution records like Dify's `workflow_node_executions` for history/observability; today results live inline on `steps[]`, which is fine to keep initially.

**Why this is now low-risk on the UI side:** the canvas we just built uses **React Flow**, whose native model is *already* nodes + edges + handles. Branch nodes = a node with multiple `sourceHandle` outputs; convergence = a node with multiple incoming edges. Our `buildGraph.ts` currently derives edges from array order — pointing it at a real `edges[]` field is a small change. So the work is concentrated in the API (`Pipeline` schema + `run.engine.ts` + `fillPrompt`), and the front-end mostly "unlocks" capability it can already render.

### Smaller workflow ideas worth lifting even if we stay mostly-linear
- **Variable pool / selectors** (`{{step.output}}`) — strictly better than `{input}`/`{step:Name}`; lets a step reference *any* upstream output + system vars (e.g. project niche/product), not just the immediately-previous one. Could ship independently of branching.
- **A few high-value node types first**, in priority order for our creative-pipeline use case: `if-else` (skip/branch on a condition), `iteration` (run a sub-flow per item — e.g. generate N image variants), `http-request`/`tool` (pull external data). `code`/`template-transform` are lower priority.
- **`human-input` ≈ our gate**, generalized — Dify models human review as a node; our gate is a step flag. Keeping the gate concept but allowing it anywhere in a graph is natural once edges exist.
- **Per-node execution log** for run history (who ran what, inputs/outputs, tokens) — good observability upgrade independent of branching.

---

## 4. Recommendation summary (prioritized)

1. **Decide whether "real branching" is on the roadmap.** If yes, it's a backend project with the 6-step scope in §3; the new canvas is ready for it. If no, still adopt the **variable pool / `{{step.output}}` selectors** (§3) — it's the highest-value, lowest-risk borrow and improves the linear product immediately.
2. **Provider error normalization** (§1) — small, improves run reliability + error UX, enables transient-retry.
3. **Per-model parameter metadata** in the shared `MODEL_CATALOG` (§1) — correct controls + pre-flight validation.
4. **Encryption: keep AES-256-GCM**; add key-versioning + (optionally) HKDF per-workspace subkeys and KMS-wrapped master for rotation/blast-radius (§2). Do **not** adopt Dify's RSA-hybrid-with-plaintext-private-key scheme.
5. **Skip** the plugin daemon and the 6-model-type split until there's concrete demand.

> Nothing in this doc was implemented — it's advisory. The cleanest first step that compounds toward branching *and* helps today is the **variable pool**.
