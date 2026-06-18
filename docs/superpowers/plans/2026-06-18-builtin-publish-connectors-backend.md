# Built-in Publish Connectors — Backend (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-agnostic "publish to channels" capability — a pipeline can run an **Action: Publish** step that posts upstream content to linked accounts via a swappable `PublishConnector`, end-to-end on a **Mock connector**, gated and idempotent, returning receipts.

**Architecture:** New `connectors` feature module (interface + registry + Mock + `ConnectedAccount` storage + linking controller), a `StepCategory` on pipeline/run steps, and a branch in the run engine's step executor that dispatches `action` steps to the connector registry instead of a `StepProvider`. No web in this plan (Plan 2). No real backend (Mock only).

**Tech Stack:** NestJS 10 + Mongoose (api), `@lyra/shared` (types/DTO interfaces), Jest (api unit), Vitest (shared). Reuses `EncryptionService`, the `ProviderRegistry`/`MockStepProvider` pattern, and the `mapPool` fan-out helper.

## Global Constraints

- **Commits are DEFERRED.** The user commits manually. Each task ends with `git add` (stage) + verification — do **not** `git commit`. Final task runs the full gate.
- **`@lyra/shared` has ZERO runtime deps** — interfaces/enums/constants only; api implements class-validator DTO classes that `implements` the shared interfaces.
- **Server-only secrets, encrypted:** connector credentials live only in the api (AES-256-GCM via `EncryptionService`); the safe `ConnectedAccount` transport shape **never** carries the credential. Reuse `EncryptionService.encrypt(plain)` / `decrypt(enc)`.
- **Publishing is always gated:** an `action` step MUST be `mode: gate`; the engine rejects an `auto` action step.
- **Idempotency:** running/re-running an action step posts to an account **at most once** (skip accounts already in the step's receipts with `status: 'ok'`).
- **Multi-tenancy:** `ConnectedAccount` + credentials + receipts are `workspaceId`-scoped; linking is gated by **`canManageKeys`** (via `WorkspaceGuard`).
- **Partial failure:** publishing to N accounts tolerates per-account failure; the step completes with mixed receipts; it errors only if **every** account fails.
- After any `apps/api`/`packages/shared` change: `pnpm --filter @lyra/shared build` (if shared changed, first) → `pnpm --filter @lyra/api build` → restart api on :3001.
- Full gate: `pnpm turbo run type-check lint test build`.

## File structure

- `packages/shared/src/enums/index.ts` — add `StepCategory`.
- `packages/shared/src/models/index.ts` — add `Receipt`, `ConnectedAccount`, `PublishConnectorInfo`; add `category?`, `action?`, `receipts?` to `Step` + `PipelineStep`.
- `packages/shared/src/dto/index.ts` — add `PublishStepConfig`, `StartLinkDto`, `ConnectAccountDto`.
- `apps/api/src/connectors/connected-account.schema.ts` — Mongoose schema (server-only `encryptedCredential`).
- `apps/api/src/connectors/connected-account.views.ts` — safe transport mapper.
- `apps/api/src/connectors/connected-accounts.service.ts` — CRUD + credential encrypt/decrypt.
- `apps/api/src/connectors/publish-connector.interface.ts` — `PublishConnector`, `PublishContext`, etc.
- `apps/api/src/connectors/mock.connector.ts` — `MockPublishConnector`.
- `apps/api/src/connectors/connector.registry.ts` — `ConnectorRegistry`.
- `apps/api/src/connectors/connectors.controller.ts` — connectors + linking endpoints.
- `apps/api/src/connectors/dto/connectors.dto.ts` — DTO classes.
- `apps/api/src/connectors/connectors.module.ts` — wiring.
- `apps/api/src/keys/keys.module.ts` — export `EncryptionService`.
- `apps/api/src/pipelines/pipeline.schema.ts` — `PipelineStepItem` += `category`, `action`.
- `apps/api/src/pipelines/pipelines.service.ts` — `normalizeSteps` carries `category`/`action`.
- `apps/api/src/runs/run.schema.ts` — `RunStep` += `category`, `action`, `receipts`.
- `apps/api/src/runs/run.views.ts` — map the new fields.
- `apps/api/src/runs/runs.service.ts` — copy `category`/`action` on run creation; branch `executeStep` to publish; idempotency.
- `apps/api/src/runs/run.engine.ts` — `assertPublishGated` helper.
- `apps/api/src/runs/runs.module.ts` — import `ConnectorsModule`.
- Tests: `apps/api/src/connectors/{connector.registry,connected-accounts.service}.spec.ts`, extend `apps/api/src/runs/runs.service.spec.ts`.

---

### Task 1: Shared contracts

**Files:**
- Modify: `packages/shared/src/enums/index.ts`
- Modify: `packages/shared/src/models/index.ts`
- Modify: `packages/shared/src/dto/index.ts`

**Interfaces produced:**
- `enum StepCategory { Generate='generate', Action='action' }`
- `Receipt { platform: string; accountId: string; url?: string; postId?: string; status: 'ok'|'failed'; error?: string }`
- `ConnectedAccount { id; workspaceId; connector; platform; displayName; externalId } & Audited` (no credential)
- `PublishConnectorInfo { id: string; label: string; platforms: string[] }`
- `Step`/`PipelineStep` gain `category?: StepCategory`, `action?: PublishStepConfig`, and `Step` also gains `receipts?: Receipt[]`
- `PublishStepConfig { connector: string; accountIds: string[]; caption?: string }`
- `StartLinkDto { connector: string }`, `ConnectAccountDto { connector: string; externalId: string; displayName: string; credential: string }`

- [ ] **Step 1: Add the enum**

In `packages/shared/src/enums/index.ts`, after `StepMode`:

```ts
// A step either generates content (prompt -> provider) or performs an external
// action (publish to a channel). Existing steps default to Generate.
export enum StepCategory {
  Generate = 'generate',
  Action = 'action',
}
```

- [ ] **Step 2: Add models**

In `packages/shared/src/models/index.ts`, import `StepCategory` in the enum import block, then add before `export interface Step`:

```ts
// One published-post outcome from an Action step (per target account).
export interface Receipt {
  platform: string;
  accountId: string;
  url?: string;
  postId?: string;
  status: 'ok' | 'failed';
  error?: string;
}

// A configured Action: publish step (lives on a pipeline/run step).
export interface PublishStepConfig {
  connector: string; // connector id (e.g. 'mock')
  accountIds: string[]; // target ConnectedAccount ids
  caption?: string; // template; defaults to {input}
}

// A linked external channel account (safe transport shape — no credential).
export interface ConnectedAccount extends Audited {
  id: string;
  workspaceId: string;
  connector: string;
  platform: string; // 'youtube' | 'facebook' | 'tiktok' | 'instagram' | ...
  displayName: string;
  externalId: string;
}

// A connector available to attach to an Action step.
export interface PublishConnectorInfo {
  id: string;
  label: string;
  platforms: string[];
}
```

Then add to **`Step`** (after `assetIds?`): `category?: StepCategory;` `action?: PublishStepConfig;` `receipts?: Receipt[];`
And to **`PipelineStep`** (after `condition?`): `category?: StepCategory;` `action?: PublishStepConfig;`

- [ ] **Step 3: Add DTOs**

In `packages/shared/src/dto/index.ts`, add `PublishStepConfig` to the `../models` import, then append:

```ts
// ===== Publish connectors =====
export interface StartLinkDto {
  connector: string;
}
export interface ConnectAccountDto {
  connector: string;
  externalId: string;
  displayName: string;
  credential: string; // stored encrypted; never returned
}
```

Also add `category?: StepCategory` + `action?: PublishStepConfig` to `PipelineStepInput` (import both from the enums/models).

- [ ] **Step 4: Build + type-check shared**

Run: `pnpm --filter @lyra/shared build && pnpm --filter @lyra/shared type-check`
Expected: both succeed.

- [ ] **Step 5: Stage (no commit)**

```bash
git add packages/shared/src packages/shared/dist
```

---

### Task 2: `ConnectedAccount` storage (api)

**Files:**
- Create: `apps/api/src/connectors/connected-account.schema.ts`
- Create: `apps/api/src/connectors/connected-account.views.ts`
- Create: `apps/api/src/connectors/connected-accounts.service.ts`
- Test: `apps/api/src/connectors/connected-accounts.service.spec.ts`
- Modify: `apps/api/src/keys/keys.module.ts` (export `EncryptionService`)

**Interfaces:**
- Consumes: `EncryptionService.encrypt/decrypt`, `BaseRepository`, `UsersService.refMap`.
- Produces: `ConnectedAccountsService.{ listForWorkspace, create, remove, getDecryptedCredential, toView, toViews }`.

- [ ] **Step 1: Export `EncryptionService` from `KeysModule`**

In `apps/api/src/keys/keys.module.ts`, change `exports: [KeysService]` to:

```ts
  exports: [KeysService, EncryptionService],
```

- [ ] **Step 2: Schema** — `apps/api/src/connectors/connected-account.schema.ts`

```ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { AuditedEntity } from '../common/database/audited.entity';

export type ConnectedAccountDocument = HydratedDocument<ConnectedAccount>;

@Schema({ timestamps: true })
export class ConnectedAccount extends AuditedEntity {
  @Prop({ required: true, index: true })
  workspaceId!: string;

  @Prop({ required: true })
  connector!: string;

  @Prop({ required: true })
  platform!: string;

  @Prop({ required: true })
  displayName!: string;

  @Prop({ required: true })
  externalId!: string;

  // Server-only — the encrypted connector credential. Never serialized.
  @Prop({ required: true })
  encryptedCredential!: string;
}

export const ConnectedAccountSchema = SchemaFactory.createForClass(ConnectedAccount);
ConnectedAccountSchema.index({ workspaceId: 1, connector: 1 });
```

- [ ] **Step 3: View mapper** — `apps/api/src/connectors/connected-account.views.ts`

```ts
import type { ConnectedAccount as Model, UserRef } from '@lyra/shared';
import type { ConnectedAccountDocument } from './connected-account.schema';
import { userRef } from '../common/refs';
import { iso } from '../common/dates';

// Safe transport shape — drops encryptedCredential.
export function toConnectedAccount(
  doc: ConnectedAccountDocument,
  refs: Map<string, UserRef>,
): Model {
  return {
    id: doc._id.toString(),
    workspaceId: doc.workspaceId,
    connector: doc.connector,
    platform: doc.platform,
    displayName: doc.displayName,
    externalId: doc.externalId,
    active: doc.active ?? true,
    createdBy: userRef(doc.createdBy, refs),
    updatedBy: userRef(doc.updatedBy, refs),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt ?? doc.createdAt),
  };
}
```

- [ ] **Step 4: Write the failing service test** — `apps/api/src/connectors/connected-accounts.service.spec.ts`

```ts
import { ConnectedAccountsService } from './connected-accounts.service';

describe('ConnectedAccountsService.getDecryptedCredential', () => {
  it('decrypts the stored credential via EncryptionService', async () => {
    const enc = { encrypt: jest.fn(), decrypt: jest.fn().mockReturnValue('secret') };
    const users = { refMap: jest.fn() };
    const svc = new ConnectedAccountsService({} as never, enc as never, users as never);
    jest
      .spyOn(svc, 'findById')
      .mockResolvedValue({ encryptedCredential: 'enc' } as never);
    const out = await svc.getDecryptedCredential('acct-1');
    expect(out).toBe('secret');
    expect(enc.decrypt).toHaveBeenCalledWith('enc');
  });

  it('returns null when the account is missing', async () => {
    const enc = { encrypt: jest.fn(), decrypt: jest.fn() };
    const svc = new ConnectedAccountsService({} as never, enc as never, { refMap: jest.fn() } as never);
    jest.spyOn(svc, 'findById').mockResolvedValue(null as never);
    expect(await svc.getDecryptedCredential('nope')).toBeNull();
  });
});
```

- [ ] **Step 5: Run it — expect FAIL**

Run: `pnpm --filter @lyra/api test -- connected-accounts.service`
Expected: FAIL (module/class not found).

- [ ] **Step 6: Service** — `apps/api/src/connectors/connected-accounts.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ConnectedAccount as ConnectedAccountModel } from '@lyra/shared';
import { ConnectedAccount, ConnectedAccountDocument } from './connected-account.schema';
import { BaseRepository } from '../common/database/base.repository';
import { EncryptionService } from '../keys/encryption.service';
import { UsersService } from '../users/users.service';
import { toConnectedAccount } from './connected-account.views';

@Injectable()
export class ConnectedAccountsService extends BaseRepository<ConnectedAccount> {
  constructor(
    @InjectModel(ConnectedAccount.name) model: Model<ConnectedAccount>,
    private readonly encryption: EncryptionService,
    private readonly users: UsersService,
  ) {
    super(model);
  }

  listForWorkspace(workspaceId: string) {
    return this.find({ workspaceId }, { sort: { createdAt: -1 } });
  }

  create(
    workspaceId: string,
    input: { connector: string; platform: string; displayName: string; externalId: string; credential: string },
    actorId: string,
  ) {
    return super.create({
      workspaceId,
      connector: input.connector,
      platform: input.platform,
      displayName: input.displayName,
      externalId: input.externalId,
      encryptedCredential: this.encryption.encrypt(input.credential),
      createdBy: actorId,
      updatedBy: actorId,
    } as Partial<ConnectedAccount>);
  }

  remove(workspaceId: string, id: string, actorId: string) {
    return this.model
      .findOneAndUpdate(
        { _id: id, workspaceId, active: { $ne: false } },
        { active: false, updatedBy: actorId },
      )
      .exec();
  }

  async getDecryptedCredential(id: string): Promise<string | null> {
    const doc = await this.findById(id);
    return doc ? this.encryption.decrypt(doc.encryptedCredential) : null;
  }

  async toView(doc: ConnectedAccountDocument): Promise<ConnectedAccountModel> {
    const refs = await this.users.refMap([doc.createdBy, doc.updatedBy]);
    return toConnectedAccount(doc, refs);
  }

  async toViews(docs: ConnectedAccountDocument[]): Promise<ConnectedAccountModel[]> {
    const refs = await this.users.refMap(docs.flatMap((d) => [d.createdBy, d.updatedBy]));
    return docs.map((d) => toConnectedAccount(d, refs));
  }
}
```

- [ ] **Step 7: Run the test — expect PASS**

Run: `pnpm --filter @lyra/api test -- connected-accounts.service`
Expected: PASS (2 tests).

- [ ] **Step 8: Stage (no commit)**

```bash
git add apps/api/src/connectors/connected-account.schema.ts apps/api/src/connectors/connected-account.views.ts apps/api/src/connectors/connected-accounts.service.ts apps/api/src/connectors/connected-accounts.service.spec.ts apps/api/src/keys/keys.module.ts
```

---

### Task 3: `PublishConnector` interface + registry + Mock connector

**Files:**
- Create: `apps/api/src/connectors/publish-connector.interface.ts`
- Create: `apps/api/src/connectors/mock.connector.ts`
- Create: `apps/api/src/connectors/connector.registry.ts`
- Test: `apps/api/src/connectors/connector.registry.spec.ts`

**Interfaces:**
- Produces: `PublishConnector { id, label, platforms, linkUrl(), listAccounts(), publish() }`; `ConnectorRegistry.{ list(), get(id) }`.

- [ ] **Step 1: Interface** — `apps/api/src/connectors/publish-connector.interface.ts`

```ts
import type { Receipt } from '@lyra/shared';

// Content to publish to one account.
export interface PublishContext {
  text: string;
  assetUrls: string[];
  account: { id: string; platform: string; externalId: string; credential: string };
}

// A discoverable external account for a connector + credential.
export interface RemoteAccount {
  platform: string;
  externalId: string;
  displayName: string;
}

// The single interface every publish backend implements (Mock now; hosted/OSS/
// direct later). Registered by id in ConnectorRegistry — swapping = one line.
export interface PublishConnector {
  readonly id: string;
  readonly label: string;
  readonly platforms: string[];
  // Begin account linking — returns a URL the user visits to authorize.
  linkUrl(workspaceId: string): Promise<{ connectUrl: string }>;
  // Accounts reachable with a credential (after the user authorized).
  listAccounts(credential: string): Promise<RemoteAccount[]>;
  // Publish once to one account; never throws — returns a Receipt.
  publish(ctx: PublishContext): Promise<Receipt>;
}
```

- [ ] **Step 2: Mock connector** — `apps/api/src/connectors/mock.connector.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { Receipt } from '@lyra/shared';
import type { PublishConnector, PublishContext, RemoteAccount } from './publish-connector.interface';

// A no-network connector: lets the whole publish flow run + be tested without any
// real platform. Replace/augment with a real connector later (registry one-liner).
@Injectable()
export class MockPublishConnector implements PublishConnector {
  readonly id = 'mock';
  readonly label = 'Mock (testing)';
  readonly platforms = ['youtube', 'facebook', 'tiktok', 'instagram'];

  linkUrl(workspaceId: string): Promise<{ connectUrl: string }> {
    return Promise.resolve({ connectUrl: `mock://connect/${workspaceId}` });
  }

  listAccounts(): Promise<RemoteAccount[]> {
    return Promise.resolve([
      { platform: 'tiktok', externalId: 'mock-tt-1', displayName: 'Mock TikTok' },
      { platform: 'instagram', externalId: 'mock-ig-1', displayName: 'Mock Instagram' },
    ]);
  }

  publish(ctx: PublishContext): Promise<Receipt> {
    return Promise.resolve({
      platform: ctx.account.platform,
      accountId: ctx.account.id,
      url: `mock://post/${ctx.account.platform}/${Date.now ? 'x' : 'x'}`,
      postId: `mock-${ctx.account.externalId}`,
      status: 'ok',
    });
  }
}
```

> Note: avoid `Date.now()` in deterministic code paths under test; the mock `url` uses a static stub.

- [ ] **Step 3: Write the failing registry test** — `apps/api/src/connectors/connector.registry.spec.ts`

```ts
import { ConnectorRegistry } from './connector.registry';
import { MockPublishConnector } from './mock.connector';

