# Connectors Microservice — Download v1 (yt-dlp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A new `apps/connectors-service` (NestJS) that resolves + downloads media via yt-dlp and streams it back through Lyra's proxy — making the shipped Import-media UI work for real (replacing the proxy's mock for `resolve`/`download`).

**Architecture:** New monorepo NestJS app on `:9100`, token-gated, not browser-facing. It wraps the **yt-dlp** binary (+ ffmpeg) — `-J` for metadata, download to an **ephemeral temp dir (TTL)** — and serves files via `GET /files/:id`. Lyra's proxy gains a `files/:id` stream-through route + a `fileId→Lyra-URL` rewrite on `download`. Publish (Postiz) is a separate v2.

**Tech Stack:** NestJS 11 + Express, TypeScript, `@lyra/shared` (MediaItem), Node `child_process` (spawn yt-dlp), Jest (mock the spawn — no network in unit tests).

## Global Constraints

- **Commits DEFERRED** — each task ends with `git add` (stage) + verification; do **not** `git commit`. Final task runs the gate.
- **Spawn yt-dlp with an argv array, never a shell string** (no `sh -c`) — injection-safe.
- **SSRF guard:** every URL passes `assertSafeUrl` (http/https only; reject localhost/private/link-local/metadata hosts) before it reaches yt-dlp.
- **Service is not browser-facing** — only Lyra calls it, gated by `Authorization: Bearer ${CONNECTORS_SERVICE_TOKEN}`; it trusts `X-Workspace-Id`/`X-User-Id` (Lyra authenticates first).
- **`MediaItem` comes from `@lyra/shared`** — never redefine it.
- yt-dlp + ffmpeg are **system binaries** (Dockerfile), not npm deps; unit tests **mock the spawn**.
- New app mirrors `apps/api` conventions: `nest build`, `tsc --noEmit -p tsconfig.json` type-check, `eslint src` lint, inline Jest config (`rootDir: src`, `testRegex: .*\.spec\.ts$`, ts-jest, `testEnvironment: node`).
- Full gate: `pnpm turbo run type-check lint test build`.

## File structure

**New app `apps/connectors-service/`:**
- `package.json`, `tsconfig.json`, `tsconfig.build.json`, `nest-cli.json`, `.eslintrc` (mirror apps/api), `.env.example`, `Dockerfile`.
- `src/main.ts` — bootstrap (`:9100`, ValidationPipe, global token guard).
- `src/app.module.ts`, `src/health.controller.ts` (`GET /health`).
- `src/common/url.ts` — `assertSafeUrl(url)`.
- `src/auth/service-token.guard.ts` — Bearer-token guard.
- `src/download/ytdlp.ts` — `resolveArgs`/`downloadArgs`/`typeFromExt`/`mapResolveJson` + `runYtDlp` (spawn).
- `src/download/file-store.ts` — `FileStore` (put/get/sweep, TTL).
- `src/download/download.service.ts`, `download/download.controller.ts`, `download/download.module.ts`.
- Tests: `*.spec.ts` beside each logic unit.

**Lyra-side (modify):**
- `apps/api/src/connectors/connectors.controller.ts` — `download` rewrite + `GET files/:fileId` stream route.
- `apps/api/src/connectors/connectors.proxy.ts` — a `stream(...)` helper for binary forward (or reuse `forward` for the rewrite + a small fetch-stream in the controller).
- `apps/web/src/pages/ImportMedia.tsx` — authed download for proxied (relative) URLs.

---

### Task 1: Scaffold `apps/connectors-service` (boots + health)

**Files:** create `apps/connectors-service/{package.json, tsconfig.json, tsconfig.build.json, nest-cli.json, .env.example, src/main.ts, src/app.module.ts, src/health.controller.ts}`.

- [ ] **Step 1: `package.json`** (mirror apps/api, trimmed — no DB/auth deps):

