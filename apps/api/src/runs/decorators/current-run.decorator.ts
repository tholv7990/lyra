import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RunDocument } from '../run.schema';

/** The run loaded by RunAccessGuard. */
export const CurrentRun = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RunDocument => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { run: RunDocument }).run;
  },
);
