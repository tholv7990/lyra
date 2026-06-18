import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';

interface Entry { path: string; created: number }

// In-memory id→temp-file map with TTL sweeping. Files are deleted on sweep.
export class FileStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  put(path: string, now: number = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { path, created: now });
    return id;
  }

  get(id: string): string | null {
    return this.map.get(id)?.path ?? null;
  }

  sweep(now: number = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) {
        this.map.delete(id);
        void unlink(e.path).catch(() => undefined);
      }
    }
  }
}
