import { describe, it, expect } from 'vitest';
import { scoreMemory, MAX_RECALL_MEMORIES, MAX_RECALL_TOKENS, selectPriorContext, DEFAULT_RUN_CONTEXT_TOKENS } from './memory';
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

describe('selectPriorContext', () => {
  const p = (id: string, chars: number) => ({ key: id, result: 'x'.repeat(chars) });

  it('keeps all priors when under budget', () => {
    const priors = [p('a', 40), p('b', 40)];
    expect(selectPriorContext(priors, DEFAULT_RUN_CONTEXT_TOKENS)).toEqual(priors);
  });

  it('drops the OLDEST first when over budget, preserving order', () => {
    // each ~25 tokens (100 chars / 4); budget 60 tokens fits 2 newest (b,c), drops a.
    const priors = [p('a', 100), p('b', 100), p('c', 100)];
    const kept = selectPriorContext(priors, 60);
    expect(kept.map((x) => x.key)).toEqual(['b', 'c']);
  });

  it('always keeps at least the most-recent prior even if it alone exceeds budget', () => {
    const priors = [p('a', 100), p('b', 4000)];
    expect(selectPriorContext(priors, 10).map((x) => x.key)).toEqual(['b']);
  });

  it('returns [] for no priors', () => {
    expect(selectPriorContext([], 100)).toEqual([]);
  });
});
