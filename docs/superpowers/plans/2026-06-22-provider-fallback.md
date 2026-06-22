# Automatic key-gated provider fallback (pipeline runs) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a text/brain pipeline step's provider call fails with a *retryable* error, transparently retry the same prompt on another provider the workspace already has a BYO key for.

**Architecture:** A pure `fallbackChain` selector in `@lyra/shared` + a small `isRetryableProviderError` classifier in the api + a private `executeWithFallback` loop wrapping the single-call dispatch in `RunsService`. No new schema, no UI, no new dependency. Spec: [../specs/2026-06-22-provider-fallback-design.md](../specs/2026-06-22-provider-fallback-design.md).

**Tech Stack:** `@lyra/shared` (zero-dep, Vitest), NestJS api (Jest, `--runInBand`). No new dependency.

## Global Constraints
- **Base:** codex-dev (`505881ac`). Build in an isolated worktree off codex-dev (a Codex agent shares the main tree).
- `@lyra/shared` stays **zero runtime deps** — `fallbackChain` is a pure function.
- **Invariant 7:** the eligibility gate must guarantee a provider is only called when the workspace has its key (or it needs none); **never log a key**; keys resolved by `doc.workspaceId` only.
- **TDD**, per-task **LOCAL commits** (no push until the deploy step), explicit `git add <paths>` — **never `-A`** (shared tree).
- api tests run **serial** (`--runInBand`).
- **Worktree stale-dist gotcha:** run `pnpm --filter @lyra/shared build` BEFORE any api type-check (else phantom missing-export errors on `fallbackChain`).
- **Mandatory `security-reviewer` pass** before merge (touches the key-decrypt path on the run engine).
- **Deploy is NOT auto-run** — the user's standing rule is commit/push only on explicit ask. Task 6 stops and asks before any push / pm2 restart.

---

## Task 1: shared — `fallbackChain` selector + `TEXT_FALLBACK_ORDER`

**Files:**
- Modify: `packages/shared/src/utils/index.ts`
- Test: `packages/shared/src/utils/utils.test.ts`

**Interfaces:**
- Consumes: `Provider` (already imported in `index.ts`).
- Produces: `TEXT_FALLBACK_ORDER: Provider[]`; `fallbackChain(primary: Provider, isEligible: (p: Provider) => boolean): Provider[]`.

- [ ] **Step 1: Write the failing test** — append to `packages/shared/src/utils/utils.test.ts` (add `fallbackChain` to the existing `'./index'` import; `Provider` is already imported there):

```ts
describe('fallbackChain', () => {
  const all = () => true;
  const none = () => false;
  it('text primary + all alts eligible → primary first, then Anthropic→OpenAI→DeepSeek order', () => {
    expect(fallbackChain(Provider.OpenAI, all)).toEqual([Provider.OpenAI, Provider.Anthropic, Provider.DeepSeek]);
    expect(fallbackChain(Provider.DeepSeek, all)).toEqual([Provider.DeepSeek, Provider.Anthropic, Provider.OpenAI]);
  });
  it('text primary + no alts eligible → just [primary]', () => {
    expect(fallbackChain(Provider.Anthropic, none)).toEqual([Provider.Anthropic]);
  });
  it('includes only eligible alts', () => {
    const onlyDeepSeek = (p: Provider) => p === Provider.DeepSeek;
    expect(fallbackChain(Provider.OpenAI, onlyDeepSeek)).toEqual([Provider.OpenAI, Provider.DeepSeek]);
  });
  it('non-text primary → just [primary] (no cross-modality fallback)', () => {
    expect(fallbackChain(Provider.Image, all)).toEqual([Provider.Image]);
    expect(fallbackChain(Provider.Video, all)).toEqual([Provider.Video]);
    expect(fallbackChain(Provider.Crawl, all)).toEqual([Provider.Crawl]);
  });
});
```

- [ ] **Step 2: Run — FAIL** — `pnpm --filter @lyra/shared test -- fallbackChain`. Expected: FAIL (`fallbackChain` not exported).

- [ ] **Step 3: Implement** — in `packages/shared/src/utils/index.ts` (near the existing `keyProviderFor`/`providerNeedsKey` helpers):

