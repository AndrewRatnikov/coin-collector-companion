# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Backlog [0.1–1.5](specs/backlog_phase_1.md) done. Workspace skeleton (0.1–0.4), a NestJS scaffold in `apps/api` (1.1): global `ValidationPipe` (`whitelist`/`transform`), `/api/v1` prefix, `GET /health`, CORS locked to `CORS_ORIGIN` + `http://localhost:3000`, and the five flat D2 modules (`Prisma`, `Auth`, `Sets`, `UserSets`, `Coins` importing `Linking`) wired into `AppModule` as empty stubs awaiting their real logic in later tasks — plus `packages/shared` (1.2): `Denomination`/`Grade` enums and the SD §4 contract types (`UserSetSummary`, `GapViewResponse`/`GapSlot`, `CoinDto`, `CoinMutationResponse`/`SlotSuggestion`, `CoinLinkResponse`), built to `dist` via its own `tsc`; plus the Prisma schema (1.3): `apps/api/prisma/schema.prisma` — `User`, `CollectionSet`, `SetSlot` (`@@unique([setId, year, mintMark, label])`), `UserSet` (`@@unique([userId, setId])`), `CoinItem` (`@@unique([userId, slotId])`, `onDelete: SetNull` on the slot FK), plus a `PrismaService` (connect/disconnect lifecycle hooks) now exported from the previously-empty `PrismaModule` — not yet consumed by `apps/api` DTOs/services or `apps/web`. Neon project provisioned (1.4): `apps/api/.env` holds the real pooled `DATABASE_URL` (host has the `-pooler` suffix — Neon also hands out a direct/non-pooled host on the same project page that looks superficially the same; use the pooled one per SD §7), first migration (`prisma/migrations/20260714042946_init`) applied, five tables live in the `neondb` database. Swagger wired (1.5): `@nestjs/swagger`'s `DocumentBuilder`/`SwaggerModule` in `apps/api/src/main.ts`, UI + JSON at `/api/docs` and `/api/docs-json` (outside the `/api/v1` prefix — `SwaggerModule.setup` takes a raw path, not prefixed); `HealthController` carries the first `@ApiTags`/`@ApiOperation` decorators as the pattern to extend per-endpoint from here on, not as a later pass. `swagger-ui-dist` pulls in `@scarf/scarf` (a telemetry postinstall script) as a transitive dep — disallowed via `pnpm-workspace.yaml`'s `allowBuilds` rather than let it run. `apps/web` doesn't exist yet (still an empty dir — scaffold is 5.1), so no web-side `.env.example` yet either; `apps/api/.env.example` already covers the api side. No seed data yet (3.1) and no frontend `dev` yet. Note: `apps/api` pins `typescript@^5.7.3` (not the root's `^6.0.3`) — `@nestjs/cli@11`'s compiler silently produces no build output under TypeScript 6 (version mismatch between its own bundled `typescript` and the loaded project one); root tooling (ESLint/Prettier) and `packages/shared` are unaffected and stay on 6.0.3. Separately, if `apps/api/tsconfig.build.tsbuildinfo` (incremental build cache, gitignored) goes stale relative to a wiped `dist/` — e.g. two `start:dev` watchers left running against the same `dist` — `tsc`/`nest build` can silently no-op and emit nothing; delete that file to force a full rebuild if `dist/main` goes missing after a build that reported success. Also note: `apps/api` pins `prisma`/`@prisma/client@^6` — Prisma 7 removes the schema-file `datasource { url = env(...) }` form entirely (moves connection config to `prisma.config.ts` + driver adapters), which the PRD §6.2 schema sketch assumes; don't upgrade to 7 without a deliberate migration of that config. Also note: root `package.json` pins `"engines": { "node": ">=22.0.0" }` and pnpm 11 enforces it — the machine's default `node` (via nvm) is v18, so any `pnpm`/`prisma` command from the repo root needs `nvm use 22` (or newer) first or it fails outright before touching your code. Available today, run from the repo root (with Node ≥22 active):

- `pnpm lint` / `pnpm lint:fix` — ESLint across the workspace
- `pnpm format` / `pnpm format:check` — Prettier across the workspace
- `pnpm --filter api start:dev` — NestJS dev server (watch mode), `GET http://localhost:3000/api/v1/health` once up, Swagger UI at `http://localhost:3000/api/docs`
- `pnpm --filter api build` — production build
- `pnpm --filter api test` / `pnpm --filter api test:e2e` — unit / e2e tests
- `pnpm --filter @coin-collector/shared build` — compile the shared enums/contracts package to `dist`
- `pnpm --filter api exec prisma generate` — regenerate the Prisma client from `schema.prisma`
- `pnpm --filter api exec prisma migrate dev --name <name>` — create + apply a new migration against the Neon `DATABASE_URL`
- `pnpm --filter api exec prisma migrate deploy` — apply pending migrations without prompting (CI/prod path)

