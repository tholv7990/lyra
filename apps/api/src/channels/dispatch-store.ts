import { randomUUID } from 'node:crypto';
import type { Receipt } from '@lyra/shared';

// One routed sub-publish: a connectors-service job of a given kind.
export interface DispatchTarget {
  kind: 'postiz' | 'browser';
  jobId: string;
  channelIds: string[];
}

interface Entry {
  targets: DispatchTarget[];
  immediate: Receipt[]; // failures that never started a job (e.g. browser connector off)
  created: number;
}

// In-memory composite-publish map: one dispatch id fans out to N connectors-service
// jobs (Postiz + per-GoLogin browser). The web polls the dispatch id; the service
// aggregates the sub-jobs on read. Ephemeral (lost on restart) — fine for v1.
export class DispatchStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  create(targets: DispatchTarget[], immediate: Receipt[], now = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { targets, immediate, created: now });
    return id;
  }

  get(id: string): Entry | null {
    return this.map.get(id) ?? null;
  }

  sweep(now = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) this.map.delete(id);
    }
  }
}
