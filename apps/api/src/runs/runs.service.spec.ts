import { BadRequestException } from '@nestjs/common';
import { Provider, StepKind, ActionType, StepMode, StepStatus } from '@lyra/shared';
import { RunsService } from './runs.service';
import type { RunDocument } from './run.schema';

function makeService(deps?: {
  keys?: any;
  actions?: any;
  projects?: any;
  model?: any;
  prompts?: any;
  registry?: any;
  assets?: any;
  cache?: any;
}): RunsService {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  // rate() only touches doc + users (via toView, which we stub); other deps unused.
  const svc = new RunsService(
    deps?.model ?? ({} as never), // model
    deps?.keys ?? ({} as never), // keys
    users as never, // users
    deps?.registry ?? ({} as never), // registry
    deps?.prompts ?? ({} as never), // prompts
    deps?.assets ?? ({} as never), // assets
    deps?.actions ?? ({} as never), // actions
    deps?.projects ?? ({} as never), // projects
    deps?.cache ?? ({} as never), // cache (StepResultCache model)
  );
  jest.spyOn(svc, 'toView').mockResolvedValue({ id: 'r1' } as never);
  return svc;
}

// Build a minimal RunDocument for cache tests. One prompt step at index 0,
// in 'idle' state, ready for runStep.
function makeRunDoc(provider: Provider = Provider.Anthropic): RunDocument {
  return {
    _id: { toString: () => 'run-1' },
    workspaceId: 'ws-1',
    projectId: undefined,
    variables: {},
    collections: {},
    status: 'idle',
    currentStep: 0,
    updatedBy: '',
    steps: [
      {
        index: 0,
        name: 'Write',
        provider,
        model: 'claude-3-haiku',
        mode: StepMode.Auto,
        status: StepStatus.Idle,
        prompt: 'Write a product description for {product}',
        kind: undefined,
        action: undefined,
      },
    ],
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  } as unknown as RunDocument;
}

