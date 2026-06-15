# Lyra — Getting Started (Claude Code Kickoff)

Hand this file **plus** `lyra-requirements.md` to Claude Code. This doc is the concrete starting point: stack, bootstrap commands, the `shared` contracts (copy-paste ready), and the Phase 0 spec (Monorepo + Auth) with a definition of done.

> **Correction vs. earlier mockup:** the pipeline uses **5 providers**, not 4. The Brain steps (brief / insight / prompts / qa) run on **Claude**, so there is an **Anthropic** key in addition to OpenAI (GPT-5.5), DeepSeek, Image, and Video.

---

## 0. Stack (pin where it matters)
- **Monorepo:** Turborepo + **pnpm** workspaces. *(Turbo is optional at this size — pnpm workspaces alone link everything; Turbo is kept for build caching + task ordering. Drop it later if you don't want it.)*
- **Language:** TypeScript (strict) everywhere
- **web:** React 18 + Vite + React Router + @tanstack/react-query
- **api:** NestJS 10 + Mongoose (MongoDB) + Passport-JWT + argon2 + **class-validator** (request validation)
- **shared:** TypeScript types + enums + constants + pure utils — **no runtime dependencies**, built with **tsup**
- **later:** BullMQ + Redis (render phase), Cloudinary/S3 (assets)

> **Validation:** `shared` carries no validation library. The api validates request bodies with **class-validator** DTO classes (Nest's native `ValidationPipe`). DTO *types* live in `shared`; the api's DTO *classes* `implements` them so they can never drift.

---

## 1. Target structure (end of Phase 0)
```
lyra/
├─ apps/
│  ├─ web/                       # Vite React SPA
│  └─ api/                       # NestJS
├─ packages/
│  ├─ shared/                    # @lyra/shared — types/enums/constants/utils, zero deps
│  │  └─ src/{enums,models,dto,constants,utils}/  index.ts
│  ├─ tsconfig/                  # base.json, react.json, node.json
│  └─ eslint-config/
├─ turbo.json
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
└─ package.json
```

---

## 2. Bootstrap commands
```bash
mkdir lyra && cd lyra
git init && pnpm init                       # set "private": true, "packageManager": "pnpm@9"
pnpm add -Dw turbo typescript

mkdir -p apps packages
mkdir -p packages/shared/src/{enums,models,dto,constants,utils}

# shared first (both apps depend on it) — no runtime deps, just build tooling
cd packages/shared && pnpm add -D tsup typescript && cd ../..

# api
pnpm dlx @nestjs/cli new apps/api --package-manager pnpm --skip-git
cd apps/api && pnpm add @nestjs/mongoose mongoose @nestjs/jwt @nestjs/passport passport passport-jwt argon2 class-validator class-transformer cookie-parser @nestjs/throttler @nestjs/config && pnpm add -D @types/passport-jwt @types/cookie-parser && pnpm add @lyra/shared@workspace:* && cd ../..

# web
pnpm create vite@latest apps/web -- --template react-ts
cd apps/web && pnpm add react-router-dom @tanstack/react-query && pnpm add @lyra/shared@workspace:* && cd ../..

pnpm install
```

---

## 3. Root config files

**package.json (root)**
```json
{
  "name": "lyra",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "test": "turbo run test"
  },
  "devDependencies": { "turbo": "^2.0.0", "typescript": "^5.4.0" }
}
```

**pnpm-workspace.yaml**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**turbo.json**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":      { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":        { "cache": false, "persistent": true },
    "lint":       {},
    "type-check": { "dependsOn": ["^build"] },
    "test":       { "dependsOn": ["^build"] }
  }
}
```

**tsconfig.base.json**
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true, "declaration": true,
    "resolveJsonModule": true, "isolatedModules": true,
    "experimentalDecorators": true, "emitDecoratorMetadata": true
  }
}
```

**apps/api/.env.example**
```
NODE_ENV=development
PORT=3001
MONGODB_URI=mongodb://localhost:27017/lyra
WEB_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
# 32-byte hex key for AES-256-GCM encryption of stored provider keys
ENCRYPTION_KEY=replace_with_64_hex_chars
```
> Provider keys (OpenAI / Anthropic / DeepSeek / Image / Video) are **never** env vars — users enter them per workspace and they're encrypted in Mongo using ENCRYPTION_KEY.

---

