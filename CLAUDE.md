# CLAUDE.md

Guidance for Claude Code in this repo. Keep this file short and current: dated changelog entries go in [docs/history.md](docs/history.md), and path-specific gotchas go in `.claude/rules/*.md`.

## What this is

Coin Collector Companion: a coin catalog and collection tracker. The core loop is: browse the catalog, build a set (by catalog filter, by manual pick, or by cloning a canonical set or another user's public set), mark coins owned, then see gaps and completion %. The **gap view** is the product's differentiator; everything else exists to feed coins into it.

Before making scope decisions, read [docs/prd_v2.md](docs/prd_v2.md) (what and why) and [docs/system-design_v2.md](docs/system-design_v2.md) (modules, API contracts, data model). Work is planned in `docs/backlog_*.md`.

## Current status (2026-09-30)

- **Deployed:** web on Vercel, API on Render, database on Neon (free tier; Render cold starts and Neon autosuspend are accepted trade-offs, not bugs).
- **Built:** auth (register/login, refresh tokens, change password, forgot/reset password), catalog browse/detail, user coin submissions with review status and "My submissions", custom/canonical/public sets with clone, collection, gap view, dashboard, glossary, feedback, EN/ES UI.
- **Password reset email:** needs a verified sending domain, and there isn't one yet. Without it, Resend only delivers to the Resend account owner's own address. Backlog items 3.12–4.3 in `docs/backlog_password-management.md` stay open until then.
- **Migrations:** `20260923200000_add_password_reset_token` and `20260926120000_add_coin_specs` were written without DB access. Check `prisma migrate status` against Neon before deploying (see Database safety below). After `add_coin_specs` is applied, re-run the catalog import to fill specs and load the Ukrainian fixtures.
- **Paperwork gap:** `docs/backlog_glossary.md` is unticked, but `/glossary` and its test exist. Validate it, then tick it off.

## Architecture

- **Monorepo (pnpm):** `apps/web` (Next.js App Router), `apps/api` (NestJS), `packages/shared` (contract types used by both), `scripts/import-catalog` (offline catalog import, its own workspace package), `seed/templates` (versioned canonical-set JSON).
- **Web and API are separate services on purpose,** to keep a real API boundary (DTOs, validation, guards). Don't move backend logic into Next.js API routes.
- **Database:** PostgreSQL through Prisma. Not up for debate.
- **Auth:** hand-rolled email/password (bcrypt) with short-lived JWT access tokens and a rotating refresh token in an httpOnly cookie. A global `JwtAuthGuard` protects routes; opt out with `@Public()`.
- **Catalog data:** comes only from the offline import (no external calls at request time). Images are hotlinked from Wikimedia Commons; there is no image storage.
- **i18n:** `apps/web/src/lib/i18n`, with `en.ts` and `es.ts`. `es.ts` is typed against `en.ts`, so always add a key to both files.

## Data model essentials

Full detail is in system-design_v2 §4.1.

- `Coin`: one row per `(country, denomination, year, mintMark, variety)`. `mintMark` and `variety` are NOT NULL and use `''` for "none", so the unique constraint works. The model also has specs (`diameterMm`, `weightG`, `thicknessMm`, `mintage`, `material`), `isKeyDate`, and a submission `status` (pending/approved/rejected).
- `CanonicalSet` / `CanonicalSetCoin`: curated sets loaded from `seed/templates` with `seed:canonical`.
- `UserSet` / `UserSetCoin`: user sets. They are all public and cloneable. Clone source FKs use `onDelete: SetNull`, so a clone survives deletion of its source.
- `Ownership`: a `(userId, coinId)` row means the user owns that coin, across every set. It has no relation to sets, and deleting a set must never touch it.
- **Gaps:** the set's coins that have no ownership row for the user, computed by an anti-join query. Don't store gaps as a flag.

## Commands

```bash
pnpm lint                                        # ESLint, whole workspace
pnpm --filter @coin-collector/shared build       # needed before api/web typecheck, build and web tests
pnpm --filter api exec prisma generate           # after any schema change or fresh install
pnpm --filter api start:dev                      # API; Swagger at /api/docs, health at /api/v1/health
pnpm --filter web dev                            # web on :3000 (if :3000 is busy, run the API with PORT=4000)
pnpm --filter <api|web|@coin-collector/shared> typecheck
pnpm --filter api test | test:e2e                # e2e needs a database
pnpm --filter web test
pnpm --filter <api|web> build
pnpm --filter api exec prisma migrate deploy     # apply pending migrations (the only prod path)
pnpm --filter api run seed:canonical             # upsert canonical sets from seed/templates
cd scripts/import-catalog && pnpm run import     # upsert catalog coins from fixtures/*.json
```

Builds exclude test files, so always run `typecheck` too. The CI job (`.github/workflows/ci.yml`) and the orchestrator's `.claude/verify.json` both run lint, typecheck, unit tests and e2e.

## Database safety

These rules are here because each of them has broken production before.

- `apps/api/.env`'s `DATABASE_URL` is the **shared Neon database that production (Render) uses.** Treat every command against it as a prod operation.
- **Never pass that URL as Prisma's `--shadow-database-url`.** Doing so once wiped the database, and it had to be restored with Neon point-in-time restore.
- **Render's build does not run migrations.** Apply new migrations with `prisma migrate deploy` before the code that needs them ships. Unapplied migrations have 500'd `GET /catalog` and login in the past, and typecheck/build/unit tests don't catch this.
- **For a non-interactive migration** (no TTY), generate the SQL with `prisma migrate diff --from-url ... --to-schema-datamodel prisma/schema.prisma --script`, put it in a new `prisma/migrations/<timestamp>_<name>/migration.sql`, then run `migrate deploy`.
- **Live manual passes** use throwaway accounts that must be deleted afterward (`apps/api/scripts/cleanup-throwaway-users.ts`); there is no user-delete endpoint. Automated runs have no DB credentials, so leave live-DB backlog steps unchecked with a "pending manual pass" note.

## Rules that are easy to break

- `GET /health` must stay `@Public()`, because Render's health check calls it without a token.
- Every catalog read uses the shared `CATALOG_COIN_SELECT`, so `submittedByUserId` is never exposed. Use it for any new read path too.
- Optional-auth routes use `OptionalJwtAuthGuard` plus `@Public()` (details in `.claude/rules/api.md`).
- Catalog imports must pass the license gate in [docs/catalog-data-licensing.md](docs/catalog-data-licensing.md): Commons image license checks, and US designs from March 1989 onward need a per-design check. Wikipedia API calls need a descriptive `User-Agent`.

## Scope discipline

The core-loop acceptance test in the PRD's Success Metrics is the scope firewall. Don't build these without a PRD change:

- theme/subject tags
- per-set privacy (`is_public`)
- drag-and-drop set reordering (coins append at `max(position) + 1`)
- any Numista dependency
- image re-hosting or user photo uploads

Canonical sets are required, and can't be descoped.