describe('ConnectorRegistry', () => {
  const reg = new ConnectorRegistry(new MockPublishConnector());

  it('lists connectors as info shapes', () => {
    const list = reg.list();
    expect(list).toEqual([{ id: 'mock', label: 'Mock (testing)', platforms: ['youtube', 'facebook', 'tiktok', 'instagram'] }]);
  });

  it('gets a connector by id', () => {
    expect(reg.get('mock').id).toBe('mock');
  });

  it('throws on an unknown connector', () => {
    expect(() => reg.get('nope')).toThrow(/unknown connector/i);
  });
});
```

- [ ] **Step 4: Run it — expect FAIL**

Run: `pnpm --filter @lyra/api test -- connector.registry`
Expected: FAIL (class not found).

- [ ] **Step 5: Registry** — `apps/api/src/connectors/connector.registry.ts`

```ts
import { Injectable } from '@nestjs/common';
import type { PublishConnectorInfo } from '@lyra/shared';
import { MockPublishConnector } from './mock.connector';
import type { PublishConnector } from './publish-connector.interface';

// Maps connector id -> implementation. Add a real connector here (one line) to
// swap the Mock backend for hosted/OSS/direct later.
@Injectable()
export class ConnectorRegistry {
  private readonly byId: Map<string, PublishConnector>;

