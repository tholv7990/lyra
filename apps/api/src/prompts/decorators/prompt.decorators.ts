import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import type { PromptDocument } from '../prompt.schema';

export const REQUIRE_PROMPT_OWNER_KEY = 'requirePromptOwner';

/** Requires the caller to be the prompt's creator (edit / delete). */
export const RequirePromptOwner = () =>
  SetMetadata(REQUIRE_PROMPT_OWNER_KEY, true);

/** The prompt loaded by PromptAccessGuard. */
export const CurrentPrompt = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PromptDocument => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return (req as unknown as { prompt: PromptDocument }).prompt;
  },
);
