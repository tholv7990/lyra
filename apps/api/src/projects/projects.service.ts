import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProjectStatus, ProjectShare, Role, type Project as ProjectModel, type ProjectBrandKit } from '@lyra/shared';
import { Project } from './project.schema';
import type { ProjectDocument } from './project.schema';
import { Task } from '../tasks/task.schema';
import { BaseRepository } from '../common/database/base.repository';
import { UsersService } from '../users/users.service';
import { toProject, projectActorIds } from './project.views';

@Injectable()
export class ProjectsService extends BaseRepository<Project> {
  constructor(
    @InjectModel(Project.name) model: Model<Project>,
    @InjectModel(Task.name) private readonly tasks: Model<Task>,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  // Base findById already excludes soft-deleted; alias kept for guard clarity.
  findActiveById(id: string) {
    return this.findById(id);
  }

  // Active-task count per project id (the board size shown on the list card).
  private async taskCounts(projectIds: string[]): Promise<Map<string, number>> {
    if (projectIds.length === 0) return new Map();
    const rows = await this.tasks.aggregate<{ _id: string; n: number }>([
      { $match: { projectId: { $in: projectIds }, active: { $ne: false } } },
      { $group: { _id: '$projectId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.n]));
  }

  async toView(p: ProjectDocument): Promise<ProjectModel> {
    const refs = await this.users.refMap(projectActorIds(p));
    return toProject(p, refs);
  }

  async toViews(ps: ProjectDocument[]): Promise<ProjectModel[]> {
    const refs = await this.users.refMap(ps.flatMap(projectActorIds));
    const counts = await this.taskCounts(ps.map((p) => p._id.toString()));
    return ps.map((p) => toProject(p, refs, counts.get(p._id.toString()) ?? 0));
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

  // Retrieve the brand kit configuration for a project (used by action steps).
  async brandKit(projectId: string): Promise<ProjectBrandKit | undefined> {
    const project = await this.findById(projectId);
    return project?.brandKit;
  }
}
