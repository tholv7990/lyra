import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Projects + status/shared access control (project-model-v2).
describe('Projects (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
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
  const signup = async (email: string, name: string) =>
    (
      await http()
        .post('/auth/signup')
        .send({ email, password: 'password123', name })
        .expect(201)
    ).body.accessToken as string;
  const newProject = (over: Record<string, unknown> = {}) => ({
    name: 'P',
    ...over,
  });

  let ownerToken: string;
  let memberToken: string;
  let teamId: string;
  let memberId: string;
  let ownerPrivateId: string;

  beforeAll(async () => {
    ownerToken = await signup('po-owner@example.com', 'Owner');
    teamId = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    const invite = (
      await http()
        .post(`/workspaces/${teamId}/invites`)
        .set(auth(ownerToken))
        .send({ email: 'po-member@example.com', role: 'member' })
        .expect(201)
    ).body.token;
    memberToken = await signup('po-member@example.com', 'Member');
    await http().post('/invites/accept').set(auth(memberToken)).send({ token: invite }).expect(200);
    const members = (
      await http().get(`/workspaces/${teamId}/members`).set(auth(ownerToken)).expect(200)
    ).body as { userId: string; name: string }[];
    memberId = members.find((m) => m.name === 'Member')!.userId;
  });

  it('creates a project that defaults to draft + shared=all', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/projects`)
      .set(auth(ownerToken))
      .send(newProject({ name: 'Owner Draft', description: 'A cozy plush sofa for pets' }))
      .expect(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.shared).toBe('all');
    expect(res.body.description).toBe('A cozy plush sofa for pets');
    expect(res.body.variables).toEqual([]);
    expect(res.body.pipelines).toEqual([]);
    expect(res.body.sharedWith).toEqual([]);
    expect(res.body.active).toBe(true);
    // audit envelope: createdBy/updatedBy expanded to { id, name }
    expect(res.body.createdBy.name).toBe('Owner');
    expect(res.body.createdBy.id).toBeTruthy();
    expect(res.body.updatedBy.name).toBe('Owner');
    ownerPrivateId = res.body.id;
  });

  it('persists variables on create and round-trips them', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/projects`)
      .set(auth(ownerToken))
      .send(
        newProject({
          name: 'With Vars',
          variables: [
            { key: 'product', value: 'Runner X' },
            { key: 'niche', value: 'footwear' },
          ],
        }),
      )
      .expect(201);
    expect(res.body.variables).toEqual([
      { key: 'product', value: 'Runner X' },
      { key: 'niche', value: 'footwear' },
    ]);
  });

  it('cascades soft delete from a workspace to its projects', async () => {
    const tempWs = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Temp' }).expect(201)
    ).body.id;
    const proj = (
      await http()
        .post(`/workspaces/${tempWs}/projects`)
        .set(auth(ownerToken))
        .send(newProject({ name: 'Doomed' }))
        .expect(201)
    ).body;
    await http().delete(`/workspaces/${tempWs}`).set(auth(ownerToken)).expect(204);
    // child project is no longer reachable (cascaded to active:false)
    await http().get(`/projects/${proj.id}`).set(auth(ownerToken)).expect(404);
  });

  it('hides a draft project from other members in the list', async () => {
    const list = await http()
      .get(`/workspaces/${teamId}/projects`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.find((p: { id: string }) => p.id === ownerPrivateId)).toBeUndefined();
  });

  it('blocks a non-creator member from reading/editing a draft project', async () => {
    await http().get(`/projects/${ownerPrivateId}`).set(auth(memberToken)).expect(403);
    await http()
      .patch(`/projects/${ownerPrivateId}`)
      .set(auth(memberToken))
      .send({ name: 'Hacked' })
      .expect(403);
  });

  it('exposes the project to all once status=public (shared=all)', async () => {
    await http()
      .patch(`/projects/${ownerPrivateId}`)
      .set(auth(ownerToken))
      .send({ status: 'public', shared: 'all' })
      .expect(200);
    await http().get(`/projects/${ownerPrivateId}`).set(auth(memberToken)).expect(200);
    const list = await http()
      .get(`/workspaces/${teamId}/projects`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.find((p: { id: string }) => p.id === ownerPrivateId)).toBeDefined();
  });

  it('gates a public + shared=people project by sharedWith', async () => {
    const proj = (
      await http()
        .post(`/workspaces/${teamId}/projects`)
        .set(auth(ownerToken))
        .send(newProject({ name: 'People Only', status: 'public', shared: 'people' }))
        .expect(201)
    ).body;
    expect(proj.shared).toBe('people');
    // sharedWith empty → member can't see it
    await http().get(`/projects/${proj.id}`).set(auth(memberToken)).expect(403);
    let list = (
      await http().get(`/workspaces/${teamId}/projects`).set(auth(memberToken)).expect(200)
    ).body;
    expect(list.find((p: { id: string }) => p.id === proj.id)).toBeUndefined();
    // add the member to sharedWith → now visible
    await http()
      .patch(`/projects/${proj.id}`)
      .set(auth(ownerToken))
      .send({ sharedWith: [memberId] })
      .expect(200);
    await http().get(`/projects/${proj.id}`).set(auth(memberToken)).expect(200);
    list = (
      await http().get(`/workspaces/${teamId}/projects`).set(auth(memberToken)).expect(200)
    ).body;
    expect(list.find((p: { id: string }) => p.id === proj.id)).toBeDefined();
  });

  it('lets the owner see a member draft project (owner override)', async () => {
    const memberProject = (
      await http()
        .post(`/workspaces/${teamId}/projects`)
        .set(auth(memberToken))
        .send(newProject({ name: 'Member Draft' }))
        .expect(201)
    ).body;
    expect(memberProject.status).toBe('draft');
    // owner can read it
    await http().get(`/projects/${memberProject.id}`).set(auth(ownerToken)).expect(200);
    // owner can delete it (override) — soft delete
    await http().delete(`/projects/${memberProject.id}`).set(auth(ownerToken)).expect(204);
    // soft-deleted: no longer readable or listed
    await http().get(`/projects/${memberProject.id}`).set(auth(ownerToken)).expect(404);
    const list = (
      await http().get(`/workspaces/${teamId}/projects`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(list.find((p: { id: string }) => p.id === memberProject.id)).toBeUndefined();
  });
});