  constructor(mock: MockPublishConnector) {
    this.byId = new Map([[mock.id, mock]]);
  }

  list(): PublishConnectorInfo[] {
    return [...this.byId.values()].map((c) => ({ id: c.id, label: c.label, platforms: c.platforms }));
  }

  get(id: string): PublishConnector {
    const c = this.byId.get(id);
    if (!c) throw new Error(`Unknown connector: ${id}`);
    return c;
  }
}
```

- [ ] **Step 6: Run the test — expect PASS**

Run: `pnpm --filter @lyra/api test -- connector.registry`
Expected: PASS (3 tests).

- [ ] **Step 7: Stage (no commit)**

```bash
git add apps/api/src/connectors/publish-connector.interface.ts apps/api/src/connectors/mock.connector.ts apps/api/src/connectors/connector.registry.ts apps/api/src/connectors/connector.registry.spec.ts
```

---

### Task 4: Connectors module + linking controller

**Files:**
- Create: `apps/api/src/connectors/dto/connectors.dto.ts`
- Create: `apps/api/src/connectors/connectors.controller.ts`
- Create: `apps/api/src/connectors/connectors.module.ts`
- Modify: `apps/api/src/app.module.ts` (register `ConnectorsModule`)

**Interfaces:**
- Consumes: Task 2 service, Task 3 registry, `WorkspaceGuard`.
- Produces: HTTP — `GET /connectors`, `GET/POST/DELETE /workspaces/:id/connected-accounts`, `POST /workspaces/:id/connectors/:connector/link`, `POST /workspaces/:id/connectors/:connector/accounts`.

- [ ] **Step 1: DTOs** — `apps/api/src/connectors/dto/connectors.dto.ts`

```ts
import { IsString, MinLength } from 'class-validator';
import type { ConnectAccountDto, StartLinkDto } from '@lyra/shared';

