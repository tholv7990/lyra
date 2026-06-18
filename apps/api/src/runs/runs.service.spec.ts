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