// Build a minimal mock cache model (findOne chain + updateOne chain).
function makeCacheMock(hitResult?: { result: string; assets?: any[] } | null) {
  const execFindOne = jest.fn().mockResolvedValue(hitResult ?? null);
  const lean = jest.fn().mockReturnValue({ exec: execFindOne });
  const findOne = jest.fn().mockReturnValue({ lean });
  const execUpdateOne = jest.fn().mockResolvedValue({ acknowledged: true });
  const updateOne = jest.fn().mockReturnValue({ exec: execUpdateOne });
  return { findOne, lean, execFindOne, updateOne, execUpdateOne };
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

describe('RunsService.createForPipeline', () => {
  it('skips the prompt lookup for action steps (empty promptId) and carries kind/action into the run', async () => {
    const findActiveById = jest.fn().mockResolvedValue({ content: 'PROMPT BODY' });
    // BaseRepository.create does `new this.model(doc).save()`.
    const ModelMock = jest
      .fn()
      .mockImplementation((d: Record<string, unknown>) => ({ ...d, save: jest.fn().mockResolvedValue(d) }));
    const svc = makeService({ model: ModelMock, prompts: { findActiveById } });

    const run = (await svc.createForPipeline(
      {
        workspaceId: 'w1',
        pipelineId: 'pl1',
        pipelineName: 'P',
        projectVariables: {},
        steps: [
          { name: 'Write', promptId: 'real-id', provider: 'anthropic', model: 'm', mode: 'auto' },
          {
            name: 'Brand',
            promptId: '',
            provider: 'anthropic',
            model: '',
            mode: 'auto',
            kind: StepKind.Action,
            action: { type: ActionType.Brand, position: 'br', size: 'md' },
          },
        ],
      } as never,
      'actor-1',
    )) as unknown as { steps: { kind?: string; action?: { type: string } }[] };

    // C1: never look up a prompt for the action step's empty id (would CastError).
    expect(findActiveById).toHaveBeenCalledTimes(1);
    expect(findActiveById).toHaveBeenCalledWith('real-id');
    expect(findActiveById).not.toHaveBeenCalledWith('');
    // The action step's kind/action reach the run document.
    expect(run.steps[1].kind).toBe(StepKind.Action);
    expect(run.steps[1].action?.type).toBe(ActionType.Brand);
  });
});

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

describe('RunsService step cache', () => {
  // Shared setup: keys + assets that every cache test needs.
  function makeRegistryAndKeys(providerOutput: any) {
    const providerExecute = jest.fn().mockResolvedValue(providerOutput);
    const registry = { get: jest.fn().mockReturnValue({ execute: providerExecute }) };
    const keys = { list: jest.fn().mockResolvedValue([{ provider: 'anthropic' }]), getDecrypted: jest.fn().mockResolvedValue('sk-test') };
    const assets = { createForStep: jest.fn().mockResolvedValue(['asset-id-1']) };
    return { providerExecute, registry, keys, assets };
  }

  it('cache HIT: returns stored output without calling the provider', async () => {
    const cachedAsset = { type: 'image', url: 'https://cdn/cached.png' };
    const cache = makeCacheMock({ result: 'cached text', assets: [cachedAsset] });
    const { providerExecute, registry, keys, assets } = makeRegistryAndKeys({ result: 'fresh', assets: [] });

    const svc = makeService({ cache, registry, keys, assets });
    const runDoc = makeRunDoc(Provider.Anthropic);

    await svc.runStep(runDoc, 0, 'actor-1');

    // Provider must NOT be called on a cache HIT.
    expect(providerExecute).not.toHaveBeenCalled();
    // Verify the cache was consulted (and the step took the cached path).
    expect(cache.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1' }),
    );
    // An asset must be created from the cached assets.
    expect(assets.createForStep).toHaveBeenCalled();
    // The step.cached flag should be true — check via toView spy was called (persist ran).
    expect(runDoc.save).toHaveBeenCalled();
  });

  it('cache MISS: calls the provider then writes the cache entry', async () => {
    const cache = makeCacheMock(null); // no hit
    const providerOutput = { result: 'fresh output', assets: [], usage: { tokens: 5 } };
    const { providerExecute, registry, keys, assets } = makeRegistryAndKeys(providerOutput);

    const svc = makeService({ cache, registry, keys, assets });
    const runDoc = makeRunDoc(Provider.Anthropic);

    await svc.runStep(runDoc, 0, 'actor-1');

    // Provider must be called on a MISS.
    expect(providerExecute).toHaveBeenCalled();
    // Cache must be written with upsert.
    expect(cache.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ cacheKey: expect.any(String) }),
      expect.objectContaining({ $set: expect.objectContaining({ result: 'fresh output', workspaceId: 'ws-1' }) }),
      { upsert: true },
    );
    expect(cache.execUpdateOne).toHaveBeenCalled();
  });

  it('bypassCache=true: skips the read and still writes the cache', async () => {
    // Even with a hit available, bypass forces a fresh provider call.
    const cache = makeCacheMock({ result: 'old cached', assets: [] });
    const providerOutput = { result: 'regenerated', assets: [], usage: { tokens: 3 } };
    const { providerExecute, registry, keys, assets } = makeRegistryAndKeys(providerOutput);

    const svc = makeService({ cache, registry, keys, assets });
    const runDoc = makeRunDoc(Provider.Anthropic);

    await svc.runStep(runDoc, 0, 'actor-1', true /* bypassCache */);

    // findOne must NOT be called (bypass skips the read).
    expect(cache.findOne).not.toHaveBeenCalled();
    // Provider must be called.
    expect(providerExecute).toHaveBeenCalled();
    // Cache must still be written (overwrite).
    expect(cache.updateOne).toHaveBeenCalled();
  });

  it('does NOT cache a Crawl step (provider does not need a key)', async () => {
    const cache = makeCacheMock(null);
    const providerOutput = { result: 'crawl result', assets: [], usage: { tokens: 0 } };
    const { providerExecute, registry, keys, assets } = makeRegistryAndKeys(providerOutput);
    // Crawl is in NO_KEY_PROVIDERS so keysPresent will be irrelevant; but we
    // still need getDecrypted so the service can resolve the (unused) key.
    keys.list.mockResolvedValue([]);

    const svc = makeService({ cache, registry, keys, assets });
    const runDoc = makeRunDoc(Provider.Crawl);
    // Crawl needs no key — so it is not locked. assertRunnable passes because
    // isLocked returns false for Crawl regardless of keysPresent.

    await svc.runStep(runDoc, 0, 'actor-1');

    // Provider is called (Crawl just goes through registry like any provider).
    expect(providerExecute).toHaveBeenCalled();
    // Neither findOne nor updateOne should be consulted for a Crawl step.
    expect(cache.findOne).not.toHaveBeenCalled();
    expect(cache.updateOne).not.toHaveBeenCalled();
  });

  it('C1 regression: static prompt with different prior-step results produces different cacheKeys', async () => {
    // Scenario: Step 0 (Write tagline) → Step 1 (Improve the tagline above — no {input}, used=false).
    // The cache key for Step 1 must differ between a run where Step 0 produced "Tagline A"
    // vs one where Step 0 produced "Tagline B", even though Step 1's prompt is unchanged.
    const cache1 = makeCacheMock(null);
    const cache2 = makeCacheMock(null);
    const providerOutput = { result: 'improved', assets: [], usage: { tokens: 2 } };
    const { registry, keys, assets } = makeRegistryAndKeys(providerOutput);

    function makeDocWithPrior(priorResult: string): RunDocument {
      return {
        _id: { toString: () => 'run-x' },
        workspaceId: 'ws-1',
        projectId: undefined,
        variables: {},
        collections: {},
        status: 'idle',
        currentStep: 1,
        updatedBy: '',
        steps: [
          {
            index: 0,
            name: 'Write',
            provider: Provider.Anthropic,
            model: 'claude-3-haiku',
            mode: StepMode.Auto,
            status: StepStatus.Done,
            prompt: 'Write a tagline for {product}',
            result: priorResult,
          },
          {
            index: 1,
            name: 'Improve',
            provider: Provider.Anthropic,
            model: 'claude-3-haiku',
            mode: StepMode.Auto,
            status: StepStatus.Idle,
            prompt: 'Improve the tagline above', // no {input}/{step:Name} → used=false
          },
        ],
        markModified: jest.fn(),
        save: jest.fn().mockResolvedValue(undefined),
      } as unknown as RunDocument;
    }

    const svc1 = makeService({ cache: cache1, registry, keys, assets });
    const svc2 = makeService({ cache: cache2, registry, keys, assets });

    await svc1.runStep(makeDocWithPrior('Tagline A'), 1, 'actor-1');
    await svc2.runStep(makeDocWithPrior('Tagline B'), 1, 'actor-1');

    // Extract the cacheKey used in each findOne call — they must differ.
    const key1 = cache1.findOne.mock.calls[0]?.[0]?.cacheKey as string;
    const key2 = cache2.findOne.mock.calls[0]?.[0]?.cacheKey as string;
    expect(typeof key1).toBe('string');
    expect(typeof key2).toBe('string');
    expect(key1).not.toBe(key2);
  });

  it('cache READ error falls through to a normal provider call', async () => {
    // findOne chain rejects — the step must still complete via the provider.
    const execFindOne = jest.fn().mockRejectedValue(new Error('Mongo timeout'));
    const lean = jest.fn().mockReturnValue({ exec: execFindOne });
    const findOne = jest.fn().mockReturnValue({ lean });
    const execUpdateOne = jest.fn().mockResolvedValue({ acknowledged: true });
    const updateOne = jest.fn().mockReturnValue({ exec: execUpdateOne });
    const cache = { findOne, lean, execFindOne, updateOne, execUpdateOne };

    const providerOutput = { result: 'fallback output', assets: [], usage: { tokens: 2 } };
    const { providerExecute, registry, keys, assets } = makeRegistryAndKeys(providerOutput);

    const svc = makeService({ cache, registry, keys, assets });
    const runDoc = makeRunDoc(Provider.Anthropic);

    // Must not throw — best-effort read failure.
    await expect(svc.runStep(runDoc, 0, 'actor-1')).resolves.toBeDefined();
    // Provider was still called.
    expect(providerExecute).toHaveBeenCalled();
    // Run was persisted.
    expect(runDoc.save).toHaveBeenCalled();
  });
});

