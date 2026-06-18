# Built-in Connectors — Lyra slice (UI + thin proxy + mock) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the Lyra-side of the built-in connectors — the 3 UI screens (Connections, Publish composer, Import media) + a thin, env-gated proxy in Lyra's api that forwards to the connectors microservice **or returns mock data when unset** — so the whole UI is buildable/testable before the microservice exists.

**Architecture:** Phase A — shared contracts + an api `connectors` proxy module (forward-or-mock). Phase B — the web nav group + 3 pages calling the proxy via the `api` wrapper. The microservice itself is **out of scope** (separate track).

**Tech Stack:** NestJS 10 (api proxy), React 18 + Vite + react-i18next (web), `@lyra/shared` (types/DTOs), Jest (api), Vitest (web/shared).

## Global Constraints

- **Commits DEFERRED** — each task ends with `git add` (stage) + verification; do **not** `git commit`. Final task runs the full gate.
- `@lyra/shared` = zero runtime deps; DTO interfaces in shared, class-validator classes in the api implementing them.
- **Proxy is the only api code** — no connector/Postiz/Cobalt logic in Lyra. Each handler: `CONNECTORS_SERVICE_URL` set → `fetch`-forward; unset → deterministic **mock**.
- **Auth** lives in the proxy: global `JwtAuthGuard` + `WorkspaceGuard` on the workspace routes; credential/connect/remove routes require `canManageKeys` (mirror `KeysController`).
- Web: all calls via `src/lib/api.ts`; no business logic in components; import types from `@lyra/shared`; honor light/Linear tokens + dark mode; visual source of truth = the approved mockups in `.superpowers/brainstorm/834-1781785093/content/` (`connections.html`, `publish-composer.html`, `import-media-v2.html`, `nav-placement.html`).
- After `apps/api`/`packages/shared` changes: rebuild shared (if changed) → rebuild api → restart :3001. Full gate: `pnpm turbo run type-check lint test build`.
- Contract (verbatim) — base path `/workspaces/:id/connectors`:
  `PUT credentials` · `GET connect-link?connector=` · `GET channels` · `DELETE channels/:channelId` · `POST publish`→`{jobId,status}` · `GET jobs/:jobId` · `POST resolve` · `POST download`.

---

## Phase A — shared contracts + api thin proxy + mock

### Task 1: Shared contracts

**Files:** `packages/shared/src/models/index.ts`, `packages/shared/src/dto/index.ts`

**Produces:** `Channel`, `Receipt`, `MediaItem`, `PublishJob`, `ConnectorInfo` models; `SaveCredentialDto`, `PublishDto`, `ResolveDto`, `DownloadDto`.

- [ ] **Step 1: Add models** — in `packages/shared/src/models/index.ts`, append:

```ts
// ===== Built-in connectors (publish + media import) =====
export interface ConnectorInfo { id: string; label: string; platforms: string[] }
export interface Channel { id: string; platform: string; displayName: string }
export interface Receipt {
  platform: string; accountId: string;
  url?: string; postId?: string; status: 'ok' | 'failed'; error?: string;
}
export interface PublishJob {
  jobId: string; status: 'queued' | 'running' | 'done' | 'failed'; receipts?: Receipt[];
}
export interface MediaItem {
  index: number; type: 'video' | 'image' | 'audio'; thumbUrl?: string; filename?: string;
}
```

- [ ] **Step 2: Add DTOs** — in `packages/shared/src/dto/index.ts`, append:

```ts
// ===== Built-in connectors =====
export interface SaveCredentialDto { connector: string; apiKey: string }
export interface PublishDto { channelIds: string[]; caption: string; mediaUrls: string[] }
export interface ResolveDto { url: string }
export interface DownloadDto { url: string; indices?: number[] }
```

- [ ] **Step 3: Build + type-check shared**

Run: `pnpm --filter @lyra/shared build && pnpm --filter @lyra/shared type-check` — both pass.

- [ ] **Step 4: Stage** — `git add packages/shared/src packages/shared/dist`

---

