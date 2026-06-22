import { BadRequestException } from '@nestjs/common';
import { StepKind, ActionType } from '@lyra/shared';
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
});
