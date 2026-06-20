import { BadRequestException } from '@nestjs/common';
import { TaskStatus } from '@lyra/shared';
import { TasksService } from './tasks.service';

function execOf(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('TasksService', () => {
  const actorId = 'u1';
  const wsId = 'ws1';
  const projectId = 'p1';

  function makeService(opts: { memberFound?: boolean } = {}) {
    const { memberFound = true } = opts;
    const created = {
      _id: 't1',
      workspaceId: wsId,
      projectId,
      name: 'Launch',
      description: '',
      status: TaskStatus.New,
      pipelines: [],
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
    const memberships = {
      findFor: jest.fn().mockResolvedValue(memberFound ? { role: 'member', workspaceId: wsId } : null),
    };
    return {
      service: new TasksService(model as never, users as never, memberships as never),
      model,
    };
  }

  it('create defaults a new task to status "new"', async () => {
    const { service, model } = makeService();
    const view = await service.create(projectId, wsId, actorId, { name: 'Launch' });
    expect(view.status).toBe(TaskStatus.New);
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId, workspaceId: wsId, status: TaskStatus.New, createdBy: actorId }),
    );
  });

  it('rejects an empty task name', async () => {
    const { service } = makeService();
    await expect(service.create(projectId, wsId, actorId, { name: '   ' })).rejects.toThrow(BadRequestException);
  });

  it('rejects assigning a non-member', async () => {
    const { service } = makeService({ memberFound: false });
    await expect(service.update('t1', actorId, { assigneeId: 'stranger' })).rejects.toThrow(/member/i);
  });

  it('accepts assigning a workspace member', async () => {
    const { service, model } = makeService({ memberFound: true });
    await service.update('t1', actorId, { assigneeId: 'u2' });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ assigneeId: 'u2' }) }),
      expect.anything(),
    );
  });

  it('clears the assignee when assigneeId is null', async () => {
    const { service, model } = makeService();
    await service.update('t1', actorId, { assigneeId: null });
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $unset: { assigneeId: '' } }),
      expect.anything(),
    );
  });
});
