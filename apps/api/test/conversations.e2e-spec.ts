import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AnthropicClient } from '../src/runs/providers/anthropic.client';
import { OpenAiCompatClient } from '../src/runs/providers/openai-compat.client';
import { UsersService } from '../src/users/users.service';

// Chats: create a conversation, stream a multi-turn reply (auto-persisted),
// rename/star, ownership isolation. The provider clients are stubbed so tests
// are hermetic (no network/spend).
describe('Conversations (e2e)', () => {
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
        complete: async () => ({ text: 'ok', usage: { tokens: 3 } }),
        stream: async (_params: unknown, onDelta: (t: string) => void) => {
          onDelta('Hello ');
          onDelta('world');
          return { text: 'Hello world', usage: { tokens: 7 } };
        },
      })
      .overrideProvider(OpenAiCompatClient)
      .useValue({
        complete: async () => ({ text: 'ds ok', usage: { tokens: 3 } }),
        stream: async (_params: unknown, onDelta: (t: string) => void) => {
          onDelta('Deep Seek');
          return { text: 'Deep Seek', usage: { tokens: 4 } };
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
  let otherToken: string;
  let wsId: string;

  beforeAll(async () => {
    ownerToken = await signup('chat-owner@example.com', 'Owner');
    otherToken = await signup('chat-other@example.com', 'Other');
    // Personal workspace created at signup — use it directly.
    wsId = (
      await http().get('/workspaces').set(auth(ownerToken)).expect(200)
    ).body[0].id as string;
    // The owner can manage keys on their own workspace — add an Anthropic key.
    await http()
      .put(`/workspaces/${wsId}/keys/anthropic`)
      .set(auth(ownerToken))
      .send({ key: 'sk-test-key' })
      .expect(200);
  });

  let convoId: string;

  it('creates an empty chat with the audit envelope', async () => {
    const res = await http()
      .post(`/workspaces/${wsId}/conversations`)
      .set(auth(ownerToken))
      .send({ provider: 'anthropic', model: 'claude-test' })
      .expect(201);
    expect(res.body.title).toBe('New chat');
    expect(res.body.messages).toEqual([]);
    expect(res.body.createdBy.name).toBe('Owner');
    convoId = res.body.id;
  });

  it('streams a reply and auto-persists both turns + derives a title', async () => {
    const res = await http()
      .post(`/conversations/${convoId}/messages`)
      .set(auth(ownerToken))
      .send({ provider: 'anthropic', model: 'claude-test', content: 'Say hello to the world' })
      .expect(200);
    expect(res.text).toContain('"type":"delta"');
    expect(res.text).toContain('"type":"done"');

    const convo = (
      await http().get(`/conversations/${convoId}`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(convo.messages).toHaveLength(2);
    expect(convo.messages[0]).toMatchObject({ role: 'user', content: 'Say hello to the world' });
    expect(convo.messages[1]).toMatchObject({ role: 'assistant', content: 'Hello world' });
    expect(convo.messages[1].provider).toBe('anthropic');
    expect(convo.title).toBe('Say hello to the world');
  });

  it('lists the chat in the sidebar with a message count', async () => {
    const list = (
      await http().get(`/workspaces/${wsId}/conversations`).set(auth(ownerToken)).expect(200)
    ).body as { id: string; messageCount: number }[];
    const mine = list.find((c) => c.id === convoId);
    expect(mine).toBeDefined();
    expect(mine!.messageCount).toBe(2);
  });

  it('renames and stars the chat', async () => {
    const res = await http()
      .patch(`/conversations/${convoId}`)
      .set(auth(ownerToken))
      .send({ title: 'Greetings', starred: true })
      .expect(200);
    expect(res.body.title).toBe('Greetings');
    expect(res.body.starred).toBe(true);
  });

  it("hides a chat from other users (not the creator)", async () => {
    await http().get(`/conversations/${convoId}`).set(auth(otherToken)).expect(403);
    const list = (
      await http().get(`/workspaces/${wsId}/conversations`).set(auth(otherToken)).expect(403)
    ).body;
    expect(list).toBeDefined();
  });

  it('soft-deletes the chat', async () => {
    await http().delete(`/conversations/${convoId}`).set(auth(ownerToken)).expect(204);
    await http().get(`/conversations/${convoId}`).set(auth(ownerToken)).expect(404);
  });
});