```json
{
  "name": "@lyra/connectors-service",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "lint": "eslint src",
    "type-check": "tsc --noEmit -p tsconfig.json",
    "test": "jest"
  },
  "dependencies": {
    "@lyra/shared": "workspace:*",
    "@nestjs/common": "^11.1.27",
    "@nestjs/config": "^4.0.4",
    "@nestjs/core": "^11.1.27",
    "@nestjs/platform-express": "^11.1.27",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.15.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.23",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.1.27",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "jest": "^30.4.2",
    "ts-jest": "^29.4.11",
    "typescript": "^6.0.3"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": { "^.+\\.(t|j)s$": "ts-jest" },
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 2: tsconfig + nest-cli** — copy `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`, `apps/api/nest-cli.json` verbatim into `apps/connectors-service/` (same NestJS/CommonJS build setup). Copy `apps/api/.eslintrc*` if present.

- [ ] **Step 3: bootstrap** — `src/main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(Number(process.env.PORT ?? 9100));
}
void bootstrap();
```

`src/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  ok() {
    return { ok: true, service: 'connectors' };
  }
}
```

`src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { DownloadModule } from './download/download.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), DownloadModule],
  controllers: [HealthController],
})
export class AppModule {}
```

`.env.example`:

```
PORT=9100
CONNECTORS_SERVICE_TOKEN=change-me-shared-token
FILE_TTL_MS=900000
TMP_DIR=
```

- [ ] **Step 4:** `pnpm install` (links the workspace), then `pnpm --filter @lyra/connectors-service type-check` — fails until `DownloadModule` exists; create a temporary empty `download/download.module.ts` (`@Module({}) export class DownloadModule {}`) so it compiles, then `pnpm --filter @lyra/connectors-service build` → succeeds.

- [ ] **Step 5: Stage** — `git add apps/connectors-service`.

---

### Task 2: `assertSafeUrl` (SSRF guard)

**Files:** create `src/common/url.ts`, `src/common/url.spec.ts`.

**Produces:** `assertSafeUrl(raw: string): URL` — throws `BadRequestException` on unsafe.

- [ ] **Step 1: failing test** — `src/common/url.spec.ts`:

```ts
import { assertSafeUrl } from './url';

describe('assertSafeUrl', () => {
  it('accepts https/http public URLs', () => {
    expect(assertSafeUrl('https://www.tiktok.com/@x/video/1').hostname).toBe('www.tiktok.com');
    expect(() => assertSafeUrl('http://example.com/v')).not.toThrow();
  });
  it('rejects non-http(s) schemes', () => {
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow();
    expect(() => assertSafeUrl('ftp://x')).toThrow();
    expect(() => assertSafeUrl('not a url')).toThrow();
  });
  it('rejects localhost / private / link-local / metadata hosts', () => {
    for (const u of [
      'http://localhost/x', 'http://127.0.0.1/x', 'http://[::1]/x',
      'http://10.0.0.5/x', 'http://192.168.1.1/x', 'http://172.16.0.1/x',
      'http://169.254.169.254/latest/meta-data', 'http://0.0.0.0/x',
    ]) {
      expect(() => assertSafeUrl(u)).toThrow();
    }
  });
});
```

- [ ] **Step 2: run → FAIL** — `pnpm --filter @lyra/connectors-service test -- url`.

- [ ] **Step 3: implement** — `src/common/url.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

const PRIVATE = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./, /^0\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

