import { MAX_RECALL_MEMORIES, MAX_RECALL_TOKENS, MemoryKind } from '@lyra/shared';
import { MemoryService } from './memory.service';

// ---------------------------------------------------------------------------
// Fake doc factory — mirrors what a real MemoryDocument looks like at runtime.
// ---------------------------------------------------------------------------
function fakeDoc(overrides: Record<string, unknown> = {}) {
  const id = overrides._id ?? 'm1';
  return {
    _id: { toString: () => String(id) },
    workspaceId: 'ws-1',
    kind: MemoryKind.Fact,
    text: 'some text',
    confidence: 1,
    provenance: 'explicit',
    active: true,
    createdBy: 'u1',
    updatedBy: 'u1',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Minimal mock model harness (mirrors products.service.spec.ts pattern).
// model.find(...).exec() resolves to an array; model.findOne(...).exec()
// resolves to one doc or null; model.create(...) resolves to a doc;
// model.updateOne(...).exec() resolves to undefined.
// ---------------------------------------------------------------------------
function makeFindChain(result: unknown) {
  const exec = jest.fn().mockResolvedValue(result);
  const chain = { exec };
  return { chain, exec };
}

function makeService(model: Record<string, unknown>) {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  return new MemoryService(model as any, users as any);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('MemoryService', () => {
  // ── remember: basic fact ──────────────────────────────────────────────────
  it('remember stores a fact: model.create called with workspaceId + text; returns a view', async () => {
    const doc = fakeDoc({ _id: 'm1', kind: MemoryKind.Fact, text: 'x' });
    const create = jest.fn().mockResolvedValue(doc);
    // findOne needed for dedupe path (dedupeKey absent → not called, but model needs it)
    const svc = makeService({ create });
    const view = await svc.remember('ws-1', { kind: MemoryKind.Fact, text: 'x' }, 'u1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', text: 'x', kind: MemoryKind.Fact }),
    );
    expect(view.id).toBe('m1');
    expect(view.text).toBe('x');
  });

  // ── remember: dedupe-versioning ───────────────────────────────────────────
  it('remember with dedupeKey deactivates prior + creates new with supersedes', async () => {
    const priorDoc = fakeDoc({ _id: 'old', dedupeKey: 'aspect', kind: MemoryKind.Preference, text: '9:16' });
    const newDoc = fakeDoc({ _id: 'new', dedupeKey: 'aspect', kind: MemoryKind.Preference, text: '1:1', supersedes: 'old' });

    // findOne → returns the prior memory
    const findOneExec = jest.fn().mockResolvedValue(priorDoc);
    const findOne = jest.fn().mockReturnValue({ exec: findOneExec });

    // updateOne → deactivates prior
    const updateOneExec = jest.fn().mockResolvedValue(undefined);
    const updateOne = jest.fn().mockReturnValue({ exec: updateOneExec });

    // create → new doc
    const create = jest.fn().mockResolvedValue(newDoc);

    const svc = makeService({ findOne, updateOne, create });
    const view = await svc.remember(
      'ws-1',
      { kind: MemoryKind.Preference, text: '1:1', dedupeKey: 'aspect' },
      'u2',
    );

    // findOne must have searched by workspaceId + dedupeKey + active
    expect(findOne).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', dedupeKey: 'aspect' }),
    );

    // updateOne must have deactivated the old doc
    expect(updateOne).toHaveBeenCalledWith(
      { _id: priorDoc._id },
      { $set: { active: false, updatedBy: 'u2' } },
    );

    // create must include supersedes
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ supersedes: 'old', dedupeKey: 'aspect' }),
    );

    expect(view.supersedes).toBe('old');
  });

  // ── recall: workspace + subjectId filter ─────────────────────────────────
  it('recall passes workspaceId + subjectId + active filter to model.find', async () => {
    const docs = [fakeDoc({ subjectId: 'p1' })];
    const exec = jest.fn().mockResolvedValue(docs);
    const find = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ find });
    await svc.recall('ws-1', { subjectId: 'p1' });
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', subjectId: 'p1', active: { $ne: false } }),
    );
  });

  // ── recall: query text filter ─────────────────────────────────────────────
  it('recall with query filters out docs whose text lacks the query term', async () => {
    const matching = fakeDoc({ _id: 'm1', text: 'I like dogs' });
    const notMatching = fakeDoc({ _id: 'm2', text: 'I like cats' });
    const exec = jest.fn().mockResolvedValue([matching, notMatching]);
    const find = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ find });
    const views = await svc.recall('ws-1', { query: 'dog' });
    expect(views).toHaveLength(1);
    expect(views[0].id).toBe('m1');
  });

  // ── recall: MAX_RECALL_MEMORIES cap ──────────────────────────────────────
  it('recall returns at most MAX_RECALL_MEMORIES items', async () => {
    const docs = Array.from({ length: MAX_RECALL_MEMORIES + 5 }, (_, i) =>
      fakeDoc({ _id: `m${i}`, text: 'short', confidence: 1 }),
    );
    const exec = jest.fn().mockResolvedValue(docs);
    const find = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ find });
    const views = await svc.recall('ws-1', {});
    expect(views.length).toBeLessThanOrEqual(MAX_RECALL_MEMORIES);
  });

  // ── recall: token budget ─────────────────────────────────────────────────
  it('recall respects token budget — fewer returned when text is long', async () => {
    // Each doc has text ~1600 chars → ~400 tokens; MAX_RECALL_TOKENS=1500 → fits ≤3
    const longText = 'a'.repeat(1600);
    const docs = Array.from({ length: 20 }, (_, i) =>
      fakeDoc({ _id: `m${i}`, text: longText, confidence: 1 }),
    );
    const exec = jest.fn().mockResolvedValue(docs);
    const find = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ find });
    const views = await svc.recall('ws-1', {});
    // Budget: 1500 tokens; each doc ~400 tokens → at most 3 fit (1200 < 1500 < 1600)
    expect(views.length).toBeLessThanOrEqual(Math.floor(MAX_RECALL_TOKENS / 400) + 1);
    expect(views.length).toBeGreaterThan(0);
  });
});
