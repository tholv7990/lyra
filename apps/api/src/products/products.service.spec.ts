import { BadRequestException } from '@nestjs/common';
import { ProductStatus } from '@lyra/shared';
import { ProductsService } from './products.service';

function execOf(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('ProductsService', () => {
  const actorId = 'u1';
  const wsId = 'ws1';
  const projectId = 'p1';

  function makeService() {
    const created = {
      _id: 'prod1',
      workspaceId: wsId,
      projectId,
      name: 'Cozy Plush Pet Sofa',
      description: '',
      status: ProductStatus.Candidate,
      evidence: [],
      sources: [],
      competitorIds: [],
      tags: [],
      createdBy: actorId,
      updatedBy: actorId,
    };
    const model = {
      create: jest.fn().mockResolvedValue(created),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue(execOf([])) }),
      findOne: jest.fn().mockReturnValue(execOf({ ...created })),
      findOneAndUpdate: jest.fn().mockReturnValue(execOf({ ...created })),
    };
    const users = {
      refMap: jest.fn().mockResolvedValue(new Map([[actorId, { id: actorId, name: 'U' }]])),
    };
    return {
      service: new ProductsService(model as never, users as never),
      model,
    };
  }

  it('create throws BadRequestException when name is blank', async () => {
    const { service } = makeService();
    await expect(service.create(projectId, wsId, actorId, { name: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('create persists with defaults — status Candidate, competitorIds [], tags []', async () => {
    const { service, model } = makeService();
    await service.create(projectId, wsId, actorId, { name: 'Cozy Plush Pet Sofa' });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId,
        workspaceId: wsId,
        status: ProductStatus.Candidate,
        competitorIds: [],
        tags: [],
        createdBy: actorId,
      }),
    );
  });

  it('remove soft-deletes — calls findOneAndUpdate with active:false in $set', async () => {
    const { service, model } = makeService();
    await service.remove('prod1', actorId);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'prod1' }),
      expect.objectContaining({ $set: expect.objectContaining({ active: false }) }),
    );
  });
});
