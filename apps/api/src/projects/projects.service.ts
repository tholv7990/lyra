import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectStatus, ProjectShare, Role, type Project as ProjectModel } from '@lyra/shared';
import { Project } from './project.schema';
import type { ProjectDocument } from './project.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toProject, projectActorIds } from './project.views';

@Injectable()
export class ProjectsService extends BaseRepository<Project> {
  constructor(
    @InjectModel(Project.name) model: Model<Project>,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  // Base findById already excludes soft-deleted; alias kept for guard clarity.
  findActiveById(id: string) {
    return this.findById(id);
  }

  async toView(p: ProjectDocument): Promise<ProjectModel> {
    const refs = await this.users.refMap(projectActorIds(p));
    return toProject(p, refs);
  }

  async toViews(ps: ProjectDocument[]): Promise<ProjectModel[]> {
    const refs = await this.users.refMap(ps.flatMap(projectActorIds));
    return ps.map((p) => toProject(p, refs));
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
          { createdBy: ctx.userId },
          { status: ProjectStatus.Public, shared: ProjectShare.All },
          { status: ProjectStatus.Public, shared: ProjectShare.People, sharedWith: ctx.userId },
        ],
      },
      { sort: { createdAt: -1 } },
    );
  }
}