describe('RunsService.executeStep', () => {
  it('routes action steps to ActionRegistry without decrypting keys', async () => {
    const keys = { getDecrypted: jest.fn() };
    const actionExecute = jest.fn().mockResolvedValue({
      result: 'https://cdn/out.png',
      assets: [{ type: 'image', url: 'https://cdn/out.png' }],
    });
    const actions = { get: jest.fn().mockReturnValue({ execute: actionExecute }) };
    const projects = { brandKit: jest.fn().mockResolvedValue({ logoUrl: 'https://cdn/logo.png' }) };

    const svc = makeService({ keys, actions, projects });

    const state = {
      steps: [
        {
          index: 0,
          kind: 'action',
          action: { type: 'brand', position: 'br', size: 'md' },
          prompt: 'https://cdn/a.png',
          mode: 'auto',
          status: 'running',
          model: '',
        },
      ],
    };

    const doc = {
      projectId: 'proj-1',
      workspaceId: 'ws-1',
      variables: {},
    } as RunDocument;

    const result = await (svc as any).executeStep(doc, state, 0);

    expect(actions.get).toHaveBeenCalledWith('brand');
    expect(actionExecute).toHaveBeenCalled();
    expect(keys.getDecrypted).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      result: 'https://cdn/out.png',
      assets: [{ type: 'image', url: 'https://cdn/out.png' }],
    });
  });

  // Regression test for C1: gatherInputImages must receive the pre-resolveStepRefs
  // prompt (`filled`) so that {step:Name} / {input} tokens are still present for
  // parseImageRefs to find. If the call used `prompt` (post-resolution) instead,
  // resolveStepRefs would have already replaced those tokens with the prior step's
  // result text and no image refs would be found, making inputImages always [].
  it('regression(C1): passes the pre-resolved prompt to the provider so inputImages is non-empty', async () => {
    const keys = { getDecrypted: jest.fn().mockResolvedValue('sk-test') };
    const providerExecute = jest.fn().mockResolvedValue({
      result: 'Generated 1 image with gemini-2.0-flash-preview-image-generation.',
      assets: [{ type: 'image', url: 'data:image/png;base64,abc' }],
      usage: { tokens: 0 },
    });
    const registry = { get: jest.fn().mockReturnValue({ execute: providerExecute }) };
    // Prior step (index 0, name "Logo") has an image asset.
    const logoImgUrl = `data:image/png;base64,${Buffer.from('logodata').toString('base64')}`;
    const assets = {
      listForRun: jest.fn().mockResolvedValue([{ stepIndex: 0, type: 'image', url: logoImgUrl }]),
    };

    const svc = new RunsService(
      {} as never, // model
      keys as never,
      { refMap: jest.fn().mockResolvedValue(new Map()) } as never, // users
      registry as never,
      {} as never, // prompts
      assets as never,
      {} as never, // actions
      {} as never, // projects
      makeCacheMock(null) as never, // cache (no hit → provider is called with inputImages)
    );
    jest.spyOn(svc, 'toView').mockResolvedValue({ id: 'r1' } as never);

    const state = {
      steps: [
        // step 0: Logo step (already completed, has image asset)
        { index: 0, name: 'Logo', provider: Provider.Google, model: 'gemini-2.0-flash-preview-image-generation', prompt: 'A logo', mode: 'auto', status: 'done', result: 'Generated 1 image with gemini.' },
        // step 1: Compose step — prompt uses {step:Logo} to chain the prior image
        { index: 1, name: 'Compose', provider: Provider.Google, model: 'gemini-2.0-flash-preview-image-generation', prompt: 'Add text to {step:Logo}', mode: 'auto', status: 'running' },
      ],
    };

    const runDoc = {
      _id: { toString: () => 'run-1' },
      projectId: 'proj-1',
      workspaceId: 'ws-1',
      variables: {},
    } as unknown as RunDocument;

    await (svc as any).executeStep(runDoc, state, 1);

    // The provider must have been called with at least one inputImage (the Logo
    // step's asset). If C1 were present (prompt passed instead of filled),
    // resolveStepRefs would replace {step:Logo} with the text result and
    // parseImageRefs would find nothing, giving inputImages=[].
    const ctx = providerExecute.mock.calls[0][0];
    expect(ctx.inputImages).toHaveLength(1);
    expect(ctx.inputImages[0].b64).toBe(Buffer.from('logodata').toString('base64'));
  });

  it('Video steps also gather inputImages for img2video chaining', async () => {
    const keys = { getDecrypted: jest.fn().mockResolvedValue('rep-test') };
    const providerExecute = jest.fn().mockResolvedValue({
      result: 'Generated 1 video with minimax/video-01.',
      assets: [{ type: 'video', url: 'https://r2/generated/vid.mp4' }],
      usage: { tokens: 0 },
    });
    const registry = { get: jest.fn().mockReturnValue({ execute: providerExecute }) };
    // Prior step (index 0, name "Logo") has an image asset.
    const logoImgUrl = `data:image/png;base64,${Buffer.from('logodata').toString('base64')}`;
    const assets = {
      listForRun: jest.fn().mockResolvedValue([{ stepIndex: 0, type: 'image', url: logoImgUrl }]),
    };

    const svc = new RunsService(
      {} as never, // model
      keys as never,
      { refMap: jest.fn().mockResolvedValue(new Map()) } as never, // users
      registry as never,
      {} as never, // prompts
      assets as never,
      {} as never, // actions
      {} as never, // projects
      makeCacheMock(null) as never, // cache (no hit → provider is called with inputImages)
    );
    jest.spyOn(svc, 'toView').mockResolvedValue({ id: 'r1' } as never);

    const state = {
      steps: [
        // step 0: Logo step (already completed, has image asset)
        { index: 0, name: 'Logo', provider: Provider.Image, model: 'dall-e-3', prompt: 'A logo', mode: 'auto' as StepMode, status: 'done', result: 'Generated 1 image.' },
        // step 1: Video step — prompt uses {step:Logo} to chain the prior image
        { index: 1, name: 'Animate', provider: Provider.Video, model: 'minimax/video-01', prompt: 'animate {step:Logo}', mode: 'auto' as StepMode, status: 'running', result: undefined },
      ],
    };

    const runDoc = {
      _id: { toString: () => 'run-1' },
      projectId: 'proj-1',
      workspaceId: 'ws-1',
      variables: {},
    } as unknown as RunDocument;

    await (svc as any).executeStep(runDoc, state, 1);

    // The Video provider must have been called with inputImages (the Logo step's asset).
    const ctx = providerExecute.mock.calls[0][0];
    expect(ctx.inputImages).toHaveLength(1);
    expect(ctx.inputImages[0].b64).toBe(Buffer.from('logodata').toString('base64'));
  });
});
