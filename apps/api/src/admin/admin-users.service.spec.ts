import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from '@lyra/shared';
import { AdminUsersService, buildUserListFilter } from './admin-users.service';
import { AdminService } from './admin.service';

// --- pure filter builder -------------------------------------------------

describe('buildUserListFilter', () => {
  it('builds a case-insensitive email/name $or for q', () => {
    const filter = buildUserListFilter('Ada');
    expect(filter).toEqual({
      $or: [
        { email: { $regex: 'Ada', $options: 'i' } },
        { name: { $regex: 'Ada', $options: 'i' } },
      ],
    });
  });

  it('escapes regex metacharacters in q', () => {
    const filter = buildUserListFilter('a.b+c') as {
      $or: { email: { $regex: string } }[];
    };
    expect(filter.$or[0].email.$regex).toBe('a\\.b\\+c');
  });

  it('returns an empty filter when q is blank/undefined', () => {
    expect(buildUserListFilter()).toEqual({});
    expect(buildUserListFilter('   ')).toEqual({});
  });
});

// --- service with mocked models ------------------------------------------

// A chainable query-builder stub whose terminal .exec() resolves to `value`.
function execOf(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

// A find()-style chain: find().sort().skip().limit().exec() and
// find().sort().limit().exec() both resolve to `docs`.
function findChain(docs: unknown) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['find', 'sort', 'skip', 'limit']) {
    chain[m] = jest.fn().mockReturnValue(chain);
  }
  chain.exec = jest.fn().mockResolvedValue(docs);
  return chain;
}

function adminService(allowlist: string): AdminService {
  return new AdminService({
    get: jest.fn().mockReturnValue(allowlist),
  } as never);
}

