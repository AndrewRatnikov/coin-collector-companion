# Coin Collector Companion

A coin catalog and collection tracker built around the **gap view**: pick a set, like Lincoln Wheat Cents 1909–1958 with every mint, and see which coins you own, which you're missing, and how close you are to finishing it.

Most coin-collecting apps show *what you own*. This one answers the question collectors actually ask: **what am I still missing?**

## Features

- **Catalog:** browse and filter coins by country, denomination, name and year, anonymously or logged in. Coin pages show specs (diameter, weight, thickness, material, mintage) and a key-date badge.
- **Sets:** build a set by filtering the catalog or picking coins by hand, or clone a curated canonical set or another user's public set.
- **Gap view:** see owned and missing coins per set, with completion %. Ownership is tracked once per coin, so marking a coin owned counts in every set that contains it.
- **Collection and dashboard:** everything you own in one place, plus progress across your sets.
- **Catalog contributions:** submit a missing coin. It stays pending until it's reviewed, and "My submissions" tracks what you've sent.
- **Accounts:** email/password sign-up, refresh-token sessions, change password, and forgot/reset password by email.
- **Also:** a glossary of collecting terms, in-app feedback, and an English/Spanish UI.

## Status

Deployed: web on Vercel, API on Render, database on Neon (all free tier).

Password-reset emails go through Resend. Until a sending domain is verified, Resend only delivers to the Resend account owner's own address, so reset emails don't reach other users yet.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router), React, TanStack Query: `apps/web` |
| Backend | NestJS: `apps/api` |
| Database | PostgreSQL (Neon) via Prisma |
| Auth | Hand-rolled email/password (bcrypt), 15-minute JWT access tokens, rotating refresh token in an httpOnly cookie |
| Email | Resend (password reset) |
| Shared types | `packages/shared`: contract types used by both apps |
| API docs | Swagger at `/api/docs` |
| Tests | Jest (API unit + e2e), Vitest + Testing Library (web) |

The frontend and backend are **separate services** on purpose, rather than one Next.js app with API routes, to keep a real API boundary with DTOs, validation and guards.

## Repo layout

```
coin-collector-companion/
├── apps/
│   ├── web/                  # Next.js app
│   └── api/                  # NestJS API: auth, catalog, sets, collection, feedback, email
├── packages/shared/          # contract types shared by web and api
├── scripts/import-catalog/   # offline catalog import from fixtures/*.json
├── seed/templates/           # versioned canonical-set definitions
└── docs/
    ├── prd_v2.md             # product spec: read before making scope decisions
    ├── system-design_v2.md   # modules, API contracts, data model
    ├── backlog_*.md          # planned and completed work
    ├── catalog-data-licensing.md
    └── history.md            # dated changelog of the build
```

## Getting started

Prerequisites: Node.js 22+ (`nvm use 22`), pnpm 11, and a PostgreSQL database.

```bash
pnpm install
pnpm --filter @coin-collector/shared build   # both apps import this package
pnpm --filter api exec prisma generate
```

### API (`apps/api`)

Copy `apps/api/.env.example` to `apps/api/.env` and set at least `DATABASE_URL` and `JWT_SECRET`. For Neon, use the **pooled** connection string (the host ends in `-pooler`). The example file documents the email variables.

```bash
pnpm --filter api exec prisma migrate deploy   # apply migrations
pnpm --filter api run seed:canonical           # load canonical sets from seed/templates
cd scripts/import-catalog && pnpm run import   # load catalog coins from fixtures
PORT=4000 pnpm --filter api start:dev          # health: http://localhost:4000/api/v1/health
```

Swagger UI is at `http://localhost:4000/api/docs`.

> **Careful:** don't point your local `.env` at the production database for development work, and never pass it to Prisma as `--shadow-database-url`, which wipes it.

### Web (`apps/web`)

Copy `apps/web/.env.example` to `apps/web/.env` and set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`.

```bash
pnpm --filter web dev   # http://localhost:3000
```

Run the API on port 4000 as shown above. The API only allows `http://localhost:3000` (plus `CORS_ORIGIN`) as a browser origin, and Next.js silently moves to port 3001 if 3000 is taken. On 3001, every request is CORS-blocked.

## Testing

```bash
pnpm lint
pnpm --filter <api|web|@coin-collector/shared> typecheck
pnpm --filter api test        # unit tests
pnpm --filter api test:e2e    # e2e tests against the database in DATABASE_URL
pnpm --filter web test
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, migrations and the API unit and e2e tests on pushes and pull requests to `main`.

## Deployment

- **API (Render):** configured in `render.yaml`. Set `DATABASE_URL` and `CORS_ORIGIN` (the web app's URL), plus `FRONTEND_URL`, `RESEND_API_KEY` and `EMAIL_FROM` for reset emails. `JWT_SECRET` is generated by Render.
- **Web (Vercel):** set `NEXT_PUBLIC_API_URL` to the Render URL plus `/api/v1`.
- **Migrations are not run by the Render build.** Apply them with `pnpm --filter api exec prisma migrate deploy` before deploying code that needs them.
- **Cold starts:** Render's free tier sleeps after 15 minutes idle, so the first request after that takes 30–60 seconds. Neon also autosuspends. Both are accepted trade-offs.

## Catalog data

Catalog data comes from open sources (Wikipedia mintage lists and US Mint publications) through an offline import; the app makes no external calls at request time. Images are hotlinked from Wikimedia Commons and pass a per-image license check. The rules are in [docs/catalog-data-licensing.md](docs/catalog-data-licensing.md).

## License

MIT, see [LICENSE](LICENSE).
