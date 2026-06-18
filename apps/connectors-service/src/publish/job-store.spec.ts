import { JobStore } from './job-store';

describe('JobStore', () => {
  it('create → a queued job retrievable by id', () => {
    const s = new JobStore(1000);
    const id = s.create();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.get(id)).toEqual({ jobId: id, status: 'queued', receipts: undefined });
    expect(s.get('nope')).toBeNull();
  });
  it('update sets status + receipts', () => {
    const s = new JobStore(1000);
    const id = s.create();
    s.update(id, { status: 'done', receipts: [{ platform: 'bluesky', accountId: 'i1', status: 'ok' }] });
    expect(s.get(id)).toMatchObject({ status: 'done', receipts: [{ status: 'ok' }] });
  });
  it('sweep drops jobs past TTL, keeps fresh ones', () => {
    const s = new JobStore(1000);
    const id = s.create(0);
    s.sweep(500); expect(s.get(id)).not.toBeNull();
    s.sweep(2000); expect(s.get(id)).toBeNull();
  });
});
