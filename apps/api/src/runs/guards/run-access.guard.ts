import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { canViewProject, type MemberCtx } from '@lyra/shared';
import { RunsService } from '../runs.service';
import { ProjectsService } from '../../projects/projects.service';
import { MembershipsService } from '../../workspaces/memberships.service';

// Loads the run + its project, verifies workspace membership and project
// visibility (shared/workspace = full access), and attaches the run.
@Injectable()
export class RunAccessGuard implements CanActivate {
  constructor(
    private readonly runs: RunsService,
    private readonly projects: ProjectsService,
    private readonly memberships: MembershipsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException();

    const run = await this.runs.findById(req.params?.id as string);
    if (!run) throw new NotFoundException('Run not found');

    const membership = await this.memberships.findFor(run.workspaceId, user.id);
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    // Test runs have no project — workspace membership is enough. Project runs
    // additionally require visibility of their project.
    if (run.projectId) {
      const project = await this.projects.findActiveById(run.projectId);
      if (!project) throw new NotFoundException('Project not found');
      const ctx: MemberCtx = {
        userId: user.id,
        role: membership.role,
        canManageKeys: membership.canManageKeys,
      };
      if (!canViewProject(project, ctx)) {
        throw new ForbiddenException('No access to this run');
      }
    }

    (req as unknown as { run: unknown }).run = run;
    return true;
  }
}
