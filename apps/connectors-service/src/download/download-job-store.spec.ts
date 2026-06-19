import { DownloadJobStore } from './download-job-store';

describe('DownloadJobStore', () => {
  it('create → a running job at 0% retrievable by id', () => {
    const s = new DownloadJobStore(1000);
    const id = s.create();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.get(id)).toEqual({ jobId: id, status: 'running', pct: 0, items: undefined, error: undefined });
    expect(s.get('nope')).toBeNull();
  });
  it('update advances pct, then marks done with items', () => {
    const s = new DownloadJobStore(1000);
    const id = s.create();
    s.update(id, { pct: 42 });
    expect(s.get(id)).toMatchObject({ status: 'running', pct: 42 });
    s.update(id, { status: 'done', pct: 100, items: [{ fileId: 'f1', filename: 'a.mp4' }] });
    expect(s.get(id)).toMatchObject({ status: 'done', pct: 100, items: [{ fileId: 'f1', filename: 'a.mp4' }] });
  });
  it('update can record an error', () => {
    const s = new DownloadJobStore(1000);
    const id = s.create();
    s.update(id, { status: 'error', error: 'This video is not available' });
    expect(s.get(id)).toMatchObject({ status: 'error', error: 'This video is not available' });
  });
  it('sweep drops jobs past TTL, keeps fresh ones', () => {
    const s = new DownloadJobStore(1000);
    const id = s.create(0);
    s.sweep(500);
    expect(s.get(id)).not.toBeNull();
    s.sweep(2000);
    expect(s.get(id)).toBeNull();
  });
});
