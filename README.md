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
│   ├── web/          # Next.js (App Router) — not yet scaffolded
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

Copy `apps/api/.env.example` to `apps/api/.env` and fill in `DATABASE_URL` (Neon's **pooled** connection string — the host has a `-pooler` suffix) and `JWT_SECRET`.

```bash
# Backend
pnpm --filter api exec prisma generate       # generate the Prisma client
pnpm --filter api exec prisma migrate dev    # apply migrations
pnpm --filter api start:dev                  # dev server, watch mode

# GET http://localhost:3000/api/v1/health once it's up
```

## Available commands

Run from the repo root, with Node ≥ 22 active:

```bash
pnpm lint / pnpm lint:fix              # ESLint across the workspace
pnpm format / pnpm format:check        # Prettier across the workspace

pnpm --filter api start:dev            # NestJS dev server (watch mode)
pnpm --filter api build                # production build
pnpm --filter api test                 # unit tests
pnpm --filter api test:e2e             # e2e tests

pnpm --filter @coin-collector/shared build   # compile shared enums/contracts to dist

pnpm --filter api exec prisma generate                    # regenerate Prisma client
pnpm --filter api exec prisma migrate dev --name <name>   # create + apply a migration
pnpm --filter api exec prisma migrate deploy               # apply pending migrations (CI/prod)
```

Frontend commands will be added once `apps/web` is scaffolded.

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
