import { SetMetadata } from '@nestjs/common';

export const REQUIRE_MANAGE_KEYS_KEY = 'requireManageKeys';

/** Requires Owner or a member granted canManageKeys (enforced by WorkspaceGuard). */
export const RequireManageKeys = () =>
  SetMetadata(REQUIRE_MANAGE_KEYS_KEY, true);
