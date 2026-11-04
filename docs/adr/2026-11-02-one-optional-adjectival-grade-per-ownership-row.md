# A coin's condition is one optional adjectival grade on the ownership row, with an optional per-set minimum grade

- **Status:** Superseded by [2026-11-04-csv-import-confirm-sets-grades](2026-11-04-csv-import-confirm-sets-grades.md)
- **Date:** 2026-11-02
- **Source:** orchestrator run `run_20261102_194108` (coin grades, phase 1 of 4: data, shared types, API, docs; the scale and the one-column shape were fixed in the task brief)
- **Code:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/20261102200000_add_coin_grades/migration.sql`, `packages/shared/src/index.ts`, `apps/api/src/collection/collection.service.ts`, `apps/api/src/sets/sets.service.ts`
- **Supersedes:** `docs/system-design_v2.md` §6 grade row and §7 "Ownership model" bullet, `docs/prd_v2.md` non-goal "No grading/condition fields"

## Context

Ownership is existence-based: a `(user_id, coin_id)` row in `Ownership` means owned, no row means not owned. The v2 design listed grading as a non-goal and wrongly claimed a grade enum was already scaffolded in `packages/shared`. Collectors want to record condition and to be told which owned coins are worth replacing with a better one, without changing completion % or what counts as a gap. Duplicates (two copies of one coin) stay out of scope.

## Decision

- A coin's condition is one optional adjectival grade: the Prisma enum `CoinGrade` (`G`, `VG`, `F`, `VF`, `XF`, `AU`, `UNC`, worst to best) stored in the nullable column `Ownership.grade`. No Sheldon 1-70 numbers; "Proof" is a strike type, not a grade.
- `UserSet.minGrade` is a nullable `CoinGrade`: the owner's personal goal. A clone does not copy it (it starts as `null`) and canonical sets have none.
- `packages/shared` exports the ordered `COIN_GRADES`, the `CoinGrade` type, `compareGrades` and `meetsMinGrade`. A null grade does not meet a non-null minimum.
- A grade is metadata on an existing row, like `ownedAt`. Owned still means "a row exists", so un-owning deletes the row and its grade. Only `PATCH /collection/:coinId` writes a grade: an absent `grade` key keeps the stored one, `null` clears it. Bulk `PATCH /collection` and CSV import never touch grades (their `createMany ... skipDuplicates` leaves existing rows alone, as in [2026-10-17-bulk-ownership-endpoint](2026-10-17-bulk-ownership-endpoint.md)). `PATCH /sets/:id` takes `{ name?, minGrade? }`, owner only, and an empty body is a 400.
- "Needs upgrade" is derived from `(grade, minGrade)`. It is never a gap, so `ownedCount`, `totalCount` and `completionPercent` ignore grades.
- Delivered as a hand-written, additive migration (`CREATE TYPE` plus two nullable `ADD COLUMN`s). It still has to be applied with `prisma migrate deploy` before the API is deployed, since Prisma selects every column.

## Alternatives considered

- A separate grades or copies table: only needed for duplicates, which are out of scope.
- Per-set grades: contradicts ownership being global per user.
- Sheldon 1-70 numbers: finer than circulation-coin collectors need and harder to compare across scales.
- Free-text condition: cannot be compared against a minimum.
- Re-marking an owned coin resets its grade: silent data loss on a double tap.
- A separate `PATCH /collection/:coinId/grade` endpoint: a second write path for one row.
- A grade on the bulk body: one grade for many coins makes no sense.
- A new `PATCH /sets/:id/min-grade` route: would duplicate the owner 403/404 check that `getOwnedSetOrThrow` already gives.

## Consequences

Marking a coin owned stays one tap and cannot lose data; grading is a later, independent edit. The migration is nullable and reversible without data loss. Duplicates or per-set grades would need an `ownership` redesign (a surrogate id plus a quantity), recorded in `docs/system-design_v2.md` §7. Phase 1 has no UI. Deploying the API before the migration is applied 500s every Ownership and UserSet read.
