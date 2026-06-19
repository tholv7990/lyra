import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PromptStatus } from '@lyra/shared';
import { PromptAccessGuard } from './prompt-access.guard';

// Locks the prompt permission boundary: a Public (shared) prompt is read-only to
// everyone but its creator; edit/delete (@RequirePromptOwner) is creator-only.
describe('PromptAccessGuard', () => {
  const prompt = { workspaceId: 'ws1', createdBy: 'owner', status: PromptStatus.Public };

  function makeGuard(p: unknown, isMember = true) {
    const prompts = { findActiveById: jest.fn().mockResolvedValue(p) };
    const memberships = { findFor: jest.fn().mockResolvedValue(isMember ? { userId: 'u' } : null) };
    const reflector = { getAllAndOverride: jest.fn() as jest.Mock };
    const guard = new PromptAccessGuard(prompts as never, memberships as never, reflector as never);
    return { guard, reflector };
  }

  function ctx(userId: string): ExecutionContext {
    const req = { user: { id: userId }, params: { id: 'p1' } };
    return {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
  }

  it('blocks a non-creator from edit/delete (@RequirePromptOwner)', async () => {
    const { guard, reflector } = makeGuard(prompt);
    reflector.getAllAndOverride.mockReturnValue(true); // requireOwner
    await expect(guard.canActivate(ctx('intruder'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the creator edit/delete', async () => {
    const { guard, reflector } = makeGuard(prompt);
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(ctx('owner'))).resolves.toBe(true);
  });

  it('lets any member view a Public prompt', async () => {
    const { guard, reflector } = makeGuard(prompt);
    reflector.getAllAndOverride.mockReturnValue(false); // read route
    await expect(guard.canActivate(ctx('other'))).resolves.toBe(true);
  });

  it('hides a Draft prompt from everyone but its creator', async () => {
    const { guard, reflector } = makeGuard({ ...prompt, status: PromptStatus.Draft });
    reflector.getAllAndOverride.mockReturnValue(false);
    await expect(guard.canActivate(ctx('other'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a non-member of the workspace', async () => {
    const { guard, reflector } = makeGuard(prompt, false);
    reflector.getAllAndOverride.mockReturnValue(false);
    await expect(guard.canActivate(ctx('other'))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s a missing prompt', async () => {
    const { guard, reflector } = makeGuard(null);
    reflector.getAllAndOverride.mockReturnValue(false);
    await expect(guard.canActivate(ctx('other'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