### Task 2: API `connectors` proxy module (forward-or-mock)

**Files (create):** `apps/api/src/connectors/connectors.proxy.ts`, `connectors.controller.ts`, `connectors.module.ts`, `dto/connectors.dto.ts`, `connectors.proxy.spec.ts`. **Modify:** `apps/api/src/app.module.ts`.

**Interfaces produced:** `ConnectorsProxy.forward(method, path, opts)` → returns parsed JSON or mock; HTTP routes per the contract.

- [ ] **Step 1: DTOs** — `apps/api/src/connectors/dto/connectors.dto.ts`

```ts
import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import type { DownloadDto, PublishDto, ResolveDto, SaveCredentialDto } from '@lyra/shared';

export class SaveCredentialBody implements SaveCredentialDto {
  @IsString() @MinLength(1) connector!: string;
  @IsString() @MinLength(1) apiKey!: string;
}
export class PublishBody implements PublishDto {
  @IsArray() @IsString({ each: true }) channelIds!: string[];
  @IsString() caption!: string;
  @IsArray() @IsString({ each: true }) mediaUrls!: string[];
}
export class ResolveBody implements ResolveDto {
  @IsString() @MinLength(1) url!: string;
}
export class DownloadBody implements DownloadDto {
  @IsString() @MinLength(1) url!: string;
  @IsOptional() @IsArray() indices?: number[];
}
```

- [ ] **Step 2: Write the failing proxy test** — `apps/api/src/connectors/connectors.proxy.spec.ts`

```ts
import { ConnectorsProxy } from './connectors.proxy';

function proxy(url?: string) {
  const config = { get: (k: string) => (k === 'CONNECTORS_SERVICE_URL' ? url : 'tok') };
  return new ConnectorsProxy(config as never);
}

describe('ConnectorsProxy (mock mode — no service URL)', () => {
  const p = proxy(undefined);
  it('returns mock channels', async () => {
    const out = await p.forward('ws', 'u', 'GET', 'channels');
    expect(Array.isArray(out.channels)).toBe(true);
    expect(out.channels.length).toBeGreaterThan(0);
  });
  it('publish returns a jobId, then job is done with receipts', async () => {
    const pub = await p.forward('ws', 'u', 'POST', 'publish', { channelIds: ['c1'], caption: 'hi', mediaUrls: [] });
    expect(pub.jobId).toBeTruthy();
    const job = await p.forward('ws', 'u', 'GET', `jobs/${pub.jobId}`);
    expect(job.status).toBe('done');
    expect(Array.isArray(job.receipts)).toBe(true);
  });
  it('resolve returns media items', async () => {
    const out = await p.forward('ws', 'u', 'POST', 'resolve', { url: 'https://x' });
    expect(out.items.length).toBeGreaterThan(0);
  });
});

describe('ConnectorsProxy (forward mode — service URL set)', () => {
  it('forwards to the service with auth + workspace headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ json: () => Promise.resolve({ channels: [] }) });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    await proxy('http://svc:9100/').forward('ws1', 'u1', 'GET', 'channels');
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('http://svc:9100/channels');
    expect(init.headers['X-Workspace-Id']).toBe('ws1');
    expect(init.headers.Authorization).toContain('Bearer');
  });
});
```

- [ ] **Step 3: Run it — expect FAIL** — `pnpm --filter @lyra/api test -- connectors.proxy` → FAIL (class missing).

- [ ] **Step 4: Implement the proxy** — `apps/api/src/connectors/connectors.proxy.ts`

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Thin proxy: forward to the connectors microservice when CONNECTORS_SERVICE_URL is
// set, else return deterministic mock data so the UI works with no microservice.
@Injectable()
export class ConnectorsProxy {
  constructor(private readonly config: ConfigService) {}

