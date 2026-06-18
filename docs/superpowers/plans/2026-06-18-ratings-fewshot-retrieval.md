# Ratings + Few-Shot Retrieval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rate a run's overall output 👍/👎, then feed the workspace's best-rated pipelines into the AI pipeline builder as few-shot examples so generated designs improve over time.

**Architecture:** Embed an optional rating on the `Run` document (one verdict per run, last-writer-wins). A `PATCH /runs/:id/rating` write path (reusing `RunAccessGuard`). A read-only Mongo aggregation in `PipelineAiService` ranks pipelines by net thumbs and injects the top 3 as a few-shot block into the existing designer system prompt — output still re-validated by `repairSteps`.

**Tech Stack:** NestJS 10 + Mongoose (api), React 18 + Vite + react-i18next (web), `@lyra/shared` (types/DTO interfaces), Jest (api unit), Vitest (shared + web unit).

## Global Constraints

- **Commits are DEFERRED.** The user commits manually ("commit only when I ask"). Each task's final step **stages** changes (`git add`) and runs verification — do **not** run `git commit`. The final task runs the full gate.
- **`@lyra/shared` has ZERO runtime deps** — types/enums/interfaces only. DTOs are interfaces in shared; the api implements class-validator classes that `implements` them.
- **Server is the source of truth.** The rateable-when gate and few-shot scoring run server-side; AI output is re-validated against real prompt ids + the model catalog (`repairSteps`).
- **Multi-tenancy:** every Mongo query is scoped by `workspaceId`; the rating write path is gated by `RunAccessGuard`.
- **After any `apps/api` or `packages/shared` change:** rebuild before running the api — `pnpm --filter @lyra/shared build` (if shared changed, FIRST), then `pnpm --filter @lyra/api build`, then restart the api on :3001. Web is Vite HMR (no restart).
- **Rating shape (verbatim):** `{ value: 'up' | 'down'; by: string /*userId*/; at: string /*ISO*/ }`. Clear with `value: null`.
- **Rateable only once a run has ≥1 step with `status === 'done'`** (`StepStatus.Done`).
- **Scoring (verbatim):** net = (#up − #down) per `pipelineId`; keep net > 0; sort `net` desc, then `up` desc, then `runs` desc; take top **3**.
- Full gate (what CI gates): `pnpm turbo run type-check lint test build`.

---

### Task 1: Shared contracts — `RunRating` + `RateRunDto`

**Files:**
- Modify: `packages/shared/src/models/index.ts`
- Modify: `packages/shared/src/dto/index.ts`

**Interfaces:**
- Produces: `RunRating { value: 'up'|'down'; by: string; at: string }`; `Run.rating?: RunRating`; `RateRunDto { value: 'up'|'down'|null }`.

This is a type-only change (no runtime logic), so there is no unit test; the "test" is that shared builds and both apps type-check.

- [ ] **Step 1: Add the `RunRating` model and the `Run.rating` field**

In `packages/shared/src/models/index.ts`, add this interface immediately **before** `export interface Run extends Audited {`:

```ts
// A per-run 👍/👎 verdict on the run's overall output. One per run (last-writer-
// wins); `by` is the userId that set it. Seeds the AI builder's few-shot retrieval.
export interface RunRating {
  value: 'up' | 'down';
  by: string;
  at: string; // ISO timestamp
}
```

Then inside `export interface Run extends Audited { ... }`, add the field right after `steps: Step[];`:

```ts
  steps: Step[];
  rating?: RunRating; // overall thumbs on this run's output (optional)
```

- [ ] **Step 2: Add the `RateRunDto` interface**

In `packages/shared/src/dto/index.ts`, add at the end of the file (after `UpdateConversationDto`):

```ts
// ===== Run ratings =====
// Thumbs on a run's overall output. `value: null` clears the rating (toggle off).
export interface RateRunDto {
  value: 'up' | 'down' | null;
}
```

- [ ] **Step 3: Build shared and type-check it**

Run: `pnpm --filter @lyra/shared build && pnpm --filter @lyra/shared type-check`
Expected: both succeed (no test changes — shared has no logic here).

- [ ] **Step 4: Stage (do not commit)**

```bash
git add packages/shared/src/models/index.ts packages/shared/src/dto/index.ts packages/shared/dist
```

---

### Task 2: API write path — `PATCH /runs/:id/rating`

**Files:**
- Modify: `apps/api/src/runs/run.schema.ts`
- Modify: `apps/api/src/runs/run.views.ts:45-64` (`toRun`)
- Modify: `apps/api/src/runs/dto/runs.dto.ts`
- Modify: `apps/api/src/runs/runs.service.ts` (add `rate`)
- Modify: `apps/api/src/runs/runs.controller.ts` (add route)
- Test: `apps/api/src/runs/runs.service.spec.ts` (new)

**Interfaces:**
- Consumes: `RunRating` from `@lyra/shared`; `StepStatus.Done` (already imported in `runs.service.ts`).
- Produces: `RunsService.rate(doc: RunDocument, value: 'up'|'down'|null, actorId: string): Promise<RunModel>`; `RateRunBody` DTO class; `PATCH /runs/:id/rating`.

- [ ] **Step 1: Write the failing test for `RunsService.rate`**

Create `apps/api/src/runs/runs.service.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { RunsService } from './runs.service';
import type { RunDocument } from './run.schema';

function makeService(): RunsService {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  // rate() only touches doc + users (via toView, which we stub); other deps unused.
  const svc = new RunsService(
    {} as never, // model
    {} as never, // keys
    users as never, // users
    {} as never, // registry
    {} as never, // prompts
    {} as never, // assets
  );
  jest.spyOn(svc, 'toView').mockResolvedValue({ id: 'r1' } as never);
  return svc;
}

function doc(steps: { status: string }[], rating?: unknown): RunDocument {
  return {
    steps,
    rating,
    updatedBy: '',
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as RunDocument;
}

describe('RunsService.rate', () => {
  it('sets a rating once a step has completed', async () => {
    const svc = makeService();
    const d = doc([{ status: 'done' }]);
    await svc.rate(d, 'up', 'user-1');
    expect(d.rating).toMatchObject({ value: 'up', by: 'user-1' });
    expect(typeof d.rating!.at).toBe('string');
    expect(d.save).toHaveBeenCalled();
  });

  it('clears the rating when value is null', async () => {
    const svc = makeService();
    const d = doc([{ status: 'done' }], { value: 'up', by: 'x', at: 'y' });
    await svc.rate(d, null, 'user-1');
    expect(d.rating).toBeUndefined();
    expect(d.save).toHaveBeenCalled();
  });

  it('rejects rating a run with no completed step', async () => {
    const svc = makeService();
    const d = doc([{ status: 'idle' }]);
    await expect(svc.rate(d, 'up', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(d.save).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @lyra/api test -- runs.service`
Expected: FAIL — `svc.rate is not a function` (method not implemented yet).

- [ ] **Step 3: Add the `rating` prop to the Run schema**

In `apps/api/src/runs/run.schema.ts`, inside the `Run` class, add after the `steps` prop (after line 109, before the closing brace):

```ts
  @Prop({ type: [RunStepSchema], default: [] })
  steps!: RunStep[];

  // Per-run thumbs (overall output quality). One verdict per run, last-writer-wins.
  // Seeds the AI builder's few-shot retrieval (top-rated pipelines as examples).
  @Prop({ type: Object })
  rating?: { value: string; by: string; at: string };
```

- [ ] **Step 4: Map the rating through in `toRun`**

In `apps/api/src/runs/run.views.ts`, add the `UserRef` import line is unchanged; inside `toRun`'s returned object, add after `steps: doc.steps.map(toStep),`:

```ts
    steps: doc.steps.map(toStep),
    rating: doc.rating
      ? { value: doc.rating.value as 'up' | 'down', by: doc.rating.by, at: doc.rating.at }
      : undefined,
```

- [ ] **Step 5: Implement `RunsService.rate`**

In `apps/api/src/runs/runs.service.ts`, add this method right after `updatePrompt` (before the closing brace of the class, around line 371):

```ts
  // Set or clear the run's overall rating. Allowed only once a step has completed
  // (rating idle output is meaningless). One verdict per run, last-writer-wins.
  async rate(doc: RunDocument, value: 'up' | 'down' | null, actorId: string) {
    if (!doc.steps.some((s) => s.status === StepStatus.Done)) {
      throw new BadRequestException('Rate a run once it has produced a result.');
    }
    doc.rating = value === null ? undefined : { value, by: actorId, at: new Date().toISOString() };
    doc.markModified('rating');
    doc.updatedBy = actorId;
    await doc.save();
    return this.toView(doc);
  }
```

(`BadRequestException` and `StepStatus` are already imported in this file.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @lyra/api test -- runs.service`
Expected: PASS (3 tests).

- [ ] **Step 7: Add the `RateRunBody` DTO**

In `apps/api/src/runs/dto/runs.dto.ts`, replace the import line and add the class:

```ts
import { IsIn, IsObject, IsOptional, IsString, ValidateIf } from 'class-validator';
import type { RateRunDto, RunPipelineDto, UpdateStepPromptDto } from '@lyra/shared';
```

Add at the end of the file:

```ts
// Rate a run's overall output. `value: null` clears it (validation runs only when
// a value is present, so null passes through to clear the rating).
export class RateRunBody implements RateRunDto {
  @ValidateIf((o) => o.value !== null && o.value !== undefined)
  @IsIn(['up', 'down'])
  value!: 'up' | 'down' | null;
}
```

- [ ] **Step 8: Wire the controller route**

In `apps/api/src/runs/runs.controller.ts`, add `RateRunBody` to the dto import on line 32:

```ts
import { RateRunBody, RunPipelineBody, UpdatePromptBody } from './dto/runs.dto';
```

Add the route after the `setPrompt` handler (after line 265):

```ts
  @Patch('runs/:id/rating')
  @UseGuards(RunAccessGuard)
  rate(
    @CurrentRun() run: RunDocument,
    @Body() body: RateRunBody,
    @CurrentUser() user: User,
  ): Promise<RunModel> {
    return this.runs.rate(run, body.value, user.id);
  }
```

- [ ] **Step 9: Type-check the api and rerun the service test**

Run: `pnpm --filter @lyra/api type-check && pnpm --filter @lyra/api test -- runs.service`
Expected: type-check passes; 3 tests pass.

- [ ] **Step 10: Stage (do not commit)**

```bash
git add apps/api/src/runs/run.schema.ts apps/api/src/runs/run.views.ts apps/api/src/runs/dto/runs.dto.ts apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.controller.ts apps/api/src/runs/runs.service.spec.ts
```

---

### Task 3: API retrieval — few-shot injection into the AI builder

**Files:**
- Modify: `apps/api/src/pipelines/pipelines.module.ts` (register `Run` schema)
- Modify: `apps/api/src/pipelines/pipeline-ai.service.ts` (deps + `topRatedPipelineIds` + `topExamples` + prompt-builder params + reorder `byId`)
- Test: `apps/api/src/pipelines/pipeline-ai.service.spec.ts` (update harness + add tests)

**Interfaces:**
- Consumes: `RunsService.rate` writes `Run.rating` (Task 2); `PipelinesService.findActiveById`; the existing `CatalogItem` type + `byId: Map<string, CatalogItem>` already built in `generate()`/`chat()`.
- Produces: `PipelineAiService.topExamples(workspaceId: string, byId: Map<string, CatalogItem>): Promise<string>` (private); `designerPrompt(catalog, current?, examples?)` and `chatDesignerPrompt(catalog, current?, examples?)` gain an `examples = ''` param.

- [ ] **Step 1: Update the spec harness to the new 5-arg constructor**

In `apps/api/src/pipelines/pipeline-ai.service.spec.ts`, replace the imports and `makeService` so the service constructs with the two new deps (Run model + PipelinesService). Replace lines 1–27 with:

```ts
import { Provider, StepMode } from '@lyra/shared';
import { PipelineAiService } from './pipeline-ai.service';
import type { AnthropicClient } from '../runs/providers/anthropic.client';
import type { PromptsService } from '../prompts/prompts.service';
import type { KeysService } from '../keys/keys.service';
import type { PipelinesService } from './pipelines.service';
import type { Model } from 'mongoose';
import type { Run } from '../runs/run.schema';

const PROMPT = {
  _id: { toString: () => 'p1' },
  title: 'Crawl store',
  content: 'Crawl the given store URL and extract products.',
  tags: ['source'],
  provider: Provider.Crawl,
  model: 'fetch',
};

function makeService(completionText: string, prompts: unknown[]) {
  const anthropic = {
    complete: jest.fn().mockResolvedValue({ text: completionText }),
  } as unknown as AnthropicClient;
  const promptsSvc = {
    listPublic: jest.fn().mockResolvedValue(prompts),
  } as unknown as PromptsService;
  const keys = {
    getDecrypted: jest.fn().mockResolvedValue('sk-test'),
  } as unknown as KeysService;
  const runModel = {
    aggregate: jest.fn().mockResolvedValue([]),
  } as unknown as Model<Run>;
  const pipelinesSvc = {
    findActiveById: jest.fn().mockResolvedValue(null),
  } as unknown as PipelinesService;
  return new PipelineAiService(anthropic, promptsSvc, keys, runModel, pipelinesSvc);
}
```

Also update the standalone "requires an Anthropic key" test (currently constructs with 3 args) to pass the two extra mocks:

```ts
  it('requires an Anthropic key', async () => {
    const svc = new PipelineAiService(
      { complete: jest.fn() } as unknown as AnthropicClient,
      { listPublic: jest.fn() } as unknown as PromptsService,
      { getDecrypted: jest.fn().mockResolvedValue(null) } as unknown as KeysService,
      { aggregate: jest.fn() } as unknown as Model<Run>,
      { findActiveById: jest.fn() } as unknown as PipelinesService,
    );
    await expect(svc.generate('ws', 'goal')).rejects.toThrow(/Anthropic key/i);
  });
```

- [ ] **Step 2: Add the new (failing) injection tests**

Append inside the `describe('PipelineAiService.generate', ...)` block (before its closing `});`):

```ts
  it('injects top-rated pipelines as few-shot examples into the system prompt', async () => {
    const anthropic = {
      complete: jest.fn().mockResolvedValue({ text: '{"name":"X","description":"","steps":[]}' }),
    } as unknown as AnthropicClient;
    const promptsSvc = {
      listPublic: jest.fn().mockResolvedValue([PROMPT]),
    } as unknown as PromptsService;
    const keys = { getDecrypted: jest.fn().mockResolvedValue('sk') } as unknown as KeysService;
    const runModel = {
      aggregate: jest.fn().mockResolvedValue([{ _id: 'pipe1' }]),
    } as unknown as Model<Run>;
    const pipelinesSvc = {
      findActiveById: jest.fn().mockResolvedValue({
        name: 'Best flow',
        description: 'great',
        origin: { goal: 'sell sofas' },
        steps: [{ name: 'Crawl', promptId: 'p1', provider: 'crawl', model: 'fetch', mode: 'auto' }],
      }),
    } as unknown as PipelinesService;
    const svc = new PipelineAiService(anthropic, promptsSvc, keys, runModel, pipelinesSvc);

    await svc.generate('ws', 'goal');

    const system = (anthropic.complete as jest.Mock).mock.calls[0][0].system as string;
    expect(system).toContain('EXAMPLES OF WELL-RATED PIPELINES');
    expect(system).toContain('sell sofas'); // the example goal
    expect(system).toContain('Crawl store'); // the prompt title resolved from the catalog
  });

  it('omits the examples section when no pipelines qualify', async () => {
    const text = '{"name":"X","description":"","steps":[]}';
    const svc = makeService(text, [PROMPT]); // aggregate returns [] by default
    await svc.generate('ws', 'goal');
    // re-read the system prompt off the internal mock
    const anthropic = (svc as unknown as { anthropic: { complete: jest.Mock } }).anthropic;
    const system = anthropic.complete.mock.calls[0][0].system as string;
    expect(system).not.toContain('EXAMPLES OF WELL-RATED PIPELINES');
  });
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `pnpm --filter @lyra/api test -- pipeline-ai`
Expected: the two new tests FAIL (no examples injected yet); the existing tests should still pass once the constructor accepts 5 args (they will fail to compile until Step 5 adds the params — that's expected at this point).

- [ ] **Step 4: Register the `Run` schema in `PipelinesModule`**

In `apps/api/src/pipelines/pipelines.module.ts`, add the import and extend `forFeature`:

```ts
import { Pipeline, PipelineSchema } from './pipeline.schema';
import { Run, RunSchema } from '../runs/run.schema';
```

```ts
    MongooseModule.forFeature([
      { name: Pipeline.name, schema: PipelineSchema },
      { name: Run.name, schema: RunSchema },
    ]),
```

- [ ] **Step 5: Add deps + retrieval + injection to `PipelineAiService`**

In `apps/api/src/pipelines/pipeline-ai.service.ts`:

(a) Extend the imports at the top:

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  defaultModel,
  isModelAllowed,
  Provider,
  StepMode,
  type AiChatResponse,
  type AiChatTurn,
  type GeneratedPipeline,
  type GeneratedStep,
  type PipelineStepInput,
} from '@lyra/shared';
import { AnthropicClient } from '../runs/providers/anthropic.client';
import { PromptsService } from '../prompts/prompts.service';
import { KeysService } from '../keys/keys.service';
import { Run } from '../runs/run.schema';
import { PipelinesService } from './pipelines.service';
```

(b) Add the constant near the other consts (after `const PROVIDERS = ...`):

```ts
const MAX_EXAMPLES = 3;
```

(c) Replace the constructor:

```ts
  constructor(
    private readonly anthropic: AnthropicClient,
    private readonly prompts: PromptsService,
    private readonly keys: KeysService,
    @InjectModel(Run.name) private readonly runModel: Model<Run>,
    private readonly pipelines: PipelinesService,
  ) {}
