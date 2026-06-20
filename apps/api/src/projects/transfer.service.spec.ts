import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { WorkspaceType, Role, ProjectStatus, ProjectShare } from '@lyra/shared';
import { TransferService } from './transfer.service';

// Minimal mock builder
function makeTransferService(opts: {
  sourceType?: WorkspaceType;
  targetType?: WorkspaceType;
  targetMemberRole?: Role | null;
  projectCreatedBy?: string;
  tasks?: { _id: string; pipelines: string[] }[];
  pipelines?: { _id: string; name: string; steps: { promptId: string; provider: string }[]; workspaceId: string }[];
  prompts?: { _id: string; title: string; workspaceId: string }[];
  pipelineUsedByOtherTask?: boolean;
  promptUsedByOutsidePipeline?: boolean;
  targetKeys?: string[];
} = {}) {
  const {
    sourceType = WorkspaceType.Personal,
    targetType = WorkspaceType.Team,
    targetMemberRole = Role.Member,
    projectCreatedBy = 'u1',
    tasks = [],
    pipelines = [],
    prompts = [],
    pipelineUsedByOtherTask = false,
    promptUsedByOutsidePipeline = false,
    targetKeys = [],
  } = opts;

  const actorId = 'u1';
  const sourceWsId = 'ws-personal';
  const targetWsId = 'ws-team';

  const project = {
    _id: { toString: () => 'p1' },
    createdBy: projectCreatedBy,
    workspaceId: sourceWsId,
    status: ProjectStatus.Draft,
    shared: ProjectShare.All,
    sharedWith: [],
    name: 'Test Project',
    description: '',
    variables: [],
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedBy: actorId,
  };

  const taskDocs = tasks.map((t) => ({ ...t, projectId: 'p1', workspaceId: sourceWsId }));
  const pipelineDocs = pipelines;
  const promptDocs = prompts;

  const taskModel = {
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(taskDocs) }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(pipelineUsedByOtherTask ? { _id: 't2' } : null),
    }),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const pipelineModel = {
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(pipelineDocs) }),
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(
        promptUsedByOutsidePipeline ? { _id: 'pl2', name: 'External' } : null,
      ),
    }),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const promptModel = {
    find: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(promptDocs) }),
    updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
  };

  const workspaceModel = {
    findOne: jest.fn().mockImplementation((filter: { _id?: string; type?: WorkspaceType }) => {
      if (filter._id === sourceWsId && !filter.type) {
        return { exec: jest.fn().mockResolvedValue({ _id: sourceWsId, type: sourceType }) };
      }
      if (filter._id === targetWsId && filter.type === WorkspaceType.Team) {
        return {
          exec: jest.fn().mockResolvedValue(
            targetType === WorkspaceType.Team ? { _id: targetWsId, type: WorkspaceType.Team } : null,
          ),
        };
      }
      return { exec: jest.fn().mockResolvedValue(null) };
    }),
  };

  const membershipModel = {
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(
        targetMemberRole !== null ? { role: targetMemberRole, workspaceId: targetWsId } : null,
      ),
    }),
  };

  const apiKeyModel = {
    find: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(targetKeys.map((provider) => ({ provider }))),
    }),
  };

  const session = {
    withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => { await fn(); }),
    endSession: jest.fn(),
  };

  const connection = { startSession: jest.fn().mockResolvedValue(session) };

  const projectsService = {
    toView: jest.fn().mockResolvedValue({ id: 'p1', workspaceId: targetWsId }),
  };

  const usersService = {
    refMap: jest.fn().mockResolvedValue(new Map([['u1', { id: 'u1', name: 'User' }]])),
  };

  // Mock projectModel for transfer
  const projectModel = {
    findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(project) }),
  };

  const service = new TransferService(
    projectModel as never,
    taskModel as never,
    pipelineModel as never,
    promptModel as never,
    workspaceModel as never,
    membershipModel as never,
    apiKeyModel as never,
    connection as never,
    projectsService as never,
    usersService as never,
  );

  return { service, project, actorId, targetWsId };
}

const targetDto = { targetWorkspaceId: 'ws-team' };