describe('AdminUsersService', () => {
  describe('getOverview', () => {
    it('maps per-collection counts + signups30d + recent signups', async () => {
      // Each model's countDocuments() returns a distinct number we assert on.
      const users = {
        ...findChain([
          { _id: 'u1', email: 'a@x.com', name: 'A', active: true, createdAt: new Date() },
        ]),
        countDocuments: jest
          .fn()
          // first call (no arg) = total users; second ({createdAt:...}) = signups30d
          .mockReturnValueOnce(execOf(10))
          .mockReturnValueOnce(execOf(3)),
      };
      const mk = (n: number) => ({ countDocuments: jest.fn().mockReturnValue(execOf(n)) });
      const workspaces = mk(5);
      const projects = mk(7);
      const pipelines = mk(2);
      const prompts = mk(9);
      const runs = mk(4);
      const conversations = mk(6);
      // membership aggregation for recentSignups workspaceCount
      const memberships = {
        aggregate: jest
          .fn()
          .mockReturnValue(execOf([{ _id: 'u1', count: 2 }])),
      };

      const svc = new AdminUsersService(
        users as never,
        memberships as never,
        workspaces as never,
        projects as never,
        pipelines as never,
        prompts as never,
        runs as never,
        conversations as never,
        adminService('a@x.com'),
      );

      const out = await svc.getOverview();

      expect(out.users).toBe(10);
      expect(out.workspaces).toBe(5);
      expect(out.projects).toBe(7);
      expect(out.pipelines).toBe(2);
      expect(out.prompts).toBe(9);
      expect(out.runs).toBe(4);
      expect(out.chats).toBe(6);
      expect(out.signups30d).toBe(3);
      // signups30d filtered by a createdAt >= cutoff range
      const filterArg = users.countDocuments.mock.calls[1][0];
      expect(filterArg.createdAt.$gte).toBeInstanceOf(Date);
      // recentSignups mapped to summaries with isAdmin + workspaceCount
      expect(out.recentSignups).toHaveLength(1);
      expect(out.recentSignups[0]).toMatchObject({
        id: 'u1',
        email: 'a@x.com',
        isAdmin: true,
        workspaceCount: 2,
      });
    });
  });

  describe('getUserDetail', () => {
    it('aggregates usage by createdBy = userId and joins workspaces', async () => {
      const userDoc = {
        _id: 'u1',
        email: 'b@x.com',
        name: 'B',
        active: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-02-01'),
      };
      const users = { findById: jest.fn().mockReturnValue(execOf(userDoc)) };
      const memberships = {
        // single-doc summary uses countDocuments; detail uses find for workspaces
        countDocuments: jest.fn().mockReturnValue(execOf(1)),
        find: jest
          .fn()
          .mockReturnValue(
            execOf([{ workspaceId: 'w1', role: Role.Owner, userId: 'u1' }]),
          ),
      };
      const workspaces = {
        find: jest
          .fn()
          .mockReturnValue(execOf([{ _id: 'w1', name: 'Acme' }])),
      };
      const usageModel = (n: number) => ({
        countDocuments: jest.fn().mockReturnValue(execOf(n)),
      });
      const projects = usageModel(3);
      const pipelines = usageModel(1);
      const prompts = usageModel(4);
      const runs = usageModel(2);
      const conversations = usageModel(5);

      const svc = new AdminUsersService(
        users as never,
        memberships as never,
        workspaces as never,
        projects as never,
        pipelines as never,
        prompts as never,
        runs as never,
        conversations as never,
        adminService(''),
      );

      const out = await svc.getUserDetail('u1');

      expect(out.usage).toEqual({
        projects: 3,
        pipelines: 1,
        prompts: 4,
        runs: 2,
        chats: 5,
      });
      // each usage count queried by createdBy = the user id (stored as string)
      expect(projects.countDocuments).toHaveBeenCalledWith({ createdBy: 'u1' });
      expect(conversations.countDocuments).toHaveBeenCalledWith({
        createdBy: 'u1',
      });
      expect(out.workspaces).toEqual([
        { id: 'w1', name: 'Acme', role: Role.Owner },
      ]);
      expect(out.updatedAt).toBe(new Date('2026-02-01').toISOString());
      expect(out.isAdmin).toBe(false);
      expect(out.workspaceCount).toBe(1);
    });

    it('throws NotFound when the user does not exist', async () => {
      const users = { findById: jest.fn().mockReturnValue(execOf(null)) };
      const svc = new AdminUsersService(
        users as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        adminService(''),
      );
      await expect(svc.getUserDetail('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('setUserActive', () => {
    it('blocks deactivating your own account', async () => {
      const users = { findByIdAndUpdate: jest.fn() };
      const svc = new AdminUsersService(
        users as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        adminService(''),
      );

      await expect(svc.setUserActive('me', false, 'me')).rejects.toThrow(
        BadRequestException,
      );
      await expect(svc.setUserActive('me', false, 'me')).rejects.toThrow(
        'You cannot deactivate your own account.',
      );
      // never touched the DB
      expect(users.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('allows reactivating yourself (active=true on own id)', async () => {
      const updated = {
        _id: 'me',
        email: 'me@x.com',
        name: 'Me',
        active: true,
        createdAt: new Date(),
      };
      const users = {
        findByIdAndUpdate: jest.fn().mockReturnValue(execOf(updated)),
      };
      const memberships = {
        countDocuments: jest.fn().mockReturnValue(execOf(0)),
      };
      const svc = new AdminUsersService(
        users as never,
        memberships as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        adminService('me@x.com'),
      );

      const out = await svc.setUserActive('me', true, 'me');
      expect(users.findByIdAndUpdate).toHaveBeenCalledWith(
        'me',
        { active: true },
        { new: true },
      );
      expect(out).toMatchObject({ id: 'me', active: true, isAdmin: true });
    });

    it('deactivates another user and returns the updated summary', async () => {
      const updated = {
        _id: 'other',
        email: 'o@x.com',
        name: 'Other',
        active: false,
        createdAt: new Date(),
      };
      const users = {
        findByIdAndUpdate: jest.fn().mockReturnValue(execOf(updated)),
      };
      const memberships = {
        countDocuments: jest.fn().mockReturnValue(execOf(2)),
      };
      const svc = new AdminUsersService(
        users as never,
        memberships as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        adminService(''),
      );

      const out = await svc.setUserActive('other', false, 'admin');
      expect(out).toMatchObject({
        id: 'other',
        active: false,
        workspaceCount: 2,
      });
    });
  });

  describe('listUsers', () => {
    it('caps limit at 100 and sorts newest-first via the q filter', async () => {
      const docs = [
        { _id: 'u1', email: 'a@x.com', name: 'A', active: true, createdAt: new Date() },
      ];
      const users = {
        ...findChain(docs),
        countDocuments: jest.fn().mockReturnValue(execOf(1)),
      };
      const memberships = {
        aggregate: jest.fn().mockReturnValue(execOf([{ _id: 'u1', count: 1 }])),
      };
      const svc = new AdminUsersService(
        users as never,
        memberships as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        adminService(''),
      );

      const out = await svc.listUsers({ page: 1, limit: 9999, q: 'a@x.com' });
      expect(out.limit).toBe(100);
      expect(out.total).toBe(1);
      expect(out.items[0]).toMatchObject({ id: 'u1', workspaceCount: 1 });
      // filtered by the q $or
      expect(users.countDocuments).toHaveBeenCalledWith({
        $or: [
          { email: { $regex: 'a@x\\.com', $options: 'i' } },
          { name: { $regex: 'a@x\\.com', $options: 'i' } },
        ],
      });
      // sorted newest-first
      expect(users.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });
  });
});