export class ConnectAccountBody implements ConnectAccountDto {
  @IsString() connector!: string;
  @IsString() @MinLength(1) externalId!: string;
  @IsString() @MinLength(1) displayName!: string;
  @IsString() @MinLength(1) credential!: string;
}

export class ListRemoteAccountsBody {
  @IsString() @MinLength(1) credential!: string;
}
```

(`StartLinkDto` has no body — the connector id is a path param.)

- [ ] **Step 2: Controller** — `apps/api/src/connectors/connectors.controller.ts`

```ts
import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { ConnectedAccount, PublishConnectorInfo, User } from '@lyra/shared';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../workspaces/guards/workspace.guard';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectorRegistry } from './connector.registry';
import { ConnectAccountBody, ListRemoteAccountsBody } from './dto/connectors.dto';
import type { RemoteAccount } from './publish-connector.interface';

@Controller()
export class ConnectorsController {
  constructor(
    private readonly accounts: ConnectedAccountsService,
    private readonly registry: ConnectorRegistry,
  ) {}

  // Available connectors (public catalog — no workspace needed).
  @Get('connectors')
  listConnectors(): PublishConnectorInfo[] {
    return this.registry.list();
  }

  @Get('workspaces/:id/connected-accounts')
  @UseGuards(WorkspaceGuard)
  async list(@Param('id') workspaceId: string): Promise<ConnectedAccount[]> {
    return this.accounts.toViews(await this.accounts.listForWorkspace(workspaceId));
  }

