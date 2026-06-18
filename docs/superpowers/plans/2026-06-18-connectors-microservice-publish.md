# Connectors Microservice — Publish v2 (self-hosted Postiz) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a publish module to `apps/connectors-service` that lists channels, uploads media, and posts to social platforms via a **self-hosted Postiz** instance — making the shipped Publish/Connections UI work for real (replacing the proxy's mock for `channels`/`publish`/`jobs`), with the Postiz API key stored per-workspace and encrypted in the api.

**Architecture:** The `connectors-service` (:9100) gains a `publish/` module that calls Postiz's public API (`GET /public/v1/integrations`, `POST /upload`, `POST /posts`). The Lyra api stores the workspace's Postiz key (new `ConnectorCredential` AES-256-GCM store), decrypts it per request, and forwards it to the service as `X-Connector-Key`; the service is the only tier that talks to Postiz. Publish runs as an async job (publish → poll `jobs/:id` → receipts), backed by an in-memory job store mirroring download's `FileStore`. Channel connect/remove happens in the Postiz web UI (its public API can't); Lyra links out and lists read-only.

**Tech Stack:** NestJS 11 + Express, TypeScript, `@lyra/shared` (`Channel`/`Receipt`/`PublishJob`/`ConnectorCredentialInfo`), Node 20 globals (`fetch`/`FormData`/`Blob`), Mongoose (the credential store), Jest (mock the Postiz client — no network in unit tests).

## Global Constraints

- **Commits DEFERRED** — each task ends with `git add` (stage) + verification; do **not** `git commit`. The final task runs the full gate. (User commits when they ask.)
- **`@lyra/shared` is the single source of truth** — `Channel`, `Receipt`, `PublishJob`, `PublishDto`, and the new `ConnectorCredentialInfo` come from shared; never redefine them in an app.
- **Secrets server-side only.** The Postiz key is per-workspace, **AES-256-GCM** at rest (reuse `EncryptionService`), never returned in full (only `last4`), never an env var. It reaches the service as a transient `X-Connector-Key` header.
- **The service is not browser-facing** — only Lyra calls it, gated by `ServiceTokenGuard` (`Authorization: Bearer ${CONNECTORS_SERVICE_TOKEN}`). Postiz runs **unmodified behind its API** (AGPL boundary).
- **SSRF guard:** every fetched media URL passes the existing `assertSafeUrl` before the service fetches it.
- **Mock mode preserved:** with `CONNECTORS_SERVICE_URL` unset the api returns the existing deterministic mock and never calls the service or requires a key.
- **Partial-failure tolerant:** one channel failing must not fail the others — post per-channel, collect a `Receipt` (ok/failed) for each.
- **Postiz field names are verified at implementation.** The public docs don't fully expose the `integrations`/`posts` JSON shapes; the mappers read **defensively** and get pinned against the live instance during the Task 10 e2e. The plan's assumed shapes are marked `// VERIFY`.
- Full gate: `pnpm turbo run type-check lint test build`.

## File structure

**New — `apps/connectors-service/src/publish/`:**
- `postiz.client.ts` — Postiz public-API `fetch` wrapper (`listIntegrations`/`uploadMedia`/`createPost`) + **pure mappers** (`mapIntegrations`, `okReceipt`, `failReceipt`).
- `job-store.ts` — in-memory `JobStore` (create/update/get/sweep, TTL) for async publish.
- `publish.service.ts` — orchestration: resolve channels → upload media → post per channel → receipts.
- `publish.controller.ts` — `GET /channels`, `POST /publish`, `GET /jobs/:id`, `GET /connect-link`; reads `X-Connector-Key`.
- `dto.ts` — `PublishBody implements PublishDto`.
- `publish.module.ts` — wires the above; registered in `app.module.ts`.
- Tests: `*.spec.ts` beside each logic unit.

**New — `apps/api/src/connectors/`:**
- `connector-credential.schema.ts` — Mongoose schema (workspace-scoped, encrypted, audited).
- `connector-credential.views.ts` — pure `toConnectorCredentialInfo`.
- `connector-credentials.service.ts` — `upsert`/`status`/`getDecrypted`.

**Modify:**
- `packages/shared/src/models/index.ts` — add `ConnectorCredentialInfo`.
- `apps/api/src/connectors/{connectors.controller.ts,connectors.proxy.ts,connectors.module.ts}` — real credentials routes, key forwarding, drop DELETE channels.
- `apps/web/src/pages/Connections.tsx`, `apps/web/src/lib/connectors.ts`, `apps/web/src/i18n/locales/{en,vi}/connectors.ts`, `apps/web/src/pages/connectors.css`.
- `docker-compose.yml`, `apps/connectors-service/.env.example`.

---

### Task 1: connectors-service — Postiz client + pure mappers

**Files:** create `apps/connectors-service/src/publish/postiz.client.ts`, `publish/postiz.client.spec.ts`.

**Interfaces:**
- Produces: `mapIntegrations(json: unknown): Channel[]`; `okReceipt(ch: Channel, json: unknown): Receipt`; `failReceipt(ch: Channel, error: string): Receipt`; `listIntegrations(base, key): Promise<unknown>`; `uploadMedia(base, key, bytes, filename, mime): Promise<UploadResult>`; `createPost(base, key, integrationId, content, media): Promise<unknown>`; `interface UploadResult { id: string; path: string }`.

- [ ] **Step 1: Write the failing test** — `publish/postiz.client.spec.ts`:

```ts
import { mapIntegrations, okReceipt, failReceipt } from './postiz.client';

describe('mapIntegrations', () => {
  it('maps integrations to channels (identifier → platform, lowercased)', () => {
    const out = mapIntegrations([{ id: 'i1', name: '@me.bsky', identifier: 'Bluesky' }]);
    expect(out).toEqual([{ id: 'i1', platform: 'bluesky', displayName: '@me.bsky' }]);
  });
  it('tolerates a wrapped { integrations: [] }, missing fields, and null', () => {
    expect(mapIntegrations({ integrations: [{ id: 'x' }] })).toEqual([
      { id: 'x', platform: 'unknown', displayName: 'x' },
    ]);
    expect(mapIntegrations(null)).toEqual([]);
  });
});

describe('receipts', () => {
  const ch = { id: 'i1', platform: 'bluesky', displayName: '@me' };
  it('okReceipt pulls postId/url defensively (flat or nested posts[])', () => {
    expect(okReceipt(ch, { id: 'p1', url: 'https://bsky.app/p/1' })).toEqual({
      platform: 'bluesky', accountId: 'i1', status: 'ok', postId: 'p1', url: 'https://bsky.app/p/1',
    });
    expect(okReceipt(ch, { posts: [{ id: 'p2', url: 'u2' }] })).toMatchObject({ postId: 'p2', url: 'u2' });
  });
  it('failReceipt records a trimmed error', () => {
    expect(failReceipt(ch, 'boom')).toEqual({
      platform: 'bluesky', accountId: 'i1', status: 'failed', error: 'boom',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/connectors-service test -- postiz.client`
