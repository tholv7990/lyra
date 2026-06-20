import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import {
  ProjectStatus,
  ProjectShare,
  Role,
  WorkspaceType,
  type TransferPreview,
  type TransferProjectDto,
  type Project as ProjectModel,
  type Provider,
} from '@lyra/shared';
import { Project } from './project.schema';
import type { ProjectDocument } from './project.schema';
import { Task } from '../tasks/task.schema';
import { Pipeline } from '../pipelines/pipeline.schema';
import type { PipelineDocument } from '../pipelines/pipeline.schema';
import { Prompt } from '../prompts/prompt.schema';
import type { PromptDocument } from '../prompts/prompt.schema';
import { Workspace } from '../workspaces/workspace.schema';
import { Membership } from '../workspaces/membership.schema';
import { ApiKey } from '../keys/api-key.schema';
import { ProjectsService } from './projects.service';
import { UsersService } from '../users/users.service';
import type { TransferConflict } from '@lyra/shared';

@Injectable()
export class TransferService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<Project>,
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
    @InjectModel(Pipeline.name) private readonly pipelineModel: Model<Pipeline>,
    @InjectModel(Prompt.name) private readonly promptModel: Model<Prompt>,
    @InjectModel(Workspace.name) private readonly workspaceModel: Model<Workspace>,
    @InjectModel(Membership.name) private readonly membershipModel: Model<Membership>,
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKey>,
    @InjectConnection() private readonly connection: Connection,
    private readonly projects: ProjectsService,
    private readonly users: UsersService,
  ) {}

  /** Gather the bundle for a project P: tasks, pipelines via tasks, prompts via pipelines. */
  private async gatherBundle(project: ProjectDocument, sourceWorkspaceId: string) {
    // 1. Tasks belonging to the project
    const tasks = await this.taskModel
      .find({ projectId: project._id.toString(), active: { $ne: false } })
      .exec();

    // 2. Pipeline IDs referenced by the tasks
    const pipelineIdSet = new Set<string>();
    for (const t of tasks) {
      for (const pid of t.pipelines) pipelineIdSet.add(pid);
    }
    const pipelineIds = [...pipelineIdSet];

    // 3. Pipelines (must belong to source workspace)
    const pipelines = pipelineIds.length
      ? await this.pipelineModel
          .find({ _id: { $in: pipelineIds }, workspaceId: sourceWorkspaceId, active: { $ne: false } })
          .exec()
      : [];

    // 4. Prompt IDs referenced by those pipelines' steps
    const promptIdSet = new Set<string>();
    for (const p of pipelines) {
      for (const step of p.steps) {
        if (step.promptId) promptIdSet.add(step.promptId);
      }
    }
    const promptIds = [...promptIdSet];

    // 5. Prompts (must belong to source workspace)
    const prompts = promptIds.length
      ? await this.promptModel
          .find({ _id: { $in: promptIds }, workspaceId: sourceWorkspaceId, active: { $ne: false } })
          .exec()
      : [];

    return { tasks, pipelines, prompts, pipelineIds, promptIds };
  }

  /** Detect shared-dependency conflicts. */
  private async detectConflicts(
    bundle: { pipelines: PipelineDocument[]; prompts: PromptDocument[]; pipelineIds: string[] },
    project: ProjectDocument,
    sourceWorkspaceId: string,
  ) {
    const conflicts: TransferConflict[] = [];

    // Pipeline conflict: a bundle pipeline is referenced by a task of a DIFFERENT project in the source workspace
    for (const pipeline of bundle.pipelines) {
      const pid = pipeline._id.toString();
      // Find tasks in the source workspace that reference this pipeline but belong to a different project
      const conflictingTask = await this.taskModel
        .findOne({
          workspaceId: sourceWorkspaceId,
          pipelines: pid,
          projectId: { $ne: project._id.toString() },
          active: { $ne: false },
        })
        .exec();
      if (conflictingTask) {
        conflicts.push({
          kind: 'pipeline',
          name: pipeline.name,
          reason: `Also used by another project in your personal workspace`,
        });
      }
    }

    // Prompt conflict: a bundle prompt is referenced by a pipeline NOT in the bundle (in source workspace)
    for (const prompt of bundle.prompts) {
      const promptId = prompt._id.toString();
      // Find a pipeline in the source workspace that uses this prompt but is NOT in the bundle
      const outsidePipeline = await this.pipelineModel
        .findOne({
          workspaceId: sourceWorkspaceId,
          'steps.promptId': promptId,
          _id: { $nin: bundle.pipelineIds },
          active: { $ne: false },
        })
        .exec();
      if (outsidePipeline) {
        conflicts.push({
          kind: 'prompt',
          name: prompt.title,
          reason: `Also used by a pipeline not in this bundle ("${outsidePipeline.name}")`,
        });
      }
    }

    return conflicts;
  }

  /** Validate permissions and return the validated target workspace doc. */
  private async validateTransfer(
    project: ProjectDocument,
    userId: string,
    dto: TransferProjectDto,
  ) {
    // 1. Caller must be project creator
    if (project.createdBy !== userId) {
      throw new ForbiddenException('Only the project creator can move it');
    }

    // 2. Source must be personal workspace
    const sourceWorkspace = await this.workspaceModel
      .findOne({ _id: project.workspaceId })
      .exec();
    if (!sourceWorkspace || sourceWorkspace.type !== WorkspaceType.Personal) {
      throw new BadRequestException('Projects can only be moved from a personal workspace');
    }

    // 3. Target must be a team workspace the user is a member of with create rights
    const targetWorkspace = await this.workspaceModel
      .findOne({ _id: dto.targetWorkspaceId, type: WorkspaceType.Team })
      .exec();
    if (!targetWorkspace) {
      throw new BadRequestException('Target workspace not found or is not a team workspace');
    }

    const targetMembership = await this.membershipModel
      .findOne({
        workspaceId: dto.targetWorkspaceId,
        userId,
        active: { $ne: false },
      })
      .exec();
    if (!targetMembership) {
      throw new ForbiddenException('You are not a member of the target workspace');
    }
    if (targetMembership.role === Role.Viewer) {
      throw new ForbiddenException('You need create rights in the target workspace');
    }

    return { sourceWorkspace, targetWorkspace };
  }

  async preview(
    project: ProjectDocument,
    userId: string,
    dto: TransferProjectDto,
  ): Promise<TransferPreview> {
    await this.validateTransfer(project, userId, dto);

    const bundle = await this.gatherBundle(project, project.workspaceId);
    const conflicts = await this.detectConflicts(bundle, project, project.workspaceId);

    // Gather distinct providers from pipeline steps
    const providerSet = new Set<string>();
    for (const pipeline of bundle.pipelines) {
      for (const step of pipeline.steps) {
        if (step.provider) providerSet.add(step.provider);
      }
    }
    const providers = [...providerSet];

    // Which of those providers the target team already has keys for
    const targetKeys = await this.apiKeyModel
      .find({ workspaceId: dto.targetWorkspaceId, active: { $ne: false } })
      .exec();
    const targetProviderSet = new Set(targetKeys.map((k) => k.provider));
    const targetHasKeys = providers.filter((p) => targetProviderSet.has(p as Provider));

    return {
      taskCount: bundle.tasks.length,
      pipelines: bundle.pipelines.map((p) => ({ id: p._id.toString(), name: p.name })),
      prompts: bundle.prompts.map((p) => ({ id: p._id.toString(), title: p.title })),
      providers,
      conflicts,
      targetHasKeys,
    };
  }

  async transfer(
    project: ProjectDocument,
    userId: string,
    dto: TransferProjectDto,
    actorId: string,
  ): Promise<ProjectModel> {
    await this.validateTransfer(project, userId, dto);

    const bundle = await this.gatherBundle(project, project.workspaceId);
    const conflicts = await this.detectConflicts(bundle, project, project.workspaceId);

    if (conflicts.length > 0) {
      throw new BadRequestException(
        `Cannot move project: ${conflicts.length} conflict(s) must be resolved first`,
      );
    }

    const targetId = dto.targetWorkspaceId;
    const now = new Date();

    const session = await this.connection.startSession();
    let movedProject: ProjectDocument | null = null;

    try {
      await session.withTransaction(async () => {
        // Move project: re-point workspaceId, set Public/All (workspace-visible), updatedBy
        movedProject = await this.projectModel
          .findByIdAndUpdate(
            project._id,
            {
              $set: {
                workspaceId: targetId,
                status: ProjectStatus.Public,
                shared: ProjectShare.All,
                updatedBy: actorId,
                updatedAt: now,
              },
            },
            { returnDocument: 'after', session },
          )
          .exec();

        // Move tasks
        if (bundle.tasks.length > 0) {
          await this.taskModel.updateMany(
            { _id: { $in: bundle.tasks.map((t) => t._id) } },
            { $set: { workspaceId: targetId, updatedBy: actorId, updatedAt: now } },
            { session },
          );
        }

        // Move pipelines
        if (bundle.pipelines.length > 0) {
          await this.pipelineModel.updateMany(
            { _id: { $in: bundle.pipelines.map((p) => p._id) } },
            { $set: { workspaceId: targetId, updatedBy: actorId, updatedAt: now } },
            { session },
          );
        }

        // Move prompts
        if (bundle.prompts.length > 0) {
          await this.promptModel.updateMany(
            { _id: { $in: bundle.prompts.map((p) => p._id) } },
            { $set: { workspaceId: targetId, updatedBy: actorId, updatedAt: now } },
            { session },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (!movedProject) throw new NotFoundException('Project not found after transfer');
    return this.projects.toView(movedProject);
  }
}
