import { NotFoundException } from '@nestjs/common';
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

  it('create rejects a blank name', async () => {
    const svc = makeService({});
    await expect(svc.create('ws-1', 'u1', { name: '  ' })).rejects.toThrow('A product name is required.');
  });

  it('create stores defaults (Candidate status, empty images/tags/competitorIds)', async () => {
    const doc = { _id: { toString: () => 'p1' }, createdBy: 'u1', updatedBy: 'u1' };
    const create = jest.fn().mockResolvedValue(doc);
    const svc = makeService({ create });
    await svc.create('ws-1', 'u1', { name: 'Widget' });
    const arg = create.mock.calls[0][0];
    expect(arg.status).toBe(ProductStatus.Candidate);
    expect(arg.images).toEqual([]);
    expect(arg.tags).toEqual([]);
    expect(arg.competitorIds).toEqual([]);
  });

  // Workspace fence: a correct id with the WRONG workspaceId must throw NotFoundException
  it('get throws NotFoundException when product belongs to a different workspace', async () => {
    const exec = jest.fn().mockResolvedValue(null); // null = no match (wrong ws)
    const findOne = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ findOne });
    await expect(svc.get('p1', 'ws-OTHER')).rejects.toThrow(NotFoundException);
    // Confirm workspaceId was passed into the query filter
    expect(findOne).toHaveBeenCalledWith({ _id: 'p1', workspaceId: 'ws-OTHER', active: { $ne: false } });
  });

  it('remove soft-deletes with workspaceId fence', async () => {
    const exec = jest.fn().mockResolvedValue(null);
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ findOneAndUpdate });
    await svc.remove('p1', 'ws-1', 'u1');
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toMatchObject({ _id: 'p1', workspaceId: 'ws-1', active: { $ne: false } });
    expect(update.$set).toMatchObject({ active: false, updatedBy: 'u1' });
  });

  it('applyResearch updates the target product with research fields (workspace-fenced)', async () => {
    const exec = jest.fn().mockResolvedValue({ _id: { toString: () => 'p1' }, createdBy: 'u', updatedBy: 'u' });
    const findOneAndUpdate = jest.fn().mockReturnValue({ exec });
    const svc = makeService({ findOneAndUpdate });
    await svc.applyResearch('p1', 'ws-1', 'system', { score: 80, decision: 'TEST_NOW' as any, evidence: [], sources: [] });
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: 'p1', workspaceId: 'ws-1', active: { $ne: false } });
    expect(update.$set).toMatchObject({ score: 80, decision: 'TEST_NOW', updatedBy: 'system' });
  });
});