Expected: FAIL ("Cannot find module './postiz.client'").

- [ ] **Step 3: Write minimal implementation** — `publish/postiz.client.ts`:

```ts
import type { Channel, Receipt } from '@lyra/shared';

// Postiz public API client. base = POSTIZ_API_URL (self-hosted instance root);
// auth = the workspace's Postiz API key, sent verbatim in Authorization.
// VERIFY: integration/post JSON field names are confirmed against the live
// instance during the e2e (Task 10); the mappers read defensively.

export interface RawIntegration {
  id: string;
  name?: string;
  identifier?: string; // platform, e.g. 'bluesky' | 'mastodon' | 'tiktok'
  provider?: string;
  disabled?: boolean;
}

export interface UploadResult { id: string; path: string }

const v1 = (base: string) => `${base.replace(/\/+$/, '')}/public/v1`;

// --- pure mappers (unit-tested) ---

export function mapIntegrations(json: unknown): Channel[] {
  const arr = Array.isArray(json)
    ? json
    : ((json as { integrations?: unknown[] } | null)?.integrations ?? []);
  return (arr as RawIntegration[]).map((i) => ({
    id: i.id,
    platform: (i.identifier ?? i.provider ?? 'unknown').toLowerCase(),
    displayName: i.name ?? i.id,
  }));
}

export function okReceipt(ch: Channel, json: unknown): Receipt {
  const r = (json ?? {}) as {
    id?: string; postId?: string; url?: string; releaseURL?: string;
    posts?: { url?: string; id?: string }[];
  };
  const first = r.posts?.[0];
  return {
    platform: ch.platform,
    accountId: ch.id,
    status: 'ok',
    postId: r.postId ?? r.id ?? first?.id,
    url: r.url ?? r.releaseURL ?? first?.url,
  };
}

export function failReceipt(ch: Channel, error: string): Receipt {
  return { platform: ch.platform, accountId: ch.id, status: 'failed', error: error.slice(0, 300) };
}

// --- network functions (integration; not unit-tested, like runYtDlp) ---

export async function listIntegrations(base: string, key: string): Promise<unknown> {
  const res = await fetch(`${v1(base)}/integrations`, { headers: { Authorization: key } });
  if (!res.ok) throw new Error(`Postiz integrations ${res.status}`);
  return res.json();
}

export async function uploadMedia(
  base: string, key: string, bytes: Uint8Array, filename: string, mime: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), filename);
  const res = await fetch(`${v1(base)}/upload`, { method: 'POST', headers: { Authorization: key }, body: form });
  if (!res.ok) throw new Error(`Postiz upload ${res.status}`);
  return (await res.json()) as UploadResult;
}

export async function createPost(
  base: string, key: string, integrationId: string, content: string, media: UploadResult[],
): Promise<unknown> {
  const value = [{ content, ...(media.length ? { image: media } : {}) }];
  const body = { type: 'now', posts: [{ integration: { id: integrationId }, value }] };
  const res = await fetch(`${v1(base)}/posts`, {
    method: 'POST',
    headers: { Authorization: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Postiz post ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/connectors-service test -- postiz.client`
Expected: PASS (5 assertions across 3 tests).

- [ ] **Step 5: Stage**

```bash
git add apps/connectors-service/src/publish/postiz.client.ts apps/connectors-service/src/publish/postiz.client.spec.ts
```

---

### Task 2: connectors-service — JobStore (in-memory async-publish jobs)

**Files:** create `apps/connectors-service/src/publish/job-store.ts`, `publish/job-store.spec.ts`.

**Interfaces:**
- Produces: `JobStore` with `create(now?): string`, `update(id, { status, receipts? }): void`, `get(id): PublishJob | null`, `sweep(now?): void`.

- [ ] **Step 1: Write the failing test** — `publish/job-store.spec.ts`:

```ts
import { JobStore } from './job-store';

describe('JobStore', () => {
  it('create → a queued job retrievable by id', () => {
    const s = new JobStore(1000);
    const id = s.create();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.get(id)).toEqual({ jobId: id, status: 'queued', receipts: undefined });
    expect(s.get('nope')).toBeNull();
  });
  it('update sets status + receipts', () => {
    const s = new JobStore(1000);
    const id = s.create();
    s.update(id, { status: 'done', receipts: [{ platform: 'bluesky', accountId: 'i1', status: 'ok' }] });
    expect(s.get(id)).toMatchObject({ status: 'done', receipts: [{ status: 'ok' }] });
  });
  it('sweep drops jobs past TTL, keeps fresh ones', () => {
    const s = new JobStore(1000);
    const id = s.create(0);
    s.sweep(500); expect(s.get(id)).not.toBeNull();
    s.sweep(2000); expect(s.get(id)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/connectors-service test -- job-store`
Expected: FAIL ("Cannot find module './job-store'").

- [ ] **Step 3: Write minimal implementation** — `publish/job-store.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { PublishJob, Receipt } from '@lyra/shared';

interface Entry { status: PublishJob['status']; receipts?: Receipt[]; created: number }

// In-memory publish-job map with TTL sweeping (status + receipts; no files).
// Mirrors download's FileStore. Jobs are ephemeral — lost on restart (fine for v2).
export class JobStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  create(now: number = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { status: 'queued', created: now });
    return id;
  }

  update(id: string, patch: { status: PublishJob['status']; receipts?: Receipt[] }): void {
    const e = this.map.get(id);
    if (e) this.map.set(id, { ...e, ...patch });
  }

  get(id: string): PublishJob | null {
    const e = this.map.get(id);
    return e ? { jobId: id, status: e.status, receipts: e.receipts } : null;
  }

  sweep(now: number = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) this.map.delete(id);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/connectors-service test -- job-store`
Expected: PASS (3 tests).

- [ ] **Step 5: Stage**

```bash
git add apps/connectors-service/src/publish/job-store.ts apps/connectors-service/src/publish/job-store.spec.ts
```

---

### Task 3: connectors-service — PublishService (orchestration + partial failure)

**Files:** create `apps/connectors-service/src/publish/publish.service.ts`, `publish/publish.service.spec.ts`.

