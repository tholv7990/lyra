import { describe, expect, test } from 'vitest';
import type { Pipeline } from '@lyra/shared';
import { pipelineMatchesFilters, pipelineTagVocab } from './Pipelines';

// Minimal Pipeline factory — only the fields the filter helpers read.
function pipe(over: Partial<Pipeline> & { name: string }): Pipeline {
  return {
    id: over.id ?? over.name,
    workspaceId: 'ws',
    name: over.name,
    description: over.description ?? '',
    tags: over.tags ?? [],
    steps: over.steps ?? [],
    variables: over.variables ?? [],
    createdBy: over.createdBy ?? { id: 'u1', name: 'Alex' },
    updatedBy: over.updatedBy ?? { id: 'u1', name: 'Alex' },
    active: true,
    createdAt: '2026-06-18T00:00:00.000Z',
    updatedAt: '2026-06-18T00:00:00.000Z',
  } as Pipeline;
}

describe('pipelineTagVocab', () => {
  test('folds tag case (one chip per tag) and counts across casings', () => {
    const vocab = pipelineTagVocab([
      pipe({ name: 'A', tags: ['Research'] }),
      pipe({ name: 'B', tags: ['research'] }),
      pipe({ name: 'C', tags: ['SEO'] }),
    ]);
    // "Research"/"research" collapse to one entry (first-seen casing), count 2.
    expect(vocab).toEqual([
      ['Research', 2],
      ['SEO', 1],
    ]);
  });
});

describe('pipelineMatchesFilters', () => {
  const research = pipe({ name: 'Launch flow', tags: ['Research'], createdBy: { id: 'u1', name: 'Alex' } });
  const seo = pipe({ name: 'SEO audit', tags: ['seo'], createdBy: { id: 'u2', name: 'Bo' } });

  test('name search is a case-insensitive substring match', () => {
    expect(pipelineMatchesFilters(research, { q: 'launch', tags: [], creators: [] })).toBe(true);
    expect(pipelineMatchesFilters(research, { q: 'AUDIT', tags: [], creators: [] })).toBe(false);
  });

  test('tag filter is case-insensitive and OR within the group', () => {
    // selecting "research" matches a pipeline tagged "Research"
    expect(pipelineMatchesFilters(research, { q: '', tags: ['research'], creators: [] })).toBe(true);
    // OR semantics: either selected tag matches
    expect(pipelineMatchesFilters(seo, { q: '', tags: ['research', 'SEO'], creators: [] })).toBe(true);
    // no overlap → excluded
    expect(pipelineMatchesFilters(research, { q: '', tags: ['SEO'], creators: [] })).toBe(false);
  });

  test('creator filter matches by id', () => {
    expect(pipelineMatchesFilters(research, { q: '', tags: [], creators: ['u1'] })).toBe(true);
    expect(pipelineMatchesFilters(research, { q: '', tags: [], creators: ['u2'] })).toBe(false);
  });

  test('groups combine with AND', () => {
    expect(pipelineMatchesFilters(research, { q: 'launch', tags: ['research'], creators: ['u1'] })).toBe(true);
    expect(pipelineMatchesFilters(research, { q: 'launch', tags: ['research'], creators: ['u2'] })).toBe(false);
  });
});
