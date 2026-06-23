import { ForbiddenException } from '@nestjs/common';
import { RunAccessGuard } from './guards/run-access.guard';

function ctx(runId = 'r1', userId = 'u1', emailVerified = true) {
  const req: any = { params: { id: runId }, user: { id: userId, emailVerified } };
  return { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => ({}), getClass: () => ({}) } as any;
}

describe('RunAccessGuard product branch', () => {
  it('allows a product-scoped run for a workspace member (no project check)', async () => {
    const runs = { findById: jest.fn().mockResolvedValue({ workspaceId: 'ws', productId: 'p1' }) };
    const projects = { findActiveById: jest.fn() };
    const memberships = { findFor: jest.fn().mockResolvedValue({ role: 'owner', canManageKeys: false }) };
    // reflector returns false (no @RequireCreate gate) — enforceCreateGate returns early
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const guard = new RunAccessGuard(runs as any, projects as any, memberships as any, reflector as any);
    await expect(guard.canActivate(ctx())).resolves.toBe(true);
    expect(projects.findActiveById).not.toHaveBeenCalled();
  });

  it('rejects a non-member', async () => {
    const runs = { findById: jest.fn().mockResolvedValue({ workspaceId: 'ws', productId: 'p1' }) };
    const memberships = { findFor: jest.fn().mockResolvedValue(null) };
    const guard = new RunAccessGuard(runs as any, {} as any, memberships as any, { getAllAndOverride: () => false } as any);
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