export function assertSafeUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('Only http(s) URLs are allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.localhost')) {
    throw new BadRequestException('URL host not allowed');
  }
  if (PRIVATE.some((re) => re.test(host))) {
    throw new BadRequestException('URL host not allowed');
  }
  return url;
}
```

- [ ] **Step 4: run → PASS**. **Step 5: Stage.**

---

### Task 3: yt-dlp wrapper (arg-builders + JSON→MediaItem mapping)

**Files:** create `src/download/ytdlp.ts`, `src/download/ytdlp.spec.ts`.

**Produces:** `typeFromExt(ext): MediaItem['type']`; `mapResolveJson(json): MediaItem[]`; `resolveArgs(url): string[]`; `downloadArgs(url, outTemplate, indices?): string[]`; `runYtDlp(args): Promise<{ stdout: string }>` (spawn; not unit-tested).

- [ ] **Step 1: failing test** — `src/download/ytdlp.spec.ts`:

```ts
import { typeFromExt, mapResolveJson, resolveArgs, downloadArgs } from './ytdlp';

describe('typeFromExt', () => {
  it('classifies by extension', () => {
    expect(typeFromExt('mp4')).toBe('video');
    expect(typeFromExt('jpg')).toBe('image');
    expect(typeFromExt('m4a')).toBe('audio');
    expect(typeFromExt('weird')).toBe('video'); // default
  });
});

describe('mapResolveJson', () => {
  it('maps a single video', () => {
    const out = mapResolveJson({ id: 'abc', ext: 'mp4', thumbnail: 't.jpg' });
    expect(out).toEqual([{ index: 0, type: 'video', thumbUrl: 't.jpg', filename: 'abc.mp4' }]);
  });
  it('maps a carousel/playlist via entries', () => {
    const out = mapResolveJson({
      _type: 'playlist',
      entries: [
        { id: '1', ext: 'jpg', thumbnail: 'a.jpg' },
        { id: '2', ext: 'mp4', thumbnail: 'b.jpg' },
      ],
    });
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ index: 0, type: 'image', filename: '1.jpg' });
    expect(out[1]).toMatchObject({ index: 1, type: 'video', filename: '2.mp4' });
  });
});

describe('arg builders', () => {
  it('resolveArgs ends with the url and has no shell metachars', () => {
    const a = resolveArgs('https://x/v');
    expect(a).toEqual(['-J', '--no-warnings', 'https://x/v']);
  });
  it('downloadArgs targets a template + optional playlist items', () => {
    expect(downloadArgs('https://x/v', '/tmp/%(id)s.%(ext)s')).toContain('-o');
    expect(downloadArgs('https://x/v', '/tmp/o', [0, 2])).toEqual(
      expect.arrayContaining(['--playlist-items', '1,3']),
    );
  });
});
```

- [ ] **Step 2: run → FAIL**.

- [ ] **Step 3: implement** — `src/download/ytdlp.ts`:

```ts
import { spawn } from 'node:child_process';
import type { MediaItem } from '@lyra/shared';

const VIDEO = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v']);
const AUDIO = new Set(['mp3', 'm4a', 'wav', 'aac', 'opus', 'flac', 'ogg']);
const IMAGE = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']);

export function typeFromExt(ext: string): MediaItem['type'] {
  const e = (ext ?? '').toLowerCase();
  if (IMAGE.has(e)) return 'image';
  if (AUDIO.has(e)) return 'audio';
  if (VIDEO.has(e)) return 'video';
  return 'video';
}

interface YtEntry { id?: string; ext?: string; thumbnail?: string; entries?: YtEntry[]; _type?: string }

function toItem(e: YtEntry, index: number): MediaItem {
  const ext = e.ext ?? 'mp4';
  return {
    index,
    type: typeFromExt(ext),
    thumbUrl: e.thumbnail,
    filename: `${e.id ?? `item-${index}`}.${ext}`,
  };
}

export function mapResolveJson(json: YtEntry): MediaItem[] {
  if (Array.isArray(json?.entries)) return json.entries.map(toItem);
  return [toItem(json ?? {}, 0)];
}

export function resolveArgs(url: string): string[] {
  return ['-J', '--no-warnings', url];
}

export function downloadArgs(url: string, outTemplate: string, indices?: number[]): string[] {
  const args = ['-o', outTemplate, '--no-warnings'];
  if (indices?.length) args.push('--playlist-items', indices.map((i) => i + 1).join(','));
  args.push(url);
  return args;
}

