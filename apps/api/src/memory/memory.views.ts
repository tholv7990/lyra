import type { Memory as MemoryView, MemoryKind, UserRef } from '@lyra/shared';
import type { MemoryDocument } from './memory.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

export function toMemory(d: MemoryDocument, refs: Map<string, UserRef>): MemoryView {
  return {
    id: d._id.toString(),
    workspaceId: d.workspaceId,
    userId: d.userId,
    kind: d.kind as MemoryKind,
    text: d.text,
    subjectType: d.subjectType,
    subjectId: d.subjectId,
    relatedIds: d.relatedIds,
    dedupeKey: d.dedupeKey,
    confidence: d.confidence,
    provenance: d.provenance,
    source: d.source,
    supersedes: d.supersedes,
    active: d.active ?? true,
    createdBy: userRef(d.createdBy, refs),
    updatedBy: userRef(d.updatedBy, refs),
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt ?? d.createdAt),
  };
}

export function memoryActorIds(d: MemoryDocument): string[] {
  return [d.createdBy, d.updatedBy];
}
