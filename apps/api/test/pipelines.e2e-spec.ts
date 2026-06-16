import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Pipeline library + project assignment.
describe('Pipelines (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  let ownerToken: string;
  let memberToken: string;
  let teamId: string;
  let promptId: string;
  let projectId: string;
  let pipelineId: string;

  const step = (over: Record<string, unknown> = {}) => ({
    name: 'Brief',
    promptId: 'PLACEHOLDER',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    mode: 'gate',
    ...over,
  });

  beforeAll(async () => {
    ownerToken = await signup('pl-owner@example.com', 'Owner');
    teamId = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    const invite = (
      await http()
        .post(`/workspaces/${teamId}/invites`)
        .set(auth(ownerToken))
        .send({ email: 'pl-member@example.com', role: 'member' })
        .expect(201)
    ).body.token;
    memberToken = await signup('pl-member@example.com', 'Member');
    await http().post('/invites/accept').set(auth(memberToken)).send({ token: invite }).expect(200);

    promptId = (
      await http()
        .post(`/workspaces/${teamId}/prompts`)
        .set(auth(ownerToken))
        .send({ title: 'Brief', content: 'Write a brief for {product}', type: 'brief', status: 'public' })
        .expect(201)
    ).body.id;

    projectId = (
      await http()
        .post(`/workspaces/${teamId}/projects`)
        .set(auth(ownerToken))
        .send({ name: 'Launch', product: 'Runner X', niche: 'shoes', homepageUrl: '' })
        .expect(201)
    ).body.id;
  });

  it('creates a pipeline with steps (ids assigned, model validated)', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/pipelines`)
      .set(auth(ownerToken))
      .send({
        name: 'Product Research',
        description: 'Research flow',
        tags: ['Research', 'research'],
        steps: [step({ promptId, name: 'Brief' }), step({ promptId, name: 'Insight', mode: 'auto' })],
      })
      .expect(201);
    expect(res.body.tags).toEqual(['Research']);
    expect(res.body.steps).toHaveLength(2);
    expect(res.body.steps[0].id).toBeTruthy();
    expect(res.body.steps[1].mode).toBe('auto');
    pipelineId = res.body.id;
  });

  it('rejects a step with a model not in the catalog', async () => {
    await http()
      .post(`/workspaces/${teamId}/pipelines`)
      .set(auth(ownerToken))
      .send({ name: 'Bad', steps: [step({ promptId, model: 'gpt-5.5' })] })
      .expect(400);
  });

  it('lists library pipelines for any member', async () => {
    const list = (
      await http().get(`/workspaces/${teamId}/pipelines`).set(auth(memberToken)).expect(200)
    ).body as { id: string }[];
    expect(list.find((p) => p.id === pipelineId)).toBeTruthy();
  });

  it('blocks a non-creator member from editing/deleting', async () => {
    await http()
      .patch(`/pipelines/${pipelineId}`)
      .set(auth(memberToken))
      .send({ name: 'Hacked' })
      .expect(403);
    await http().delete(`/pipelines/${pipelineId}`).set(auth(memberToken)).expect(403);
  });

  it('updates the pipeline (creator)', async () => {
    const res = await http()
      .patch(`/pipelines/${pipelineId}`)
      .set(auth(ownerToken))
      .send({ name: 'Research v2', steps: [step({ promptId, name: 'Brief only' })] })
      .expect(200);
    expect(res.body.name).toBe('Research v2');
    expect(res.body.steps).toHaveLength(1);
  });

  it('assigns + lists + unassigns a pipeline on a project', async () => {
    await http()
      .post(`/projects/${projectId}/pipelines/${pipelineId}`)
      .set(auth(ownerToken))
      .expect(201);

    let assigned = (
      await http().get(`/projects/${projectId}/pipelines`).set(auth(ownerToken)).expect(200)
    ).body as { id: string }[];
    expect(assigned.find((p) => p.id === pipelineId)).toBeTruthy();

    await http()
      .delete(`/projects/${projectId}/pipelines/${pipelineId}`)
      .set(auth(ownerToken))
      .expect(204);

    assigned = (
      await http().get(`/projects/${projectId}/pipelines`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(assigned.find((p) => p.id === pipelineId)).toBeUndefined();
  });

  it('cascades soft delete from a workspace to its pipelines', async () => {
    const tempWs = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Temp' }).expect(201)
    ).body.id;
    const pl = (
      await http()
        .post(`/workspaces/${tempWs}/pipelines`)
        .set(auth(ownerToken))
        .send({ name: 'Doomed' })
        .expect(201)
    ).body;
    await http().delete(`/workspaces/${tempWs}`).set(auth(ownerToken)).expect(204);
    await http().get(`/pipelines/${pl.id}`).set(auth(ownerToken)).expect(404);
  });
});
