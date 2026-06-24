import { RunsService } from './runs.service';
import { StepStatus } from '@lyra/shared';

function versionError() { const e = new Error('No matching document'); e.name = 'VersionError'; return e; }

// Minimal fake doc: toState reads status/currentStep/steps; persist sets them + save().
function fakeDoc(over: Partial<any> = {}) {
  return { _id: 'r1', status: 'running', currentStep: 0, steps: [{ index: 0, status: StepStatus.Running, jobId: 'job1', mode: 'auto', model: 'm' }], variables: {}, save: jest.fn().mockResolvedValue(undefined), ...over } as any;
}

describe('RunsService.commit retry', () => {
  // toView needs users.refMap; stub it.
  const svc = Object.create(RunsService.prototype) as RunsService;
  (svc as any).users = { refMap: jest.fn().mockResolvedValue(new Map()) };

  it('retries once on VersionError then succeeds', async () => {
    const stale = fakeDoc();
    stale.save.mockRejectedValueOnce(versionError()).mockResolvedValue(undefined);
    const fresh = fakeDoc();
    (svc as any).model = { findById: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(fresh) }) };
    const mutate = jest.fn((s: any) => { s.status = 'stopped'; });
    await (svc as any).commit(stale, mutate, 'u');
    expect((svc as any).model.findById).toHaveBeenCalledTimes(1); // reloaded once
    expect(fresh.save).toHaveBeenCalled();
    expect(fresh.status).toBe('stopped');
  });

  it('propagates a non-VersionError without retry', async () => {
    const doc = fakeDoc();
    doc.save.mockRejectedValue(new Error('boom'));
    (svc as any).model = { findById: jest.fn() };
    await expect((svc as any).commit(doc, () => {}, 'u')).rejects.toThrow('boom');
    expect((svc as any).model.findById).not.toHaveBeenCalled();
  });
});
