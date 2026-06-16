import { SetMetadata } from '@nestjs/common';

export const REQUIRE_OWNER_KEY = 'requireOwner';

/** Marks a workspace-scoped route as Owner-only (enforced by WorkspaceGuard). */
export const RequireOwner = () => SetMetadata(REQUIRE_OWNER_KEY, true);
