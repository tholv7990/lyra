import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Role, RequestType, RequestStatus, WorkspaceType } from '@lyra/shared';
import { RequestsService } from './requests.service';

// Helper to create a chainable findOne mock (top-level so reusable across describe blocks)
// Note: findOneExec is defined here and used in both describe blocks below

// Helper to create a chainable findOne mock
function findOneExec(value: unknown) {
  return { exec: jest.fn().mockResolvedValue(value) };
}

describe('RequestsService team-upgrade', () => {
  const ownerId = 'owner1';
  const strangerId = 'stranger1';
  const wsId = 'ws1';

  function makeService(opts: {
    wsType?: string;
    wsFound?: boolean;
    memberRole?: string | null;
    existingRequest?: unknown;
  } = {}) {
    const { wsType = 'personal', wsFound = true, memberRole = Role.Owner, existingRequest = null } = opts;

    // Model with exec-chain for create, findOne
    const createdDoc = {
      _id: 'req1',
      id: 'req1',
      type: RequestType.TeamUpgrade,
      subject: 'My Team',
      subjectKey: 'my team',
      body: '',
      status: RequestStatus.Open,
      workspaceId: wsId,
      voters: [ownerId],
      createdBy: ownerId,
      updatedBy: ownerId,
      toObject: () => ({}),
    };
    const model = {
      create: jest.fn().mockResolvedValue(createdDoc),
      findOne: jest.fn().mockReturnValue(findOneExec(existingRequest)),
      find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }) }),
    } as never;

    const workspaces = {
      findById: jest.fn().mockResolvedValue(
        wsFound ? { _id: wsId, id: wsId, type: wsType, name: 'Solo' } : null
      ),
    } as never;

    const memberships = {
      findFor: jest.fn().mockResolvedValue(
        memberRole ? { role: memberRole, workspaceId: wsId, userId: ownerId } : null
      ),
    } as never;

    const users = {
      refMap: jest.fn().mockResolvedValue(new Map([[ownerId, { id: ownerId, name: 'Owner' }]])),
    } as never;

    return new RequestsService(model, users, workspaces, memberships);
  }

  it('team-upgrade rejected when workspace not found', async () => {
    const service = makeService({ wsFound: false });
    await expect(
      service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: wsId }),
    ).rejects.toThrow();
  });

  it('team-upgrade rejected when workspace is already team', async () => {
    const service = makeService({ wsType: 'team' });
    await expect(
      service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: wsId }),
    ).rejects.toThrow(BadRequestException);
  });

  it('team-upgrade rejected for non-owner', async () => {
    const service = makeService({ memberRole: Role.Member });
    await expect(
      service.create(strangerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: wsId }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('team-upgrade rejected when workspaceId missing', async () => {
    const service = makeService();
    await expect(
      service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('team-upgrade succeeds for owner of personal workspace', async () => {
    const service = makeService();
    const req = await service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: wsId });
    expect(req.type).toBe(RequestType.TeamUpgrade);
  });

  it('team-upgrade rejected when duplicate open request exists', async () => {
    const existingReq = { _id: 'req0', type: RequestType.TeamUpgrade, status: RequestStatus.Open, workspaceId: wsId };
    const service = makeService({ existingRequest: existingReq });
    await expect(
      service.create(ownerId, { type: RequestType.TeamUpgrade, subject: 'My Team', workspaceId: wsId }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('RequestsService updateStatus team-upgrade', () => {
  const ownerId = 'owner1';
  const adminId = 'admin1';
  const wsId = 'ws1';

  function makeUpdateService(opts: { requestType?: string; workspaceId?: string } = {}) {
    const { requestType = RequestType.TeamUpgrade, workspaceId = wsId } = opts;

    const requestDoc = {
      _id: 'req1',
      id: 'req1',
      type: requestType,
      subject: 'T',
      subjectKey: 't',
      body: '',
      status: RequestStatus.Resolved,
      workspaceId,
      voters: [ownerId],
      createdBy: ownerId,
      updatedBy: adminId,
      toObject: () => ({}),
    };

    const model = {
      create: jest.fn(),
      findOne: jest.fn().mockReturnValue(findOneExec(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(findOneExec(requestDoc)),
    } as never;

    const upgradeToTeam = jest.fn().mockResolvedValue({ type: WorkspaceType.Team });
    const workspaces = { findById: jest.fn(), upgradeToTeam } as never;
    const memberships = { findFor: jest.fn() } as never;
    const users = {
      refMap: jest.fn().mockResolvedValue(new Map([
        [ownerId, { id: ownerId, name: 'Owner' }],
        [adminId, { id: adminId, name: 'Admin' }],
      ])),
    } as never;

    const service = new RequestsService(model, users, workspaces, memberships);
    return { service, upgradeToTeam };
  }

  it('resolving a team-upgrade request calls upgradeToTeam', async () => {
    const { service, upgradeToTeam } = makeUpdateService();
    await service.updateStatus('req1', { status: RequestStatus.Resolved }, adminId);
    expect(upgradeToTeam).toHaveBeenCalledWith(wsId, adminId);
  });

  it('declining a team-upgrade does NOT call upgradeToTeam', async () => {
    const requestDoc = {
      _id: 'req1', id: 'req1',
      type: RequestType.TeamUpgrade, subject: 'T', subjectKey: 't', body: '',
      status: RequestStatus.Declined, workspaceId: wsId,
      voters: ['owner1'], createdBy: 'owner1', updatedBy: adminId,
      toObject: () => ({}),
    };
    const model = {
      create: jest.fn(),
      findOne: jest.fn().mockReturnValue(findOneExec(null)),
      findByIdAndUpdate: jest.fn().mockReturnValue(findOneExec(requestDoc)),
    } as never;
    const upgradeToTeam = jest.fn();
    const workspaces = { upgradeToTeam } as never;
    const memberships = { findFor: jest.fn() } as never;
    const users = {
      refMap: jest.fn().mockResolvedValue(new Map([
        ['owner1', { id: 'owner1', name: 'Owner' }],
        [adminId, { id: adminId, name: 'Admin' }],
      ])),
    } as never;
    const service = new RequestsService(model, users, workspaces, memberships);
    await service.updateStatus('req1', { status: RequestStatus.Declined }, adminId);
    expect(upgradeToTeam).not.toHaveBeenCalled();
  });

  it('resolving a non-team-upgrade request does NOT call upgradeToTeam', async () => {
    const { service, upgradeToTeam } = makeUpdateService({ requestType: RequestType.Provider });
    await service.updateStatus('req1', { status: RequestStatus.Resolved }, adminId);
    expect(upgradeToTeam).not.toHaveBeenCalled();
  });
});