```ts
// Text/brain providers whose output is interchangeable enough to retry across, in
// fallback priority order. Image/Google/Video/Crawl are other modalities — no
// cross-fallback. Used by the run engine's automatic provider fallback.
export const TEXT_FALLBACK_ORDER: Provider[] = [Provider.Anthropic, Provider.OpenAI, Provider.DeepSeek];

// Ordered providers to attempt for a step whose chosen provider is `primary`: the
// primary first, then the other text providers (in TEXT_FALLBACK_ORDER) for which
// `isEligible` is true (the workspace has their key). A non-text primary — or one
// with no eligible alternates — yields just [primary] (today's no-fallback path).
// Pure: the caller supplies eligibility so this stays dependency-free.
export function fallbackChain(
  primary: Provider,
  isEligible: (p: Provider) => boolean,
): Provider[] {
  if (!TEXT_FALLBACK_ORDER.includes(primary)) return [primary];
  const alts = TEXT_FALLBACK_ORDER.filter((p) => p !== primary && isEligible(p));
  return [primary, ...alts];
}
```

- [ ] **Step 4: Run — PASS** — `pnpm --filter @lyra/shared test -- fallbackChain` then `pnpm --filter @lyra/shared build` (rebuild dist so the api picks up the new export).

- [ ] **Step 5: Commit** —
```bash
git add packages/shared/src/utils/index.ts packages/shared/src/utils/utils.test.ts
git commit -m "feat(shared): fallbackChain selector for provider fallback"
```

---

## Task 2: api — `isRetryableProviderError` classifier

**Files:**
- Create: `apps/api/src/runs/providers/retryable.ts`
- Test: `apps/api/src/runs/providers/retryable.spec.ts`

**Interfaces:**
- Produces: `isRetryableProviderError(err: unknown): boolean`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/runs/providers/retryable.spec.ts`:

```ts
import { HttpException } from '@nestjs/common';
import { isRetryableProviderError } from './retryable';

