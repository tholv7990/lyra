import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// End-to-end check of the Phase 0 Definition of Done: signup persists a user
// and returns a token + rt cookie, invalid bodies are rejected, refresh
// rotates, /auth/me is gated, and no secret ever appears in a response.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    // Single-node replica set so the transactional signup works in tests.
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ACCESS_TOKEN_TTL = '15m';
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

  const creds = { email: 'ann@example.com', password: 'password123', name: 'Ann' };

  it('rejects an invalid signup body (short password)', async () => {
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ email: 'bad@example.com', password: 'short', name: 'B' })
      .expect(400);
  });

  it('signs up: returns accessToken + safe user, sets rt cookie, leaks no hash', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/signup')
      .send(creds)
      .expect(201);

    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.user.email).toBe(creds.email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain(creds.password);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.join()).toMatch(/rt=/);
    expect(cookies.join()).toMatch(/HttpOnly/i);
  });

  it('rejects a duplicate signup', async () => {
    await request(app.getHttpServer()).post('/auth/signup').send(creds).expect(409);
  });

  it('blocks /auth/me without a token and allows it with a Bearer token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);

    expect(me.body.user.email).toBe(creds.email);
    expect(me.body.user.passwordHash).toBeUndefined();
  });

  it('rejects login with a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: 'wrong-password' })
      .expect(401);
  });

  it('refresh rotates the cookie; the old refresh cookie then fails', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);

    const oldCookie = login.headers['set-cookie'];

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(200);

    expect(refreshed.body.accessToken).toBeTruthy();
    const newCookie = refreshed.headers['set-cookie'];
    expect(newCookie).toBeDefined();

    // The rotated-away (old) cookie must no longer be accepted.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', oldCookie)
      .expect(401);

    // The fresh cookie still works.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', newCookie)
      .expect(200);
  });

  it('logout invalidates the refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: creds.email, password: creds.password })
      .expect(200);
    const cookie = login.headers['set-cookie'];

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookie)
      .expect(401);
  });
});
