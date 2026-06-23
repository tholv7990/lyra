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
