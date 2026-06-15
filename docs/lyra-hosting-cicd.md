# Lyra — Hosting & CI/CD

Deployment guide for the Turborepo app: **web** (Vite React SPA), **api** (NestJS), **worker** (BullMQ, added at the render phase), **MongoDB**, **Redis**, and **asset storage**.

> Repo/package scope is `@lyra/*`, repo is `lyra`. If the product name ever changes, rename here — nothing else depends on it.

---

## 1. Hosting topology

| Component | Recommended | Alternatives | Notes |
|---|---|---|---|
| **web** (SPA) | **Vercel** | Netlify, Cloudflare Pages | Static build, global CDN, preview deploy per PR |
| **api** (NestJS) | **Railway** | Render, Fly.io, VPS | Long-running Node server; needs persistent process (WebSockets, long jobs) |
| **worker** (BullMQ) | **Railway** (2nd service) | Render worker, Fly machine | Same Docker image as api, different start command. Added at the render phase. |
| **database** | **MongoDB Atlas** | self-host (not advised) | Managed, M0 free → M10 dedicated as you grow |
| **cache/queue** | **Upstash Redis** | Railway Redis, Render Redis | Serverless Redis for BullMQ; only needed once the queue lands |
| **assets** (img/video) | **Cloudflare R2** | AWS S3 + CloudFront, Cloudinary | Zero egress fees — best for serving generated media |
| **email** (invites) | **Resend** | Postmark, SES | Transactional invite + password-reset emails |

**Cheapest path (full control):** one **Hetzner CX22 (~€4/mo)** running Docker Compose — `api + worker + redis + caddy (TLS)` — with **Atlas** for the DB and **R2** for assets. More ops, lowest cost.

---

## 2. Environments

| Env | Branch / trigger | web | api | DB |
|---|---|---|---|---|
| **Preview** | every PR | Vercel preview URL | Railway PR env (optional) | Atlas `*-preview` db or shared dev |
| **Production** | push/merge to `main` | Vercel production | Railway production | Atlas production cluster |

Keep a **staging** tier only if you need it later; trunk-based (PR → preview → main → prod) is enough to start.

---

## 3. Repository & branch strategy
- **Trunk-based.** `main` is always deployable and auto-deploys to production.
- Feature work on short-lived branches → PR → CI must pass → squash-merge to `main`.
- Tags `vX.Y.Z` on `main` for release marking (optional; platforms deploy per-commit).

---

## 4. CI — GitHub Actions (lint · type-check · test · build)
Turbo runs only the affected packages and caches results. One workflow gates every PR and every push to `main`.

**.github/workflows/ci.yml**
```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run lint type-check test build
        env:
          # optional Turbo Remote Cache (Vercel) — speeds CI across runs
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ vars.TURBO_TEAM }}
```

> **Turbo remote cache** is optional but worth it: set `TURBO_TOKEN`/`TURBO_TEAM` (Vercel) so CI reuses build artifacts across runs and across the deploy platforms.

---

## 5. CD — Frontend (Vercel)
Connect the repo in Vercel once, then it auto-deploys.

- **Root directory:** `apps/web`
- **Framework preset:** Vite
- **Install command:** `pnpm install --frozen-lockfile` (run at repo root — Vercel detects the monorepo)
- **Build command:** `cd ../.. && pnpm turbo run build --filter=web`
- **Output directory:** `apps/web/dist`
- **Env vars:** `VITE_API_URL=https://api.yourdomain.com`
- **Deploys:** push to `main` → production; every PR → a preview URL.
- **Rollback:** Vercel keeps every deployment — promote a previous one instantly.

---

## 6. CD — Backend api + worker (Railway via Docker)
Build the api from a monorepo-aware Dockerfile using `turbo prune` (ships only the packages the api needs).

