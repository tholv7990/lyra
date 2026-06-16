import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Phase 2: projects + visibility access control.
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
    product: 'Runner X',
    niche: 'footwear',
    homepageUrl: '',
    ...over,
  });

  let ownerToken: string;
  let memberToken: string;
  let teamId: string;
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
  });

  it('creates a project that defaults to private', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/projects`)
      .set(auth(ownerToken))
      .send(newProject({ name: 'Owner Private' }))
      .expect(201);
    expect(res.body.visibility).toBe('private');
    expect(res.body.createdBy).toBeTruthy();
    ownerPrivateId = res.body.id;
  });

  it('hides a private project from other members in the list', async () => {
    const list = await http()
      .get(`/workspaces/${teamId}/projects`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.find((p: { id: string }) => p.id === ownerPrivateId)).toBeUndefined();
  });

  it('blocks a non-creator member from reading/editing a private project', async () => {
    await http().get(`/projects/${ownerPrivateId}`).set(auth(memberToken)).expect(403);
    await http()
      .patch(`/projects/${ownerPrivateId}`)
      .set(auth(memberToken))
      .send({ name: 'Hacked' })
      .expect(403);
  });

  it('exposes the project to all once visibility is workspace', async () => {
    await http()
      .patch(`/projects/${ownerPrivateId}`)
      .set(auth(ownerToken))
      .send({ visibility: 'workspace' })
      .expect(200);
    await http().get(`/projects/${ownerPrivateId}`).set(auth(memberToken)).expect(200);
    const list = await http()
      .get(`/workspaces/${teamId}/projects`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.find((p: { id: string }) => p.id === ownerPrivateId)).toBeDefined();
  });

  it('lets the owner see a member private project (owner override)', async () => {
    const memberProject = (
      await http()
        .post(`/workspaces/${teamId}/projects`)
        .set(auth(memberToken))
        .send(newProject({ name: 'Member Private' }))
        .expect(201)
    ).body;
    expect(memberProject.visibility).toBe('private');
    // owner can read it
    await http().get(`/projects/${memberProject.id}`).set(auth(ownerToken)).expect(200);
    // owner can delete it (override)
    await http().delete(`/projects/${memberProject.id}`).set(auth(ownerToken)).expect(204);
  });
});
