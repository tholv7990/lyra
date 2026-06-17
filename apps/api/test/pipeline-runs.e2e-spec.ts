import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../src/runs/providers/openai-compat.client';

// Running a composable pipeline in a project's context (chaining + gates).
// The Anthropic client echoes the prompt it receives so chaining is observable.
describe('Pipeline runs (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnthropicClient)
      .useValue({
        complete: async (p: { prompt: string }) => ({ text: p.prompt, usage: { tokens: 1 } }),
        stream: async () => ({ text: 'x', usage: { tokens: 1 } }),
      })
      .overrideProvider(OpenAiCompatClient)
      .useValue({
        complete: async (p: { prompt: string }) => ({ text: p.prompt, usage: { tokens: 1 } }),
        stream: async () => ({ text: 'x', usage: { tokens: 1 } }),
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
  let prompt1: string;
  let prompt2: string;

  const newStep = (over: Record<string, unknown>) => ({
    name: 'Step',
    promptId: '',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    mode: 'auto',
    ...over,
  });

  beforeAll(async () => {
    token = (
      await http()
        .post('/auth/signup')
        .send({ email: 'pr-run@example.com', password: 'password123', name: 'O' })
        .expect(201)
    ).body.accessToken;
    wsId = (
      await http().post('/workspaces').set(auth(token)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    await http()
      .put(`/workspaces/${wsId}/keys/anthropic`)
      .set(auth(token))
      .send({ key: 'sk-test' })
      .expect(200);
    projectId = (
      await http()
        .post(`/workspaces/${wsId}/projects`)
        .set(auth(token))
        .send({ name: 'Launch', product: 'Runner X', niche: 'shoes', homepageUrl: '' })
        .expect(201)
    ).body.id;
    prompt1 = (
      await http()
        .post(`/workspaces/${wsId}/prompts`)
        .set(auth(token))
        .send({ title: 'Brief', content: 'Brief for {product}', type: 'brief', status: 'public' })
        .expect(201)
    ).body.id;
    prompt2 = (
      await http()
        .post(`/workspaces/${wsId}/prompts`)
        .set(auth(token))
        .send({ title: 'Refine', content: 'Refine: {input}', type: 'insight', status: 'public' })
        .expect(201)
    ).body.id;
  });

  async function makePipeline(steps: Record<string, unknown>[]) {
    return (
      await http()
        .post(`/workspaces/${wsId}/pipelines`)
        .set(auth(token))
        .send({ name: 'Flow', steps })
        .expect(201)
    ).body.id as string;
  }

  it('creates a run from a pipeline: steps snapshotted raw, variables captured', async () => {
    const pipelineId = await makePipeline([
      newStep({ name: 'Brief', promptId: prompt1 }),
      newStep({ name: 'Refine', promptId: prompt2 }),
    ]);
    const run = (
      await http()
        .post(`/projects/${projectId}/pipelines/${pipelineId}/runs`)
        .set(auth(token))
        .expect(201)
    ).body;
    expect(run.pipelineId).toBe(pipelineId);
    expect(run.steps).toHaveLength(2);
    expect(run.steps[0].name).toBe('Brief');
    expect(run.steps[0].provider).toBe('anthropic');
    // Phase 2: prompts are snapshotted raw — project/custom/system vars resolve at
    // run time from the run's variable snapshot, not at creation.
    expect(run.steps[0].prompt).toBe('Brief for {product}');
    expect(run.variables.product).toBe('Runner X');
    expect(run.steps[0].key).toBeUndefined(); // composable step, no StepKey
  });

  it('runs all steps, chaining output into {input}', async () => {
    const pipelineId = await makePipeline([
      newStep({ name: 'Brief', promptId: prompt1 }),
      newStep({ name: 'Refine', promptId: prompt2 }),
    ]);
    const run = (
      await http()
        .post(`/projects/${projectId}/pipelines/${pipelineId}/runs`)
        .set(auth(token))
        .expect(201)
    ).body;
    const done = (
      await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)
    ).body;
    expect(done.status).toBe('done');
    expect(done.steps.every((s: { status: string }) => s.status === 'done')).toBe(true);
    // step 2 received step 1's output via {input}
    expect(done.steps[1].result).toContain(done.steps[0].result);
  });

  it('pauses at a gate step and resumes on approval', async () => {
    const pipelineId = await makePipeline([
      newStep({ name: 'Gated', promptId: prompt1, mode: 'gate' }),
    ]);
    const run = (
      await http()
        .post(`/projects/${projectId}/pipelines/${pipelineId}/runs`)
        .set(auth(token))
        .expect(201)
    ).body;
    let state = (
      await http().post(`/runs/${run.id}/run-all`).set(auth(token)).expect(201)
    ).body;
    expect(state.status).toBe('awaiting_gate');
    expect(state.steps[0].status).toBe('waiting');
    await http().post(`/runs/${run.id}/steps/0/approve`).set(auth(token)).expect(201);
    state = (await http().get(`/runs/${run.id}`).set(auth(token)).expect(200)).body;
    expect(state.status).toBe('done');
  });
});
