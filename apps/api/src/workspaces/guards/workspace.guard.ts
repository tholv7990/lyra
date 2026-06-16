import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role, canManageKeys } from '@lyra/shared';
import { MembershipsService } from '../memberships.service';
import { REQUIRE_OWNER_KEY } from '../decorators/require-owner.decorator';
import { REQUIRE_MANAGE_KEYS_KEY } from '../decorators/require-manage-keys.decorator';

// Verifies the caller is a member of the targeted workspace, attaches the
// membership to the request, and enforces @RequireOwner(). The workspace is
// taken from the :id route param or the X-Workspace-Id header.
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(
    private readonly memberships: MembershipsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException();

    const workspaceId =
      (req.params?.id as string | undefined) ??
      (req.headers['x-workspace-id'] as string | undefined);
    if (!workspaceId) throw new ForbiddenException('Workspace not specified');

    const membership = await this.memberships.findFor(workspaceId, user.id);
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const ctx = {
      userId: user.id,
      role: membership.role,
      canManageKeys: membership.canManageKeys,
    };

    const requireOwner = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireOwner && membership.role !== Role.Owner) {
      throw new ForbiddenException('Owner only');
    }

    const requireManageKeys = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_MANAGE_KEYS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requireManageKeys && !canManageKeys(ctx)) {
      throw new ForbiddenException('Key management requires Owner or canManageKeys');
    }

    (req as unknown as { membership: unknown }).membership = {
      ...ctx,
      workspaceId,
    };
    return true;
  }
}
