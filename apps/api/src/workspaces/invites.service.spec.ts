import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@lyra/shared';
import { InvitesService } from './invites.service';

// A future-dated pending invite for a@x.com into workspace w1.
function inviteDoc(over: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'i1',
    id: 'i1',
    workspaceId: 'w1',
    email: 'a@x.com',
    role: Role.Member,
    status: 'pending',
    expiresAt: new Date(Date.now() + 1_000_000),
    createdBy: 'inviter',
    ...over,
  };
}

function makeService() {
  const model = { findByIdAndUpdate: jest.fn().mockResolvedValue({}) } as never;
  const memberships = {
    findFor: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  };
  const users = { refMap: jest.fn().mockResolvedValue(new Map([['inviter', { id: 'inviter', name: 'Ivy' }]])) } as never;
  const workspaces = { findById: jest.fn().mockResolvedValue({ name: 'Acme' }) } as never;
  const connection = { transaction: jest.fn(async (cb: (s: unknown) => unknown) => cb({})) } as never;
  const s = new InvitesService(model, memberships as never, users, workspaces, connection);
  return { s, memberships };
}

describe('InvitesService in-app accept/decline', () => {
  it('acceptById rejects a different email (403)', async () => {
    const { s } = makeService();
    jest.spyOn(s, 'findById').mockResolvedValue(inviteDoc() as never);
    await expect(s.acceptById('i1', { id: 'u', email: 'other@x.com' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('acceptById 404s a missing/expired invite', async () => {
    const { s } = makeService();
    jest.spyOn(s, 'findById').mockResolvedValue(inviteDoc({ expiresAt: new Date(Date.now() - 1000) }) as never);
    await expect(s.acceptById('i1', { id: 'u', email: 'a@x.com' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('acceptById creates a membership on email match', async () => {
    const { s, memberships } = makeService();
    jest.spyOn(s, 'findById').mockResolvedValue(inviteDoc() as never);
    const ws = await s.acceptById('i1', { id: 'u', email: 'A@X.com' });
    expect(ws).toBe('w1');
    expect(memberships.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'w1', userId: 'u', role: Role.Member }),
      expect.anything(),
    );
  });

  it('decline rejects a different email (403)', async () => {
    const { s } = makeService();
    jest.spyOn(s, 'findById').mockResolvedValue(inviteDoc() as never);
    await expect(s.decline('i1', { id: 'u', email: 'other@x.com' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('decline sets status declined on email match', async () => {
    const { s } = makeService();
    jest.spyOn(s, 'findById').mockResolvedValue(inviteDoc() as never);
    const patch = jest.spyOn(s, 'findByIdAndUpdate').mockResolvedValue({} as never);
    await s.decline('i1', { id: 'u', email: 'a@x.com' });
    expect(patch).toHaveBeenCalledWith('i1', expect.objectContaining({ status: 'declined', active: false }));
  });

  it('listMine maps to MyInvite with workspace name + inviter', async () => {
    const { s } = makeService();
    jest.spyOn(s, 'listForEmail').mockResolvedValue([inviteDoc()] as never);
    const out = await s.listMine({ id: 'u', email: 'a@x.com' });
    expect(out).toEqual([
      expect.objectContaining({
        id: 'i1',
        workspaceId: 'w1',
        workspaceName: 'Acme',
        role: Role.Member,
        invitedBy: { id: 'inviter', name: 'Ivy' },
      }),
    ]);
  });
});