## 4. The `shared` package = single source of truth
- Holds **types** (entity models + DTO interfaces), **enums**, **constants** (`STEP_DEFS`, `STEP_PROVIDERS`), and **pure utils** (`canViewProject`, `canEditProject`, `canManageKeys`, `fillPrompt`). **No runtime dependencies.**
- Entity models are the **safe transport shapes** — what the API returns and the web consumes.
- **Server-only fields** (`passwordHash`, `encryptedKey`, `tokenHash`) live ONLY in the api's Mongoose schemas — never in shared, never sent to the client.
- ids are `string` in shared (Mongo ObjectId serialized to string).
- DTO **interfaces** live here; the api implements them as class-validator **classes** (section 6).

---

## 5. `shared` contracts (copy-paste ready)

**packages/shared/package.json**
```json
{
  "name": "@lyra/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "dev": "tsup src/index.ts --format esm --dts --watch",
    "type-check": "tsc --noEmit"
  }
}
```

**src/enums/index.ts**
```ts
export enum Role { Owner = 'owner', Member = 'member' }
export enum ProjectVisibility { Private = 'private', Shared = 'shared', Workspace = 'workspace' }
export enum RunStatus { Idle='idle', Running='running', AwaitingGate='awaiting_gate', Done='done', Error='error' }
export enum StepStatus { Idle='idle', Queued='queued', Running='running', Waiting='waiting', Done='done', Error='error' }
export enum StepMode { Auto = 'auto', Gate = 'gate' }
export enum StepKey { Find='find', Crawl='crawl', Brief='brief', Insight='insight', Prompts='prompts', Images='images', Video='video', QA='qa' }
export enum Provider { OpenAI='openai', DeepSeek='deepseek', Anthropic='anthropic', Image='image', Video='video' }
```

**src/models/index.ts**
```ts
import { Role, ProjectVisibility, RunStatus, StepStatus, StepMode, StepKey } from '../enums';

export interface User       { id: string; email: string; name: string; createdAt: string; }
export interface Workspace  { id: string; name: string; type: 'personal'|'team'; createdBy: string; createdAt: string; }
export interface Membership { id: string; workspaceId: string; userId: string; role: Role; canManageKeys: boolean; createdAt: string; }
export interface Invite     { id: string; workspaceId: string; email: string; role: Role; status: 'pending'|'accepted'|'revoked'; expiresAt: string; createdAt: string; }
export interface ApiKeyInfo { id: string; workspaceId: string; provider: string; last4: string; updatedAt: string; } // no encryptedKey

export interface Project {
  id: string; workspaceId: string; createdBy: string;
  name: string; product: string; niche: string; homepageUrl: string;
  brandBrief?: Record<string, unknown>; learnings?: string[];
  visibility: ProjectVisibility; sharedWith: string[];   // used only when visibility === 'shared'
  createdAt: string;
}

export interface Step {
  index: number; key: StepKey; mode: StepMode; status: StepStatus;
  model: string; prompt: string; result?: string; assetIds?: string[];
  usage?: { tokens?: number; costUsd?: number }; error?: string;
  startedAt?: string; finishedAt?: string;
}
export interface Run {
  id: string; projectId: string; workspaceId: string; createdBy: string;
  status: RunStatus; currentStep: number; steps: Step[]; createdAt: string; updatedAt: string;
}
export interface Asset {
  id: string; runId: string; workspaceId: string; stepIndex: number;
  type: 'image'|'video'|'audio'; url: string; thumbUrl?: string; meta?: Record<string, unknown>; approved?: boolean;
}
```