// Spawn yt-dlp with an argv array (no shell). Not unit-tested (integration).
export function runYtDlp(args: string[], timeoutMs = 120_000): Promise<{ stdout: string }> {
  return new Promise((resolve, reject) => {
    const ps = spawn('yt-dlp', args, { timeout: timeoutMs });
    let stdout = '';
    let stderr = '';
    ps.stdout.on('data', (d) => (stdout += d));
    ps.stderr.on('data', (d) => (stderr += d));
    ps.on('error', reject);
    ps.on('close', (code) =>
      code === 0 ? resolve({ stdout }) : reject(new Error(`yt-dlp exited ${code}: ${stderr.slice(0, 500)}`)),
    );
  });
}
```

- [ ] **Step 4: run → PASS**. **Step 5: Stage.**

---

### Task 4: `FileStore` (ephemeral temp + TTL)

**Files:** create `src/download/file-store.ts`, `src/download/file-store.spec.ts`.

**Produces:** `FileStore` with `put(path): string` (returns id), `get(id): string | null`, `sweep(now?): void`.

- [ ] **Step 1: failing test** — `src/download/file-store.spec.ts`:

```ts
import { FileStore } from './file-store';

describe('FileStore', () => {
  it('put returns an unguessable id retrievable via get', () => {
    const fs = new FileStore(1000);
    const id = fs.put('/tmp/a.mp4');
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fs.get(id)).toBe('/tmp/a.mp4');
    expect(fs.get('nope')).toBeNull();
  });
  it('sweep drops entries past TTL, keeps fresh ones', () => {
    const fs = new FileStore(1000);
    const id = fs.put('/tmp/a.mp4', 0); // created at t=0
    fs.sweep(500);
    expect(fs.get(id)).toBe('/tmp/a.mp4'); // still fresh
    fs.sweep(2000);
    expect(fs.get(id)).toBeNull(); // expired
  });
});
```

- [ ] **Step 2: run → FAIL**.

- [ ] **Step 3: implement** — `src/download/file-store.ts`:

```ts
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';

interface Entry { path: string; created: number }

// In-memory id→temp-file map with TTL sweeping. Files are deleted on sweep.
export class FileStore {
  private readonly map = new Map<string, Entry>();
  constructor(private readonly ttlMs: number) {}

  put(path: string, now: number = Date.now()): string {
    const id = randomUUID();
    this.map.set(id, { path, created: now });
    return id;
  }

  get(id: string): string | null {
    return this.map.get(id)?.path ?? null;
  }

  sweep(now: number = Date.now()): void {
    for (const [id, e] of this.map) {
      if (now - e.created >= this.ttlMs) {
        this.map.delete(id);
        void unlink(e.path).catch(() => undefined);
      }
    }
  }
}
```

- [ ] **Step 4: run → PASS**. **Step 5: Stage.**

---

### Task 5: `ServiceTokenGuard`

**Files:** create `src/auth/service-token.guard.ts`, `src/auth/service-token.guard.spec.ts`.

- [ ] **Step 1: failing test**:

```ts
import { ServiceTokenGuard } from './service-token.guard';
import { UnauthorizedException } from '@nestjs/common';

function ctx(auth?: string) {
  return { switchToHttp: () => ({ getRequest: () => ({ headers: auth ? { authorization: auth } : {} }) }) } as never;
}

