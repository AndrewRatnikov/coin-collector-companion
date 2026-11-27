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

Prerequisites: Node.js 26 (`nvm use` reads `.nvmrc`), pnpm 11, and a PostgreSQL database.

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

The week-two retention report (users by sign-up ISO week, how many marked 5+ coins owned, how many marked coins owned in two different weeks) runs against production with the URL passed inline. It is read-only and prints only week keys and counts, no emails or ids:

```bash
DATABASE_URL='<production pooled URL from Render>' pnpm --filter api exec ts-node scripts/retention-report.ts
```

> **Careful:** local development uses a separate Neon branch (`dev`), not the production database. Keep the production connection string out of your local `.env`; when a command really has to run against production, pass it inline (`DATABASE_URL='...' pnpm ...`). Never pass the production URL to Prisma as `--shadow-database-url`, which wipes it.

### Web (`apps/web`)

Copy `apps/web/.env.example` to `apps/web/.env` and set `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1`.

```bash
pnpm --filter web dev   # http://localhost:3000
```

Run the API on port 4000 as shown above. The API only allows `http://localhost:3000` (plus the `CORS_ORIGIN` entries) as a browser origin, and Next.js silently moves to port 3001 if 3000 is taken. On 3001, every request is CORS-blocked.

## Testing

```bash
pnpm lint
pnpm --filter <api|web|@coin-collector/shared> typecheck
pnpm --filter api test        # unit tests
pnpm --filter api test:e2e    # e2e tests against the database in DATABASE_URL
pnpm --filter web test
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, the API and web builds, migrations, the API and web unit tests and the API e2e tests on pushes and pull requests to `main`.

## Deployment

- **Domain layout:** the app runs under one registrable domain, `coincompanion.app`, with DNS in Cloudflare: the web app on Vercel at the apex (`coincompanion.app`), the API on Render at `api.coincompanion.app`, and the Resend sending domain at `mail.coincompanion.app`. Every record is **DNS-only** (grey cloud, not proxied) so Vercel, Render and Resend can issue certificates and verify the domain. One registrable domain makes web and API same-site, so the `SameSite=Lax` refresh cookie is stored and sent and sessions outlive the 15-minute access token; on the old `*.vercel.app` / `*.onrender.com` URLs they don't ([ADR](docs/adr/2026-11-21-custom-domain-makes-web-and-api-same-site.md)).
- **API (Render):** configured in `render.yaml`, which lists every variable the service needs (`sync: false` ones are set in the Render dashboard). `JWT_SECRET` is generated by Render. Set:
  - `DATABASE_URL`: the production Neon URL.
  - `CORS_ORIGIN`: a comma-separated list of browser origins allowed with credentials, e.g. `https://coincompanion.app,https://www.coincompanion.app`. Entries are trimmed and empty ones dropped, but otherwise must match the browser's `Origin` exactly (scheme and host, no trailing slash). `http://localhost:3000` is always allowed in addition.
  - `FRONTEND_URL`: the web app's base URL for password-reset links (`https://coincompanion.app`). If unset, the **first** `CORS_ORIGIN` entry is used, then `http://localhost:3000`.
  - `EMAIL_FROM`: the reset email's sender, an address on the verified sending domain (e.g. `Coin Collector Companion <no-reply@mail.coincompanion.app>`), and `RESEND_API_KEY`.
- **Web (Vercel):** set `NEXT_PUBLIC_API_URL` to the API host plus `/api/v1` (`https://api.coincompanion.app/api/v1`), and `NEXT_PUBLIC_SITE_URL` to the site's absolute URL (`https://coincompanion.app`); it becomes Next's `metadataBase`, so Open Graph and Twitter image URLs are absolute on that domain (unset or not an absolute http(s) URL leaves Next's default). `NEXT_PUBLIC_SITE_URL` is **required in production**: robots.txt, the sitemap, `/llms.txt` and the landing page's JSON-LD build their absolute URLs from it, and unset they fall back to `http://localhost:3000`. Optionally set `API_URL` (server-only, the API base including `/api/v1`) for the server-side fetches of the sitemap and `/llms.txt` (and of the server-rendered public pages later); unset or blank, they use `NEXT_PUBLIC_API_URL`. For analytics, set `NEXT_PUBLIC_POSTHOG_TOKEN` (the PostHog project token; unset means analytics is off) and `NEXT_PUBLIC_POSTHOG_REGION` (`us`, the default, or `eu`).
- **Analytics (PostHog):** the web app sends events cookieless through its own `/relay` proxy (Next.js rewrites to PostHog), so that traffic counts toward Vercel data transfer; it's small because there is no session replay. In the PostHog project: (1) enable **cookieless server hash mode** (Project settings → Web analytics), or PostHog drops the cookieless events; (2) turn on **Discard client IP data**.
- **Migrations:** the Render build applies pending migrations. `render.yaml`'s `buildCommand` runs `pnpm --filter api exec prisma migrate deploy` after `prisma generate` and before the API build, so code can't go live ahead of its schema. If a migration fails, the build fails and the previous deploy keeps serving. Migrations run before the new code is live, while the old code is still serving, so a destructive or non-backward-compatible change still needs an expand/contract sequence (add, ship, remove in a later migration). A Render rollback doesn't undo a migration.
- **Cold starts:** Render's free tier sleeps after 15 minutes idle, so the first request after that takes 30–60 seconds. Neon also autosuspends. Both are accepted trade-offs.

### Search engines and AI agents

- **robots.txt** (`apps/web/src/app/robots.ts`) allows every crawler. Besides the `*` group it has one explicit Allow group per named AI crawler: OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Google-Extended and CCBot. Every group disallows the signed-in and auth-only paths (`/dashboard`, `/collection`, `/want-list`, `/settings`, `/admin`, `/sets/new`, `/sets/*/missing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`), because a crawler follows only its most specific group. It links the sitemap.
- **Changing the policy:** edit `AI_CRAWLER_USER_AGENTS` (the named bots) or `DISALLOWED_PATHS` in `apps/web/src/app/robots.ts`. To block one bot, give its group `disallow: '/'` instead of the shared list; to add one, append its user agent to `AI_CRAWLER_USER_AGENTS`.
- **URLs:** `https://coincompanion.app/robots.txt`, `https://coincompanion.app/sitemap.xml` (static pages, curated checklists, public sets and approved coins), `https://coincompanion.app/llms.txt` (a Markdown summary of the site, its checklists and the public read API) and the OpenAPI JSON at `https://api.coincompanion.app/api/docs-json` (Swagger UI stays at `/api/docs`).
- The sitemap and `/llms.txt` fetch the API on the server through `apps/web/src/lib/server-api.ts`, cached for an hour with a 5 s timeout; when the API is asleep they are served with what loaded and rebuilt on the next request ([ADR](docs/adr/2026-11-26-public-pages-server-rendered-with-cached-api-data.md)).

## Catalog data

Catalog data comes from open sources (Wikipedia mintage lists and US Mint publications) through an offline import; the app makes no external calls at request time. Images are hotlinked from Wikimedia Commons and pass a per-image license check. The rules are in [docs/catalog-data-licensing.md](docs/catalog-data-licensing.md).

## License

MIT, see [LICENSE](LICENSE).