**src/constants/steps.ts**
```ts
import { StepKey, StepMode, Provider } from '../enums';

export const STEP_PROVIDERS: Record<StepKey, Provider> = {
  [StepKey.Find]:    Provider.OpenAI,
  [StepKey.Crawl]:   Provider.DeepSeek,
  [StepKey.Brief]:   Provider.Anthropic,
  [StepKey.Insight]: Provider.Anthropic,
  [StepKey.Prompts]: Provider.Anthropic,
  [StepKey.Images]:  Provider.Image,
  [StepKey.Video]:   Provider.Video,
  [StepKey.QA]:      Provider.Anthropic,
};

export interface StepDef { index: number; key: StepKey; title: string; owner: string; mode: StepMode; phase: 'source'|'brain'|'render'|'finish'; promptTemplate: string; }

export const STEP_DEFS: StepDef[] = [
  { index:0, key:StepKey.Find,    title:'Find sources',        owner:'GPT-5.5 Pro',                mode:StepMode.Auto, phase:'source',
    promptTemplate:'Find the top-performing competitor ads and reference creatives for {product} in the {niche} space.\nReturn 8–10 sources, each with: URL, the hook, format, and why it performs.' },
  { index:1, key:StepKey.Crawl,   title:'Crawl & extract',     owner:'DeepSeek',                   mode:StepMode.Auto, phase:'source',
    promptTemplate:'Crawl the sources from Step 1.\nExtract: ad copy, hooks, visible specs, price points, and visual patterns.\nOutput structured JSON grouped by source.' },
  { index:2, key:StepKey.Brief,   title:'Brand Brief',         owner:'Claude',                     mode:StepMode.Gate, phase:'brain',
    promptTemplate:'Paste brand info below — Claude structures it into brand DNA.\n\n• Color story:\n• Product details (variants, specs):\n• Voice / tone:\n• The Quiet Hero arc:\n• Homepage: {homepage}' },
  { index:3, key:StepKey.Insight, title:'Competitor Insight',  owner:'Claude',                     mode:StepMode.Auto, phase:'brain',
    promptTemplate:'From the crawled data, identify for {product}:\n• Winning angles + hooks\n• Visual patterns that repeat\n• The gap we can own\n• Tropes to avoid' },
  { index:4, key:StepKey.Prompts, title:'Direction + Prompts', owner:'Claude',                     mode:StepMode.Gate, phase:'brain',
    promptTemplate:'Generate from the brief + insights:\n• 9 image prompts (hero, grip detail, lifestyle ×3, studio ×2, before/after, packaging)\n• 3 UGC scripts (15s, hook-led)\nReview and edit below, then approve to unlock render.' },
  { index:5, key:StepKey.Images,  title:'Images',              owner:'cutout · generate · upscale',mode:StepMode.Auto, phase:'render',
    promptTemplate:'Render stills from the approved prompts.\n• Product shots: edit the REAL product image (keep the trainer accurate)\n• Atmospheric shots: generate fresh, brand-graded\n• Upscale 4×, clean backgrounds' },
  { index:6, key:StepKey.Video,   title:'Video / UGC',         owner:'avatars · cinematic · voice',mode:StepMode.Auto, phase:'render',
    promptTemplate:'Produce from the approved scripts:\n• 3 avatar UGC ads for paid social\n• 1 cinematic b-roll cut for the brand film\n• Voiceover matched to the {product} brand voice' },
  { index:7, key:StepKey.QA,      title:'Assemble + QA',       owner:'logo · grade · caption',     mode:StepMode.Gate, phase:'finish',
    promptTemplate:'Final assembly + QA:\n• Apply logo + color grade + captions\n• Check brand fit and product accuracy\nApprove to ship the batch.' },
];
```

**src/utils/index.ts**
```ts
import { Role, ProjectVisibility } from '../enums';
import type { Project } from '../models';

export interface MemberCtx { userId: string; role: Role; canManageKeys: boolean; }

export function canViewProject(p: Pick<Project,'createdBy'|'visibility'|'sharedWith'>, ctx: MemberCtx): boolean {
  if (ctx.role === Role.Owner) return true;                         // owner override
  if (p.createdBy === ctx.userId) return true;
  if (p.visibility === ProjectVisibility.Workspace) return true;
  if (p.visibility === ProjectVisibility.Shared) return p.sharedWith.includes(ctx.userId);
  return false;                                                     // private, not creator
}
export function canEditProject(p: Pick<Project,'createdBy'>, ctx: MemberCtx): boolean {
  return ctx.role === Role.Owner || p.createdBy === ctx.userId;
}
export function canManageKeys(ctx: MemberCtx): boolean {
  return ctx.role === Role.Owner || ctx.canManageKeys;
}

export function fillPrompt(tmpl: string, vars: { product?: string; niche?: string; homepage?: string }): string {
  return tmpl
    .replace(/{product}/g,  vars.product?.trim()  || '{product}')
    .replace(/{niche}/g,    vars.niche?.trim()    || '{niche}')
    .replace(/{homepage}/g, vars.homepage?.trim() || '{homepage}');
}
```