describe('isRetryableProviderError', () => {
  it('retryable: 429, 5xx, 529, timeouts, quota markers', () => {
    expect(isRetryableProviderError({ status: 429 })).toBe(true);
    expect(isRetryableProviderError({ statusCode: 500 })).toBe(true);
    expect(isRetryableProviderError({ status: 503 })).toBe(true);
    expect(isRetryableProviderError(new HttpException('overloaded', 529))).toBe(true);
    expect(isRetryableProviderError(new Error('Request timed out'))).toBe(true);
    expect(isRetryableProviderError(new Error('429 Too Many Requests'))).toBe(true);
    expect(isRetryableProviderError(new Error('insufficient_quota'))).toBe(true);
    expect(isRetryableProviderError(new Error('socket hang up'))).toBe(true);
  });
  it('not retryable: 400/401/403/404, plain client errors, unknown', () => {
    expect(isRetryableProviderError({ status: 400 })).toBe(false);
    expect(isRetryableProviderError({ status: 401 })).toBe(false);
    expect(isRetryableProviderError(new HttpException('bad request', 400))).toBe(false);
    expect(isRetryableProviderError(new Error('invalid prompt'))).toBe(false);
    expect(isRetryableProviderError(undefined)).toBe(false);
    expect(isRetryableProviderError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL** — `pnpm --filter @lyra/api exec jest retryable`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** — `apps/api/src/runs/providers/retryable.ts`:

```ts
// True when a provider error is transient enough that retrying on ANOTHER provider
// could succeed: rate limits (429), server/overload errors (5xx incl Anthropic 529),
// network/timeouts, and quota markers. A client error (400/401/403/404/422 — a
// malformed prompt or a bad key) is NOT retryable; falling back would only mask a
// config error. Unknown shapes default to non-retryable (conservative — don't fan a
// mystery error across every provider's key).
// ponytail: substring heuristic on the message when no status is present; upgrade
// path is typed errors from the provider clients if this proves too loose.
export function isRetryableProviderError(err: unknown): boolean {
  const status = httpStatus(err);
  if (status !== undefined) return status === 429 || status >= 500;

  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (!msg) return false;
  return (
    /\b(429|529)\b/.test(msg) ||
    /rate.?limit|too many requests|overloaded|insufficient_quota|\bquota\b/.test(msg) ||
    /timeout|timed out|etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|network error/.test(msg) ||
    /internal server error|bad gateway|service unavailable|gateway timeout|\b50[0-9]\b/.test(msg)
  );
}

// Pull an HTTP status off the common error shapes: a Nest HttpException
// (getStatus()), a plain { status } / { statusCode }, or { response.status }.
function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const get = (e as { getStatus?: () => number }).getStatus;
  if (typeof get === 'function') {
    try { return get.call(e); } catch { /* fall through to plain fields */ }
  }
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  const resp = e.response as { status?: unknown } | undefined;
  if (resp && typeof resp.status === 'number') return resp.status;
  return undefined;
}
```

- [ ] **Step 4: Run — PASS** — `pnpm --filter @lyra/api exec jest retryable`.

- [ ] **Step 5: Commit** —
```bash
git add apps/api/src/runs/providers/retryable.ts apps/api/src/runs/providers/retryable.spec.ts
git commit -m "feat(api): isRetryableProviderError classifier"
```

---

## Task 3: api — `executeWithFallback` in RunsService + wire the dispatch + cache guard

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts`
- Test: `apps/api/src/runs/runs.service.fallback.spec.ts` (new — isolates the fallback unit; do not disturb any existing run specs)

**Interfaces:**
- Consumes: `fallbackChain` + `defaultModel` + `keyProviderFor` + `providerNeedsKey` (`@lyra/shared`); `isRetryableProviderError` (Task 2); `ProviderRegistry.get`, `KeysService.list`/`getDecrypted`, the existing private `keysPresent`.
- Produces: `private executeWithFallback(primary, stepForRun, apiKey, priorResults, inputImages, workspaceId): Promise<{ output: StepRunOutput; servedBy: Provider }>`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/runs/runs.service.fallback.spec.ts`. Constructs `RunsService` with only the deps `executeWithFallback` touches mocked (the constructor order is `model, keys, users, registry, prompts, assets, actions, projects, cache`):

```ts
import { Provider } from '@lyra/shared';
import { RunsService } from './runs.service';

type ExecMap = Partial<Record<Provider, jest.Mock>>;

function makeSvc(execMap: ExecMap, keyedProviders: Provider[]) {
  const registry = { get: (p: Provider) => ({ execute: execMap[p] ?? jest.fn() }) };
  const keys = {
    list: jest.fn().mockResolvedValue(keyedProviders.map((provider) => ({ provider }))),
    getDecrypted: jest.fn().mockResolvedValue('alt-key'),
  };
  const svc = new RunsService(
    {} as never, keys as never, {} as never, registry as never,
    {} as never, {} as never, {} as never, {} as never, {} as never,
  );
  return { svc, keys };
}
const step = (p: Provider) => ({ provider: p, model: 'm', name: 'Hook' });
const call = (svc: RunsService, primary: Provider) =>
  (svc as unknown as { executeWithFallback: Function }).executeWithFallback(primary, step(primary), 'primary-key', [], [], 'ws');

describe('RunsService.executeWithFallback', () => {
  it('primary success → primary served, no key lookup, no alt call', async () => {
    const primaryExec = jest.fn().mockResolvedValue({ result: 'ok' });
    const { svc, keys } = makeSvc({ [Provider.OpenAI]: primaryExec }, []);
    const res = await call(svc, Provider.OpenAI);
    expect(res).toMatchObject({ servedBy: Provider.OpenAI, output: { result: 'ok' } });
    expect(keys.list).not.toHaveBeenCalled();
  });

  it('primary retryable (429) + alt keyed → alt serves with its default model', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 429 });
    const dsExec = jest.fn().mockResolvedValue({ result: 'from-deepseek' });
    const { svc } = makeSvc({ [Provider.OpenAI]: primaryExec, [Provider.DeepSeek]: dsExec }, [Provider.DeepSeek]);
    const res = await call(svc, Provider.OpenAI);
    expect(res.servedBy).toBe(Provider.DeepSeek);
    expect(res.output.result).toBe('from-deepseek');
    // the alt ran with ITS default model, not the primary's "m"
    expect(dsExec.mock.calls[0][0].step.provider).toBe(Provider.DeepSeek);
    expect(dsExec.mock.calls[0][0].step.model).not.toBe('m');
  });

  it('primary retryable + no eligible alt → throws the primary error', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 429 });
    const { svc } = makeSvc({ [Provider.OpenAI]: primaryExec }, []);
    await expect(call(svc, Provider.OpenAI)).rejects.toMatchObject({ status: 429 });
  });

  it('primary non-retryable (400) → throws, no fallback attempted', async () => {
    const primaryExec = jest.fn().mockRejectedValue({ status: 400 });
    const anthroExec = jest.fn();
    const { svc, keys } = makeSvc({ [Provider.OpenAI]: primaryExec, [Provider.Anthropic]: anthroExec }, [Provider.Anthropic]);
    await expect(call(svc, Provider.OpenAI)).rejects.toMatchObject({ status: 400 });
    expect(anthroExec).not.toHaveBeenCalled();
    expect(keys.list).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run — FAIL** — `pnpm --filter @lyra/api exec jest runs.service.fallback`. Expected: FAIL (`executeWithFallback` not a function).

- [ ] **Step 3: Add imports** — in `apps/api/src/runs/runs.service.ts`:
  - Add `Logger` to the `@nestjs/common` import: `import { BadRequestException, Injectable, Logger } from '@nestjs/common';`
  - Add `fallbackChain` and `defaultModel` to the `@lyra/shared` import block (alongside `keyProviderFor`, `providerNeedsKey`, `Provider`).
  - Extend the step-provider type import: `import type { StepRunOutput, PriorStepResult, StepInputImage } from './providers/step-provider.interface';`
  - Add `import { isRetryableProviderError } from './providers/retryable';`

- [ ] **Step 4: Add the logger field** — inside the `RunsService` class body (above the constructor):

```ts
  private readonly logger = new Logger(RunsService.name);
```

- [ ] **Step 5: Implement `executeWithFallback`** — add this private method to `RunsService` (e.g. right after `executeFanOut`):

```ts
  // Run a single-call step through its primary provider; on a RETRYABLE error, retry
  // the same prompt on the other text providers the workspace has a key for (each
  // with its own default model). Eligibility reuses the same gate as `isLocked`, so
  // a provider is never called without its BYO key (invariant 7). The keys lookup is
  // lazy — a healthy primary costs nothing extra. Returns which provider served.
  private async executeWithFallback(
    primary: Provider,
    stepForRun: Step,
    apiKey: string,
    priorResults: PriorStepResult[],
    inputImages: StepInputImage[],
    workspaceId: string,
  ): Promise<{ output: StepRunOutput; servedBy: Provider }> {
    try {
      const output = await this.registry
        .get(primary)
        .execute({ step: stepForRun, apiKey, priorResults, inputImages });
      return { output, servedBy: primary };
    } catch (primaryErr) {
      if (!isRetryableProviderError(primaryErr)) throw primaryErr;
      const present = await this.keysPresent(workspaceId);
      const isEligible = (p: Provider) => !providerNeedsKey(p) || present.has(keyProviderFor(p));
      const alts = fallbackChain(primary, isEligible).filter((p) => p !== primary);
      let lastErr = primaryErr;
      for (const alt of alts) {
        const altKey = (await this.keys.getDecrypted(workspaceId, keyProviderFor(alt))) ?? '';
        const altStep = { ...stepForRun, provider: alt, model: defaultModel(alt) };
        try {
          const output = await this.registry
            .get(alt)
            .execute({ step: altStep, apiKey: altKey, priorResults, inputImages });
          this.logger.warn(
            `step "${stepForRun.name ?? stepForRun.key ?? ''}": ${primary} failed (${errMessage(primaryErr)}) → served by ${alt}`,
          );
          return { output, servedBy: alt };
        } catch (altErr) {
          lastErr = altErr;
          if (!isRetryableProviderError(altErr)) throw altErr;
        }
      }
      throw lastErr;
    }
  }
```

- [ ] **Step 6: Wire the dispatch + cache guard** — in `executeStep`, replace the single dispatch line and the cache write guard. Find:

```ts
    const output = await this.registry.get(provider).execute({ step: stepForRun, apiKey, priorResults, inputImages });
    if (cacheable) {
```

Replace with:

```ts
    const { output, servedBy } = await this.executeWithFallback(
      provider, stepForRun, apiKey, priorResults, inputImages, doc.workspaceId,
    );
    // Cache only the PRIMARY's result — a transient fallback must not poison the
    // (provider+model)-keyed cache (cacheKey above was built from the primary).
    if (cacheable && servedBy === provider) {
```

(Leave the cache-write body and the final `return output;` unchanged.)

- [ ] **Step 7: Run — PASS** — `pnpm --filter @lyra/shared build` (worktree stale-dist) then:
```bash
pnpm --filter @lyra/api exec jest runs.service.fallback
pnpm --filter @lyra/api run type-check
```
Both green.

- [ ] **Step 8: Commit** —
```bash
git add apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.service.fallback.spec.ts
git commit -m "feat(api): automatic key-gated provider fallback on pipeline run steps"
```

---

## Task 4: Phase 0 — CLAUDE.md doc truth-up (no code)

**Files:**
- Modify: root `CLAUDE.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Fix the stale "only Anthropic is real" claims** — in root `CLAUDE.md`, find the two places that say only Anthropic executes for real (the "Current state" paragraph: *"only **Anthropic** executes for real (others MockStepProvider)"* and the StepProvider paragraph: *"only Anthropic is real — openai/deepseek/image/video still use `MockStepProvider`"*). Replace both with the accurate state:

> Real providers: **Anthropic** (brain steps), **OpenAI** + **DeepSeek** (`OpenAiCompatStepProvider`), **Image** (`gpt-image-1`, reuses the OpenAI key), **Google/Gemini** image. **Mock-only:** Video and Crawl-as-render. Wiring a real provider = add its impl + map it in `ProviderRegistry`.

Keep the surrounding text; change only the inaccurate clauses. (No test — documentation.)

- [ ] **Step 2: Commit** —
```bash
git add CLAUDE.md
git commit -m "docs: correct stale 'only Anthropic is real' provider claims"
```

---

## Task 5: Full gate + whole-branch review

- [ ] **Step 1: Full gate (serial)** — from the worktree:
```bash
pnpm --filter @lyra/shared build
pnpm --filter @lyra/shared test
pnpm --filter @lyra/api run type-check && pnpm --filter @lyra/api exec jest --runInBand && pnpm --filter @lyra/api build
pnpm --filter @lyra/shared --filter @lyra/api run lint
```
Expected: all green, lint 0. (Web + connectors untouched — no need to build them.)

- [ ] **Step 2: `security-reviewer` pass** — dispatch the `security-reviewer` subagent on the diff (MERGE_BASE..HEAD). Focus: no key logged (the `logger.warn` line carries no key/`apiKey`); the eligibility gate (`!providerNeedsKey || keysPresent.has(keyProviderFor)`) is sound and never lets a non-BYO'd provider be called; no cross-workspace key access; a crafted "retryable" error can't coerce spend across every provider beyond the bounded text chain. Fix any Critical/Important before deploy.

---

## Task 6: Deploy (STOP — get user go-ahead first)

- [ ] **Step 1: STOP and report.** Per the user's standing rule (commit/push only when asked), do NOT push or restart anything yet. Report gate + security-review results and ask: "ship to dev?"

- [ ] **Step 2: On approval — merge + deploy.** ff-merge the branch into `codex-dev`, then in the MAIN tree: `pnpm --filter @lyra/shared build && pnpm --filter @lyra/api build`, `pm2 restart lyra-api`, confirm `lyra-api` boots clean (pm2 `online` + logs show "Nest application successfully started"), then `git push origin codex-dev:dev`. Web/connectors untouched → no other restart.

- [ ] **Step 3: Smoke (optional).** Trigger a pipeline run on a healthy provider → still works (fallback is a no-op when the primary succeeds). Full fallback exercise requires forcing a 429, so unit tests are the real proof.

---

## Self-Review

**Spec coverage:** §4 chain/eligibility → Task 1 (`fallbackChain`) + Task 3 (eligibility gate). §5 retryable → Task 2. §6 control flow + §7 location → Task 3. §8 cache (primary-only write) → Task 3 Step 6. §9 telemetry (log-only) → Task 3 `logger.warn`. §10 Phase 0 docs → Task 4. §13 invariants/deploy/security → Tasks 5–6. Non-goals (fan-out/Chat/cross-modality/config UI/schema field) → no tasks ✓.

**Placeholder scan:** every code step has literal code; commands have expected results. No TBD/TODO.

**Type consistency:** `fallbackChain(primary, isEligible): Provider[]` consistent across Task 1 def/test and Task 3 call. `isRetryableProviderError(err): boolean` consistent across Task 2 def/test and Task 3. `executeWithFallback(primary, stepForRun, apiKey, priorResults, inputImages, workspaceId): { output, servedBy }` consistent across Task 3 def/test/wire. `defaultModel`/`keyProviderFor`/`providerNeedsKey` are existing shared exports.

**Known coverage gap (intentional):** the cache-skip-on-fallback guard (Task 3 Step 6, `servedBy === provider`) is a one-line conditional verified by review + the existing cache tests, not a dedicated heavy `executeStep` test (which would need the full cache/prompt-resolution mock stack — over-engineering per YAGNI). The fallback decision logic itself is fully unit-tested in Task 3.
