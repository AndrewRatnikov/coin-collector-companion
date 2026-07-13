# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Workspace skeleton only (backlog [0.1–0.4](specs/backlog_phase_1.md)): pnpm workspace (`apps/web`, `apps/api`, `packages/shared`, `seed/templates`), root TypeScript/ESLint/Prettier config, git + GitHub repo. `apps/web`, `apps/api`, and `packages/shared` are still empty directories — NestJS and Next.js have not been scaffolded yet, so there is no `dev`, `test`, `migrate`, or `seed` command yet. Available today, run from the repo root:

- `pnpm lint` / `pnpm lint:fix` — ESLint across the workspace
- `pnpm format` / `pnpm format:check` — Prettier across the workspace

Update this section again as each of those real commands appears (NestJS scaffold → `dev`/`test`; Prisma → `migrate`; seed script → `seed`), per backlog item 0.5.

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