describe('TransferService.preview', () => {
  it('returns empty bundle for a project with no tasks', async () => {
    const { service, project, actorId } = makeTransferService();
    const preview = await service.preview(project as never, actorId, targetDto);
    expect(preview.taskCount).toBe(0);
    expect(preview.pipelines).toHaveLength(0);
    expect(preview.prompts).toHaveLength(0);
    expect(preview.conflicts).toHaveLength(0);
  });

  it('gathers pipelines from tasks and prompts from pipeline steps', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'My Pipeline', steps: [{ promptId: 'pr1', provider: 'anthropic' }], workspaceId: 'ws-personal' }],
      prompts: [{ _id: 'pr1', title: 'My Prompt', workspaceId: 'ws-personal' }],
    });
    const preview = await service.preview(project as never, actorId, targetDto);
    expect(preview.taskCount).toBe(1);
    expect(preview.pipelines).toHaveLength(1);
    expect(preview.pipelines[0].name).toBe('My Pipeline');
    expect(preview.prompts).toHaveLength(1);
    expect(preview.providers).toContain('anthropic');
  });

  it('detects a pipeline conflict when shared with another project', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'Shared Pipeline', steps: [], workspaceId: 'ws-personal' }],
      pipelineUsedByOtherTask: true,
    });
    const preview = await service.preview(project as never, actorId, targetDto);
    expect(preview.conflicts).toHaveLength(1);
    expect(preview.conflicts[0].kind).toBe('pipeline');
  });

  it('detects a prompt conflict when used by a pipeline outside the bundle', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'Pipeline', steps: [{ promptId: 'pr1', provider: 'openai' }], workspaceId: 'ws-personal' }],
      prompts: [{ _id: 'pr1', title: 'Shared Prompt', workspaceId: 'ws-personal' }],
      promptUsedByOutsidePipeline: true,
    });
    const preview = await service.preview(project as never, actorId, targetDto);
    const promptConflicts = preview.conflicts.filter((c) => c.kind === 'prompt');
    expect(promptConflicts).toHaveLength(1);
  });

  it('reports which providers the target already has keys for', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'P', steps: [{ promptId: 'pr1', provider: 'anthropic' }], workspaceId: 'ws-personal' }],
      prompts: [],
      targetKeys: ['anthropic'],
    });
    const preview = await service.preview(project as never, actorId, targetDto);
    expect(preview.targetHasKeys).toContain('anthropic');
  });

  it('rejects when caller is not the project creator', async () => {
    const { service, project } = makeTransferService({ projectCreatedBy: 'other-user' });
    await expect(service.preview(project as never, 'u1', targetDto)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when source is a team workspace', async () => {
    const { service, project, actorId } = makeTransferService({ sourceType: WorkspaceType.Team });
    await expect(service.preview(project as never, actorId, targetDto)).rejects.toThrow(BadRequestException);
  });

  it('rejects when target membership role is Viewer', async () => {
    const { service, project, actorId } = makeTransferService({ targetMemberRole: Role.Viewer });
    await expect(service.preview(project as never, actorId, targetDto)).rejects.toThrow(ForbiddenException);
  });

  it('rejects when user is not a member of the target', async () => {
    const { service, project, actorId } = makeTransferService({ targetMemberRole: null });
    await expect(service.preview(project as never, actorId, targetDto)).rejects.toThrow(ForbiddenException);
  });
});

describe('TransferService.transfer', () => {
  it('throws 400 when conflicts exist', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'Shared', steps: [], workspaceId: 'ws-personal' }],
      pipelineUsedByOtherTask: true,
    });
    await expect(service.transfer(project as never, actorId, targetDto, actorId)).rejects.toThrow(BadRequestException);
  });

  it('moves project, tasks, pipelines, and prompts to target workspace on a clean transfer', async () => {
    const { service, project, actorId } = makeTransferService({
      tasks: [{ _id: 't1', pipelines: ['pl1'] }],
      pipelines: [{ _id: 'pl1', name: 'Pipeline', steps: [{ promptId: 'pr1', provider: 'anthropic' }], workspaceId: 'ws-personal' }],
      prompts: [{ _id: 'pr1', title: 'Prompt', workspaceId: 'ws-personal' }],
    });
    const result = await service.transfer(project as never, actorId, targetDto, actorId);
    expect(result.workspaceId).toBe('ws-team');
  });
});