```

(d) In `generate()`, build `byId` + `examples` **before** the `complete()` call and pass `examples` into `designerPrompt`. Replace the body from the catalog construction through `repairSteps` with:

```ts
    const catalog: CatalogItem[] = docs.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      tags: p.tags ?? [],
      provider: p.provider,
      model: p.model,
      snippet: (p.content ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LEN),
    }));
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const examples = await this.topExamples(workspaceId, byId);

    const model = defaultModel(Provider.Anthropic);
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.designerPrompt(catalog, current, examples),
      prompt: goal.trim(),
      maxTokens: 2000,
    });

    const parsed = this.parse(completion.text);
    const steps = this.repairSteps(parsed.steps.slice(0, MAX_STEPS), byId);
```

(Delete the now-duplicate `const byId = new Map(...)` that previously sat just before `repairSteps`.)

(e) In `chat()`, do the same — build `byId` + `examples` up front, pass `examples` to `chatDesignerPrompt`, and reuse `byId` below. Replace from the catalog construction down to the `return`:

```ts
    const catalog: CatalogItem[] = docs.map((p) => ({
      id: p._id.toString(),
      title: p.title,
      tags: p.tags ?? [],
      provider: p.provider,
      model: p.model,
      snippet: (p.content ?? '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LEN),
    }));
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const examples = await this.topExamples(workspaceId, byId);

    const model = defaultModel(Provider.Anthropic);
    const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
    const last = messages[messages.length - 1];
    const completion = await this.anthropic.complete({
      apiKey,
      model,
      system: this.chatDesignerPrompt(catalog, current, examples),
      prompt: last?.content?.trim() || '...',
      history,
      maxTokens: 2000,
    });

    const { message, pipeline } = this.chatParse(completion.text);
    let draft: GeneratedPipeline | undefined;
    if (pipeline && pipeline.steps.length) {
      const steps = this.repairSteps(pipeline.steps.slice(0, MAX_STEPS), byId);
      if (steps.length) {
        const goal = messages.find((m) => m.role === 'user')?.content?.trim().slice(0, 4000) ?? '';
        draft = {
          name: clip(pipeline.name, 120) || 'AI pipeline',
          description: clip(pipeline.description, 2000),
          steps,
          origin: { source: 'ai', goal, model },
        };
      }
    }
    return { reply: message || 'Okay.', draft };
```

(f) Add the two private retrieval methods (place them right after `chat()` / before `designerPrompt`):

```ts
  // Top-rated pipelines in the workspace by net thumbs (up - down), filtered to
  // net > 0, tiebroken by up-count then run-count. Read-only — drives few-shot.
  private async topRatedPipelineIds(workspaceId: string, limit = MAX_EXAMPLES): Promise<string[]> {
    const rows = await this.runModel.aggregate<{ _id: unknown }>([
      {
        $match: {
          workspaceId,
          'rating.value': { $in: ['up', 'down'] },
          pipelineId: { $type: 'string' },
        },
      },
      {
        $group: {
          _id: '$pipelineId',
          up: { $sum: { $cond: [{ $eq: ['$rating.value', 'up'] }, 1, 0] } },
          down: { $sum: { $cond: [{ $eq: ['$rating.value', 'down'] }, 1, 0] } },
          runs: { $sum: 1 },
        },
      },
      { $addFields: { net: { $subtract: ['$up', '$down'] } } },
      { $match: { net: { $gt: 0 } } },
      { $sort: { net: -1, up: -1, runs: -1 } },
      { $limit: limit },
    ]);
    return rows.map((r) => String(r._id));
  }

  // A compact few-shot block from the workspace's top-rated pipelines, or '' when
  // none qualify. Prompt titles resolve from the catalog already loaded; a prompt
  // not in the public catalog shows "(prompt unavailable)" but keeps the step shape.
  private async topExamples(workspaceId: string, byId: Map<string, CatalogItem>): Promise<string> {
    const ids = await this.topRatedPipelineIds(workspaceId);
    const blocks: string[] = [];
    for (const id of ids) {
      const p = await this.pipelines.findActiveById(id);
      if (!p || !p.steps?.length) continue;
      const goal = clip(
        p.origin?.goal || `${p.name}${p.description ? ` — ${p.description}` : ''}`,
        300,
      );
      const lines = p.steps.map((s, i) => {
        const title = !s.promptId ? '(gap)' : byId.get(s.promptId)?.title ?? '(prompt unavailable)';
        return `  ${i + 1}. ${s.name} [${s.provider}/${s.model}] ${s.mode} — prompt "${title}" (id: ${s.promptId || 'none'})`;
      });
      blocks.push([`Example ${blocks.length + 1} — Goal: ${goal}`, ...lines].join('\n'));
    }
    return blocks.join('\n\n');
  }
```

(g) Add the `examples` parameter to `designerPrompt` and insert the block. Change the signature to:

```ts
  private designerPrompt(catalog: CatalogItem[], current?: PipelineStepInput[], examples = ''): string {
```

In its returned array, change the segment that currently reads `'CATALOG:', list, '', ...task,` to:

```ts
      'CATALOG:',
      list,
      '',
      ...(examples
        ? [
            'EXAMPLES OF WELL-RATED PIPELINES IN THIS WORKSPACE (inspiration for structure and prompt selection; you may reuse their prompt ids when they fit the goal):',
            examples,
            '',
          ]
        : []),
      ...task,
```

(h) Add the `examples` parameter to `chatDesignerPrompt` and insert the block. Change the signature to:

```ts
  private chatDesignerPrompt(catalog: CatalogItem[], current?: PipelineStepInput[], examples = ''): string {
```

In its returned array, change `'CATALOG:', list, ...currentText, '',` to:

```ts
      'CATALOG:',
      list,
      ...currentText,
      '',
      ...(examples
        ? [
            'EXAMPLES OF WELL-RATED PIPELINES IN THIS WORKSPACE (inspiration for structure and prompt selection; you may reuse their prompt ids when they fit the goal):',
            examples,
            '',
          ]
        : []),
```

- [ ] **Step 6: Run the AI service tests to verify all pass**

Run: `pnpm --filter @lyra/api test -- pipeline-ai`
Expected: PASS — original tests + 2 new injection tests (7 total).

- [ ] **Step 7: Type-check the api**

Run: `pnpm --filter @lyra/api type-check`
Expected: passes (no circular-dep error — `Run` model is injected, `RunsService` is not imported).

- [ ] **Step 8: Stage (do not commit)**

```bash
git add apps/api/src/pipelines/pipelines.module.ts apps/api/src/pipelines/pipeline-ai.service.ts apps/api/src/pipelines/pipeline-ai.service.spec.ts
```

---

### Task 4: Web — per-run thumbs in the run toolbar

**Files:**
- Create: `apps/web/src/components/RunRating.tsx`
- Test: `apps/web/src/components/RunRating.test.tsx`
- Modify: `apps/web/src/pages/ProjectDetail.tsx` (import, `rate` handler, render in run bar, `StepStatus` import)
- Modify: `apps/web/src/i18n/locales/en/run.ts`
- Modify: `apps/web/src/i18n/locales/vi/run.ts`
- Modify: `apps/web/src/index.css` (rating button styles)

**Interfaces:**
- Consumes: `RunRating` type from `@lyra/shared`; the `api` fetch wrapper; the page's `run`/`setRun`/`setRuns`/`busy`/`act`.
- Produces: `RunRating` component + `nextRating(current, clicked)` pure helper; `ProjectDetail.rate(value)` handler.

> Note: vitest runs `environment: 'node'` (no jsdom/RTL). Test the toggle decision as a pure exported function and smoke-test the markup with `renderToStaticMarkup` — do NOT use RTL click events.

- [ ] **Step 1: Add i18n keys (en + vi)**

In `apps/web/src/i18n/locales/en/run.ts`, add before the `// statuses` comment:

```ts
  rate: 'Rate this run',
  rateUp: 'Rate this run good',
  rateDown: 'Rate this run bad',
```

In `apps/web/src/i18n/locales/vi/run.ts`, add the same keys (Vietnamese) in the corresponding place:

```ts
  rate: 'Đánh giá lần chạy này',
  rateUp: 'Đánh giá tốt',
  rateDown: 'Đánh giá kém',
```

- [ ] **Step 2: Write the failing test for `RunRating` + `nextRating`**

Create `apps/web/src/components/RunRating.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RunRating, nextRating } from './RunRating';

describe('nextRating', () => {
  it('sets the clicked value when none or the other is active', () => {
    expect(nextRating(undefined, 'up')).toBe('up');
    expect(nextRating('up', 'down')).toBe('down');
  });
  it('clears when clicking the already-active value', () => {
    expect(nextRating('up', 'up')).toBeNull();
    expect(nextRating('down', 'down')).toBeNull();
  });
});

describe('RunRating', () => {
  it('renders both thumbs and marks the active one', () => {
    const html = renderToStaticMarkup(
      <RunRating value={{ value: 'up', by: 'u', at: '' }} onRate={() => {}} />,
    );
    expect((html.match(/run-rating-btn/g) ?? []).length).toBe(2);
    expect(html).toContain('aria-pressed="true"');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @lyra/web test -- RunRating`
Expected: FAIL — cannot resolve `./RunRating`.

- [ ] **Step 4: Implement the `RunRating` component**

Create `apps/web/src/components/RunRating.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import type { RunRating as RunRatingValue } from '@lyra/shared';

interface RunRatingProps {
  value?: RunRatingValue;
  disabled?: boolean;
  onRate: (value: 'up' | 'down' | null) => void;
}

// The toggle decision: clicking the active thumb clears it, otherwise sets it.
export function nextRating(
  current: 'up' | 'down' | undefined,
  clicked: 'up' | 'down',
): 'up' | 'down' | null {
  return current === clicked ? null : clicked;
}

// Per-run thumbs: 👍 / 👎 reflecting the run's overall rating. Pure presentational —
// the page owns the API call (server is the source of truth).
export function RunRating({ value, disabled, onRate }: RunRatingProps) {
  const { t } = useTranslation();
  const current = value?.value;
  return (
    <div className="run-rating" role="group" aria-label={t('run.rate')}>
      <button
        type="button"
        className={`run-rating-btn${current === 'up' ? ' active' : ''}`}
        disabled={disabled}
        aria-pressed={current === 'up'}
        title={t('run.rateUp')}
        onClick={() => onRate(nextRating(current, 'up'))}
      >
        👍
      </button>
      <button
        type="button"
        className={`run-rating-btn${current === 'down' ? ' active' : ''}`}
        disabled={disabled}
        aria-pressed={current === 'down'}
        title={t('run.rateDown')}
        onClick={() => onRate(nextRating(current, 'down'))}
      >
        👎
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @lyra/web test -- RunRating`
Expected: PASS (3 tests).

- [ ] **Step 6: Wire `RunRating` into `ProjectDetail`**

In `apps/web/src/pages/ProjectDetail.tsx`:

(a) Add the component import near the other component imports (by line 26):

```ts
import { RunFlow } from '../components/RunFlow';
import { RunRating } from '../components/RunRating';
```

(b) Ensure `StepStatus` is imported from `@lyra/shared`. Find the existing `@lyra/shared` import and add `StepStatus` to it (if not already present).

(c) Add the `rate` handler right after the `savePrompt` handler (after line 289):

```ts
  const rate = (value: 'up' | 'down' | null) =>
    run &&
    act(async () => {
      const updated = await api<Run>(`/runs/${run.id}/rating`, {
        method: 'PATCH',
        body: JSON.stringify({ value }),
      });
      setRun(updated);
      setRuns((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    });
```

(d) Render the thumbs in the run bar. In the `run-view-bar` block, after the status badge (`<span className={`badge status-${run.status}`}>...`, line 330) and before `<div className="run-view-actions">`:

```tsx
              <span className={`badge status-${run.status}`}>{statusLabel(run.status)}</span>
              {run.steps.some((s) => s.status === StepStatus.Done) && (
                <RunRating value={run.rating} disabled={busy} onRate={rate} />
              )}
              <div className="run-view-actions">
```

- [ ] **Step 7: Add styles for the rating buttons**

In `apps/web/src/index.css`, append:

```css
.run-rating {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}
.run-rating-btn {
  width: auto;
  margin: 0;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  opacity: 0.45;
  filter: grayscale(1);
  transition: opacity 0.12s ease, filter 0.12s ease, background 0.12s ease;
}
.run-rating-btn:hover:not(:disabled) {
  opacity: 0.8;
  background: var(--surface-2, rgba(0, 0, 0, 0.05));
}
.run-rating-btn.active {
  opacity: 1;
  filter: none;
}
.run-rating-btn:disabled {
  cursor: default;
  opacity: 0.3;
}
```

(If `--surface-2` isn't a defined token, use an existing hover-surface token from `index.css`.)

- [ ] **Step 8: Type-check + test the web app**

Run: `pnpm --filter @lyra/web type-check && pnpm --filter @lyra/web test -- RunRating`
Expected: type-check passes; RunRating tests pass.

- [ ] **Step 9: Stage (do not commit)**

```bash
git add apps/web/src/components/RunRating.tsx apps/web/src/components/RunRating.test.tsx apps/web/src/pages/ProjectDetail.tsx apps/web/src/i18n/locales/en/run.ts apps/web/src/i18n/locales/vi/run.ts apps/web/src/index.css
```

---

### Task 5: Full gate + rebuild/restart + manual verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full CI gate**

Run: `pnpm turbo run type-check lint test build`
Expected: all 12 tasks green; api unit count increases (new `runs.service.spec` + 2 `pipeline-ai` tests), web test count increases (RunRating).

- [ ] **Step 2: Rebuild shared + api, restart the api**

```bash
pnpm --filter @lyra/shared build
pnpm --filter @lyra/api build
# kill :3001 then start detached (see SESSION-HANDOFF §0):
#   Get-NetTCPConnection -LocalPort 3001 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }
#   (cd apps/api && node dist/main.js)
# verify: curl http://localhost:3001/  -> 404 (app up)
```

- [ ] **Step 3: Manual verification with a real login**

Log in with the tester creds from `apps/api/.env` (do NOT echo secrets), `POST /auth/login` for a token. Workspace "Putiin's Workspace" = `6a309b8efe9ec7c83515dad5`. Then:
- Find/create a run with a completed step. `PATCH /runs/:id/rating` body `{"value":"up"}` → 200, response includes `rating: { value: 'up', by, at }`.
- `PATCH /runs/:id/rating` body `{"value":null}` → 200, `rating` absent.
- `PATCH` a run with no completed step → 400 "Rate a run once it has produced a result."
- `POST /workspaces/6a309b8efe9ec7c83515dad5/pipelines/generate { goal }` still returns a valid draft (no regression). With a top-rated pipeline present, the generator runs the few-shot path (examples are internal to the system prompt; unit tests assert injection).

- [ ] **Step 4: In-app UI check (dev.getlyras.app or :5173)**

Open a run in a project's run view: with no completed step the thumbs are hidden; once a step completes they appear next to the status badge. Click 👍 → highlights; click it again → clears; 👎 toggles likewise. Toggle dark mode — the buttons stay legible.

- [ ] **Step 5: Report status (commit only when the user asks)**

Summarize: tests added + counts, files changed, manual results. Leave everything staged; do not `git commit` unless the user requests it.

---

## Self-Review

**1. Spec coverage** (against `docs/superpowers/specs/2026-06-18-ratings-fewshot-retrieval-design.md`):
- §1 Data model → Task 1 (shared `RunRating` + `Run.rating`) + Task 2 Step 3/4 (schema + view). ✓
- §2 Write path (`PATCH /runs/:id/rating`, gate, clear) → Task 2. ✓
- §3 Retrieval (module wiring, aggregation, `topExamples`) → Task 3 Steps 4–5. ✓
- §4 AI builder integration (reorder `byId`, inject into both prompt builders, explicit-only scoring) → Task 3 Step 5 (d–h). ✓
- §5 Web (thumbs in toolbar, optimistic, gated by completed step, i18n) → Task 4. ✓
- §6 Testing (rate set/clear/reject, injection present/absent, web pure helper + markup) → Tasks 2/3/4 + full gate Task 5. ✓
- §7 Non-goals — nothing in the plan builds them. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows real code. The only conditional note ("if `--surface-2` isn't defined, use an existing token") is a concrete fallback instruction, not a placeholder. ✓

**3. Type consistency:** `rate(doc, value, actorId)` signature identical in service (Task 2 Step 5), controller (Step 8), and test (Step 1). `RunRating { value, by, at }` identical across shared/schema/view/web. `topExamples(workspaceId, byId)` and `nextRating(current, clicked)` names match between definition and call sites. `examples = ''` param added consistently to both `designerPrompt` and `chatDesignerPrompt` and passed from both `generate()` and `chat()`. ✓
