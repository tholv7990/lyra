import { BadRequestException } from '@nestjs/common';
import { RunsService } from './runs.service';
import type { RunDocument } from './run.schema';

function makeService(deps?: {
  keys?: any;
  actions?: any;
  projects?: any;
}): RunsService {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  // rate() only touches doc + users (via toView, which we stub); other deps unused.
  const svc = new RunsService(
    {} as never, // model
    deps?.keys ?? ({} as never), // keys
    users as never, // users
    {} as never, // registry
    {} as never, // prompts
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
