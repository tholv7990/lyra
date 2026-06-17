import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../src/runs/providers/openai-compat.client';

// Run state machine + real StepProvider dispatch over a composable pipeline. The
// Anthropic client is stubbed so steps exercise the provider path without spend.
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
      .overrideProvider(OpenAiCompatClient)
      .useValue({
        complete: async () => ({ text: '[stub] source output', usage: { tokens: 5 } }),
        stream: async (_p: unknown, onDelta: (t: string) => void) => {
          onDelta('[stub]');
          return { text: '[stub] source output', usage: { tokens: 5 } };
        },
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
  let pipelineId: string;

  // Create a run by executing the test pipeline in the project's context.
  const createRun = () =>
    http()
      .post(`/projects/${projectId}/pipelines/${pipelineId}/runs`)
      .set(auth(token))
      .expect(201);

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
        .send({ name: 'Launch', variables: [{ key: 'product', value: 'Runner X' }] })
        .expect(201)
    ).body.id;
    const promptId = (
      await http()
        .post(`/workspaces/${wsId}/prompts`)
        .set(auth(token))
        .send({ title: 'Brief', content: 'Brief for {product}', status: 'public' })
        .expect(201)
    ).body.id;
    pipelineId = (
      await http()
        .post(`/workspaces/${wsId}/pipelines`)
        .set(auth(token))
        .send({
          name: 'Flow',
          steps: [
            {
              name: 'Brief',
              promptId,
              provider: 'anthropic',
              model: 'claude-sonnet-4-6',
              mode: 'auto',
            },
          ],
        })
        .expect(201)
    ).body.id;
  });

  it('creates a run snapshotting the pipeline steps (idle)', async () => {
    const res = await createRun();
    expect(res.body.steps).toHaveLength(1);
    expect(res.body.status).toBe('idle');
    expect(res.body.currentStep).toBe(0);
    expect(res.body.steps[0].prompt).toBe('Brief for {product}');
  });

  it('blocks running a step whose provider key is missing', async () => {
    const run = (await createRun()).body;
    await http().post(`/runs/${run.id}/steps/0/run`).set(auth(token)).expect(400);
  });

  it('runs the step once the provider key is set; reset returns it to idle', async () => {
    await http()
      .put(`/workspaces/${wsId}/keys/anthropic`)
      .set(auth(token))
      .send({ key: 'sk-test' })
      .expect(200);

    const run = (await createRun()).body;
    const state = (await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)).body;
    expect(state.status).toBe('done');
    expect(state.steps[0].status).toBe('done');
    expect(state.steps[0].result).toContain('[stub] brain output');

    const reset = (await http().post(`/runs/${run.id}/reset`).set(auth(token)).expect(201)).body;
    expect(reset.status).toBe('idle');
    expect(reset.currentStep).toBe(0);
    expect(reset.steps[0].result).toBeFalsy();
  });

  it('edits a step prompt', async () => {
    const run = (await createRun()).body;
    const res = await http()
      .patch(`/runs/${run.id}/steps/0/prompt`)
      .set(auth(token))
      .send({ prompt: 'custom prompt' })
      .expect(200);
    expect(res.body.steps[0].prompt).toBe('custom prompt');
  });

  it('denies access to a non-member', async () => {
    const run = (await createRun()).body;
    const outsider = (
      await http()
        .post('/auth/signup')
        .send({ email: 'outsider@example.com', password: 'password123', name: 'Out' })
        .expect(201)
    ).body.accessToken;
    await http().get(`/runs/${run.id}`).set(auth(outsider)).expect(403);
  });
});
