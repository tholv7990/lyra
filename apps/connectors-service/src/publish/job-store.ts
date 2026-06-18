import { randomUUID } from 'node:crypto';
import type { PublishJob, Receipt } from '@lyra/shared';

interface Entry { status: PublishJob['status']; receipts?: Receipt[]; created: number }

// In-memory publish-job map with TTL sweeping (status + receipts; no files).
// Mirrors download's FileStore. Jobs are ephemeral — lost on restart (fine for v2).
export class JobStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  create(now: number = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { status: 'queued', created: now });
    return id;
  }

  update(id: string, patch: { status: PublishJob['status']; receipts?: Receipt[] }): void {
    const e = this.map.get(id);
    if (e) this.map.set(id, { ...e, ...patch });
  }

  get(id: string): PublishJob | null {
    const e = this.map.get(id);
    return e ? { jobId: id, status: e.status, receipts: e.receipts } : null;
  }

  sweep(now: number = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) this.map.delete(id);
    }
  }
}