**Interfaces:**
- Consumes: `postiz.client` (T1), `JobStore` (T2), `assertSafeUrl` (existing `common/url.ts`).
- Produces: `PublishService` with `channels(key): Promise<Channel[]>`, `publish(key, input): { jobId; status }`, `job(id): PublishJob | null`, `connectUrl(): { url }`, `runPublish(jobId, key, input): Promise<void>`. `input = { channelIds: string[]; caption: string; mediaUrls: string[] }`.

- [ ] **Step 1: Write the failing test** — `publish/publish.service.spec.ts`:

```ts
import { PublishService } from './publish.service';
import * as postiz from './postiz.client';

function svc() {
  return new PublishService({
    get: (k: string) =>
      k === 'POSTIZ_API_URL' ? 'http://postiz:5000'
      : k === 'POSTIZ_PUBLIC_URL' ? 'http://localhost:5000'
      : '900000',
  } as never);
}

const RAW = [
  { id: 'i1', name: '@a', identifier: 'bluesky' },
  { id: 'i2', name: '@b', identifier: 'mastodon' },
];

describe('PublishService', () => {
  beforeEach(() => {
    jest.spyOn(postiz, 'listIntegrations').mockResolvedValue(RAW); // real mapIntegrations runs
  });
  afterEach(() => jest.restoreAllMocks());

  it('connectUrl returns the Postiz public URL', () => {
    expect(svc().connectUrl()).toEqual({ url: 'http://localhost:5000' });
  });

  it('posts per channel; partial failure tolerated; job → done', async () => {
    jest.spyOn(postiz, 'createPost').mockImplementation((_b, _k, id) =>
      id === 'i2'
        ? Promise.reject(new Error('dead token'))
        : Promise.resolve({ id: 'p1', url: 'u1' }),
    );
    const s = svc();
    const { jobId, status } = s.publish('key', { channelIds: ['i1', 'i2'], caption: 'hi', mediaUrls: [] });
    expect(status).toBe('queued');
    // wait for the background runPublish to settle
    for (let i = 0; i < 100 && !['done', 'failed'].includes(s.job(jobId)!.status); i++) {
      await new Promise((r) => setImmediate(r));
    }
    expect(s.job(jobId)).toEqual({
      jobId,
      status: 'done',
      receipts: [
        { platform: 'bluesky', accountId: 'i1', status: 'ok', postId: 'p1', url: 'u1' },
        { platform: 'mastodon', accountId: 'i2', status: 'failed', error: 'dead token' },
      ],
    });
  });

  it('rejects an unsafe media URL (SSRF) before posting', async () => {
    await expect(
      svc().runPublish('j', 'key', { channelIds: ['i1'], caption: 'x', mediaUrls: ['http://169.254.169.254/'] }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/connectors-service test -- publish.service`
Expected: FAIL ("Cannot find module './publish.service'").

- [ ] **Step 3: Write minimal implementation** — `publish/publish.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Channel, PublishJob, Receipt } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { JobStore } from './job-store';
import * as postiz from './postiz.client';

interface PublishInput { channelIds: string[]; caption: string; mediaUrls: string[] }

@Injectable()
export class PublishService {
  private readonly store: JobStore;
  private readonly base: string;
  private readonly publicUrl: string;

  constructor(config: ConfigService) {
    this.store = new JobStore(Number(config.get('JOB_TTL_MS') ?? 900_000));
    this.base = config.get<string>('POSTIZ_API_URL') ?? '';
    this.publicUrl = config.get<string>('POSTIZ_PUBLIC_URL') ?? '';
    setInterval(() => this.store.sweep(), 60_000).unref();
  }

  connectUrl(): { url: string } {
    return { url: this.publicUrl || '#postiz' };
  }

  async channels(key: string): Promise<Channel[]> {
    return postiz.mapIntegrations(await postiz.listIntegrations(this.base, key));
  }

  publish(key: string, input: PublishInput): { jobId: string; status: PublishJob['status'] } {
    const jobId = this.store.create();
    void this.runPublish(jobId, key, input).catch(() =>
      this.store.update(jobId, { status: 'failed', receipts: [] }),
    );
    return { jobId, status: 'queued' };
  }

  job(id: string): PublishJob | null {
    return this.store.get(id);
  }

  // Resolve channels → upload media once → post per channel (partial-failure
  // tolerant) → receipts. Exposed for unit tests; runs in the background from publish().
  async runPublish(jobId: string, key: string, input: PublishInput): Promise<void> {
    this.store.update(jobId, { status: 'running' });
    const all = await this.channels(key);
    const targets = input.channelIds
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is Channel => !!c);

    const media: postiz.UploadResult[] = [];
    for (const url of input.mediaUrls) {
      assertSafeUrl(url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`media fetch ${res.status}`);
      const mime = res.headers.get('content-type') ?? 'application/octet-stream';
      const bytes = new Uint8Array(await res.arrayBuffer());
      media.push(await postiz.uploadMedia(this.base, key, bytes, filenameFromUrl(url), mime));
    }

    const receipts: Receipt[] = [];
    for (const ch of targets) {
      try {
        const json = await postiz.createPost(this.base, key, ch.id, input.caption, media);
        receipts.push(postiz.okReceipt(ch, json));
      } catch (e) {
        receipts.push(postiz.failReceipt(ch, e instanceof Error ? e.message : 'post failed'));
      }
    }
    this.store.update(jobId, { status: 'done', receipts });
  }
}

function filenameFromUrl(url: string): string {
  try {
    return new URL(url).pathname.split('/').pop() || 'media';
  } catch {
    return 'media';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/connectors-service test -- publish.service`
Expected: PASS (3 tests; the partial-failure job settles to `done` with mixed receipts).

- [ ] **Step 5: Stage**

```bash
git add apps/connectors-service/src/publish/publish.service.ts apps/connectors-service/src/publish/publish.service.spec.ts
```

---

### Task 4: connectors-service — Publish controller + dto + module wiring

**Files:** create `apps/connectors-service/src/publish/publish.controller.ts`, `publish/dto.ts`, `publish/publish.module.ts`, `publish/publish.controller.spec.ts`; modify `apps/connectors-service/src/app.module.ts`.

**Interfaces:**
- Consumes: `PublishService` (T3), `ServiceTokenGuard` (existing).
- Produces routes (token-gated): `GET /channels` (needs `X-Connector-Key`) → `{ channels }`; `POST /publish` (needs key) → `{ jobId, status }`; `GET /jobs/:id` → `PublishJob`; `GET /connect-link` → `{ url }`.

- [ ] **Step 1: Write the failing test** — `publish/publish.controller.spec.ts`:

