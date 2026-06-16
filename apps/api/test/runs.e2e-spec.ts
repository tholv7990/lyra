import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';

// Phase 4: run state machine + real StepProvider dispatch. The Anthropic client
// is stubbed so brain steps exercise the provider path without network/spend.
describe('Runs (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'd'.repeat(64);
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnthropicClient)
      .useValue({
        complete: async () => ({ text: '[stub] brain output', usage: { tokens: 5 } }),
      })
      .compile();
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

  let token: string;
  let wsId: string;
  let projectId: string;

  beforeAll(async () => {
    token = (
      await http()
        .post('/auth/signup')
        .send({ email: 'r-owner@example.com', password: 'password123', name: 'Owner' })
        .expect(201)
    ).body.accessToken;
    wsId = (
      await http().post('/workspaces').set(auth(token)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    projectId = (
      await http()
        .post(`/workspaces/${wsId}/projects`)
        .set(auth(token))
        .send({ name: 'Launch', product: 'Runner X', niche: 'footwear', homepageUrl: '' })
        .expect(201)
    ).body.id;
  });

  it('creates a run with 8 idle steps', async () => {
    const res = await http().post(`/projects/${projectId}/runs`).set(auth(token)).expect(201);
    expect(res.body.steps).toHaveLength(8);
    expect(res.body.status).toBe('idle');
    expect(res.body.currentStep).toBe(0);
  });

  it('blocks running a step whose provider key is missing', async () => {
    const run = (await http().post(`/projects/${projectId}/runs`).set(auth(token)).expect(201))
      .body;
    await http().post(`/runs/${run.id}/steps/0/run`).set(auth(token)).expect(400);
  });

  it('runs the pipeline through gates once keys are set', async () => {
    // Unlock every provider with placeholder keys (no real spend).
    for (const p of ['openai', 'deepseek', 'anthropic', 'image', 'video']) {
      await http()
        .put(`/workspaces/${wsId}/keys/${p}`)
        .set(auth(token))
        .send({ key: `test-${p}-key` })
        .expect(200);
    }

    const run = (await http().post(`/projects/${projectId}/runs`).set(auth(token)).expect(201))
      .body;

    // run-all pauses at the first gate (Brief, step 2)
    let state = (await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)).body;
    expect(state.status).toBe('awaiting_gate');
    expect(state.currentStep).toBe(2);
    expect(state.steps[2].result).toBeTruthy();

    // cannot run while awaiting a gate
    await http().post(`/runs/${run.id}/steps/2/run`).set(auth(token)).expect(400);

    // approve gate, continue to the next gate (Prompts, step 4)
    await http().post(`/runs/${run.id}/steps/2/approve`).set(auth(token)).expect(201);
    state = (await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)).body;
    expect(state.currentStep).toBe(4);
    expect(state.status).toBe('awaiting_gate');

    // approve through the rest to done
    await http().post(`/runs/${run.id}/steps/4/approve`).set(auth(token)).expect(201);
    state = (await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)).body;
    expect(state.currentStep).toBe(7);
    await http().post(`/runs/${run.id}/steps/7/approve`).set(auth(token)).expect(201);

    const done = (await http().get(`/runs/${run.id}`).set(auth(token)).expect(200)).body;
    expect(done.status).toBe('done');
    expect(done.steps.every((s: { status: string }) => s.status === 'done')).toBe(true);

    // reset returns it to idle
    const reset = (await http().post(`/runs/${run.id}/reset`).set(auth(token)).expect(201)).body;
    expect(reset.status).toBe('idle');
    expect(reset.currentStep).toBe(0);
    expect(reset.steps[0].result).toBeFalsy();
  });

  it('edits a step prompt', async () => {
    const run = (await http().post(`/projects/${projectId}/runs`).set(auth(token)).expect(201))
      .body;
    const res = await http()
      .patch(`/runs/${run.id}/steps/0/prompt`)
      .set(auth(token))
      .send({ prompt: 'custom prompt' })
      .expect(200);
    expect(res.body.steps[0].prompt).toBe('custom prompt');
  });

  it('denies access to a non-member', async () => {
    const run = (await http().post(`/projects/${projectId}/runs`).set(auth(token)).expect(201))
      .body;
    const outsider = (
      await http()
        .post('/auth/signup')
        .send({ email: 'outsider@example.com', password: 'password123', name: 'Out' })
        .expect(201)
    ).body.accessToken;
    await http().get(`/runs/${run.id}`).set(auth(outsider)).expect(403);
  });
});