  async forward(
    workspaceId: string,
    userId: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    const base = this.config.get<string>('CONNECTORS_SERVICE_URL');
    if (!base) return this.mock(method, path, body);
    const token = this.config.get<string>('CONNECTORS_SERVICE_TOKEN') ?? '';
    const res = await fetch(`${base.replace(/\/+$/, '')}/${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Workspace-Id': workspaceId,
        'X-User-Id': userId,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Record<string, unknown>;
  }

  // Deterministic mock for the env-gated fallback.
  private mock(method: string, path: string, body?: unknown): Record<string, unknown> {
    if (path === 'channels')
      return {
        channels: [
          { id: 'mock-tt', platform: 'tiktok', displayName: '@mock.tiktok' },
          { id: 'mock-ig', platform: 'instagram', displayName: '@mock.instagram' },
        ],
      };
    if (path === 'connect-link') return { url: '#mock-connect' };
    if (path === 'credentials') return { ok: true };
    if (path === 'publish') return { jobId: 'mock-job-1', status: 'queued' };
    if (path.startsWith('jobs/'))
      return {
        jobId: path.slice(5),
        status: 'done',
        receipts: [
          { platform: 'tiktok', accountId: 'mock-tt', status: 'ok', url: 'https://example.com/mock-tt' },
          { platform: 'instagram', accountId: 'mock-ig', status: 'ok', url: 'https://example.com/mock-ig' },
        ],
      };
    if (path === 'resolve')
      return {
        items: [
          { index: 0, type: 'video', filename: 'clip.mp4' },
          { index: 1, type: 'image', filename: '1.jpg' },
        ],
      };
    if (path === 'download')
      return { items: [{ url: 'https://example.com/mock-download', filename: 'media.zip' }] };
    return {};
  }
}
```

- [ ] **Step 5: Run the test — expect PASS** — `pnpm --filter @lyra/api test -- connectors.proxy` (4 tests pass).

- [ ] **Step 6: Controller** — `apps/api/src/connectors/connectors.controller.ts`

```ts
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import type { User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ConnectorsProxy } from './connectors.proxy';
import { DownloadBody, PublishBody, ResolveBody, SaveCredentialBody } from './dto/connectors.dto';

@Controller('workspaces/:id/connectors')
@UseGuards(WorkspaceGuard)
export class ConnectorsController {
  constructor(private readonly proxy: ConnectorsProxy) {}

  @Put('credentials')
  saveCredential(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: SaveCredentialBody) {
    return this.proxy.forward(ws, u.id, 'PUT', 'credentials', b);
  }
  @Get('connect-link')
  connectLink(@Param('id') ws: string, @CurrentUser() u: User, @Query('connector') connector: string) {
    return this.proxy.forward(ws, u.id, 'GET', `connect-link?connector=${encodeURIComponent(connector ?? '')}`);
  }
  @Get('channels')
  channels(@Param('id') ws: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', 'channels');
  }
  @Delete('channels/:channelId')
  removeChannel(@Param('id') ws: string, @Param('channelId') c: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'DELETE', `channels/${c}`);
  }
  @Post('publish')
  publish(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: PublishBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'publish', b);
  }
  @Get('jobs/:jobId')
  job(@Param('id') ws: string, @Param('jobId') j: string, @CurrentUser() u: User) {
    return this.proxy.forward(ws, u.id, 'GET', `jobs/${j}`);
  }
  @Post('resolve')
  resolve(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: ResolveBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'resolve', b);
  }
  @Post('download')
  download(@Param('id') ws: string, @CurrentUser() u: User, @Body() b: DownloadBody) {
    return this.proxy.forward(ws, u.id, 'POST', 'download', b);
  }
}
```

> **canManageKeys:** `credentials`, `connect-link`, `channels DELETE` should require it. Check how `KeysController` enforces `canManageKeys` (a metadata decorator read by `WorkspaceGuard`) and apply the same to those three routes.

- [ ] **Step 7: Module + register** — `apps/api/src/connectors/connectors.module.ts`

```ts
import { Module } from '@nestjs/common';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ConnectorsController } from './connectors.controller';
import { ConnectorsProxy } from './connectors.proxy';

@Module({
  imports: [WorkspacesModule], // WorkspaceGuard + MembershipsService
  controllers: [ConnectorsController],
  providers: [ConnectorsProxy],
})
export class ConnectorsModule {}
```

Add `ConnectorsModule` to `apps/api/src/app.module.ts` imports.

- [ ] **Step 8: Type-check + boot** — `pnpm --filter @lyra/api type-check`; build + restart api; confirm the 8 `connectors` routes are mapped + clean boot.

- [ ] **Step 9: Stage** — `git add apps/api/src/connectors apps/api/src/app.module.ts`

---

## Phase B — web (nav group + 3 pages, mock-backed)

### Task 3: Web connectors api client + i18n + nav/routes

**Files:** create `apps/web/src/lib/connectors.ts`; create `apps/web/src/i18n/locales/{en,vi}/connectors.ts` (+ register in the locale index); modify `apps/web/src/App.tsx` (routes), `apps/web/src/layout/AppLayout.tsx` (Built-ins nav group), `apps/web/src/layout/icons.tsx` (icons).

- [ ] **Step 1: api client** — `apps/web/src/lib/connectors.ts`

```ts
import { api } from './api';
import type { Channel, MediaItem, PublishJob } from '@lyra/shared';

const base = (ws: string) => `/workspaces/${ws}/connectors`;
export const connectorsApi = {
  saveCredential: (ws: string, connector: string, apiKey: string) =>
    api(`${base(ws)}/credentials`, { method: 'PUT', body: JSON.stringify({ connector, apiKey }) }),
  connectLink: (ws: string, connector: string) =>
    api<{ url: string }>(`${base(ws)}/connect-link?connector=${connector}`),
  channels: (ws: string) => api<{ channels: Channel[] }>(`${base(ws)}/channels`),
  removeChannel: (ws: string, id: string) => api(`${base(ws)}/channels/${id}`, { method: 'DELETE' }),
  publish: (ws: string, channelIds: string[], caption: string, mediaUrls: string[]) =>
    api<PublishJob>(`${base(ws)}/publish`, { method: 'POST', body: JSON.stringify({ channelIds, caption, mediaUrls }) }),
  job: (ws: string, jobId: string) => api<PublishJob>(`${base(ws)}/jobs/${jobId}`),
  resolve: (ws: string, url: string) => api<{ items: MediaItem[] }>(`${base(ws)}/resolve`, { method: 'POST', body: JSON.stringify({ url }) }),
  download: (ws: string, url: string, indices?: number[]) =>
    api<{ items: { url: string; filename: string }[] }>(`${base(ws)}/download`, { method: 'POST', body: JSON.stringify({ url, indices }) }),
};
```

- [ ] **Step 2: i18n** — create `connectors.ts` locale files (EN + VI) with keys for the 3 screens (titles, labels, buttons, statuses) and register the namespace in `apps/web/src/i18n/locales/{en,vi}/index.ts` + the i18n resources. Mirror an existing locale file's shape.

- [ ] **Step 3: Icons + nav group** — add `PublishIcon`, `ImportIcon`, `ConnectionsIcon` to `icons.tsx`. In `AppLayout.tsx`, after the Projects `NavLink`, add a **Built-ins** group label + 3 `NavLink`s (`/publish`, `/import`, `/connections`) following the existing `nav-item` pattern; add these paths to `MODULES` + `NAV_KEY` so the breadcrumb resolves.

- [ ] **Step 4: Routes** — in `App.tsx`, import the 3 pages and add child routes `publish`, `import`, `connections`.

- [ ] **Step 5: Type-check** — `pnpm --filter @lyra/web type-check` (will fail until pages exist — create stub pages returning `null`, or do this step after Tasks 5–7). Stub the 3 page components first so routing compiles.

- [ ] **Step 6: Stage** — `git add` the new/modified web files.

### Task 4: Connections page

**File:** create `apps/web/src/pages/Connections.tsx`. Visual source: `connections.html`.

- [ ] **Step 1:** Build `Connections.tsx` — port the markup/classes from `connections.html` into JSX. State: `channels` (from `connectorsApi.channels`), a masked Postiz-key input (calls `saveCredential`), "Connect a channel" → `connectLink` then `window.open(url)`, channel remove → `removeChannel` + reload. Use `useWorkspace()` for `ws`, the `api` wrapper, `useTranslation`. Move the mockup's inline `<style>` into a CSS file or `index.css` block. Render the Cobalt status section statically.
- [ ] **Step 2:** Type-check web → pass. Manually load `/connections` (mock mode) → shows 2 mock channels.
- [ ] **Step 3:** Stage.

### Task 5: Publish composer page

**File:** create `apps/web/src/pages/PublishComposer.tsx`. Visual source: `publish-composer.html`.

- [ ] **Step 1:** Build it — load `channels`; multi-select chips (toggle `channelIds`); caption textarea (+ count); media url list (paste/add); **Publish** → `connectorsApi.publish(...)` → `{ jobId }` → **poll** `connectorsApi.job(ws, jobId)` every ~1.5s until `status` is `done`/`failed` → render `receipts` (✓ link / ✗ error). Disable Publish while a job runs.
- [ ] **Step 2:** Type-check; manual `/publish` (mock) → publish → receipts render (2 ok).
- [ ] **Step 3:** Stage.

### Task 6: Import media page

**File:** create `apps/web/src/pages/ImportMedia.tsx`. Visual source: `import-media-v2.html` (taller ~168px tiles).

- [ ] **Step 1:** Build it — URL input + **Fetch** → `connectorsApi.resolve(ws, url)` → render `items` grid (tiles per the v2 mockup); per-item ↓ and **Download all** → `connectorsApi.download(...)` → trigger browser download of returned urls. ToS notice by the action.
- [ ] **Step 2:** Type-check; manual `/import` (mock) → Fetch → 2 items render.
- [ ] **Step 3:** Stage.

### Task 7: Web test for the composer poll

**File:** create `apps/web/src/pages/PublishComposer.test.ts(x)` (Vitest, `environment: node` → use `renderToStaticMarkup` for markup + a pure helper test for the toggle/poll-state logic, mirroring `RunRating.test.tsx`).

- [ ] **Step 1:** Extract the channel-toggle + "ready to publish" logic into a pure exported function and unit-test it; smoke-test the composer markup renders channel chips. Run → pass.
- [ ] **Step 2:** Stage.

---

### Task 8: Full gate + manual mock verification

- [ ] **Step 1:** `pnpm turbo run type-check lint test build` → all green (api +4 proxy tests, web + composer test).
- [ ] **Step 2:** Rebuild shared+api, restart api (mock mode — `CONNECTORS_SERVICE_URL` unset). Web via Vite HMR.
- [ ] **Step 3:** Manual (real login): visit **Built-ins → Connections** (2 mock channels, save key ok), **Publish** (compose → publish → 2 ok receipts), **Import** (paste any url → Fetch → 2 items). Confirm the nav group + breadcrumbs.
- [ ] **Step 4:** Report counts/files/results. Leave staged; commit only when the user asks.

---

## Self-Review

**1. Spec coverage** (vs frontend-design + backend-architecture + ui-proxy specs): nav group → T3; Connections (key/channels/connect/Cobalt status) → T4; Publish composer (chips/caption/media/gate/receipts-poll) → T5; Import (resolve/preview/download) → T6; thin proxy + **env-gated mock** → T2; contract endpoints → T2; shared types → T1; auth in proxy → T2 (WorkspaceGuard + canManageKeys note). Microservice + pipeline wiring = explicitly out of scope. ✓

**2. Placeholder scan:** web page tasks reference the **approved mockup files** (real artifacts) for markup + give exact api wiring — concrete, not "TBD". The only "mirror the existing pattern" notes (canManageKeys decorator, i18n namespace registration, RunRating test style) point at concrete existing code. ✓

**3. Type consistency:** `Channel`/`Receipt`/`PublishJob`/`MediaItem` and the DTOs are used identically across shared, the api DTOs/proxy/tests, and the web `connectorsApi` client. Endpoint paths match the contract verbatim across proxy, controller, and web client. ✓
