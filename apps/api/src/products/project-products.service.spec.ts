import { ProductsService } from './products.service';

function svc(model: any) {
  return new ProductsService(model, { refMap: jest.fn().mockResolvedValue(new Map()) } as any);
}

describe('ProductsService copies', () => {
  it('selectIntoProject snapshots pool info into a project copy', async () => {
    const pool = {
      _id: { toString: () => 'pool1' },
      workspaceId: 'ws',
      name: 'Bed',
      images: ['a'],
      category: 'pet',
      source: { url: 'u' },
      price: 50,
      offer: 'x',
      description: '',
      createdBy: 'u',
      updatedBy: 'u',
    };
    const created: any[] = [];
    const model = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(pool) }),
      create: jest.fn().mockImplementation((d) => {
        created.push(d);
        return { ...d, _id: { toString: () => 'copy1' }, createdBy: 'u', updatedBy: 'u' };
      }),
    };
    await svc(model).selectIntoProject('ws', 'proj1', 'pool1', 'u');
    expect(created[0]).toMatchObject({
      workspaceId: 'ws',
      projectId: 'proj1',
      poolProductId: 'pool1',
      name: 'Bed',
      images: ['a'],
      price: 50,
    });
    expect(created[0].poolSnapshotAt).toBeTruthy();
  });

  it('selectIntoProject rejects a missing/non-pool product', async () => {
    const model = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
    };
    await expect(svc(model).selectIntoProject('ws', 'proj1', 'nope', 'u')).rejects.toThrow();
  });
});

describe('ProductsService drift + refresh', () => {
  it('detects niche drift and re-snapshots niche while preserving per-brand price', async () => {
    // Copy has a stale niche; pool has updated niche. price/compareAtPrice are per-brand.
    const copy = {
      _id: { toString: () => 'copy1' },
      workspaceId: 'ws',
      projectId: 'proj1',
      poolProductId: 'pool1',
      active: true,
      name: 'Bed',
      niche: 'old niche',
      description: 'old desc',
      category: 'pet',
      images: ['a'],
      source: { url: 'u' },
      price: 99,          // per-brand — must NOT be overwritten by refresh
      compareAtPrice: 120,
      createdBy: 'u',
      updatedBy: 'u',
      poolSnapshotAt: '2026-01-01T00:00:00.000Z',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const pool = {
      _id: { toString: () => 'pool1' },
      workspaceId: 'ws',
      name: 'Bed',
      niche: 'new niche',
      description: 'new desc',
      category: 'pet',
      images: ['a'],
      source: { url: 'u' },
      price: 30,          // pool price must NOT be written back to copy
      createdBy: 'u',
      updatedBy: 'u',
    };

    // ── driftsFrom: niche changed → should drift ──────────────────────────
    // Access the private function indirectly by triggering listForProject.
    // We verify via listForProject that drift=true when niche differs.
    const copyForList = { ...copy, _id: { toString: () => 'copy1' }, poolProductId: 'pool1' };
    const listModel = {
      find: jest.fn().mockImplementation(({ projectId }) => {
        if (projectId === 'proj1') return { sort: () => ({ exec: jest.fn().mockResolvedValue([copyForList]) }) };
        return { sort: () => ({ exec: jest.fn().mockResolvedValue([pool]) }) };
      }),
      // for batch pool lookup
    };
    // Patch find to return pool for the $in batch
    listModel.find.mockImplementation((query: any) => {
      if (query.projectId) return { sort: () => ({ exec: jest.fn().mockResolvedValue([copyForList]) }) };
      // batch pool fetch
      return { exec: jest.fn().mockResolvedValue([pool]) };
    });
    const listResult = await svc(listModel as any).listForProject('ws', 'proj1');
    expect(listResult[0].drift).toBe(true);

    // ── refreshCopy: re-snapshots niche/description, does NOT touch price ─
    const refreshModel = {
      findOne: jest.fn()
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(copy) })   // copy lookup
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(pool) }),  // pool lookup
    };
    await svc(refreshModel as any).refreshCopy('copy1', 'ws', 'proj1', 'u');

    expect(copy.niche).toBe('new niche');
    expect(copy.description).toBe('new desc');
    // Per-brand fields must be untouched
    expect(copy.price).toBe(99);
    expect(copy.compareAtPrice).toBe(120);
    expect(copy.save).toHaveBeenCalled();
  });
});
