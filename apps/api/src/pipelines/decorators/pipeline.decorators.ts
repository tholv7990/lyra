import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { PipelineDocument } from '../pipeline.schema';

export const REQUIRE_PIPELINE_OWNER_KEY = 'requirePipelineOwner';

/** Requires the caller to be the pipeline's creator or the workspace owner. */
export const RequirePipelineOwner = () =>
  SetMetadata(REQUIRE_PIPELINE_OWNER_KEY, true);

/** The pipeline loaded by PipelineAccessGuard. */
export const CurrentPipeline = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PipelineDocument => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { pipeline: PipelineDocument }).pipeline;
  },
);
