import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { canViewProject, canEditProject, canCreate, type MemberCtx } from '@lyra/shared';
import { ProjectsService } from '../projects.service';
import { MembershipsService } from '../../workspaces/memberships.service';
import { REQUIRE_PROJECT_EDIT_KEY } from '../decorators/project.decorators';
import { enforceCreateGate, userEmailVerified } from '../../workspaces/guards/create-gate';

// Loads the project by :id, verifies the caller is a member of its workspace,
// enforces view (always) and edit (@RequireProjectEdit) via the shared helpers,
// and attaches the project + member context to the request.
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly projects: ProjectsService,
    private readonly memberships: MembershipsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException();

    const id = req.params?.id as string;
    const project = await this.projects.findActiveById(id);
    if (!project) throw new NotFoundException('Project not found');

    const membership = await this.memberships.findFor(
      project.workspaceId,
      user.id,
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const ctx: MemberCtx = {
      userId: user.id,
      role: membership.role,
      canManageKeys: membership.canManageKeys,
    };
    if (!canViewProject(project, ctx)) {
      throw new ForbiddenException('No access to this project');
    }

    const requireEdit = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PROJECT_EDIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireEdit && !canEditProject(project, ctx)) {
      throw new ForbiddenException('Cannot edit this project');
    }

    enforceCreateGate(this.reflector, context, canCreate(ctx), userEmailVerified(user));

    (req as unknown as { project: unknown }).project = project;
    return true;
  }
}