```ts
import { PublishController } from './publish.controller';
import { UnauthorizedException } from '@nestjs/common';

function make() {
  const svc = {
    publish: jest.fn().mockReturnValue({ jobId: 'j1', status: 'queued' }),
    channels: jest.fn().mockResolvedValue([]),
    job: jest.fn().mockReturnValue({ jobId: 'j1', status: 'done', receipts: [] }),
    connectUrl: jest.fn().mockReturnValue({ url: 'http://localhost:5000' }),
  };
  return { c: new PublishController(svc as never), svc };
}

describe('PublishController', () => {
  it('publish forwards the body + key to the service', () => {
    const { c, svc } = make();
    expect(c.publish({ channelIds: ['i1'], caption: 'x', mediaUrls: [] }, 'key')).toEqual({ jobId: 'j1', status: 'queued' });
    expect(svc.publish).toHaveBeenCalledWith('key', { channelIds: ['i1'], caption: 'x', mediaUrls: [] });
  });
  it('rejects channels/publish without a connector key', () => {
    const { c } = make();
    expect(() => c.publish({ channelIds: [], caption: '', mediaUrls: [] }, undefined)).toThrow(UnauthorizedException);
    return expect(c.channels(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
  it('jobs/:id falls back to a failed shell when the job is gone', () => {
    const { c, svc } = make();
    svc.job.mockReturnValueOnce(null);
    expect(c.job('missing')).toEqual({ jobId: 'missing', status: 'failed', receipts: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/connectors-service test -- publish.controller`
Expected: FAIL ("Cannot find module './publish.controller'").

- [ ] **Step 3: Write minimal implementation**

`publish/dto.ts`:

```ts
import { IsArray, IsString } from 'class-validator';
import type { PublishDto } from '@lyra/shared';

export class PublishBody implements PublishDto {
  @IsArray() @IsString({ each: true }) channelIds!: string[];
  @IsString() caption!: string;
  @IsArray() @IsString({ each: true }) mediaUrls!: string[];
}
```

`publish/publish.controller.ts`:

```ts
import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import type { PublishJob } from '@lyra/shared';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { PublishService } from './publish.service';
import { PublishBody } from './dto';

@Controller()
@UseGuards(ServiceTokenGuard)
export class PublishController {
  constructor(private readonly svc: PublishService) {}

  @Get('connect-link')
  connectLink() {
    return this.svc.connectUrl();
  }

  @Get('channels')
  async channels(@Headers('x-connector-key') key?: string) {
    return { channels: await this.svc.channels(requireKey(key)) };
  }

  @Post('publish')
  publish(@Body() b: PublishBody, @Headers('x-connector-key') key?: string) {
    return this.svc.publish(requireKey(key), b);
  }

  @Get('jobs/:id')
  job(@Param('id') id: string): PublishJob {
    return this.svc.job(id) ?? { jobId: id, status: 'failed', receipts: [] };
  }
}

function requireKey(key?: string): string {
  if (!key) throw new UnauthorizedException('missing connector key');
  return key;
}
```

`publish/publish.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { PublishController } from './publish.controller';
import { PublishService } from './publish.service';

@Module({
  controllers: [PublishController],
  providers: [PublishService, ServiceTokenGuard],
})
export class PublishModule {}
```

Register it — modify `apps/connectors-service/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';
import { PublishModule } from './publish/publish.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule, PublishModule],
  controllers: [HealthController],
})
export class AppModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/connectors-service test -- publish.controller` → PASS, then
`pnpm --filter @lyra/connectors-service type-check && pnpm --filter @lyra/connectors-service build` → succeed.
Expected: controller tests pass; the whole service compiles with the new module registered.

- [ ] **Step 5: Stage**

```bash
git add apps/connectors-service/src/publish apps/connectors-service/src/app.module.ts
```

---

### Task 5: shared — `ConnectorCredentialInfo`

**Files:** modify `packages/shared/src/models/index.ts`.

**Interfaces:**
- Produces: `interface ConnectorCredentialInfo { connector: string; connected: boolean; last4?: string }` (re-exported from the shared barrel; consumed by api Task 6 + web Task 8).

- [ ] **Step 1: Add the interface** — append to the connectors block in `packages/shared/src/models/index.ts` (right after the `MediaItem` interface at the end of the file):

```ts
// Safe transport shape for a stored connector credential (e.g. the Postiz API
// key) — reports only whether it's set + a last-4 hint, never the key itself.
export interface ConnectorCredentialInfo {
  connector: string; // e.g. 'postiz'
  connected: boolean;
  last4?: string;
}
```

- [ ] **Step 2: Rebuild shared so api/web see the new type**

Run: `pnpm --filter @lyra/shared build`
Expected: tsup emits `dist/index.js` + `dist/index.cjs` with no error.

- [ ] **Step 3: Verify it's exported**

Run: `pnpm --filter @lyra/shared type-check`
Expected: PASS. (The models barrel is re-exported from `src/index.ts`; no extra wiring needed.)

- [ ] **Step 4: Stage**

```bash
git add packages/shared/src/models/index.ts
```

---

### Task 6: api — `ConnectorCredential` store (schema + service + view)

**Files:** create `apps/api/src/connectors/connector-credential.schema.ts`, `connector-credential.views.ts`, `connector-credentials.service.ts`, `connector-credential.views.spec.ts`.

**Interfaces:**
- Consumes: `EncryptionService` (from `../keys/encryption.service`), `BaseRepository`, `AuditedEntity`, `ConnectorCredentialInfo` (T5).
- Produces: `ConnectorCredentialsService` with `upsert(ws, connector, plaintext, actorId): Promise<ConnectorCredentialInfo>`, `status(ws, connector): Promise<ConnectorCredentialInfo>`, `getDecrypted(ws, connector): Promise<string | null>`; pure `toConnectorCredentialInfo(doc, connector): ConnectorCredentialInfo`.

- [ ] **Step 1: Write the failing test** — `connector-credential.views.spec.ts`:

```ts
import { toConnectorCredentialInfo } from './connector-credential.views';

describe('toConnectorCredentialInfo', () => {
  it('reports disconnected when there is no doc', () => {
    expect(toConnectorCredentialInfo(null, 'postiz')).toEqual({ connector: 'postiz', connected: false });
  });
  it('exposes only connector + connected + last4 (never the key)', () => {
    const doc = { connector: 'postiz', last4: 'cdef', encryptedKey: 'iv:tag:ct' } as never;
    expect(toConnectorCredentialInfo(doc, 'postiz')).toEqual({
      connector: 'postiz', connected: true, last4: 'cdef',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/api test -- connector-credential.views`
