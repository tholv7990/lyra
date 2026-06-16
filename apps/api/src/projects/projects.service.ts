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

  // Active (non-deleted) project by id.
  findActiveById(id: string) {
    return this.findOne({ _id: id, active: { $ne: false } });
  }

  // Soft delete: flip active to false (the document is retained).
  softDelete(id: string) {
    return this.findByIdAndUpdate(id, { active: false });
  }

  // Projects in a workspace the member is allowed to see (owner sees all).
  listForMember(workspaceId: string, ctx: { userId: string; role: Role }) {
    if (ctx.role === Role.Owner) {
      return this.find({ workspaceId, active: { $ne: false } }, { sort: { createdAt: -1 } });
    }
    return this.find(
      {
        workspaceId,
        active: { $ne: false },
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
