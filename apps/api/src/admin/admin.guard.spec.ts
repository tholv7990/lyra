import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

// Builds an ExecutionContext whose request carries the given `user` (as the
// global JwtAuthGuard would have attached it).
function ctxWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  function makeGuard(allowlist: string): AdminGuard {
    const config = { get: jest.fn().mockReturnValue(allowlist) };
    return new AdminGuard(new AdminService(config as never));
  }

  it('allows an allowlisted user', () => {
    const guard = makeGuard('admin@lyra.com');
    expect(guard.canActivate(ctxWith({ email: 'admin@lyra.com' }))).toBe(true);
  });

  it('403s a non-allowlisted user', () => {
    const guard = makeGuard('admin@lyra.com');
    expect(() => guard.canActivate(ctxWith({ email: 'other@lyra.com' }))).toThrow(
      ForbiddenException,
    );
  });

  it('403s when there is no authenticated user', () => {
    const guard = makeGuard('admin@lyra.com');
    expect(() => guard.canActivate(ctxWith(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('403s when the allowlist is empty (no admins by default)', () => {
    const guard = makeGuard('');
    expect(() => guard.canActivate(ctxWith({ email: 'admin@lyra.com' }))).toThrow(
      ForbiddenException,
    );
  });
});
