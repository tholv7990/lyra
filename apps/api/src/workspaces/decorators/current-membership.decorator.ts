import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { MemberCtx } from '@lyra/shared';

export type RequestMembership = MemberCtx & { workspaceId: string };

/** The caller's membership in the targeted workspace (set by WorkspaceGuard). */
export const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestMembership => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { membership: RequestMembership }).membership;
  },
);