**src/dto/index.ts** — DTO **types** only (no validation lib; the api validates these with class-validator)
```ts
import { Role, ProjectVisibility } from '../enums';

export interface SignupDto        { email: string; password: string; name: string; }
export interface LoginDto         { email: string; password: string; }
export interface CreateProjectDto { name: string; product: string; niche: string; homepageUrl: string; }
export interface UpdateProjectDto {
  name?: string; product?: string; niche?: string; homepageUrl?: string;
  brandBrief?: Record<string, unknown>; visibility?: ProjectVisibility; sharedWith?: string[];
}
export interface InviteDto        { email: string; role: Role; }
export interface UpdatePromptDto  { prompt: string; }
export interface UpsertKeyDto     { key: string; }
```

**src/index.ts**
```ts
export * from './enums';
export * from './models';
export * from './constants/steps';
export * from './utils';
export * from './dto';
```

---

## 6. Phase 0 — api (NestJS): Auth
Build only auth + users in Phase 0. Workspaces/projects/keys/runs come in later phases (see requirements B8).

**Modules / files**
```
apps/api/src/
├─ main.ts                 # cookie-parser, CORS=WEB_ORIGIN(credentials), global ValidationPipe, global JwtAuthGuard
├─ app.module.ts           # ConfigModule.forRoot, MongooseModule.forRoot(MONGODB_URI), ThrottlerModule, AuthModule
├─ common/
│  ├─ guards/jwt-auth.guard.ts      # extends AuthGuard('jwt'); honors @Public()
│  ├─ decorators/public.decorator.ts
│  └─ decorators/current-user.decorator.ts
├─ users/
│  ├─ user.schema.ts       # { email(unique), passwordHash, name } — passwordHash NEVER serialized
│  └─ users.service.ts
└─ auth/
   ├─ auth.module.ts
   ├─ auth.controller.ts   # signup, login, refresh, logout, me
   ├─ auth.service.ts      # argon2 hash/verify, issue tokens, rotate refresh
   ├─ jwt.strategy.ts      # validates access token from Authorization header
   ├─ refresh-token.schema.ts  # { userId, tokenHash, expiresAt }
   └─ dto/
      ├─ signup.dto.ts     # class-validator class implements SignupDto
      └─ login.dto.ts      # class-validator class implements LoginDto
```

**Validation — class-validator (Nest native)**
```ts
// apps/api/src/main.ts  (excerpt)
app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

// apps/api/src/auth/dto/signup.dto.ts
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { SignupDto } from '@lyra/shared';

export class SignupBody implements SignupDto {   // implements → can't drift from shared type
  @IsEmail()  email!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(8) password!: string;
}
```

**Token strategy**
- Access: `JwtService.sign({ sub: userId }, { secret: JWT_ACCESS_SECRET, expiresIn: ACCESS_TOKEN_TTL })` → returned in JSON body.
- Refresh: random opaque token → cookie `rt` (httpOnly, secure, sameSite=strict, path=/auth/refresh) → store **argon2 hash** in `refresh-token` collection with `expiresAt`.
- `POST /auth/refresh`: read `rt` cookie → find matching non-expired hash → **rotate** (delete old, issue new rt + new access) → return access.
- `POST /auth/logout`: delete the rt record + clear cookie.
- Passwords: argon2id.

**Endpoints (Phase 0)**
```
POST /auth/signup   body=SignupBody  -> creates user (+ personal workspace stub) -> {accessToken, user}
POST /auth/login    body=LoginBody   -> {accessToken, user}   (+ sets rt cookie)
POST /auth/refresh  (rt cookie)      -> {accessToken}
POST /auth/logout                    -> 204
GET  /auth/me       (Bearer)         -> {user}
```
Mark signup/login/refresh as `@Public()`; everything else requires the global `JwtAuthGuard`.

---

## 7. Phase 0 — web (Vite React)
```
apps/web/src/
├─ main.tsx                # QueryClientProvider, RouterProvider
├─ lib/api.ts             # fetch wrapper: attach in-memory access token; on 401 -> call /auth/refresh once -> retry
├─ auth/AuthContext.tsx   # holds access token in memory (NOT localStorage); bootstraps via /auth/refresh on load
├─ auth/useAuth.ts
├─ pages/Login.tsx        # request body typed with LoginDto from @lyra/shared
├─ pages/Signup.tsx
└─ pages/Dashboard.tsx    # placeholder behind auth
```
- Access token in memory only; refresh cookie is httpOnly (browser sends it automatically with `credentials: 'include'`).
- On app load, call `/auth/refresh` to silently restore a session.
- Import DTO types from shared to type request bodies; do light inline form checks (required/format). The server is the source of truth for validation.

