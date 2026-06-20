import { SetMetadata } from '@nestjs/common';

export const REQUIRE_CREATE_KEY = 'requireCreate';

/** Requires a role that can create workspace content (Owner or Member, not Viewer).
 *  Enforced by WorkspaceGuard via the shared `canCreate` helper. */
export const RequireCreate = () => SetMetadata(REQUIRE_CREATE_KEY, true);
