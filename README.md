# Lyra

A multi-user web app where teams run an 8-step AI creative pipeline
(find → crawl → brief → insight → prompts → images → video → assemble/QA)
for a brand/product, producing on-brand images and UGC/video.

Turborepo monorepo · TypeScript (strict) · React + Vite (web) · NestJS + Mongoose (api) · `@lyra/shared` (zero-dependency types/enums/constants/utils).

> **Status: Phase 0 complete** — monorepo scaffold + authentication (signup / login / refresh / logout / me).
> See [docs/lyra-requirements.md](docs/lyra-requirements.md) §B8 for the full phase plan and [CLAUDE.md](CLAUDE.md) for architecture and conventions.

## Workspace layout

```
apps/
  web/        # Vite + React SPA (the workbench)
  api/        # NestJS + Mongoose REST API
packages/
  shared/     # @lyra/shared — types, enums, constants, pure utils (no runtime deps)
docs/         # product, technical, design-system, and hosting/CI specs
```

## Prerequisites

- **Node 20+** (developed on 24) and **pnpm 10**
- **Docker** (for the local MongoDB), or any MongoDB reachable at `MONGODB_URI`

## Getting started

```bash
pnpm install

# api environment — copy the example and fill in secrets
cp apps/api/.env.example apps/api/.env

# start the local backing services (MongoDB replica set)
docker compose up -d mongo

pnpm dev          # runs web (:5173) + api (:3001) together via Turbo
```

### Local services (Docker)

Only stateful services run in Docker; the apps run on the host for fast HMR.

```bash
docker compose up -d mongo             # MongoDB (single-node replica set rs0)
docker compose --profile queue up -d   # + Redis (needed from Phase 6)
docker compose down                    # stop (keeps data)
docker compose down -v                 # stop + wipe data
```

Mongo runs as a single-node replica set so multi-document transactions work
(Phase 1 onward). The matching URI is `mongodb://localhost:27017/lyra?replicaSet=rs0`.
Prefer a cloud DB instead? Point `MONGODB_URI` at a MongoDB Atlas SRV string —
no other change needed.

## Common commands

```bash
pnpm build        # build all packages (shared builds first)
pnpm type-check   # tsc --noEmit across the workspace
pnpm lint         # eslint across the workspace
pnpm test         # unit tests (shared: vitest, api: jest, web: vitest)

pnpm --filter @lyra/api test:e2e   # auth e2e against in-memory MongoDB
```

## Notes

- The access token lives in memory client-side; the refresh token is a rotated, httpOnly cookie hashed at rest.
- Passwords are hashed with argon2id. Server-only fields never appear in any API response.
- `@lyra/shared` is built dual-format (ESM + CJS) so both the Vite web app and the CommonJS NestJS api consume it cleanly.