Update this section again as each further real command appears (seed script → `seed`; Next.js scaffold → frontend `dev`), per backlog item 0.5.

## What this project is

Coin Collector Companion — a personal collection tracker whose core differentiator is the **gap view**: given a canonical "set" (e.g. Lincoln Wheat Cents 1909–1958, all mints), show which slots are owned vs. missing, with completion % and key-date flags. Everything else (coin CRUD, photos, dashboards) is secondary to that one feature. Read the full PRD at [docs/prd.md](docs/prd.md) before making scope decisions — it resolves several inconsistencies explicitly and explains *why*, not just *what*.

## Architecture (as planned)

Frontend (Next.js, App Router) and backend (NestJS) run as **separate services at runtime** — not a Next.js app using API routes as the backend — this is deliberate, to force a real API boundary (DTOs, validation, guards) for portfolio purposes. Do not collapse them into one running service.

- **Repo layout:** single monorepo (pnpm/npm workspaces: `apps/web`, `apps/api`, `packages/shared` for DTO/type sharing) — see [docs/prd.md](docs/prd.md) §8.1. This is orthogonal to the runtime-separation rule above: one repo, two independently built/deployed services.
- **DB:** PostgreSQL via Prisma (decided — do not reintroduce a TypeORM debate).
- **Auth:** hand-rolled Passport + JWT + bcrypt in Nest, email/password only. No social login, no outsourced auth BaaS.
- **Images:** out of scope until Phase 3 (Cloudflare R2, presigned uploads). Don't build image upload infrastructure earlier than that — the `imageUrls` column exists from Phase 1 (empty array, not nullable) but is unused until then.
- **Hosting (when deploying):** Vercel (frontend), Render (backend), Neon (DB). Free tier throughout; Render cold-starts after 15 min idle — this is an accepted, documented tradeoff, not a bug to fix.

## Data model (high level — see PRD §6 for full detail)

- `User` — id, email, password hash.
- `CollectionSet` — a set definition (template or user-created). `denomination` (shared enum from `packages/shared` — never free text; it's half the auto-suggest match key), `isTemplate` flag; `ownerId` is null for templates, set for user-created sets.
- `SetSlot` — one expected item within a `CollectionSet` (year, mint mark, label, sort order, `isKeyDate`).
- `UserSet` — joins a `User` to a `CollectionSet` they're pursuing. **Every pursued set gets a `UserSet` row, including the user's own custom sets** — don't special-case "template vs. mine" in pursuit/progress logic; `CollectionSet.ownerId` answers *who may edit the definition*, `UserSet` answers *who is collecting against it*.
- `CoinItem` — belongs to a `User`; denomination (same shared enum), year, mint mark, country, grade, purchase price (USD-only in v1, `Decimal`), notes, acquired date, `imageUrls` (empty until Phase 3), optional FK to a `SetSlot`.

Mint-mark convention (decided, PRD §6.3): a coin/slot struck with **no mint mark stores `null`, never `"P"`** — in template JSON, the coin form, and API normalization alike. Matching is exact (`null` matches `null`); violating this breaks auto-suggest for Philadelphia issues, the most common coins in most US series.

Key invariant: multiple `CoinItem`s may exist for the same year/mint (duplicates are normal), but **at most one `CoinItem` may be linked to a given `SetSlot` per user** — enforce with a unique constraint on `(userId, slotId)`. Relinking a slot to a different coin replaces the link rather than erroring (the unlink+link pair must run in a single transaction); the old coin stays in the collection, just unlinked.

Gap computation: for a given `UserSet`, gap = the `SetSlot`s with no linked `CoinItem` for that user. Keep this as a simple query — it's the core product, don't over-engineer it.

## Scope discipline

The PRD is phased on purpose (Phase 1 = gap view only, ~1 week; Phase 2 = custom set builder + polish; Phase 3 = photos; Phase 4 = stretch, design-for-don't-build). When asked to add a feature, check which phase it belongs to before building it:

- **Two-state slots only** (owned/missing) in Phase 1+2. "Owned but want a better example" is a Phase 4 want-list concept — don't add a third slot state to smuggle it in early.
- **No photos before Phase 3.** Don't add upload UI, storage config, or image processing before then.
- Auto-suggest for slot linking (matching a newly added coin against open slots by denomination + year + mint mark) ships in **Phase 1**, not later — it's what keeps the gap view trustworthy, not a nice-to-have.
- Seeded set templates live as **versioned JSON files in the repo**, loaded via a seed script — not hardcoded in migrations, not fetched from an external API. The seed script upserts slots on the natural key `(setId, year, mintMark, label)` — **never delete-and-recreate slots wholesale**, since `CoinItem.slotId` points at slot rows and recreating them severs every user's links on each template correction.
- The Phase 1 acceptance test is the scope firewall: register → activate Lincoln Cents template → add 5 real coins → auto-suggest links them → gap view shows correct owned/missing/completion %. Anything not needed for that path is a later phase.
