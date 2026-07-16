# Coin Collector Companion

A personal collection tracker whose core differentiator is the **gap view**: given a canonical "set" (e.g. Lincoln Wheat Cents 1909–1958, all mints), show which slots are owned vs. missing, with completion % and key-date flags.

Existing coin-collecting apps show *what you own*. This one answers the question collectors actually ask: **what am I still missing, and how close am I to finishing this set?**

Full product spec: [docs/prd.md](docs/prd.md). Internal architecture and API contracts: [docs/system-design.md](docs/system-design.md).

## Status

🚧 In development — Phase 1 (the gap view, end-to-end). Not yet deployed.

See [CLAUDE.md](CLAUDE.md) for a detailed, up-to-date account of what's built so far.

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js (App Router) — `apps/web` |
| Backend | NestJS — `apps/api` |
| Database | PostgreSQL (Neon), via Prisma |
| Auth | Passport + JWT + bcrypt, hand-rolled (email/password only) |
| Shared types | `packages/shared` — enums + DTO/contract types used by both apps |
| API docs | `@nestjs/swagger`, served at `/api/docs` |
| Hosting (when deployed) | Vercel (frontend) · Render (backend) · Neon (database) — free tier throughout |

Frontend and backend run as **separate services**, not a single Next.js app with API routes — this is deliberate, to force a real API boundary (DTOs, validation, guards). See [docs/system-design.md §3](docs/system-design.md) for why.

## Repo layout

```
coin-collector-companion/
├── apps/
│   ├── web/          # Next.js (App Router) — auth pages, sets, coins, gap view
│   └── api/          # NestJS — auth, sets, user-sets, coins, linking
├── packages/
│   └── shared/       # shared enums (Denomination, Grade) + contract types
├── seed/templates/   # versioned JSON set templates (Lincoln Cents, etc.)
├── docs/
│   ├── prd.md              # product spec — read this before making scope decisions
│   └── system-design.md    # module boundaries, API contracts, key flows
└── specs/            # phased backlog
```

## Prerequisites

- Node.js ≥ 22 (`nvm use 22` — the repo's `engines` field and pnpm both enforce this)
- pnpm 11
- A PostgreSQL database (the project targets [Neon](https://neon.tech); `apps/api/.env` holds the connection string)

## Getting started

```bash
nvm use 22
pnpm install
```

### Backend (`apps/api`)

Copy `apps/api/.env.example` to `apps/api/.env` and fill in `DATABASE_URL` (Neon's **pooled** connection string — the host has a `-pooler` suffix) and `JWT_SECRET`.

```bash
pnpm --filter @coin-collector/shared build   # apps/api's DTOs import this package
pnpm --filter api exec prisma generate       # generate the Prisma client
pnpm --filter api exec prisma migrate dev    # apply migrations
pnpm --filter api exec prisma db seed        # load the set templates (Lincoln Cents, etc.)
pnpm --filter api start:dev                  # dev server, watch mode

# GET http://localhost:3000/api/v1/health once it's up
# Swagger UI at http://localhost:3000/api/docs
```

### Frontend (`apps/web`)

Copy `apps/web/.env.example` to `apps/web/.env` — `NEXT_PUBLIC_API_URL` should point at the API's `/api/v1` prefix (`http://localhost:3000/api/v1` by default).

```bash
pnpm --filter web dev   # dev server at http://localhost:3000
```

**Running both at once:** `apps/api` and `apps/web` both default to port 3000. `next dev` will silently fall back to 3001 if 3000 is taken, but the API's CORS allowlist only ever includes `http://localhost:3000` (plus `CORS_ORIGIN` for prod) — so a frontend served from the 3001 fallback gets every request CORS-blocked. Give the API a different port instead of letting the frontend fall back:

```bash
PORT=4000 pnpm --filter api start:dev
# then point apps/web/.env at NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
pnpm --filter web dev   # now free to claim port 3000
```

## Testing

```bash
# Backend — unit and e2e tests (e2e boots the real AppModule against your DATABASE_URL)
pnpm --filter api test
pnpm --filter api test:e2e

# Frontend — no automated test suite yet; typecheck + lint + build stand in for CI
pnpm --filter web exec tsc --noEmit
pnpm --filter web build

# Whole workspace
pnpm lint
pnpm format:check
```

To exercise the two together manually, run both dev servers (see above) and walk through the Phase 1 acceptance path: register → activate a seeded template (e.g. Lincoln Wheat Cents) → add coins → confirm auto-suggest links them → open the gap view and check owned/missing counts.

## Available commands

Run from the repo root, with Node ≥ 22 active:

```bash
pnpm lint / pnpm lint:fix              # ESLint across the workspace
pnpm format / pnpm format:check        # Prettier across the workspace

pnpm --filter api start:dev            # NestJS dev server (watch mode)
pnpm --filter api build                # production build
pnpm --filter api test                 # unit tests
pnpm --filter api test:e2e             # e2e tests

pnpm --filter web dev                  # Next.js dev server
pnpm --filter web build                # production build
pnpm --filter web start                # serve a production build

pnpm --filter @coin-collector/shared build   # compile shared enums/contracts to dist

pnpm --filter api exec prisma generate                    # regenerate Prisma client
pnpm --filter api exec prisma migrate dev --name <name>   # create + apply a migration
pnpm --filter api exec prisma migrate deploy               # apply pending migrations (CI/prod)
pnpm --filter api exec prisma db seed                       # (re)load seed/templates/*.json
```

## Data model (high level)

- **User** — id, email, password hash.
- **CollectionSet** — a set definition (template or user-created), with a `denomination` enum and an `isTemplate` flag.
- **SetSlot** — one expected item within a set (year, mint mark, label, key-date flag).
- **UserSet** — joins a user to a set they're pursuing (every pursued set gets one, including custom sets).
- **CoinItem** — a coin the user owns, with an optional link to a `SetSlot`.

Full schema and field-level notes: [docs/prd.md §6](docs/prd.md).

**Key invariant:** a coin may exist without being linked to a slot (duplicates are normal), but at most one coin may be linked to a given slot per user — enforced with a unique constraint on `(userId, slotId)`.

## Scope discipline

The project is phased on purpose:

- **Phase 1** — auth, seeded set templates, coin CRUD, auto-suggest slot linking, the gap view, Swagger docs, deploy. Nothing else. This is the actual MVP.
- **Phase 2** — custom set builder, search/filter, dashboard, responsive polish.
- **Phase 3** — photo uploads (Cloudflare R2).
- **Phase 4** — stretch, design-for-don't-build (want-lists, CSV import/export, shareable links, value tracking).

The Phase 1 acceptance test is the scope firewall: register → activate the Lincoln Cents template → add 5 real coins → auto-suggest links them → gap view shows correct owned/missing/completion %. Anything not needed for that path belongs in a later phase.

Details: [docs/prd.md §5](docs/prd.md).

## Deployment

Not yet deployed. Planned: Vercel (frontend) + Render (backend) + Neon (database), all free tier. Render's free web service spins down after 15 minutes idle — the first request after a cold start takes roughly 30–60 seconds. This is an accepted trade-off, not a bug.

## License

MIT — see [LICENSE](LICENSE).