**apps/api/Dockerfile** (build context = **repo root**)
```dockerfile
# ---- base ----
FROM node:20-slim AS base
RUN corepack enable
WORKDIR /app

# ---- prune: isolate api + its workspace deps ----
FROM base AS prune
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @lyra/api --docker

# ---- install + build ----
FROM base AS build
COPY --from=prune /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /app/out/full/ .
RUN pnpm turbo run build --filter=@lyra/api

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app .
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**Railway setup**
- **api service:** deploy from repo, Dockerfile path `apps/api/Dockerfile`, root/context = repo root. Start = image `CMD`. Health check path `/health`.
- **worker service** (added at render phase): same repo/image, override start command to `node dist/worker.js`. No public port.
- **Env vars** (both services): see §9.
- **Deploys:** push to `main` → Railway rebuilds and deploys. Watch paths so api redeploys only when `apps/api/**` or `packages/**` change.
- **Rollback:** Railway keeps prior deployments — redeploy the previous one.

> Render/Fly equivalent: same Dockerfile; Render = a Web Service (api) + a Background Worker (worker); Fly = two processes in `fly.toml`.

---

## 7. Database (MongoDB Atlas) + migrations
- **Cluster:** start M0 (free) → M10 dedicated when traffic/data grows. Enable backups on production.
- **Network:** allow only the api/worker egress IPs (Railway static egress / Fly) — not `0.0.0.0/0` in production.
- **Connection:** `MONGODB_URI` as a secret; one DB per environment (`lyra`, `lyra-preview`).

**Indexes & migrations.** Mongo is schemaless, but you still need indexes and occasional data migrations.
- In production, **disable Mongoose auto-indexing** (`MongooseModule.forRoot(uri, { autoIndex: false })`) — building indexes implicitly on boot is risky at scale.
- Manage indexes/migrations with **migrate-mongo**. Required indexes for v1:
  - `users.email` unique
  - `memberships` unique compound `{ workspaceId, userId }`
  - `apikeys` unique compound `{ workspaceId, provider }`
  - `projects` index `{ workspaceId, visibility }` and `{ workspaceId, createdBy }`
  - `runs` index `{ projectId }`, `assets` index `{ runId }`
  - `refreshtokens` TTL index on `expiresAt`; `invites` TTL on `expiresAt`
- **Run migrations on deploy**, before the new api starts:

**.github/workflows/migrate.yml** (runs on push to `main`)
```yaml
name: Migrate
on:
  push:
    branches: [main]
    paths: ["apps/api/migrations/**"]
jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @lyra/api migrate-mongo up
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI_PROD }}
```
> Or use Railway's **pre-deploy command** to run `migrate-mongo up` before each release.

---

## 8. Redis + Assets + Email (managed, no deploy)
- **Upstash Redis:** create a database, set `REDIS_URL` on api + worker. Only needed once BullMQ lands (render phase).
- **Cloudflare R2:** bucket per environment; the api uploads generated media and stores the public/CDN URL in the `assets` collection. Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.
- **Resend:** `RESEND_API_KEY` for invite + password-reset emails.

---

## 9. Secrets & environment management

**Where secrets live**
- **GitHub Actions:** repo Secrets (`MONGODB_URI_PROD`, `TURBO_TOKEN`, …) for CI/migrations.
- **Vercel:** project env vars (`VITE_API_URL`).
- **Railway:** service variables (the api/worker runtime secrets below).
- Never commit secrets; never put provider API keys here — those are per-workspace and encrypted in Mongo with `ENCRYPTION_KEY`.

**api / worker runtime env**
```
NODE_ENV=production
PORT=3001
MONGODB_URI=...                 # Atlas
WEB_ORIGIN=https://app.yourdomain.com
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d
ENCRYPTION_KEY=...              # 64 hex chars (AES-256-GCM for stored provider keys)
REDIS_URL=...                   # Upstash (render phase)
R2_ACCOUNT_ID=...  R2_ACCESS_KEY_ID=...  R2_SECRET_ACCESS_KEY=...  R2_BUCKET=...
RESEND_API_KEY=...
```

---

## 10. Health checks, rollback, monitoring
- **Health endpoint:** add `GET /health` in NestJS (`@nestjs/terminus`) returning DB + Redis status. Railway/Render use it to gate deploys; the worker exposes a lightweight liveness check.
- **Rollback:** Vercel (promote previous deployment) and Railway/Render (redeploy previous) are both one click. Keep DB migrations **backward-compatible** so a rollback of the api doesn't break against the new schema (expand-then-contract).
- **Logs:** platform-native logs (Vercel/Railway). Add **Sentry** (api + web) for error tracking.
- **Uptime:** a simple external monitor (BetterStack/UptimeRobot) hitting `/health` and the web URL.

---

## 11. Deploy flow (summary)
```
PR opened ──▶ CI (lint/type-check/test/build) ──▶ Vercel preview URL
                                                    Railway PR env (optional)

merge to main ──▶ CI ──▶ migrate-mongo up ──▶ Vercel prod  +  Railway prod (api, worker)
                                              R2 / Upstash / Atlas = managed, always on
```

---

## 12. Rough monthly cost (starting → small scale)

| Service | Start | Small scale |
|---|---|---|
| Vercel | $0 (Hobby) | $20 (Pro) |
| Railway (api + worker) | ~$5 | $15–30 (usage) |
| MongoDB Atlas | $0 (M0) | $9–57 (M2/M10) |
| Upstash Redis | $0 | usage (cents) |
| Cloudflare R2 | ~$0 | $0.015/GB stored, no egress |
| Resend | $0 (3k/mo) | $20 |
| **Total** | **~$5–10** | **~$60–120** |

VPS alternative (Hetzner + Docker Compose + Atlas + R2): **~€5–10/mo** all-in, more ops.

---

## 13. Build order for infra (matches the app phases)
- **Phase 0–2:** Vercel (web) + Railway (api) + Atlas. No Redis, no worker, no R2 yet.
- **Phase 3–5:** still no queue; add **Resend** when invites land (Phase 1) and **R2** is not needed until renders.
- **Phase 6 (render):** add **Upstash Redis** + the **worker** service + **R2** bucket.
- **Phase 7 (harden):** lock Atlas network to egress IPs, add Sentry + uptime, enable backups, finalize rollback runbook.
