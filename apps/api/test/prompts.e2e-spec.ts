import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// Prompt library: draft (creator-only) vs public (all members), creator-only
// edit/delete, soft delete + cascade, media attachments.
describe('Prompts (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryReplSet;

  beforeAll(async () => {
    mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    process.env.MONGODB_URI = mongod.getUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
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
  const newPrompt = (over: Record<string, unknown> = {}) => ({
    title: 'Hero shot',
    content: 'A clean studio render of {product}',
    ...over,
  });

  let ownerToken: string;
  let memberToken: string;
  let teamId: string;
  let ownerDraftId: string;
  let ownerPublicId: string;

  beforeAll(async () => {
    ownerToken = await signup('pr-owner@example.com', 'Owner');
    teamId = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Acme' }).expect(201)
    ).body.id;
    const invite = (
      await http()
        .post(`/workspaces/${teamId}/invites`)
        .set(auth(ownerToken))
        .send({ email: 'pr-member@example.com', role: 'member' })
        .expect(201)
    ).body.token;
    memberToken = await signup('pr-member@example.com', 'Member');
    await http().post('/invites/accept').set(auth(memberToken)).send({ token: invite }).expect(200);
  });

  it('creates a prompt that defaults to draft, with audit envelope + media', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(
        newPrompt({
          title: 'Owner Draft',
          media: [{ type: 'image', url: 'https://cdn/x.png', name: 'ref' }],
        }),
      )
      .expect(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.active).toBe(true);
    expect(res.body.media).toHaveLength(1);
    expect(res.body.media[0]).toMatchObject({ type: 'image', url: 'https://cdn/x.png', name: 'ref' });
    // audit envelope expanded to { id, name }
    expect(res.body.createdBy.name).toBe('Owner');
    expect(res.body.createdBy.id).toBeTruthy();
    expect(res.body.updatedBy.name).toBe('Owner');
    ownerDraftId = res.body.id;
  });

  it('rejects an invalid media type (nested validation)', async () => {
    await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(newPrompt({ media: [{ type: 'hologram', url: 'https://cdn/x.png' }] }))
      .expect(400);
  });

  it('hides a draft from other members (list + read)', async () => {
    const list = await http()
      .get(`/workspaces/${teamId}/prompts`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.items.find((p: { id: string }) => p.id === ownerDraftId)).toBeUndefined();
    await http().get(`/prompts/${ownerDraftId}`).set(auth(memberToken)).expect(403);
  });

  it('blocks a non-creator from editing or deleting', async () => {
    await http()
      .patch(`/prompts/${ownerDraftId}`)
      .set(auth(memberToken))
      .send({ title: 'Hacked' })
      .expect(403);
    await http().delete(`/prompts/${ownerDraftId}`).set(auth(memberToken)).expect(403);
  });

  it('publishing a draft exposes it to all members', async () => {
    const res = await http()
      .patch(`/prompts/${ownerDraftId}`)
      .set(auth(ownerToken))
      .send({ status: 'public' })
      .expect(200);
    expect(res.body.status).toBe('public');
    ownerPublicId = ownerDraftId;
    // now visible + readable by the member
    await http().get(`/prompts/${ownerPublicId}`).set(auth(memberToken)).expect(200);
    const list = await http()
      .get(`/workspaces/${teamId}/prompts`)
      .set(auth(memberToken))
      .expect(200);
    expect(list.body.items.find((p: { id: string }) => p.id === ownerPublicId)).toBeDefined();
  });

  it('paginates and filters by status, tag, and name', async () => {
    await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(newPrompt({ title: 'Filter Target', status: 'public', tags: ['filterme'] }))
      .expect(201);

    // by tag
    const byTag = (
      await http().get(`/workspaces/${teamId}/prompts?tag=filterme`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(byTag.items.length).toBe(1);
    expect(byTag.items[0].title).toBe('Filter Target');
    expect(byTag.total).toBe(1);

    // by name (case-insensitive substring)
    const byName = (
      await http().get(`/workspaces/${teamId}/prompts?q=filter`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(byName.items.find((p: { title: string }) => p.title === 'Filter Target')).toBeTruthy();

    // by status
    const drafts = (
      await http().get(`/workspaces/${teamId}/prompts?status=draft`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(drafts.items.every((p: { status: string }) => p.status === 'draft')).toBe(true);

    // pagination shape + limit honored
    const paged = (
      await http().get(`/workspaces/${teamId}/prompts?limit=1&page=1`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(paged.items.length).toBe(1);
    expect(paged.limit).toBe(1);
    expect(paged.total).toBeGreaterThan(1);
  });

  it('lets the creator soft-delete their prompt', async () => {
    const created = (
      await http()
        .post(`/workspaces/${teamId}/prompts`)
        .set(auth(memberToken))
        .send(newPrompt({ title: 'Doomed', status: 'public' }))
        .expect(201)
    ).body;
    await http().delete(`/prompts/${created.id}`).set(auth(memberToken)).expect(204);
    await http().get(`/prompts/${created.id}`).set(auth(memberToken)).expect(404);
    const list = (
      await http().get(`/workspaces/${teamId}/prompts`).set(auth(ownerToken)).expect(200)
    ).body;
    expect(list.items.find((p: { id: string }) => p.id === created.id)).toBeUndefined();
  });

  it('normalizes + dedupes tags on create (case-insensitive, trimmed)', async () => {
    const res = await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(
        newPrompt({
          title: 'Tagged',
          status: 'public',
          tags: ['Hero', 'hero', ' Summer Sale ', 'summer sale'],
        }),
      )
      .expect(201);
    expect(res.body.tags).toEqual(['Hero', 'Summer Sale']);
  });

  it('exposes the tag vocabulary scoped to what the member can see', async () => {
    // a public tag the member should see, and a draft-only tag they should not
    await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(newPrompt({ title: 'Pub', status: 'public', tags: ['public-tag'] }))
      .expect(201);
    await http()
      .post(`/workspaces/${teamId}/prompts`)
      .set(auth(ownerToken))
      .send(newPrompt({ title: 'Secret', status: 'draft', tags: ['secret-tag'] }))
      .expect(201);

    const vocab = (
      await http().get(`/workspaces/${teamId}/prompts/tags`).set(auth(memberToken)).expect(200)
    ).body as { value: string; count: number }[];
    const values = vocab.map((t) => t.value);
    expect(values).toContain('public-tag');
    expect(values).not.toContain('secret-tag');
  });

  it('updates tags (deduped) on a prompt', async () => {
    const created = (
      await http()
        .post(`/workspaces/${teamId}/prompts`)
        .set(auth(ownerToken))
        .send(newPrompt({ title: 'Retag', status: 'public', tags: ['a'] }))
        .expect(201)
    ).body;
    const updated = (
      await http()
        .patch(`/prompts/${created.id}`)
        .set(auth(ownerToken))
        .send({ tags: ['b', 'B', 'c'] })
        .expect(200)
    ).body;
    expect(updated.tags).toEqual(['b', 'c']);
  });

  it('cascades soft delete from a workspace to its prompts', async () => {
    const tempWs = (
      await http().post('/workspaces').set(auth(ownerToken)).send({ name: 'Temp' }).expect(201)
    ).body.id;
    const prompt = (
      await http()
        .post(`/workspaces/${tempWs}/prompts`)
        .set(auth(ownerToken))
        .send(newPrompt({ title: 'WS-bound', status: 'public' }))
        .expect(201)
    ).body;
    await http().delete(`/workspaces/${tempWs}`).set(auth(ownerToken)).expect(204);
    await http().get(`/prompts/${prompt.id}`).set(auth(ownerToken)).expect(404);
  });
});
