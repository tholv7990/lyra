import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../src/runs/providers/openai-compat.client';

// Provider model catalog: fetch live models with the saved key and serve the
// effective (refreshed-or-default) catalog. The provider clients' listModels are
// stubbed so tests are hermetic (no network/key spend).
describe('Models (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    process.env.NODE_ENV = 'test';

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AnthropicClient)
      .useValue({
        listModels: async () => [
          { id: 'claude-next-1', label: 'Claude Next 1' },
          { id: 'claude-next-2', label: 'Claude Next 2' },
        ],
      })
      .overrideProvider(OpenAiCompatClient)
      .useValue({
        // GET /models returns ids; the service keeps text chat models, drops
        // embeddings/tts/image, then sorts.
        listModels: async () => [
          'gpt-5.5',
          'text-embedding-3',
          'gpt-4o-mini',
          'gpt-4o-mini-tts',
          'o3-mini',
          'dall-e-3',
        ],
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
  const signup = async (email: string, name: string) =>
    (
      await http()
        .post('/auth/signup')
        .send({ email, password: 'password123', name })
        .expect(201)
    ).body.accessToken as string;

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let wsId: string;

  beforeAll(async () => {
    ownerToken = await signup('md-owner@example.com', 'Owner');
    wsId = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Acme' }).expect(201)
    ).body.id;

    const invite = (
      await http()
        .post(`/workspaces/${wsId}/invites`)
        .set(auth(ownerToken))
        .send({ email: 'md-member@example.com', role: 'member' })
        .expect(201)
    ).body.token;
    memberToken = await signup('md-member@example.com', 'Member');
    await http().post('/invites/accept').set(auth(memberToken)).send({ token: invite }).expect(200);

    outsiderToken = await signup('md-outsider@example.com', 'Out');
  });

  it('serves the built-in catalog before any refresh', async () => {
    const cat = (
      await http().get(`/workspaces/${wsId}/models`).set(auth(ownerToken)).expect(200)
    ).body as Record<string, { id: string }[]>;
    // Defaults from MODEL_CATALOG (real Anthropic ids).
    expect(cat.anthropic.some((m) => m.id === 'claude-opus-4-8')).toBe(true);
  });

  it('rejects refresh before the provider key is set', async () => {
    await http()
      .post(`/workspaces/${wsId}/keys/anthropic/models`)
      .set(auth(ownerToken))
      .expect(400);
  });

  it('refreshes models from the provider once the key is set', async () => {
    await http()
      .put(`/workspaces/${wsId}/keys/anthropic`)
      .set(auth(ownerToken))
      .send({ key: 'sk-test' })
      .expect(200);

    const models = (
      await http()
        .post(`/workspaces/${wsId}/keys/anthropic/models`)
        .set(auth(ownerToken))
        .expect(201)
    ).body as { id: string; label: string }[];
    expect(models).toEqual([
      { id: 'claude-next-1', label: 'Claude Next 1' },
      { id: 'claude-next-2', label: 'Claude Next 2' },
    ]);
  });

  it('serves the refreshed catalog afterwards', async () => {
    const cat = (
      await http().get(`/workspaces/${wsId}/models`).set(auth(ownerToken)).expect(200)
    ).body as Record<string, { id: string }[]>;
    expect(cat.anthropic.map((m) => m.id)).toEqual(['claude-next-1', 'claude-next-2']);
  });

  it('filters OpenAI listing to chat models and sorts them', async () => {
    await http()
      .put(`/workspaces/${wsId}/keys/openai`)
      .set(auth(ownerToken))
      .send({ key: 'sk-oa' })
      .expect(200);
    const models = (
      await http()
        .post(`/workspaces/${wsId}/keys/openai/models`)
        .set(auth(ownerToken))
        .expect(201)
    ).body as { id: string }[];
    // embeddings/tts/image dropped; text chat models kept and sorted.
    expect(models.map((m) => m.id)).toEqual(['gpt-4o-mini', 'gpt-5.5', 'o3-mini']);
  });

  it('rejects model listing for image/video providers', async () => {
    await http()
      .put(`/workspaces/${wsId}/keys/image`)
      .set(auth(ownerToken))
      .send({ key: 'sk-img' })
      .expect(200);
    await http()
      .post(`/workspaces/${wsId}/keys/image/models`)
      .set(auth(ownerToken))
      .expect(400);
  });

  it('lets any member read the catalog but blocks refresh without manage-keys', async () => {
    await http().get(`/workspaces/${wsId}/models`).set(auth(memberToken)).expect(200);
    await http()
      .post(`/workspaces/${wsId}/keys/anthropic/models`)
      .set(auth(memberToken))
      .expect(403);
  });

  it('blocks a non-member entirely', async () => {
    await http().get(`/workspaces/${wsId}/models`).set(auth(outsiderToken)).expect(403);
  });
});
