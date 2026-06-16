import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// File attachments (GridFS): upload + download + type gating.
describe('Files (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'e'.repeat(64);
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
  const signup = async (email: string) =>
    (
      await http()
        .post('/auth/signup')
        .send({ email, password: 'password123', name: 'U' })
        .expect(201)
    ).body.accessToken as string;

  let token: string;
  let wsId: string;

  beforeAll(async () => {
    token = await signup('files-owner@example.com');
    wsId = (
      await http().post('/workspaces').set(auth(token)).send({ name: 'Acme' }).expect(201)
    ).body.id;
  });

  it('uploads a file and serves it back', async () => {
    const res = await http()
      .post(`/workspaces/${wsId}/files`)
      .set(auth(token))
      .attach('file', Buffer.from('hello world'), {
        filename: 'note.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(res.body.type).toBe('file');
    expect(res.body.name).toBe('note.txt');
    expect(res.body.mime).toBe('text/plain');
    expect(res.body.size).toBe(11);
    expect(res.body.url).toMatch(/^\/files\/[a-f0-9]{24}$/);

    const dl = await http().get(res.body.url).expect(200);
    expect(dl.headers['content-type']).toContain('text/plain');
    expect(dl.text).toBe('hello world');
  });

  it('classifies an image upload as type "image"', async () => {
    // 1x1 transparent PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await http()
      .post(`/workspaces/${wsId}/files`)
      .set(auth(token))
      .attach('file', png, { filename: 'dot.png', contentType: 'image/png' })
      .expect(201);
    expect(res.body.type).toBe('image');
  });

  it('rejects a disallowed file type', async () => {
    await http()
      .post(`/workspaces/${wsId}/files`)
      .set(auth(token))
      .attach('file', Buffer.from('MZ'), {
        filename: 'evil.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('blocks a non-member from uploading', async () => {
    const outsider = await signup('files-outsider@example.com');
    await http()
      .post(`/workspaces/${wsId}/files`)
      .set(auth(outsider))
      .attach('file', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' })
      .expect(403);
  });

  it('404s an unknown file id', async () => {
    await http().get('/files/0123456789abcdef01234567').expect(404);
  });
});
