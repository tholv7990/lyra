import { describe, it, expect } from 'vitest';
import { scoreMemory, MAX_RECALL_MEMORIES, MAX_RECALL_TOKENS } from './memory';
import { MemoryKind } from '../enums';
import type { Memory } from '../models';

const mem = (over: Partial<Memory>): Memory => ({ id: 'm', workspaceId: 'w', kind: MemoryKind.Fact, text: 't', confidence: 1, provenance: 'explicit', active: true, createdBy: { id: 'u', name: 'U' }, updatedBy: { id: 'u', name: 'U' }, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-06-01T00:00:00Z', ...over });
const now = '2026-06-24T00:00:00Z';

describe('scoreMemory', () => {
  it('a newer memory outranks an older one (same confidence/subject)', () => {
    expect(scoreMemory(mem({ updatedAt: '2026-06-20T00:00:00Z' }), { now })).toBeGreaterThan(scoreMemory(mem({ updatedAt: '2026-01-01T00:00:00Z' }), { now }));
  });
  it('a subject match outranks a non-match', () => {
    expect(scoreMemory(mem({ subjectId: 'p1', updatedAt: now }), { subjectId: 'p1', now })).toBeGreaterThan(scoreMemory(mem({ subjectId: 'p2', updatedAt: now }), { subjectId: 'p1', now }));
  });
  it('confidence scales the score', () => {
    expect(scoreMemory(mem({ confidence: 0.5, updatedAt: now }), { now })).toBeCloseTo(0.5, 6);
  });
  it('exposes recall budget constants', () => {
    expect(MAX_RECALL_MEMORIES).toBeGreaterThan(0);
    expect(MAX_RECALL_TOKENS).toBeGreaterThan(0);
  });
});