  // Begin linking — returns a connect URL from the connector.
  @Post('workspaces/:id/connectors/:connector/link')
  @UseGuards(WorkspaceGuard) // canManageKeys enforced below
  startLink(
    @Param('id') workspaceId: string,
    @Param('connector') connector: string,
  ): Promise<{ connectUrl: string }> {
    return this.registry.get(connector).linkUrl(workspaceId);
  }

  // Discover accounts reachable with a credential (after authorize).
  @Post('workspaces/:id/connectors/:connector/accounts')
  @UseGuards(WorkspaceGuard)
  listRemote(
    @Param('connector') connector: string,
    @Body() body: ListRemoteAccountsBody,
  ): Promise<RemoteAccount[]> {
    return this.registry.get(connector).listAccounts(body.credential);
  }

  // Persist a linked account (encrypts the credential).
  @Post('workspaces/:id/connected-accounts')
  @UseGuards(WorkspaceGuard)
  async connect(
    @Param('id') workspaceId: string,
    @Body() body: ConnectAccountBody,
    @CurrentUser() user: User,
  ): Promise<ConnectedAccount> {
    const remote = await this.registry.get(body.connector).listAccounts(body.credential);
    const platform = remote.find((r) => r.externalId === body.externalId)?.platform ?? body.connector;
    const doc = await this.accounts.create(
      workspaceId,
      { connector: body.connector, platform, displayName: body.displayName, externalId: body.externalId, credential: body.credential },
      user.id,
    );
    return this.accounts.toView(doc);
  }

  @Delete('workspaces/:id/connected-accounts/:accountId')
  @UseGuards(WorkspaceGuard)
  async remove(
    @Param('id') workspaceId: string,
    @Param('accountId') accountId: string,
    @CurrentUser() user: User,
  ): Promise<{ ok: true }> {
    await this.accounts.remove(workspaceId, accountId, user.id);
    return { ok: true };
  }
}
```

> **`canManageKeys`:** `WorkspaceGuard` already enforces membership + role + `canManageKeys` per the existing pattern used by `KeysController` (`/workspaces/:id/keys`). Mirror that controller's guard usage exactly — if it relies on a metadata decorator (e.g. `@RequireManageKeys()`), copy it onto the link/connect/remove routes. (Check `keys.controller.ts` and replicate.)

- [ ] **Step 3: Module** — `apps/api/src/connectors/connectors.module.ts`

```ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { UsersModule } from '../users/users.module';
import { KeysModule } from '../keys/keys.module'; // EncryptionService
import { ConnectedAccount, ConnectedAccountSchema } from './connected-account.schema';
import { ConnectedAccountsService } from './connected-accounts.service';
import { ConnectorRegistry } from './connector.registry';
import { MockPublishConnector } from './mock.connector';
import { ConnectorsController } from './connectors.controller';