describe('ServiceTokenGuard', () => {
  const guard = new ServiceTokenGuard({ get: () => 'sekret' } as never);
  it('allows the right bearer token', () => {
    expect(guard.canActivate(ctx('Bearer sekret'))).toBe(true);
  });
  it('rejects a missing/wrong token', () => {
    expect(() => guard.canActivate(ctx())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(ctx('Bearer nope'))).toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 2: run → FAIL**.

- [ ] **Step 3: implement** — `src/auth/service-token.guard.ts`:

```ts
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const expected = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const got = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
    if (!expected || got !== expected) throw new UnauthorizedException('bad service token');
    return true;
  }
}
```

- [ ] **Step 4: run → PASS**. **Step 5: Stage.**

---

### Task 6: Download module (controller + service + routes)

**Files:** create `src/download/download.service.ts`, `download.controller.ts`, `download/dto.ts`; replace the temp `download.module.ts`.

**Interfaces:**
- Consumes: `assertSafeUrl` (T2), `ytdlp` (T3), `FileStore` (T4), `ServiceTokenGuard` (T5).
- Produces: `POST /resolve` `{url}`→`{items:MediaItem[]}`; `POST /download` `{url,indices?}`→`{items:{fileId,filename}[]}`; `GET /files/:id` → stream.

- [ ] **Step 1: dto** — `src/download/dto.ts`:

```ts
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';
export class ResolveBody { @IsString() @MinLength(1) url!: string; }
export class DownloadBody {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() indices?: number[];
}
```

- [ ] **Step 2: service** — `src/download/download.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readdir } from 'node:fs/promises';
import type { MediaItem } from '@lyra/shared';
import { assertSafeUrl } from '../common/url';
import { downloadArgs, mapResolveJson, resolveArgs, runYtDlp } from './ytdlp';
import { FileStore } from './file-store';

@Injectable()
export class DownloadService {
  private readonly store: FileStore;
  constructor(config: ConfigService) {
    this.store = new FileStore(Number(config.get('FILE_TTL_MS') ?? 900_000));
    setInterval(() => this.store.sweep(), 60_000).unref();
  }

  async resolve(url: string): Promise<MediaItem[]> {
    assertSafeUrl(url);
    const { stdout } = await runYtDlp(resolveArgs(url));
    return mapResolveJson(JSON.parse(stdout));
  }

  async download(url: string, indices?: number[]): Promise<{ fileId: string; filename: string }[]> {
    assertSafeUrl(url);
    const dir = await mkdtemp(join(tmpdir(), 'lyra-dl-'));
    await runYtDlp(downloadArgs(url, join(dir, '%(id)s.%(ext)s'), indices));
    const files = await readdir(dir);
    return files.map((f) => ({ fileId: this.store.put(join(dir, f)), filename: f }));
  }

  pathFor(id: string): string {
    const p = this.store.get(id);
    if (!p) throw new NotFoundException('file expired or not found');
    return p;
  }
}
```

- [ ] **Step 3: controller** — `src/download/download.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { DownloadService } from './download.service';
import { DownloadBody, ResolveBody } from './dto';

@Controller()
@UseGuards(ServiceTokenGuard)
export class DownloadController {
  constructor(private readonly svc: DownloadService) {}

  @Post('resolve')
  async resolve(@Body() b: ResolveBody) {
    return { items: await this.svc.resolve(b.url) };
  }

  @Post('download')
  async download(@Body() b: DownloadBody) {
    return { items: await this.svc.download(b.url, b.indices) };
  }

  @Get('files/:id')
  file(@Param('id') id: string, @Res() res: Response) {
    const path = this.svc.pathFor(id);
    res.setHeader('Content-Disposition', `attachment; filename="${basename(path)}"`);
    createReadStream(path).pipe(res);
  }
}
```

- [ ] **Step 4: module** — replace `src/download/download.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ServiceTokenGuard } from '../auth/service-token.guard';
import { DownloadController } from './download.controller';
import { DownloadService } from './download.service';

@Module({
  controllers: [DownloadController],
  providers: [DownloadService, ServiceTokenGuard],
})
export class DownloadModule {}
```

- [ ] **Step 5: verify** — `pnpm --filter @lyra/connectors-service type-check` + `build` pass; run all its tests (`pnpm --filter @lyra/connectors-service test`) → green. Optional manual: `CONNECTORS_SERVICE_TOKEN=t node dist/main.js`, then `curl -H "Authorization: Bearer t" -H 'Content-Type: application/json' -d '{"url":"https://www.youtube.com/watch?v=..."}' localhost:9100/resolve` (needs yt-dlp installed locally).

- [ ] **Step 6: Stage.**

---

### Task 7: Dockerfile + compose wiring + service .env.example

**Files:** create `apps/connectors-service/Dockerfile`; modify `docker-compose.yml` (point `connectors-service.build`).

- [ ] **Step 1: Dockerfile** — `apps/connectors-service/Dockerfile` (node + yt-dlp standalone binary + ffmpeg):

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl python3 \
  && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
  && chmod a+rx /usr/local/bin/yt-dlp \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# (Monorepo build context: copy + install + build the workspace, or mount a prebuilt dist.)
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @lyra/connectors-service... build
EXPOSE 9100
CMD ["node", "apps/connectors-service/dist/main.js"]
```

- [ ] **Step 2: compose** — in `docker-compose.yml`, set the `connectors-service` block's `build` to this app and drop the placeholder image:

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
    depends_on: []
```

(Validate: `docker compose config --quiet`.)

- [ ] **Step 3: Stage.**

---

### Task 8: Lyra proxy — `files/:id` stream route + `download` rewrite

**Files:** modify `apps/api/src/connectors/connectors.controller.ts`, `connectors.proxy.ts`. Test: extend `connectors.proxy.spec.ts`.

**Interfaces:**
- Consumes: `ConnectorsProxy.forward` (existing).
- Produces: `download` response now returns `{ items: { url, filename }[] }` where `url` = `/workspaces/:id/connectors/files/:fileId`; new `GET .../files/:fileId` streams from the service.

- [ ] **Step 1: failing test** — append to `apps/api/src/connectors/connectors.proxy.spec.ts`:

```ts
import { rewriteDownload } from './connectors.proxy';

describe('rewriteDownload', () => {
  it('rewrites service fileIds to Lyra file URLs', () => {
    const out = rewriteDownload('ws1', { items: [{ fileId: 'abc', filename: 'v.mp4' }] });
    expect(out.items[0]).toEqual({ url: '/workspaces/ws1/connectors/files/abc', filename: 'v.mp4' });
  });
  it('passes through absolute urls (mock mode)', () => {
    const out = rewriteDownload('ws1', { items: [{ url: 'https://example.com/x', filename: 'm.zip' }] });
    expect(out.items[0]).toEqual({ url: 'https://example.com/x', filename: 'm.zip' });
  });
});
```

- [ ] **Step 2: run → FAIL** (`pnpm --filter @lyra/api test -- connectors.proxy`).

- [ ] **Step 3: implement the pure helper** — in `apps/api/src/connectors/connectors.proxy.ts`, export:

```ts
// Map the service's download response (fileId-based) to browser-facing Lyra file
// URLs; leave absolute urls (mock mode) untouched.
export function rewriteDownload(
  workspaceId: string,
  body: { items?: { fileId?: string; url?: string; filename: string }[] },
): { items: { url: string; filename: string }[] } {
  const items = (body.items ?? []).map((it) =>
    it.fileId
      ? { url: `/workspaces/${workspaceId}/connectors/files/${it.fileId}`, filename: it.filename }
      : { url: it.url ?? '', filename: it.filename },
  );
  return { items };
}
```

Add a binary stream helper on `ConnectorsProxy` (used by the files route):

```ts
async streamFile(path: string): Promise<{ status: number; headers: Headers; body: ReadableStream | null }> {
  const base = this.config.get<string>('CONNECTORS_SERVICE_URL');
  if (!base) return { status: 404, headers: new Headers(), body: null }; // mock mode: no real files
  const token = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
  const res = await fetch(`${base.replace(/\/+$/, '')}/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, headers: res.headers, body: res.body };
}
```

- [ ] **Step 4: wire the controller** — in `connectors.controller.ts`, change `download` to rewrite, and add the `files` route (stream-through, mirroring `runs.controller`'s asset streaming):

```ts
import { Res } from '@nestjs/common';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { rewriteDownload } from './connectors.proxy';

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
    Readable.fromWeb(r.body as WebReadableStream).pipe(res);
  }
```

- [ ] **Step 5: run → PASS** (proxy spec: 4 prior + 2 rewrite). `pnpm --filter @lyra/api type-check`. Rebuild + restart api; confirm the `files/:fileId` route maps.

- [ ] **Step 6: Stage.**

---

### Task 9: Web Import — authed download for proxied files

**Files:** modify `apps/web/src/pages/ImportMedia.tsx`.

- [ ] **Step 1:** import the authed helper and split download by URL kind. Change the top import to add `downloadFile`:

```ts
import { api, downloadFile } from '../lib/api';
```

Replace `triggerDownload`'s usage in `download(...)` so **relative** (proxied) URLs go through the authed helper, absolute (mock/external) via the anchor:

```ts
  const download = (indices?: number[]) => {
    if (!ws) return;
    void connectorsApi
      .download(ws, url.trim(), indices)
      .then((r) =>
        r.items.forEach((it) =>
          it.url.startsWith('http')
            ? triggerDownload(it.url, it.filename)        // absolute (mock/external)
            : void downloadFile(it.url, it.filename),     // proxied Lyra file (authed)
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : t('connectors.error')));
  };
```

- [ ] **Step 2:** `pnpm --filter @lyra/web type-check` → pass. (Mock mode unchanged: mock urls are absolute → anchor path.)

- [ ] **Step 3: Stage.**

---

### Task 10: Full gate + verification

- [ ] **Step 1:** `pnpm install` (ensure the new workspace member is linked), then `pnpm turbo run type-check lint test build` → all green; the new `@lyra/connectors-service` package shows build + its unit tests (url, ytdlp, file-store, guard); api proxy spec gains the 2 rewrite tests.
- [ ] **Step 2:** `docker compose config --quiet` → VALID.
- [ ] **Step 3 (manual, mock mode — no microservice):** restart api with `CONNECTORS_SERVICE_URL` unset → Import still works on mock (download returns example URLs via the anchor path).
- [ ] **Step 4 (manual, real — optional):** `docker compose --profile connectors up -d connectors-service` (builds the image with yt-dlp+ffmpeg); set `CONNECTORS_SERVICE_URL=http://localhost:9100` + the matching token in `apps/api/.env`; restart api; in the Import UI, paste a public video URL → Fetch shows real items → Download saves the file.
- [ ] **Step 5: Report** counts/files/results. Leave staged; commit only when the user asks.

---

## Self-Review

**1. Spec coverage:** new `apps/connectors-service` (T1); SSRF guard (T2); yt-dlp resolve/download + MediaItem mapping (T3); ephemeral temp + TTL (T4); token guard (T5); the 3 endpoints (T6); Dockerfile w/ yt-dlp+ffmpeg + compose (T7); Lyra proxy `files/:id` + download rewrite (T8); web authed download (T9); gate (T10). Publish/queue/Cobalt/cookies = explicitly out. ✓

**2. Placeholder scan:** every code step has real code; the Dockerfile's monorepo-build line is concrete (pnpm filtered build) with a noted alternative; no TBDs. ✓

**3. Type consistency:** `MediaItem` from `@lyra/shared` everywhere; service returns `{ fileId, filename }`, `rewriteDownload` maps to `{ url, filename }` (the contract the web/`connectorsApi.download` already expects); `resolveArgs`/`downloadArgs`/`mapResolveJson`/`typeFromExt` names match across `ytdlp.ts` + its spec + the service; `FileStore.put/get/sweep` and `ServiceTokenGuard.canActivate` match their specs. ✓
