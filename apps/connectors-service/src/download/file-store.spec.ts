import { FileStore } from './file-store';

describe('FileStore', () => {
  it('put returns an unguessable id retrievable via get', () => {
    const fs = new FileStore(1000);
    const id = fs.put('/tmp/a.mp4');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fs.get(id)).toBe('/tmp/a.mp4');
    expect(fs.get('nope')).toBeNull();
  });
  it('sweep drops entries past TTL, keeps fresh ones', () => {
    const fs = new FileStore(1000);
    const id = fs.put('/tmp/a.mp4', 0); // created at t=0
    fs.sweep(500);
    expect(fs.get(id)).toBe('/tmp/a.mp4'); // still fresh
    fs.sweep(2000);
    expect(fs.get(id)).toBeNull(); // expired
  });
});