@Module({
  imports: [
    WorkspacesModule,
    UsersModule,
    KeysModule,
    MongooseModule.forFeature([{ name: ConnectedAccount.name, schema: ConnectedAccountSchema }]),
  ],
  controllers: [ConnectorsController],
  providers: [ConnectedAccountsService, ConnectorRegistry, MockPublishConnector],
  exports: [ConnectedAccountsService, ConnectorRegistry],
})
export class ConnectorsModule {}
```

- [ ] **Step 4: Register the module** — in `apps/api/src/app.module.ts`, add `ConnectorsModule` to the `imports` array (follow the existing import-list pattern).

- [ ] **Step 5: Type-check + boot**

Run: `pnpm --filter @lyra/api type-check`
Then build + restart the api and confirm `Nest application successfully started` and the routes log (`/connectors`, `/workspaces/:id/connected-accounts`, …).
Expected: clean boot, routes mapped.

- [ ] **Step 6: Stage (no commit)**

```bash
git add apps/api/src/connectors/dto apps/api/src/connectors/connectors.controller.ts apps/api/src/connectors/connectors.module.ts apps/api/src/app.module.ts
```

---

### Task 5: Pipeline + run step fields (`category`, `action`, `receipts`)

**Files:**
- Modify: `apps/api/src/pipelines/pipeline.schema.ts` (`PipelineStepItem`)
- Modify: `apps/api/src/pipelines/pipelines.service.ts` (`normalizeSteps`)
- Modify: `apps/api/src/runs/run.schema.ts` (`RunStep`)
- Modify: `apps/api/src/runs/run.views.ts` (`toStep`)
- Modify: `apps/api/src/runs/runs.service.ts` (`createForPipeline` copies `category`/`action`)

**Interfaces:**
- Consumes: `StepCategory`, `PublishStepConfig`, `Receipt` (Task 1).
- Produces: persisted `category`/`action` on pipeline + run steps; `receipts` on run steps; `RunModel`/`Step` carry them.

- [ ] **Step 1: `PipelineStepItem`** — in `apps/api/src/pipelines/pipeline.schema.ts`, add to the class (after `condition`):

```ts
  // Action: publish steps. category 'generate' (default) keeps the prompt path.
  @Prop({ enum: Object.values(StepCategory), default: StepCategory.Generate })
  category!: string;

  @Prop({ type: Object })
  action?: { connector: string; accountIds: string[]; caption?: string };
```

Add `StepCategory` to the `@lyra/shared` import at the top.

- [ ] **Step 2: `normalizeSteps`** — in `apps/api/src/pipelines/pipelines.service.ts`, inside the returned step object in `normalizeSteps`, add (after `condition`):

```ts
        category: s.category ?? undefined,
        action: s.action?.connector
          ? {
              connector: s.action.connector,
              accountIds: Array.isArray(s.action.accountIds) ? s.action.accountIds : [],
              caption: s.action.caption?.trim() || undefined,
            }
          : undefined,
```

(Models for `action` are validated against real accounts at run time, not here.)

- [ ] **Step 3: `RunStep`** — in `apps/api/src/runs/run.schema.ts`, add to the `RunStep` class (after `assetIds`):

```ts
  @Prop()
  category?: string;

  @Prop({ type: Object })
  action?: { connector: string; accountIds: string[]; caption?: string };

  @Prop({ type: [Object], default: undefined })
  receipts?: { platform: string; accountId: string; url?: string; postId?: string; status: string; error?: string }[];
```

- [ ] **Step 4: `toStep`** — in `apps/api/src/runs/run.views.ts`, add to the returned object:

```ts
    category: s.category as Step['category'],
    action: s.action,
    receipts: s.receipts as Step['receipts'],
```

- [ ] **Step 5: `createForPipeline`** — in `apps/api/src/runs/runs.service.ts`, in the `steps.push({...})` block, add:

```ts
        category: ps.category,
        action: ps.action,
```

and extend the `PipelineRunInput.steps[]` type + the controllers' `steps.map(...)` (in `runs.controller.ts`, all three places that map `pipeline.steps`) to pass `category: s.category, action: s.action`.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @lyra/api type-check`
Expected: passes.

- [ ] **Step 7: Stage (no commit)**

```bash
git add apps/api/src/pipelines/pipeline.schema.ts apps/api/src/pipelines/pipelines.service.ts apps/api/src/runs/run.schema.ts apps/api/src/runs/run.views.ts apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.controller.ts
```

---

### Task 6: Run-engine action execution (the core)

**Files:**
- Modify: `apps/api/src/runs/run.engine.ts` (`assertPublishGated`)
- Modify: `apps/api/src/runs/runs.service.ts` (branch `executeStep`; `executePublish`)
- Modify: `apps/api/src/runs/runs.module.ts` (import `ConnectorsModule`)
- Test: extend `apps/api/src/runs/runs.service.spec.ts`

**Interfaces:**
- Consumes: `ConnectorRegistry.get`, `ConnectedAccountsService.{ findById, getDecryptedCredential }`, the existing `mapPool` + `fillPrompt`/`resolveStepRefs`, `StepCategory`.
- Produces: action steps publish via the registry; `step.receipts` populated; idempotent; gate-enforced.

- [ ] **Step 1: `assertPublishGated`** — in `apps/api/src/runs/run.engine.ts`, add:

```ts
import { StepCategory } from '@lyra/shared'; // add to existing import

// A publish (action) step must be a gate — publishing is never auto.
export function assertPublishGated(step: Step): void {
  if (step.category === StepCategory.Action && step.mode !== StepMode.Gate) {
    throw new RunTransitionError('Publish steps must be gated (set the step to gate mode).');
  }
}
```

- [ ] **Step 2: Wire `ConnectorsModule` into `RunsModule`** — in `apps/api/src/runs/runs.module.ts`, add `ConnectorsModule` to `imports` and inject `ConnectorRegistry` + `ConnectedAccountsService` into `RunsService`'s constructor (both exported by `ConnectorsModule`).

