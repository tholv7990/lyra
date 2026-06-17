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
import { ProjectPipeline } from '../../pipelines/project-pipeline.schema';
import { ProviderModel } from '../../models/provider-model.schema';

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
    @InjectModel(ProjectPipeline.name)
    private readonly projectPipelines: Model<ProjectPipeline>,
    @InjectModel(ProviderModel.name)
    private readonly providerModels: Model<ProviderModel>,
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
      this.projectPipelines.updateMany({ workspaceId }, patch),
      this.providerModels.updateMany({ workspaceId }, patch),
    ]);
  }

  async deleteProject(projectId: string, actorId: string) {
    const patch = { active: false, updatedBy: actorId };
    await this.proj.updateOne({ _id: projectId }, patch);
    await Promise.all([
      this.runs.updateMany({ projectId }, patch),
      // unassign the project's pipelines (the library pipelines themselves stay)
      this.projectPipelines.updateMany({ projectId }, patch),
    ]);
  }
}
