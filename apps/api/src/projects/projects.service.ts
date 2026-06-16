import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectVisibility, Role } from '@lyra/shared';
import { Project } from './project.schema';
import { BaseRepository } from '../common/database/base.repository';

@Injectable()
export class ProjectsService extends BaseRepository<Project> {
  constructor(@InjectModel(Project.name) model: Model<Project>) {
    super(model);
  }

  // Projects in a workspace the member is allowed to see (owner sees all).
  listForMember(workspaceId: string, ctx: { userId: string; role: Role }) {
    if (ctx.role === Role.Owner) {
      return this.find({ workspaceId }, { sort: { createdAt: -1 } });
    }
    return this.find(
      {
        workspaceId,
        $or: [
          { visibility: ProjectVisibility.Workspace },
          { createdBy: ctx.userId },
          { visibility: ProjectVisibility.Shared, sharedWith: ctx.userId },
        ],
      },
      { sort: { createdAt: -1 } },
    );
  }
}