- [ ] **Step 3: Write the failing tests** — append to `apps/api/src/runs/runs.service.spec.ts`:

```ts
import { StepCategory, StepMode } from '@lyra/shared';

describe('RunsService.executePublish', () => {
  function svcWith(connector: { publish: jest.Mock }, accounts: Record<string, { platform: string; externalId: string }>) {
    const registry = { get: jest.fn().mockReturnValue(connector) };
    const accountsSvc = {
      findById: jest.fn((id: string) => Promise.resolve(accounts[id] ? { _id: { toString: () => id }, ...accounts[id] } : null)),
      getDecryptedCredential: jest.fn().mockResolvedValue('cred'),
    };
    return new RunsService(
      {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
      registry as never, accountsSvc as never,
    );
  }

  const step = (over: object = {}) => ({
    index: 0, mode: StepMode.Gate, status: 'idle', model: '', prompt: 'hi',
    category: StepCategory.Action,
    action: { connector: 'mock', accountIds: ['a1', 'a2'], caption: 'Launch!' },
    receipts: undefined, ...over,
  });

  it('publishes to each account and records receipts', async () => {
    const publish = jest.fn().mockImplementation(({ account }) =>
      Promise.resolve({ platform: account.platform, accountId: account.id, status: 'ok', postId: 'p' }),
    );
    const svc = svcWith({ publish }, { a1: { platform: 'tiktok', externalId: 'x1' }, a2: { platform: 'instagram', externalId: 'x2' } });
    const out = await svc.executePublish(
      { workspaceId: 'ws', variables: {} } as never,
      { steps: [step()] } as never,
      0,
    );
    expect(publish).toHaveBeenCalledTimes(2);
    expect(out.receipts).toHaveLength(2);
    expect(out.receipts!.every((r) => r.status === 'ok')).toBe(true);
  });

  it('tolerates partial failure (1 of 2 fails)', async () => {
    const publish = jest.fn()
      .mockResolvedValueOnce({ platform: 'tiktok', accountId: 'a1', status: 'ok' })
      .mockResolvedValueOnce({ platform: 'instagram', accountId: 'a2', status: 'failed', error: 'boom' });
    const svc = svcWith({ publish }, { a1: { platform: 'tiktok', externalId: 'x1' }, a2: { platform: 'instagram', externalId: 'x2' } });
    const out = await svc.executePublish({ workspaceId: 'ws', variables: {} } as never, { steps: [step()] } as never, 0);
    expect(out.receipts!.filter((r) => r.status === 'ok')).toHaveLength(1);
    expect(out.receipts!.filter((r) => r.status === 'failed')).toHaveLength(1);
  });

  it('is idempotent — skips accounts already published ok', async () => {
    const publish = jest.fn().mockResolvedValue({ platform: 'tiktok', accountId: 'a2', status: 'ok' });
    const svc = svcWith({ publish }, { a1: { platform: 'tiktok', externalId: 'x1' }, a2: { platform: 'instagram', externalId: 'x2' } });
    const s = step({ receipts: [{ platform: 'tiktok', accountId: 'a1', status: 'ok' }] });
    const out = await svc.executePublish({ workspaceId: 'ws', variables: {} } as never, { steps: [s] } as never, 0);
    expect(publish).toHaveBeenCalledTimes(1); // a1 skipped, only a2 posted
    expect(out.receipts).toHaveLength(2); // existing a1 + new a2
  });
});
```

- [ ] **Step 4: Run — expect FAIL**

Run: `pnpm --filter @lyra/api test -- runs.service`
Expected: FAIL (`executePublish` not a function).

- [ ] **Step 5: Implement** — in `apps/api/src/runs/runs.service.ts`:

(a) In `executeStep`, branch at the top (before the provider path):

```ts
    const step = state.steps[index];
    if (step.category === StepCategory.Action) {
      return this.executePublish(doc, state, index);
    }
    const provider = providerOf(step);
```

(b) Add the method (uses the existing `fillPrompt`, `resolveStepRefs`, `mapPool`):

```ts
  // Publish an Action step: resolve the caption + media, post to each target
  // account via the connector (capped parallel), tolerating per-account failure,
  // and skipping accounts already published ok (idempotent). Returns receipts.
  async executePublish(
    doc: RunDocument,
    state: RunState,
    index: number,
  ): Promise<StepRunOutput & { receipts: Receipt[] }> {
    const step = state.steps[index];
    const cfg = step.action;
    if (!cfg?.connector || !cfg.accountIds?.length) {
      throw new Error('Publish step has no connector or target accounts.');
    }
    const connector = this.registry.get(cfg.connector);

    // Caption: the action.caption template (default {input}) + chaining refs.
    const template = cfg.caption?.trim() || '{input}';
    const filled = fillPrompt(template, doc.variables ?? {});
    const { prompt: text } = resolveStepRefs(filled, state.steps, index);
    step.sentPrompt = text;

    // Media: the immediately-preceding step's assets (resolved to urls by the run).
    const prevAssetIds = index > 0 ? state.steps[index - 1]?.assetIds ?? [] : [];
    const assetUrls = await this.assets.urlsForIds(prevAssetIds);

    const done = new Set((step.receipts ?? []).filter((r) => r.status === 'ok').map((r) => r.accountId));
    const todo = cfg.accountIds.filter((id) => !done.has(id));

    const fresh = await mapPool(todo, FANOUT_CONCURRENCY, async (accountId): Promise<Receipt> => {
      const acct = await this.accounts.findById(accountId);
      if (!acct || acct.workspaceId !== doc.workspaceId) {
        return { platform: 'unknown', accountId, status: 'failed', error: 'account not found' };
      }
      const credential = (await this.accounts.getDecryptedCredential(accountId)) ?? '';
      try {
        return await connector.publish({
          text,
          assetUrls,
          account: { id: accountId, platform: acct.platform, externalId: acct.externalId, credential },
        });
      } catch (e) {
        return { platform: acct.platform, accountId, status: 'failed', error: e instanceof Error ? e.message : 'publish failed' };
      }
    });

    const receipts = [...(step.receipts ?? []), ...fresh];
    step.receipts = receipts;
    const okCount = receipts.filter((r) => r.status === 'ok').length;
    if (okCount === 0) throw new Error(`All ${cfg.accountIds.length} publishes failed (e.g. ${fresh[0]?.error}).`);
    return { result: `Published to ${okCount}/${cfg.accountIds.length} account(s).`, receipts, usage: { tokens: 0 } };
  }
```

