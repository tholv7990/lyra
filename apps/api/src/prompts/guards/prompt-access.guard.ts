import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PromptStatus, canCreate } from '@lyra/shared';
import { PromptsService } from '../prompts.service';
import { MembershipsService } from '../../workspaces/memberships.service';
import { REQUIRE_PROMPT_OWNER_KEY } from '../decorators/prompt.decorators';
import { REQUIRE_CREATE_KEY } from '../../workspaces/decorators/require-create.decorator';

// Loads the prompt by :id, verifies the caller is a member of its workspace,
// enforces visibility (public OR creator) and ownership (@RequirePromptOwner →
// creator only) for edit/delete, and attaches the prompt to the request.
@Injectable()
export class PromptAccessGuard implements CanActivate {
  constructor(
    private readonly prompts: PromptsService,
    private readonly memberships: MembershipsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException();

    const id = req.params?.id as string;
    const prompt = await this.prompts.findActiveById(id);
    if (!prompt) throw new NotFoundException('Prompt not found');

    const membership = await this.memberships.findFor(
      prompt.workspaceId,
      user.id,
    );
    if (!membership) {
      throw new ForbiddenException('Not a member of this workspace');
    }

    const isOwner = prompt.createdBy === user.id;
    const requireOwner = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PROMPT_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requireOwner) {
      if (!isOwner) throw new ForbiddenException('Cannot modify this prompt');
    } else if (prompt.status !== PromptStatus.Public && !isOwner) {
      // Drafts are visible only to their creator.
      throw new ForbiddenException('No access to this prompt');
    }

    const requireCreate = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_CREATE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      requireCreate &&
      !canCreate({ userId: user.id, role: membership.role, canManageKeys: membership.canManageKeys })
    ) {
      throw new ForbiddenException('Viewers cannot add to this prompt — ask an owner to change your role');
    }

    (req as unknown as { prompt: unknown }).prompt = prompt;
    return true;
  }
}