---

## 8. Phase 0 — Definition of Done
- `pnpm install` + `pnpm dev` runs web + api together via Turbo.
- `@lyra/shared` builds and is imported by both apps (one type change propagates to both).
- Sign up → user persisted (argon2 hash), access token returned, rt cookie set; invalid bodies rejected by `ValidationPipe`.
- Refresh on reload restores the session; logout clears it.
- `GET /auth/me` returns the user only with a valid Bearer token; 401 otherwise.
- Passwords/hashes/tokens never appear in any API response.

---

## 9. Beyond Phase 0 (build order — see requirements B8)
1. Workspaces + memberships (`canManageKeys`) + invites; personal workspace on signup; switcher.
2. Projects (visibility/sharedWith, default **private**) + encrypted workspace-level API keys (5 providers).
3. Run state machine with **fake results** (port the workbench) — gates, run-all, reset. No AI spend.
4. Brain steps (Claude) real — Steps 3/4/5 via the `StepProvider` interface.
5. Source steps — GPT-5.5 (1) + DeepSeek crawl (2).
6. Render steps + BullMQ/Redis — images (6) + video (7); assets to Cloudinary/S3.
7. Assemble/QA + loop into Step 5 + harden + deploy.

---

## 10. Claude Code setup (plugins & config)

You'll drive this build with Claude Code, so set it up against the repo first.

**Install & run**
```bash
npm install -g @anthropic-ai/claude-code   # requires Node 18+ (repo uses 20)
cd lyra
claude
```
Docs: https://docs.claude.com/en/docs/claude-code/overview — plugin/MCP commands evolve, so confirm exact syntax there.

**Context files.** Claude Code auto-reads `CLAUDE.md`. Use the root one in §12, plus a small per-package file so rules apply where they're relevant:
- `apps/api/CLAUDE.md` — NestJS: module-per-feature, class-validator DTOs that `implements` the shared interfaces, never expose server-only fields.
- `apps/web/CLAUDE.md` — React/Vite: in-memory access token, types from `@lyra/shared`, no business logic in components.
- `packages/shared/CLAUDE.md` — types/enums/constants/utils only; zero runtime deps.

**Permissions — `.claude/settings.json`.** Pre-allow the commands Claude Code runs so it doesn't stop to ask each time:
```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm:*)", "Bash(turbo:*)", "Bash(npx nest:*)",
      "Bash(vite:*)", "Bash(tsc:*)", "Bash(node:*)",
      "Bash(git:*)", "Bash(docker:*)"
    ]
  }
}
```

**MCP servers worth adding for this stack**
- **context7** — pulls current NestJS / Mongoose / Vite / React / BullMQ docs into context, so generated code matches today's APIs instead of stale ones.
- **MongoDB MCP** — lets Claude inspect the dev database while building: verify the indexes from §7, look at stored documents. Point it at your local `MONGODB_URI`.

Add via `claude mcp add ...` or an `.mcp.json` at the repo root (confirm the exact command in the docs).