Expected: FAIL ("Cannot find module './connector-credential.views'").

- [ ] **Step 3: Write minimal implementation**

`connector-credential.schema.ts`:

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type ConnectorCredentialDocument = HydratedDocument<ConnectorCredential>;

@Schema({ timestamps: true })
export class ConnectorCredential extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  connector!: string; // e.g. 'postiz'

  // Server-only: AES-256-GCM ciphertext. Never serialized to clients.
  @Prop({ required: true })
  encryptedKey!: string;

  @Prop({ required: true })
  last4!: string;
}

export const ConnectorCredentialSchema = SchemaFactory.createForClass(ConnectorCredential);

// One ACTIVE credential per (workspace, connector) — partial so re-adding after a
// soft delete works (mirrors ApiKey).
ConnectorCredentialSchema.index(
  { workspaceId: 1, connector: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);
```

`connector-credential.views.ts`:

```ts
import type { ConnectorCredentialInfo } from '@lyra/shared';
import type { ConnectorCredentialDocument } from './connector-credential.schema';

// Safe transport shape — never includes encryptedKey.
export function toConnectorCredentialInfo(
  doc: ConnectorCredentialDocument | null,
  connector: string,
): ConnectorCredentialInfo {
  if (!doc) return { connector, connected: false };
  return { connector: doc.connector, connected: true, last4: doc.last4 };
}
```

`connector-credentials.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ConnectorCredentialInfo } from '@lyra/shared';
import { ConnectorCredential, ConnectorCredentialDocument } from './connector-credential.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from '../keys/encryption.service';
import { toConnectorCredentialInfo } from './connector-credential.views';

// Per-workspace encrypted connector credentials (e.g. the Postiz API key). Mirrors
// KeysService but kept separate from the AI-Provider key store. Never returns the key.
@Injectable()
export class ConnectorCredentialsService extends BaseRepository<ConnectorCredential> {
  constructor(
    @InjectModel(ConnectorCredential.name) model: Model<ConnectorCredential>,
    private readonly encryption: EncryptionService,
  ) {
    super(model);
  }

