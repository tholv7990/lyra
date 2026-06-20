import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../src/runs/providers/openai-compat.client';
import { WorkspacesService } from '../src/workspaces/workspaces.service';
import { UsersService } from '../src/users/users.service';

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
        // Curated to the latest model per tier (opus/sonnet/haiku).
        listModels: async () => [
          { id: 'claude-opus-4-5', label: 'Claude Opus 4.5' },
          { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
          { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
          { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
        ],
      })
      .overrideProvider(OpenAiCompatClient)
      .useValue({
        // Curated to the newest GPT family + newest reasoning model.
        listModels: async () => [
          'gpt-4o',
          'gpt-5',
          'gpt-5.5',
          'gpt-5.5-pro',
          'gpt-5.5-2026-04-23',
          'gpt-5.5-codex',
          'o3-mini',
          'o4-mini',
          'text-embedding-3',
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
  let outsiderToken: string;
  let wsId: string;

  beforeAll(async () => {
    ownerToken = await signup('md-owner@example.com', 'Owner');
    // Get the personal workspace and upgrade it to a team so invites work.
    const workspaces = await http().get('/workspaces').set(auth(ownerToken)).expect(200);
    wsId = workspaces.body[0].id as string;
    const me = (await http().get('/auth/me').set(auth(ownerToken)).expect(200)).body.user;
    await app.get(WorkspacesService).upgradeToTeam(wsId, me.id);

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
    // Only the latest per tier; older opus dropped.
    expect(models.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('serves the refreshed catalog afterwards', async () => {
    const cat = (
      await http().get(`/workspaces/${wsId}/models`).set(auth(ownerToken)).expect(200)
    ).body as Record<string, { id: string }[]>;
    expect(cat.anthropic.map((m) => m.id)).toEqual([
      'claude-opus-4-8',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ]);
  });

  it('curates OpenAI to the newest GPT family + newest reasoning model', async () => {
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
    // gpt-4o/gpt-5 (older), dated snapshot, codex, embeddings/image all dropped.
    expect(models.map((m) => m.id)).toEqual(['gpt-5.5', 'gpt-5.5-pro', 'o4-mini']);
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