**Plugins — best ones for Lyra** (you already run several of these):
- **typescript-lsp** — type-aware diagnostics across the strict-TS monorepo; it catches type errors the moment Claude edits, which is exactly what keeps the shared-types contract honest. The highest-value plugin here.
- **frontend-design** — for the React workbench; pair it with `lyra-design-system.md` so the UI matches the tokens.
- **context7** — same up-to-date-docs benefit as the MCP above (it's the plugin form).
- **code-review** — a review pass over each diff before you commit; mirrors the CI gate.
- **ralph-loop** — drive a phase to its Definition of Done autonomously, then review the result.
- **superpowers** — the engineering-process layer (plan → test-first → verify) — what makes Claude Code follow the loop in §11 instead of jumping to code. Keep it enabled. See §11.

**Workflow for Lyra**
1. Hand Claude Code `lyra-getting-started.md` + `lyra-requirements.md`, then run starter prompt #1 (§13).
2. Build **one phase at a time**; let `typescript-lsp` + `pnpm type-check` gate each step.
3. Run **code-review** before each commit; use **ralph-loop** to push a phase to its Definition of Done.
4. Keep `CLAUDE.md` updated as conventions emerge — it compounds across sessions.

## 11. Development process (plan → test → build → ship)

Run every phase — and every feature inside it — through one loop. This is where **superpowers** earns its place: it's the plugin that makes Claude Code plan and test *before* writing code, instead of jumping straight to implementation. Keep it enabled — and keep the loop written down here so the process never depends on a single plugin.

**The loop (per phase / per feature)**
1. **Plan** — Claude restates the goal, lists the files it will create or change, and the acceptance criteria (the phase's Definition of Done). You approve the plan before any code is written. *(superpowers: planning)*
2. **Contract first** — settle the shared types / DTOs / endpoints in `@lyra/shared` before implementing, so api and web build against a fixed shape.
3. **Test first** — write the failing test for the unit or endpoint, then implement until it's green. Highest value on: auth flows, the access helpers (`canViewProject` / `canManageKeys`), DTO validation, and the run-orchestrator transitions. *(superpowers: TDD)*
4. **Implement** — write the code; `typescript-lsp` surfaces type errors as you edit.
5. **Verify** — run the CI tasks locally: `pnpm turbo run lint type-check test build`. Nothing is "done" until they pass *and* the phase's Definition of Done is met. *(superpowers: verify-before-done)*
6. **Review** — run **code-review** over the diff; fix what it flags.
7. **Commit & PR** — small, focused commits; CI gates the PR; merging to `main` deploys (see the hosting doc).
8. **Autonomy** — let **ralph-loop** drive a phase to green on its own, then you review at the phase boundary.

**Testing strategy (per layer)**
- **shared** — Vitest unit tests for the pure helpers (`canViewProject`, `canEditProject`, `canManageKeys`, `fillPrompt`). Cheap, high-value, no setup.
- **api** — Jest unit tests for services, guards, and the orchestrator transitions; **supertest** e2e for the auth endpoints against **mongodb-memory-server**, so tests never touch a real database.
- **web** — Vitest + React Testing Library for `AuthContext` and the login/signup forms; add Playwright for the login → dashboard flow once it's stable.
- Everything hangs off the `test` task in `turbo.json`, so `pnpm turbo run test` runs the whole suite and CI gates it.

**Division of labor**
- **superpowers** → the methodology (brainstorm → plan → TDD → verify).
- **the docs** (requirements + this file) → *what* to build and the contracts.
- **typescript-lsp / code-review / ralph-loop** → enforce each stage (types, review, the autonomous loop).

**Rule of thumb:** no code before an approved plan; nothing is "done" before the tests and the Definition of Done both pass.

## 12. Suggested `CLAUDE.md` (repo root)
```md
# Lyra
Turborepo (pnpm) · TS strict · apps/web (Vite React) · apps/api (NestJS+Mongoose) · packages/shared (types only, zero deps).

## Rules
- All shared types, enums, constants (STEP_DEFS, STEP_PROVIDERS), and access helpers (canViewProject/canEditProject/canManageKeys) live in @lyra/shared. Never duplicate them in an app.
- shared has NO runtime dependencies and NO validation library. Request validation is done in the api with class-validator DTO classes that `implements` the shared DTO interface (so they can't drift).
- Server-only fields (passwordHash, encryptedKey, tokenHash) stay in api Mongoose schemas; never put them in shared or any API response.
- Auth: JWT access (memory) + rotating refresh (httpOnly cookie, hashed in DB). Email+password, argon2id.
- Multi-tenancy: every query scoped by workspaceId; workspace is checked per request, not stored in the JWT.
- Provider API keys are per-workspace, AES-256-GCM encrypted in Mongo. 5 providers: openai, anthropic, deepseek, image, video.
- Follow the phase order in lyra-requirements.md (§B8). Build Phase 0 first.

## Commands
pnpm dev | pnpm build | pnpm type-check | pnpm lint
```

## 13. Starter prompts for Claude Code
1. "Read lyra-requirements.md and lyra-getting-started.md. Scaffold the Turborepo per §1–3: root config, packages/shared, empty apps/web and apps/api. Then create all files in §5 exactly. shared has no runtime deps."
2. "Build Phase 0 api auth per §6 — users + auth modules, argon2, JWT access + rotating refresh cookie, guards, the five endpoints. Validate request bodies with class-validator DTO classes that implement the shared DTO interfaces. Add a .env from .env.example."
3. "Build Phase 0 web per §7 — AuthContext with in-memory token + silent refresh, the fetch wrapper, Login/Signup typed with shared DTO interfaces, a guarded Dashboard placeholder."
4. "Verify the Phase 0 Definition of Done in §8 end-to-end and fix anything failing."
