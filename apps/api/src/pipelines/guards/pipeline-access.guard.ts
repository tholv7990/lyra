import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '@lyra/shared';
import { PipelinesService } from '../pipelines.service';
import { MembershipsService } from '../../workspaces/memberships.service';
import { REQUIRE_PIPELINE_OWNER_KEY } from '../decorators/pipeline.decorators';

// Loads the pipeline by :id, verifies workspace membership (all members can
// view library pipelines), and enforces ownership (creator or workspace owner)
// for @RequirePipelineOwner routes (edit/delete).
@Injectable()
export class PipelineAccessGuard implements CanActivate {
  constructor(
    private readonly pipelines: PipelinesService,
    private readonly memberships: MembershipsService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) throw new ForbiddenException();

    const id = req.params?.id as string;
    const pipeline = await this.pipelines.findActiveById(id);
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const membership = await this.memberships.findFor(pipeline.workspaceId, user.id);
    if (!membership) throw new ForbiddenException('Not a member of this workspace');

    const requireOwner = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_PIPELINE_OWNER_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (
      requireOwner &&
      pipeline.createdBy !== user.id &&
      membership.role !== Role.Owner
    ) {
      throw new ForbiddenException('Cannot modify this pipeline');
    }

    (req as unknown as { pipeline: unknown }).pipeline = pipeline;
    return true;
  }
}