  async upsert(
    workspaceId: string, connector: string, plaintext: string, actorId: string,
  ): Promise<ConnectorCredentialInfo> {
    const doc = await this.model
      .findOneAndUpdate(
        { workspaceId, connector },
        {
          $set: {
            encryptedKey: this.encryption.encrypt(plaintext),
            last4: plaintext.slice(-4),
            updatedBy: actorId,
            active: true,
          },
          $setOnInsert: { workspaceId, connector, createdBy: actorId },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .exec();
    return toConnectorCredentialInfo(doc as ConnectorCredentialDocument, connector);
  }

  async status(workspaceId: string, connector: string): Promise<ConnectorCredentialInfo> {
    const doc = await this.findOne({ workspaceId, connector });
    return toConnectorCredentialInfo(doc as ConnectorCredentialDocument | null, connector);
  }

  async getDecrypted(workspaceId: string, connector: string): Promise<string | null> {
    const doc = await this.findOne({ workspaceId, connector });
    return doc ? this.encryption.decrypt((doc as ConnectorCredentialDocument).encryptedKey) : null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lyra/api test -- connector-credential.views`
Expected: PASS (2 tests). (`upsert`/`getDecrypted` round-trip through Mongoose is verified by the Task 10 e2e, matching the house pattern for repository services — `EncryptionService` itself is unit-tested in `keys/encryption.service.spec.ts`.)

- [ ] **Step 5: Stage**

```bash
git add apps/api/src/connectors/connector-credential.schema.ts apps/api/src/connectors/connector-credential.views.ts apps/api/src/connectors/connector-credentials.service.ts apps/api/src/connectors/connector-credential.views.spec.ts
```

---

### Task 7: api — wire credentials routes + key forwarding (controller + proxy + module)

**Files:** modify `apps/api/src/connectors/connectors.controller.ts`, `connectors.proxy.ts`, `connectors.module.ts`. Test: create `apps/api/src/connectors/connectors.controller.spec.ts`.

**Interfaces:**
- Consumes: `ConnectorCredentialsService` (T6), `ConnectorsProxy`.
- Produces: `PUT credentials` → `ConnectorCredentialInfo`; `GET credentials` → `ConnectorCredentialInfo`; `channels`/`publish`/`jobs` forward with the decrypted key; `ConnectorsProxy.usesService(): boolean` and `forward(..., connectorKey?)`.

- [ ] **Step 1: Write the failing test** — `connectors.controller.spec.ts`:

```ts
import { ConnectorsController } from './connectors.controller';
import { BadRequestException } from '@nestjs/common';

const user = { id: 'u1' } as never;

function make(usesService: boolean, key: string | null) {
  const proxy = { usesService: () => usesService, forward: jest.fn().mockResolvedValue({ ok: true }) };
  const creds = { getDecrypted: jest.fn().mockResolvedValue(key), upsert: jest.fn(), status: jest.fn() };
  return { c: new ConnectorsController(proxy as never, creds as never), proxy, creds };
}

describe('ConnectorsController key gating', () => {
  it('mock mode: forwards channels with no key (no throw)', async () => {
    const { c, proxy } = make(false, null);
    await c.channels('ws', user);
    expect(proxy.forward).toHaveBeenCalledWith('ws', 'u1', 'GET', 'channels', undefined, undefined);
  });
  it('real mode + key: forwards publish with the decrypted key', async () => {
    const { c, proxy } = make(true, 'pk');
    await c.publish('ws', user, { channelIds: ['i1'], caption: 'x', mediaUrls: [] } as never);
    expect(proxy.forward).toHaveBeenCalledWith('ws', 'u1', 'POST', 'publish', expect.anything(), 'pk');
  });
  it('real mode + no key: 400 before forwarding', async () => {
    const { c, proxy } = make(true, null);
    await expect(c.channels('ws', user)).rejects.toBeInstanceOf(BadRequestException);
    expect(proxy.forward).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lyra/api test -- connectors.controller`
Expected: FAIL (constructor arity / `usesService` not a function — the controller doesn't take `creds` yet).

- [ ] **Step 3: Add `usesService` + `connectorKey` to the proxy** — in `apps/api/src/connectors/connectors.proxy.ts`, add the method and extend `forward`'s signature/headers, and delete the now-dead `credentials` and `channels/` (DELETE) mock branches:

```ts
  // True when a real connectors-service is configured (vs the deterministic mock).
  usesService(): boolean {
    return !!this.config.get<string>('CONNECTORS_SERVICE_URL');
  }

  async forward(
    workspaceId: string,
    userId: string,
    method: Method,
    path: string,
    body?: unknown,
    connectorKey?: string,
  ): Promise<Record<string, unknown>> {
    const base = this.config.get<string>('CONNECTORS_SERVICE_URL');
    if (!base) return this.mock(path);

    const token = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const res = await fetch(`${base.replace(/\/+$/, '')}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Workspace-Id': workspaceId,
        'X-User-Id': userId,
        ...(connectorKey ? { 'X-Connector-Key': connectorKey } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  }
```

In the same file, in the `mock(path)` method, **delete** these two now-unreachable branches (their routes are removed in Step 4):

```ts
    if (path === 'credentials') return { ok: true };
```
and
```ts
    if (path.startsWith('channels/')) return { ok: true }; // DELETE channels/:id
```

- [ ] **Step 4: Rewire the controller** — replace `apps/api/src/connectors/connectors.controller.ts` with (real credentials write, status read, key-gated forwards, DELETE channels removed):

```ts
import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ConnectorCredentialInfo, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { RequireManageKeys } from '../workspaces/decorators/require-manage-keys.decorator';
import { ConnectorsProxy, rewriteDownload } from './connectors.proxy';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { DownloadBody, PublishBody, ResolveBody, SaveCredentialBody } from './dto/connectors.dto';

const POSTIZ = 'postiz';

// Thin proxy to the connectors microservice (or its mock). Read + run actions are
// member-level; managing credentials requires canManageKeys. The Postiz key is
// stored here (encrypted) and forwarded to the service as X-Connector-Key.
@Controller('workspaces/:id/connectors')
@UseGuards(WorkspaceGuard)
export class ConnectorsController {
  constructor(
    private readonly proxy: ConnectorsProxy,
    private readonly credentials: ConnectorCredentialsService,
  ) {}

  @Put('credentials')
  @RequireManageKeys()
  saveCredential(
    @Param('id') ws: string,
    @CurrentUser() u: User,
    @Body() b: SaveCredentialBody,
  ): Promise<ConnectorCredentialInfo> {
    return this.credentials.upsert(ws, b.connector, b.apiKey, u.id);
  }

  @Get('credentials')
  credentialStatus(@Param('id') ws: string): Promise<ConnectorCredentialInfo> {
    return this.credentials.status(ws, POSTIZ);
  }

  @Get('connect-link')
  @RequireManageKeys()
  connectLink(@Param('id') ws: string, @CurrentUser() u: User, @Query('connector') connector: string) {
    return this.proxy.forward(ws, u.id, 'GET', `connect-link?connector=${encodeURIComponent(connector ?? '')}`);
  }

  @Get('channels')
  async channels(@Param('id') ws: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', 'channels', undefined, await this.requireKey(ws));
  }

  @Post('publish')
  async publish(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: PublishBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'publish', b, await this.requireKey(ws));
  }

  @Get('jobs/:jobId')
  async job(@Param('id') ws: string, @Param('jobId') j: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', `jobs/${j}`, undefined, await this.requireKey(ws));
  }

  @Post('resolve')
  resolve(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: ResolveBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'resolve', b);
  }

  @Post('download')
  async download(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DownloadBody) {
    const raw = await this.proxy.forward(ws, u.id, 'POST', 'download', b);
    return rewriteDownload(ws, raw as never);
  }

  @Get('files/:fileId')
  async file(@Param('fileId') fileId: string, @Res() res: Response) {
    const r = await this.proxy.streamFile(`files/${fileId}`);
    if (!r.body) { res.status(r.status).end(); return; }
    const cd = r.headers.get('content-disposition');
    if (cd) res.setHeader('Content-Disposition', cd);
    const ct = r.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cl = r.headers.get('content-length');
    if (cl) res.setHeader('Content-Length', cl);
    Readable.fromWeb(r.body as WebReadableStream).pipe(res);
  }

  // Resolve the workspace's decrypted Postiz key. In real mode a missing key is a
  // friendly 400 (no keyless call); in mock mode the key is unused, so return
  // undefined and let the proxy serve mock data.
  private async requireKey(ws: string): Promise<string | undefined> {
    const key = await this.credentials.getDecrypted(ws, POSTIZ);
    if (this.proxy.usesService() && !key) {
      throw new BadRequestException('Connect Postiz first — add your API key in Connections.');
    }
    return key ?? undefined;
  }
}
```

- [ ] **Step 5: Register the credential store in the module** — replace `apps/api/src/connectors/connectors.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsProxy } from './connectors.proxy';
import { ConnectorCredential, ConnectorCredentialSchema } from './connector-credential.schema';
import { ConnectorCredentialsService } from './connector-credentials.service';
import { EncryptionService } from '../keys/encryption.service';

// Thin proxy module for the built-in connectors (publish + media import). Connector
// logic lives in the separate microservice; this forwards (or mocks). The Postiz
// API key is stored here, encrypted, and forwarded as X-Connector-Key.
@Module({
  imports: [
    WorkspacesModule, // WorkspaceGuard + MembershipsService
    MongooseModule.forFeature([{ name: ConnectorCredential.name, schema: ConnectorCredentialSchema }]),
  ],
  controllers: [ConnectorsController],
  providers: [ConnectorsProxy, ConnectorCredentialsService, EncryptionService],
})
export class ConnectorsModule {}
```

- [ ] **Step 6: Run tests + type-check**

Run: `pnpm --filter @lyra/api test -- connectors.controller && pnpm --filter @lyra/api test -- connectors.proxy && pnpm --filter @lyra/api type-check`
Expected: new controller spec PASS (3); the existing `connectors.proxy.spec.ts` (rewriteDownload tests) still PASS; type-check clean. Rebuild + restart the api; confirm the routes log on boot (`PUT/GET credentials`, `channels`, `publish`, `jobs/:jobId`, no `DELETE channels`).

- [ ] **Step 7: Stage**

```bash
git add apps/api/src/connectors/connectors.controller.ts apps/api/src/connectors/connectors.proxy.ts apps/api/src/connectors/connectors.module.ts apps/api/src/connectors/connectors.controller.spec.ts
```

---

### Task 8: web — Connections page (real key state + connect/manage in Postiz)

**Files:** modify `apps/web/src/lib/connectors.ts`, `apps/web/src/pages/Connections.tsx`, `apps/web/src/i18n/locales/en/connectors.ts`, `apps/web/src/i18n/locales/vi/connectors.ts`, `apps/web/src/pages/connectors.css`.

**Interfaces:**
- Consumes: `ConnectorCredentialInfo` (T5), `GET/PUT credentials` (T7).
- Produces: `connectorsApi.credentialStatus(ws)`; `removeChannel` dropped. `PublishComposer.tsx` is unchanged.

- [ ] **Step 1: Update the web client** — in `apps/web/src/lib/connectors.ts`, add the import + `credentialStatus`, and remove `removeChannel`:

```ts
import { api } from './api';
import type { Channel, ConnectorCredentialInfo, MediaItem, PublishJob } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/connectors`;

export const connectorsApi = {
  saveCredential: (ws: string, connector: string, apiKey: string) =>
    api<ConnectorCredentialInfo>(`${base(ws)}/credentials`, {
      method: 'PUT',
      body: JSON.stringify({ connector, apiKey }),
    }),

  credentialStatus: (ws: string) =>
    api<ConnectorCredentialInfo>(`${base(ws)}/credentials`),

  connectLink: (ws: string, connector: string) =>
    api<{ url: string }>(`${base(ws)}/connect-link?connector=${encodeURIComponent(connector)}`),

  channels: (ws: string) => api<{ channels: Channel[] }>(`${base(ws)}/channels`),

  publish: (ws: string, channelIds: string[], caption: string, mediaUrls: string[]) =>
    api<PublishJob>(`${base(ws)}/publish`, {
      method: 'POST',
      body: JSON.stringify({ channelIds, caption, mediaUrls }),
    }),

  job: (ws: string, jobId: string) => api<PublishJob>(`${base(ws)}/jobs/${jobId}`),

  resolve: (ws: string, url: string) =>
    api<{ items: MediaItem[] }>(`${base(ws)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }),

  download: (ws: string, url: string, indices?: number[]) =>
    api<{ items: { url: string; filename: string }[] }>(`${base(ws)}/download`, {
      method: 'POST',
      body: JSON.stringify({ url, indices }),
    }),
};
```

- [ ] **Step 2: Add i18n strings** — in `apps/web/src/i18n/locales/en/connectors.ts`, add inside the Connections block (after `remove`):

```ts
  notConnected: 'not connected',
  manageInPostiz: 'Manage channels in Postiz',
  postizKeyHint:
    'Generate this in your Postiz instance (Settings → Public API). Channels are connected inside Postiz, then appear here.',
```

In `apps/web/src/i18n/locales/vi/connectors.ts`, add the matching keys (Vietnamese):

```ts
  notConnected: 'chưa kết nối',
  manageInPostiz: 'Quản lý kênh trong Postiz',
  postizKeyHint:
    'Tạo khóa này trong Postiz của bạn (Settings → Public API). Kênh được kết nối bên trong Postiz, sau đó hiển thị ở đây.',
```

- [ ] **Step 3: Add the "off" badge style** — append to `apps/web/src/pages/connectors.css`:

```css
.cx-badge-off { color: var(--text-muted, #888); font-size: 12px; }
```

- [ ] **Step 4: Rewrite the Connections page** — replace `apps/web/src/pages/Connections.tsx`:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Channel, ConnectorCredentialInfo } from '@lyra/shared';
import { useWorkspace } from '../workspace/useWorkspace';
import { connectorsApi } from '../lib/connectors';
import './connectors.css';

const GLYPH: Record<string, string> = {
  tiktok: '♪', instagram: '◎', youtube: '▶', facebook: 'f', x: '𝕏', bluesky: '🦋', mastodon: '🐘',
};
const cls = (platform: string) => (GLYPH[platform] ? platform : 'generic');
const glyph = (platform: string) => GLYPH[platform] ?? '◆';

// Built-ins → Connections. Manage the Postiz API key (stored encrypted, per
// workspace) and view the channels connected in Postiz. Connecting/removing
// channels happens in the Postiz UI (its public API can't), so we link out.
export function Connections() {
  const { t } = useTranslation();
  const { current } = useWorkspace();
  const ws = current?.id;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [cred, setCred] = useState<ConnectorCredentialInfo | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!ws) return;
    try {
      setCred(await connectorsApi.credentialStatus(ws));
      setChannels((await connectorsApi.channels(ws)).channels);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    }
  }, [ws, t]);

  useEffect(() => { void load(); }, [load]);

  async function act(fn: () => Promise<unknown>) {
    if (!ws) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('connectors.error'));
    } finally {
      setBusy(false);
    }
  }

  const saveKey = () =>
    void act(async () => {
      await connectorsApi.saveCredential(ws!, 'postiz', keyInput.trim());
      setKeyInput('');
      await load();
    });

  const openPostiz = () =>
    void act(async () => {
      const { url } = await connectorsApi.connectLink(ws!, 'postiz');
      window.open(url, '_blank', 'noopener');
    });

  return (
    <div className="cx-page">
      <h2 className="cx-title">{t('connectors.connectionsTitle')}</h2>
      <p className="cx-sub">{t('connectors.connectionsSubtitle')}</p>
      {error && <p className="cx-error">{error}</p>}

      <div className="cx-section">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.publishing')}</span>
          <span className={cred?.connected ? 'cx-badge-ok' : 'cx-badge-off'}>
            ● Postiz{' '}
            {cred?.connected
              ? `${t('connectors.connected')} ····${cred.last4 ?? ''}`
              : t('connectors.notConnected')}
          </span>
        </div>

        <div className="cx-keyrow">
          <label>{t('connectors.postizKey')}</label>
          <input
            className="cx-input"
            type="password"
            value={keyInput}
            placeholder="postiz key…"
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button className="cx-btn" disabled={busy || !keyInput.trim()} onClick={saveKey}>
            {t('connectors.save')}
          </button>
        </div>
        <p className="cx-note">{t('connectors.postizKeyHint')}</p>

        <div className="cx-label">{t('connectors.connectedChannels')}</div>
        <div className="cx-grid">
          {channels.map((c) => (
            <div className="cx-card" key={c.id}>
              <span className={`cx-ic ${cls(c.platform)}`}>{glyph(c.platform)}</span>
              <div>
                <div className="cx-name">{c.displayName}</div>
                <div className="cx-plat">{c.platform}</div>
              </div>
            </div>
          ))}
          <button className="cx-add" disabled={busy} onClick={openPostiz}>
            ＋ {t('connectors.manageInPostiz')} ↗
          </button>
        </div>
      </div>

      <div className="cx-section">
        <div className="cx-sec-head">
          <span className="cx-sec-title">{t('connectors.mediaImport')}</span>
          <span className="cx-badge-ok">● {t('connectors.connected')}</span>
        </div>
        <p className="cx-note">{t('connectors.cobaltNote')}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Type-check the web app**

Run: `pnpm --filter @lyra/web type-check`
Expected: PASS. (`PublishComposer.tsx` is unchanged and still imports `Channel`/`PublishJob`; `removeChannel` had no other callers.)

- [ ] **Step 6: Stage**

```bash
git add apps/web/src/lib/connectors.ts apps/web/src/pages/Connections.tsx apps/web/src/pages/connectors.css apps/web/src/i18n/locales/en/connectors.ts apps/web/src/i18n/locales/vi/connectors.ts
```

---

### Task 9: compose + env — enable Postiz; wire service env

**Files:** modify `docker-compose.yml`, `apps/connectors-service/.env.example`.

**Interfaces:**
- Produces: `connectors-service` reaches Postiz via `POSTIZ_API_URL`; `connect-link` returns `POSTIZ_PUBLIC_URL`.

- [ ] **Step 1: Wire the service env** — in `docker-compose.yml`, update the `connectors-service` block's `environment` + `depends_on` (the `postiz`/`postiz-postgres`/`postiz-redis` services already exist under the `connectors` profile):

```yaml
  connectors-service:
    profiles: ["connectors"]
    build:
      context: .
      dockerfile: apps/connectors-service/Dockerfile
    container_name: lyra-connectors-service
    restart: unless-stopped
    ports:
      - "9100:9100"
    environment:
      PORT: "9100"
      CONNECTORS_SERVICE_TOKEN: "change-me-shared-token"
      FILE_TTL_MS: "900000"
      JOB_TTL_MS: "900000"
      POSTIZ_API_URL: "http://postiz:5000"
      POSTIZ_PUBLIC_URL: "http://localhost:5000"
    depends_on:
      - postiz
```

- [ ] **Step 2: Update the service `.env.example`** — append to `apps/connectors-service/.env.example`:

```
JOB_TTL_MS=900000
# Self-hosted Postiz (publish v2). API base = the Postiz backend; PUBLIC = its web UI
# (where users connect channels). The per-workspace Postiz key is NOT here — it is
# stored encrypted in the Lyra api and forwarded per request as X-Connector-Key.
POSTIZ_API_URL=http://localhost:5000
POSTIZ_PUBLIC_URL=http://localhost:5000
```

- [ ] **Step 3: Validate compose**

Run: `docker compose config --quiet`
Expected: VALID (no output, exit 0).

- [ ] **Step 4: Stage**

```bash
git add docker-compose.yml apps/connectors-service/.env.example
```

---

### Task 10: Full gate + real e2e (Bluesky/Mastodon)

**Files:** none (verification only).

- [ ] **Step 1: Link + full gate**

Run: `pnpm install && pnpm turbo run type-check lint test build`
Expected: all green. New `@lyra/connectors-service` unit tests (postiz.client, job-store, publish.service, publish.controller) pass; api gains `connector-credential.views` + `connectors.controller` specs; existing `connectors.proxy` spec still green; shared + web build.

- [ ] **Step 2: Validate compose**

Run: `docker compose config --quiet`
Expected: VALID.

- [ ] **Step 3: Mock-mode smoke (no microservice, no Postiz)**

With `CONNECTORS_SERVICE_URL` unset in `apps/api/.env`, rebuild + restart the api. In the web app → Connections: the page loads, channels show the mock list, the badge reads "not connected" until a key is saved (saving stores it encrypted even in mock mode). Publish still works on the mock job. Expected: no errors; nothing calls Postiz.

- [ ] **Step 4: Real e2e — the definition of done**

1. `docker compose --profile connectors up -d` (starts `postiz` + `postiz-postgres` + `postiz-redis` + `connectors-service`).
2. Open the Postiz UI (`http://localhost:5000`), create the admin account, and **connect a Bluesky or Mastodon channel** (app password / instance URL — no platform app review). Copy the **Public API key** (Settings → Public API).
3. In `apps/api/.env`: set `CONNECTORS_SERVICE_URL=http://localhost:9100` + the matching `CONNECTORS_SERVICE_TOKEN` (= the service's `change-me-shared-token`); rebuild + restart the api.
4. In Lyra → Connections: paste the Postiz key → Save (badge flips to "connected ····xxxx"); the Bluesky/Mastodon channel appears in the list (live `GET /integrations`).
5. In Lyra → Publish: pick the channel → type a caption (optionally add one **public** image URL) → Publish → poll resolves to a receipt with `status: ok` and a link to the **live post**. Open the link to confirm it posted.
6. Partial-failure check (optional): disconnect the channel's token in Postiz, publish again → receipt shows `status: failed` with the error, and the job still completes (`done`, not crashed).

- [ ] **Step 5: Report** the gate result (task counts/pass), the mock-mode smoke result, and — if run — the live post URL. Leave everything **staged**; commit only when the user asks.

---

## Self-Review

**1. Spec coverage** (against `2026-06-18-connectors-microservice-publish-design.md`):
- Publish module / Postiz client + mappers → T1; async job store → T2; orchestration + partial failure + SSRF media → T3; controller routes (`channels`/`publish`/`jobs`/`connect-link`) + `X-Connector-Key` → T4.
- `ConnectorCredentialInfo` shared shape → T5; per-workspace encrypted credential store (schema/service/view) → T6.
- Real `saveCredential` + `GET credentials` + key forwarding + drop DELETE channels + `usesService` → T7.
- Connections page (real state, connect/manage-in-Postiz, drop remove) + web client + i18n → T8.
- Compose Postiz wiring + service env → T9; full gate + real Bluesky/Mastodon e2e (the DoD) → T10.
- Non-goals (scheduling/drafts/analytics/in-Lyra connect-remove/`data:`-relative media/pipeline-step) — none implemented. ✓

**2. Placeholder scan:** every code step shows real code; Postiz JSON field assumptions are flagged `// VERIFY` and pinned in T10; no "TBD"/"add error handling"/"similar to Task N". ✓

**3. Type consistency:** `Channel`/`Receipt`/`PublishJob`/`PublishDto`/`ConnectorCredentialInfo` come from `@lyra/shared` everywhere. `mapIntegrations`/`okReceipt`/`failReceipt`/`UploadResult`/`listIntegrations`/`uploadMedia`/`createPost` names match across `postiz.client.ts` + its spec + `publish.service.ts`. `JobStore.create/update/get/sweep` match the spec + service. `PublishService.{channels,publish,job,connectUrl,runPublish}` match the controller (T4) + spec. `ConnectorCredentialsService.{upsert,status,getDecrypted}` + `toConnectorCredentialInfo` match the controller (T7) + view spec. `ConnectorsProxy.{usesService,forward(+connectorKey)}` match the controller calls. The `X-Connector-Key` header set by the api proxy (T7) is read by the service controller `@Headers('x-connector-key')` (T4). ✓
