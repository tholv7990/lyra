import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { UsersService } from '../src/users/users.service';

// Phase 1: workspaces, memberships, invites.
describe('Workspaces (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await mongod?.stop();
  });

  const http = () => request(app.getHttpServer());
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
  // Signup now returns { ok: true }; the access token comes from login.
  // Email is immediately verified so @RequireCreate guards pass in tests.
  const signup = async (email: string, name: string) => {
    await http()
      .post('/auth/signup')
      .send({ email, password: 'password123', name })
      .expect(201);
    await app.get(UsersService).findOneAndUpdate({ email }, { $set: { emailVerified: true } });
    return (
      await http().post('/auth/login').send({ email, password: 'password123' }).expect(200)
    ).body.accessToken as string;
  };

  let ownerToken: string;
  let teamId: string;

  it('creates a personal workspace on signup', async () => {
    ownerToken = await signup('owner@example.com', 'Owner');
    const res = await http().get('/workspaces').set(auth(ownerToken)).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe('personal');
    expect(res.body[0].role).toBe('owner');
    teamId = res.body[0].id as string;
  });

  it('upgrading a personal workspace to team reflects the new type', async () => {
    // Free team creation via POST /workspaces is removed — upgrade is admin-gated
    // and done via WorkspacesService.upgradeToTeam. Here we drive it directly
    // (as the service layer would after an admin approves a team-upgrade request).
    const me = (await http().get('/auth/me').set(auth(ownerToken)).expect(200)).body.user;
    const upgraded = await app.get(WorkspacesService).upgradeToTeam(teamId, me.id);
    expect(upgraded).not.toBeNull();
    expect(upgraded!.type).toBe('team');

    // The workspace list now shows type=team.
    const list = await http().get('/workspaces').set(auth(ownerToken)).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].type).toBe('team');
    expect(list.body[0].role).toBe('owner');
  });

  it('invites a member, who accepts and joins', async () => {
    const inviteRes = await http()
      .post(`/workspaces/${teamId}/invites`)
      .set(auth(ownerToken))
      .send({ email: 'member@example.com', role: 'member' })
      .expect(201);
    const token = inviteRes.body.token as string;
    expect(token).toBeTruthy();

    const memberToken = await signup('member@example.com', 'Member');
    const accept = await http()
      .post('/invites/accept')
      .set(auth(memberToken))
      .send({ token })
      .expect(200);
    expect(accept.body.id).toBe(teamId);
    expect(accept.body.role).toBe('member');

    const members = await http()
      .get(`/workspaces/${teamId}/members`)
      .set(auth(memberToken))
      .expect(200);
    expect(members.body).toHaveLength(2);
    expect(members.body.map((m: { email: string }) => m.email).sort()).toEqual([
      'member@example.com',
      'owner@example.com',
    ]);
  });

  it('enforces owner-only management and workspace membership', async () => {
    const memberToken = (
      await http()
        .post('/auth/login')
        .send({ email: 'member@example.com', password: 'password123' })
        .expect(200)
    ).body.accessToken as string;

    // member cannot rename the workspace (owner only)
    await http()
      .patch(`/workspaces/${teamId}`)
      .set(auth(memberToken))
      .send({ name: 'Hacked' })
      .expect(403);

    // a non-member cannot read someone else's personal workspace
    const memberWorkspaces = await http()
      .get('/workspaces')
      .set(auth(memberToken))
      .expect(200);
    const memberPersonal = memberWorkspaces.body.find(
      (w: { type: string }) => w.type === 'personal',
    );
    await http()
      .get(`/workspaces/${memberPersonal.id}`)
      .set(auth(ownerToken))
      .expect(403);
  });

  it('rejects an invite accepted by the wrong email', async () => {
    const inviteRes = await http()
      .post(`/workspaces/${teamId}/invites`)
      .set(auth(ownerToken))
      .send({ email: 'someone@example.com', role: 'member' })
      .expect(201);
    const token = inviteRes.body.token as string;

    const otherToken = await signup('different@example.com', 'Different');
    await http()
      .post('/invites/accept')
      .set(auth(otherToken))
      .send({ token })
      .expect(403);
  });

  it('rejects invite creation on a personal workspace', async () => {
    // The member's own personal workspace must reject invites until upgraded.
    const memberToken = (
      await http()
        .post('/auth/login')
        .send({ email: 'member@example.com', password: 'password123' })
        .expect(200)
    ).body.accessToken as string;
    const memberWorkspaces = (
      await http().get('/workspaces').set(auth(memberToken)).expect(200)
    ).body;
    const personalWs = memberWorkspaces.find((w: { type: string }) => w.type === 'personal');

    await http()
      .post(`/workspaces/${personalWs.id}/invites`)
      .set(auth(memberToken))
      .send({ email: 'anyone@example.com', role: 'member' })
      .expect(400);
  });
});
