import { ProductStatus } from '@lyra/shared';
import { ProductsService } from './products.service';

function makeService(model: any) {
  const users = { refMap: jest.fn().mockResolvedValue(new Map()) };
  return new ProductsService(model as any, users as any);
}

describe('ProductsService (workspace-scoped)', () => {
  it('list filters by workspaceId + active', async () => {
    const exec = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ exec });
    const find = jest.fn().mockReturnValue({ sort });
    await makeService({ find }).list('ws-1');
    expect(find).toHaveBeenCalledWith({ workspaceId: 'ws-1', active: { $ne: false } });
  });

  it('applyResearch updates the target product with research fields', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: { toString: () => 'p1' }, createdBy: 'u', updatedBy: 'u' });
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ findOneAndUpdate });
    await svc.applyResearch('p1', 'system', { score: 80, decision: 'TEST_NOW' as any, evidence: [], sources: [] });
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: 'p1', active: { $ne: false } });
    expect(update.$set).toMatchObject({ score: 80, decision: 'TEST_NOW', updatedBy: 'system' });
  });
});
