import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { UsersService } from '../src/users/users.service';

// Pipeline library + project.pipelines references (project-model-v2).
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
    // Get the personal workspace and upgrade it to a team so invites work.
    const workspaces = await http().get('/workspaces').set(auth(ownerToken)).expect(200);
    teamId = workspaces.body[0].id as string;
    const me = (await http().get('/auth/me').set(auth(ownerToken)).expect(200)).body.user;
    await app.get(WorkspacesService).upgradeToTeam(teamId, me.id);

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
        .send({ title: 'Brief', content: 'Write a brief for {product}', type: 'text', status: 'public' })
        .expect(201)
    ).body.id;

    projectId = (
      await http()
        .post(`/workspaces/${teamId}/projects`)
        .set(auth(ownerToken))
        .send({ name: 'Launch', variables: [{ key: 'product', value: 'Runner X' }] })
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

  it('rejects a step with an empty model', async () => {
    await http()
      .post(`/workspaces/${teamId}/pipelines`)
      .set(auth(ownerToken))
      .send({ name: 'Bad', steps: [step({ promptId, model: '' })] })
      .expect(400);
  });

  it('accepts a step with an arbitrary (non-catalog) model id', async () => {
    // No static-catalog gating — refreshed model ids are saved as-is.
    const res = await http()
      .post(`/workspaces/${teamId}/pipelines`)
      .set(auth(ownerToken))
      .send({ name: 'Future', steps: [step({ promptId, model: 'claude-future-99' })] })
      .expect(201);
    expect(res.body.steps[0].model).toBe('claude-future-99');
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

  it('attaches + detaches a pipeline via project.pipelines', async () => {
    // attach by editing the project's pipeline-reference array
    let proj = (
      await http()
        .patch(`/projects/${projectId}`)
        .set(auth(ownerToken))
        .send({ pipelines: [pipelineId] })
        .expect(200)
    ).body;
    expect(proj.pipelines).toEqual([pipelineId]);

    // round-trips on read
    proj = (await http().get(`/projects/${projectId}`).set(auth(ownerToken)).expect(200)).body;
    expect(proj.pipelines).toEqual([pipelineId]);

    // detach
    proj = (
      await http()
        .patch(`/projects/${projectId}`)
        .set(auth(ownerToken))
        .send({ pipelines: [] })
        .expect(200)
    ).body;
    expect(proj.pipelines).toEqual([]);
  });

  it('drops a soft-deleted pipeline ref from project.pipelines on read', async () => {
    // a disposable pipeline attached to the project
    const tempPipeline = (
      await http()
        .post(`/workspaces/${teamId}/pipelines`)
        .set(auth(ownerToken))
        .send({ name: 'Temp', steps: [step({ promptId })] })
        .expect(201)
    ).body.id as string;
    await http()
      .patch(`/projects/${projectId}`)
      .set(auth(ownerToken))
      .send({ pipelines: [tempPipeline] })
      .expect(200);

    // soft-delete the pipeline → its ref must no longer surface on the project
    await http().delete(`/pipelines/${tempPipeline}`).set(auth(ownerToken)).expect(204);
    const proj = (
      await http().get(`/projects/${projectId}`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(proj.pipelines).not.toContain(tempPipeline);
  });

  it('reports how many pipelines use a prompt (delete-warning)', async () => {
    const usedPrompt = (
      await http()
        .post(`/workspaces/${teamId}/prompts`)
        .set(auth(ownerToken))
        .send({ title: 'Used', content: 'hi', status: 'public' })
        .expect(201)
    ).body.id;
    await http()
      .post(`/workspaces/${teamId}/pipelines`)
      .set(auth(ownerToken))
      .send({ name: 'Uses it', steps: [step({ promptId: usedPrompt })] })
      .expect(201);

    const used = (
      await http()
        .get(`/workspaces/${teamId}/pipelines/prompt-usage/${usedPrompt}`)
        .set(auth(ownerToken))
        .expect(200)
    ).body;
    expect(used.count).toBe(1);
    // a prompt bound to no pipeline reports zero
    const unusedPrompt = (
      await http()
        .post(`/workspaces/${teamId}/prompts`)
        .set(auth(ownerToken))
        .send({ title: 'Unused', content: 'hi', status: 'public' })
        .expect(201)
    ).body.id;
    const none = (
      await http()
        .get(`/workspaces/${teamId}/pipelines/prompt-usage/${unusedPrompt}`)
        .set(auth(ownerToken))
        .expect(200)
    ).body;
    expect(none.count).toBe(0);
  });

  it('cascades soft delete from a workspace to its pipelines', async () => {
    // Sign up a fresh user whose personal workspace we can upgrade + cascade-delete.
    const tempToken = await signup('pl-cascade@example.com', 'Cascade');
    const workspaces = await http().get('/workspaces').set(auth(tempToken)).expect(200);
    const tempWs = workspaces.body[0].id as string;
    const tempMe = (await http().get('/auth/me').set(auth(tempToken)).expect(200)).body.user;
    await app.get(WorkspacesService).upgradeToTeam(tempWs, tempMe.id);

    const pl = (
      await http()
        .post(`/workspaces/${tempWs}/pipelines`)
        .set(auth(tempToken))
        .send({ name: 'Doomed' })
        .expect(201)
    ).body;
    await http().delete(`/workspaces/${tempWs}`).set(auth(tempToken)).expect(204);
    await http().get(`/pipelines/${pl.id}`).set(auth(ownerToken)).expect(404);
  });
});
