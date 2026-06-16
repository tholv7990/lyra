import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Phase 2: encrypted workspace keys + manage-keys gating.
describe('Keys (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'c'.repeat(64);
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

  const PLAINTEXT = 'sk-live-abcdef0123456789';
  let ownerToken: string;
  let memberToken: string;
  let teamId: string;
  let memberId: string;

  beforeAll(async () => {
    ownerToken = await signup('k-owner@example.com', 'Owner');
    teamId = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    const invite = (
      await http()
        .post(`/workspaces/${teamId}/invites`)
        .set(auth(ownerToken))
        .send({ email: 'k-member@example.com', role: 'member' })
        .expect(201)
    ).body.token;
    memberToken = await signup('k-member@example.com', 'Member');
    await http().post('/invites/accept').set(auth(memberToken)).send({ token: invite }).expect(200);
    const members = (
      await http().get(`/workspaces/${teamId}/members`).set(auth(ownerToken)).expect(200)
    ).body;
    memberId = members.find((m: { email: string }) => m.email === 'k-member@example.com').userId;
  });

  it('owner sets a key; response exposes only last4, never the secret', async () => {
    const res = await http()
      .put(`/workspaces/${teamId}/keys/openai`)
      .set(auth(ownerToken))
      .send({ key: PLAINTEXT })
      .expect(200);
    expect(res.body.provider).toBe('openai');
    expect(res.body.last4).toBe('6789');
    expect(res.body.encryptedKey).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
  });

  it('lists keys with last4 only (any member can read)', async () => {
    const res = await http()
      .get(`/workspaces/${teamId}/keys`)
      .set(auth(memberToken))
      .expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].last4).toBe('6789');
    expect(JSON.stringify(res.body)).not.toContain(PLAINTEXT);
    expect(JSON.stringify(res.body)).not.toContain('encryptedKey');
  });

  it('blocks a member without canManageKeys from writing', async () => {
    await http()
      .put(`/workspaces/${teamId}/keys/anthropic`)
      .set(auth(memberToken))
      .send({ key: 'sk-ant-xxxx' })
      .expect(403);
  });

  it('allows writing once granted canManageKeys', async () => {
    await http()
      .patch(`/workspaces/${teamId}/members/${memberId}`)
      .set(auth(ownerToken))
      .send({ canManageKeys: true })
      .expect(200);
    await http()
      .put(`/workspaces/${teamId}/keys/anthropic`)
      .set(auth(memberToken))
      .send({ key: 'sk-ant-wxyz' })
      .expect(200);
  });

  it('rejects an unknown provider', async () => {
    await http()
      .put(`/workspaces/${teamId}/keys/bogus`)
      .set(auth(ownerToken))
      .send({ key: 'x' })
      .expect(400);
  });

  it('deletes a key', async () => {
    await http().delete(`/workspaces/${teamId}/keys/openai`).set(auth(ownerToken)).expect(204);
    const res = await http().get(`/workspaces/${teamId}/keys`).set(auth(ownerToken)).expect(200);
    expect(res.body.find((k: { provider: string }) => k.provider === 'openai')).toBeUndefined();
  });
});
