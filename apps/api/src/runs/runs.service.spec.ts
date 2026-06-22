import { BadRequestException } from '@nestjs/common';
import { StepKind, ActionType, Provider } from '@lyra/shared';
import { RunsService } from './runs.service';
import type { RunDocument } from './run.schema';

function makeService(deps?: {
  keys?: any;
  actions?: any;
  projects?: any;
  model?: any;
  prompts?: any;
}): RunsService {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  // rate() only touches doc + users (via toView, which we stub); other deps unused.
  const svc = new RunsService(
    deps?.model ?? ({} as never), // model
    deps?.keys ?? ({} as never), // keys
    users as never, // users
    {} as never, // registry
    deps?.prompts ?? ({} as never), // prompts
    {} as never, // assets
    deps?.actions ?? ({} as never), // actions
    deps?.projects ?? ({} as never), // projects
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
});
