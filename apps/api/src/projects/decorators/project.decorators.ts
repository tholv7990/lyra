import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { ProjectDocument } from '../project.schema';

export const REQUIRE_PROJECT_EDIT_KEY = 'requireProjectEdit';

/** Requires the caller to be able to edit the project (creator or owner). */
export const RequireProjectEdit = () =>
  SetMetadata(REQUIRE_PROJECT_EDIT_KEY, true);

/** The project loaded by ProjectAccessGuard. */
export const CurrentProject = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ProjectDocument => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { project: ProjectDocument }).project;
  },
);