(c) `completeStep` already persists `step.result`/`usage`; `step.receipts` is set on the `state` step reference, so it persists with the run. Confirm `completeStep` doesn't overwrite `receipts` (it doesn't — it only sets result/usage/status).

(d) Add `assertPublishGated(step)` into the `runStep` guard chain (after `assertRunnable`) and into `runAll` before running an action step, so an `auto` action step is rejected.

(e) Add a tiny helper on `AssetsService`: `urlsForIds(ids: string[]): Promise<string[]>` → load assets by id (scoped) and return their `url`s. If `AssetsService` lacks it, add it (follow `listForRun`'s pattern).

(f) Imports: add `StepCategory`, `type Receipt` to the `@lyra/shared` import; `assertPublishGated` to the engine import.

- [ ] **Step 6: Run — expect PASS**

Run: `pnpm --filter @lyra/api test -- runs.service`
Expected: PASS (existing rate tests + 3 publish tests).

- [ ] **Step 7: Type-check + boot**

Run: `pnpm --filter @lyra/api type-check`, then build + restart api; confirm clean boot.

- [ ] **Step 8: Stage (no commit)**

```bash
git add apps/api/src/runs/run.engine.ts apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.service.spec.ts apps/api/src/runs/runs.module.ts apps/api/src/assets/assets.service.ts
```

---

### Task 7: Backend gate + manual API verification (Mock, end-to-end)

**Files:** none (verification).

- [ ] **Step 1: Full CI gate**

Run: `pnpm turbo run type-check lint test build`
Expected: all tasks green; api unit count up (connected-accounts ×2, connector.registry ×3, publish ×3).

- [ ] **Step 2: Rebuild shared + api, restart api** (see Global Constraints). Confirm `Nest application successfully started` + the connectors routes mapped.

- [ ] **Step 3: Manual end-to-end via API** (real login per SESSION-HANDOFF; do not echo secrets). Workspace `6a309b8efe9ec7c83515dad5`:
  - `GET /connectors` → includes `{ id: 'mock', … }`.
  - `POST /workspaces/:id/connectors/mock/accounts` `{ "credential": "x" }` → mock remote accounts.
  - `POST /workspaces/:id/connected-accounts` `{ connector:'mock', externalId:'mock-tt-1', displayName:'Mock TikTok', credential:'x' }` → returns a `ConnectedAccount` (no credential field present).
  - Create a pipeline with a Generate step then an **action** step (`category:'action'`, `mode:'gate'`, `action:{connector:'mock',accountIds:[<id>],caption:'Hello {input}'}`) — via `POST /workspaces/:id/pipelines`.
  - Test-run it (`POST /workspaces/:id/pipelines/:pid/test-runs`), run steps; the action step pauses at the gate; approve → it publishes via Mock; `GET /runs/:id` shows `steps[1].receipts` with `status:'ok'`.
  - Re-run the step → no duplicate receipt (idempotent).
  - Try a pipeline with an `auto` action step → run is rejected with the "must be gated" message.

- [ ] **Step 4: Report** — counts, files, manual results. Leave staged; do not `git commit` unless asked.

---

## Self-Review

**1. Spec coverage** (vs `2026-06-18-builtin-publish-connectors-design.md`): connect accounts → T2/T4; publish-as-step → T5/T6; multi-channel + partial failure → T6; receipts → T1/T5/T6; swappable backend + Mock → T3; always-gated → T6 (`assertPublishGated`); encrypted server-side secrets → T2; idempotency → T6; workspace-scoping + `canManageKeys` → T2/T4. Web requirements are intentionally **Plan 2**. ✓

**2. Placeholder scan:** the only "check/replicate the existing pattern" notes (canManageKeys decorator in T4; `AssetsService.urlsForIds` in T6e) point at concrete existing code to mirror, not vague TODOs. The Mock `url` deliberately avoids `Date.now()`. ✓

**3. Type consistency:** `PublishStepConfig {connector, accountIds, caption?}`, `Receipt {platform, accountId, url?, postId?, status, error?}`, `StepCategory.Action='action'`, and `executePublish(doc,state,index)` are used identically across shared, schemas, service, and tests. ✓
