import { randomUUID } from 'node:crypto';

export interface ServiceDownloadJob {
  jobId: string;
  status: 'running' | 'done' | 'error';
  pct: number;
  items?: { fileId: string; filename: string }[]; // service-internal (fileId); the api rewrites to file URLs
  error?: string;
}

interface Entry { status: ServiceDownloadJob['status']; pct: number; items?: ServiceDownloadJob['items']; error?: string; created: number }

// In-memory download-job map with TTL sweeping. Mirrors FileStore/JobStore.
// Jobs are ephemeral — lost on restart (fine; downloads are short-lived).
export class DownloadJobStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  create(now: number = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { status: 'running', pct: 0, created: now });
    return id;
  }

  update(id: string, patch: Partial<Omit<Entry, 'created'>>): void {
    const e = this.map.get(id);
    if (e) this.map.set(id, { ...e, ...patch });
  }

  get(id: string): ServiceDownloadJob | null {
    const e = this.map.get(id);
    return e ? { jobId: id, status: e.status, pct: e.pct, items: e.items, error: e.error } : null;
  }

  sweep(now: number = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) this.map.delete(id);
    }
  }
}
