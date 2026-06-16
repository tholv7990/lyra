import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';

// Prompt testing playground: streaming run (SSE) + history + star/tags.
// The Anthropic client is stubbed so tests are hermetic (no network/spend).
describe('Prompt tests (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'f'.repeat(64);
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnthropicClient)
      .useValue({
        complete: async () => ({ text: 'ok', usage: { tokens: 3 } }),
        stream: async (
          _params: unknown,
          onDelta: (t: string) => void,
        ) => {
          onDelta('Hello ');
          onDelta('world');
          return { text: 'Hello world', usage: { tokens: 7 } };
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
  const signup = async (email: string) =>
    (
      await http()
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'U' })
        .expect(201)
    ).body.accessToken as string;

  // Parse SSE text into the list of data objects.
  const events = (text: string) =>
    text
      .split('\n\n')
      .map((b) => b.trim())
      .filter((b) => b.startsWith('data:'))
      .map((b) => JSON.parse(b.slice(5).trim()) as Record<string, unknown>);

  let token: string;
  let wsId: string;
  let promptId: string;
  const body = { provider: 'anthropic', model: 'claude-sonnet-4-6', input: 'Say hi' };

  beforeAll(async () => {
    token = await signup('pt-owner@example.com');
    wsId = (
      await http().post('/workspaces').set(auth(token)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    promptId = (
      await http()
        .post(`/workspaces/${wsId}/prompts`)
        .set(auth(token))
        .send({ title: 'Greeter', content: 'Say hello to {product}', type: 'brief', status: 'public' })
        .expect(201)
    ).body.id;
  });

  it('rejects a run before the provider key is set', async () => {
    await http()
      .post(`/workspaces/${wsId}/prompts/${promptId}/tests`)
      .set(auth(token))
      .send(body)
      .expect(400);
  });

  it('rejects a model not in the catalog', async () => {
    await http()
      .post(`/workspaces/${wsId}/prompts/${promptId}/tests`)
      .set(auth(token))
      .send({ ...body, model: 'gpt-5.5' })
      .expect(400);
  });

  let testId: string;

  it('streams a run and saves it to history', async () => {
    await http()
      .put(`/workspaces/${wsId}/keys/anthropic`)
      .set(auth(token))
      .send({ key: 'sk-test' })
      .expect(200);

    const res = await http()
      .post(`/workspaces/${wsId}/prompts/${promptId}/tests`)
      .set(auth(token))
      .send(body)
      .expect(200);

    const evts = events(res.text);
    const deltas = evts.filter((e) => e.type === 'delta').map((e) => e.text).join('');
    expect(deltas).toBe('Hello world');
    const done = evts.find((e) => e.type === 'done');
    expect(done).toBeTruthy();
    const test = done!.test as { id: string; result: string; starred: boolean };
    expect(test.result).toBe('Hello world');
    expect(test.starred).toBe(false);
    testId = test.id;
  });

  it('lists test history for the prompt', async () => {
    const list = (
      await http()
        .get(`/workspaces/${wsId}/prompts/${promptId}/tests`)
        .set(auth(token))
        .expect(200)
    ).body as { id: string }[];
    expect(list.find((t) => t.id === testId)).toBeTruthy();
  });

  it('stars + tags a result, and filters by them', async () => {
    const updated = (
      await http()
        .patch(`/prompt-tests/${testId}`)
        .set(auth(token))
        .send({ starred: true, tags: ['Good', 'good', 'keep'] })
        .expect(200)
    ).body;
    expect(updated.starred).toBe(true);
    expect(updated.tags).toEqual(['Good', 'keep']);

    const starred = (
      await http()
        .get(`/workspaces/${wsId}/prompts/${promptId}/tests?starred=true`)
        .set(auth(token))
        .expect(200)
    ).body as { id: string }[];
    expect(starred.find((t) => t.id === testId)).toBeTruthy();
  });

  it('soft-deletes a test', async () => {
    await http().delete(`/prompt-tests/${testId}`).set(auth(token)).expect(204);
    const list = (
      await http()
        .get(`/workspaces/${wsId}/prompts/${promptId}/tests`)
        .set(auth(token))
        .expect(200)
    ).body as { id: string }[];
    expect(list.find((t) => t.id === testId)).toBeUndefined();
  });

  it('blocks a non-member from running tests', async () => {
    const outsider = await signup('pt-outsider@example.com');
    await http()
      .post(`/workspaces/${wsId}/prompts/${promptId}/tests`)
      .set(auth(outsider))
      .send(body)
      .expect(403);
  });
});
