import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { REQUIRE_CREATE_KEY } from '../decorators/require-create.decorator';

// Shared enforcement for @RequireCreate endpoints. A create/run/spend action needs
// BOTH a creator role (Owner/Member, not Viewer) AND a confirmed email — an
// unverified password signup can browse but not act until they verify. Used by
// every guard that gates these actions (Workspace/ProjectAccess/RunAccess/PromptAccess)
// so the rule lives in one place.
export function enforceCreateGate(
  reflector: Reflector,
  context: ExecutionContext,
  canCreateRole: boolean,
  emailVerified: boolean,
): void {
  const requireCreate = reflector.getAllAndOverride<boolean>(REQUIRE_CREATE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (!requireCreate) return;
  if (!canCreateRole) {
    throw new ForbiddenException('Viewers cannot create or run — ask an owner to change your role');
  }
  if (!emailVerified) {
    throw new ForbiddenException('Confirm your email to create or run');
  }
}

// Pull emailVerified off the request user (the SafeUser attached by JwtStrategy).
// Missing → treated as verified (legacy grandfather; toSafeUser already does this).
export function userEmailVerified(user: unknown): boolean {
  return (user as { emailVerified?: boolean } | undefined)?.emailVerified ?? true;
}
