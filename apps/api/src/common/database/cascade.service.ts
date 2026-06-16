import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Workspace } from '../../workspaces/workspace.schema';
import { Membership } from '../../workspaces/membership.schema';
import { Invite } from '../../workspaces/invite.schema';
import { ApiKey } from '../../keys/api-key.schema';
import { Project } from '../../projects/project.schema';
import { Run } from '../../runs/run.schema';

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
    ]);
  }

  async deleteProject(projectId: string, actorId: string) {
    const patch = { active: false, updatedBy: actorId };
    await this.proj.updateOne({ _id: projectId }, patch);
    await this.runs.updateMany({ projectId }, patch);
  }
}
