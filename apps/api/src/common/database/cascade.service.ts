import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace } from '../../workspaces/workspace.schema';
import { Membership } from '../../workspaces/membership.schema';
import { Invite } from '../../workspaces/invite.schema';
import { ApiKey } from '../../keys/api-key.schema';
import { Project } from '../../projects/project.schema';
import { Run } from '../../runs/run.schema';
import { Prompt } from '../../prompts/prompt.schema';
import { Conversation } from '../../conversations/conversation.schema';
import { Pipeline } from '../../pipelines/pipeline.schema';
import { ProviderModel } from '../../models/provider-model.schema';
import { Asset } from '../../assets/asset.schema';
import { Task } from '../../tasks/task.schema';

// Soft-delete cascades. Injects child models directly (not feature services)
// so there are no circular module dependencies.
@Injectable()
export class CascadeService {
  constructor(
    @InjectModel(Workspace.name) private readonly ws: Model<Workspace>,
    @InjectModel(Membership.name) private readonly mem: Model<Membership>,
    @InjectModel(Invite.name) private readonly inv: Model<Invite>,
    @InjectModel(ApiKey.name) private readonly keys: Model<ApiKey>,
    @InjectModel(Project.name) private readonly proj: Model<Project>,
    @InjectModel(Run.name) private readonly runs: Model<Run>,
    @InjectModel(Prompt.name) private readonly prompts: Model<Prompt>,
    @InjectModel(Conversation.name)
    private readonly conversations: Model<Conversation>,
    @InjectModel(Pipeline.name) private readonly pipelines: Model<Pipeline>,
    @InjectModel(ProviderModel.name)
    private readonly providerModels: Model<ProviderModel>,
    @InjectModel(Asset.name) private readonly assets: Model<Asset>,
    @InjectModel(Task.name) private readonly taskModel: Model<Task>,
  ) {}

  async deleteWorkspace(workspaceId: string, actorId: string) {
    const patch = { active: false, updatedBy: actorId };
    await this.ws.updateOne({ _id: workspaceId }, patch);
    await Promise.all([
      this.mem.updateMany({ workspaceId }, patch),
      this.inv.updateMany({ workspaceId }, patch),
      this.keys.updateMany({ workspaceId }, patch),
      this.proj.updateMany({ workspaceId }, patch),
      this.runs.updateMany({ workspaceId }, patch),
      this.prompts.updateMany({ workspaceId }, patch),
      this.conversations.updateMany({ workspaceId }, patch),
      this.pipelines.updateMany({ workspaceId }, patch),
      this.providerModels.updateMany({ workspaceId }, patch),
      this.assets.updateMany({ workspaceId }, patch),
    ]);
  }

  async deleteProject(projectId: string, actorId: string) {
    const patch = { active: false, updatedBy: actorId };
    await this.proj.updateOne({ _id: projectId }, patch);
    // The project's pipeline references live on the project doc; the library
    // pipelines themselves stay. Runs for this project are soft-deleted, and the
    // assets those runs produced go with them.
    const runs = await this.runs.find({ projectId }, { _id: 1 });
    await this.runs.updateMany({ projectId }, patch);
    const runIds = runs.map((r) => r._id.toString());
    if (runIds.length) await this.assets.updateMany({ runId: { $in: runIds } }, patch);
  }

  // Soft-delete a library pipeline and pull its id out of every task (and
  // legacy project) that referenced it, so no dangling pipeline ref surfaces.
  async deletePipeline(pipelineId: string, actorId: string) {
    await this.pipelines.updateOne(
      { _id: pipelineId },
      { active: false, updatedBy: actorId },
    );
    await Promise.all([
      this.taskModel.updateMany(
        { pipelines: pipelineId },
        { $pull: { pipelines: pipelineId }, $set: { updatedBy: actorId } },
      ),
      this.proj.updateMany(
        { pipelines: pipelineId },
        { $pull: { pipelines: pipelineId }, $set: { updatedBy: actorId } },
      ),
    ]);
  }
}
