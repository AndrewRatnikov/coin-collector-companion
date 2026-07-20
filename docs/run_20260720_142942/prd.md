# PRD: Day 4 Week 2 — Ownership/Collection Module + Gap View

**Run:** run_20260720_142942
**Date:** 2026-07-20

## Goal

Coin Collector Companion lets a user track which coins from the catalog they personally own, independent of any one set, and see how complete a given set is against their own collection. This task builds that missing piece: a `CollectionModule` that lets a logged-in user mark/unmark a coin as owned and browse their full collection, plus a `GET /sets/:id/gaps` endpoint on the existing `SetsController` that shows completion progress for any set (the caller's own or someone else's public one) against the caller's own ownership. Ownership is existence-based (a row in the `ownership` table, not a boolean flag) and deliberately has no foreign-key relationship to sets in either direction, so that deleting a set can never accidentally erase what a user owns.

## User stories

- As a logged-in collector, I want to mark a coin as owned or not-owned via a single idempotent call, so that retries/double-clicks never produce inconsistent state or errors.
- As a logged-in collector, I want to see my full collection, optionally filtered by country or year, so I can browse what I own without going through any particular set.
- As a logged-in collector, I want to see completion progress (owned/total/%) for any set — my own or someone else's public set — so I can gauge how close I am to completing it before deciding whether to build or clone it.
- As a logged-in collector, I want deleting a set to never affect what I own, so my collection stays intact regardless of what sets I create or remove.
- As a logged-in collector, I want a set I cloned from someone else to stay fully mine even if the original is later deleted, so my copy is genuinely independent.

## Acceptance criteria

**Code (built + covered by automated unit/integration tests with mocked Prisma, matching this repo's existing `*.spec.ts` conventions):**

1. `PATCH /collection/:coinId` exists in a new `apps/api/src/collection/` module (`CollectionModule`, registered in `AppModule`), requires auth, and validates `:coinId` with `ParseUUIDPipe`.
2. Request body is `{ owned: boolean }`, validated with `class-validator` (`@IsBoolean()`).
3. `owned: true` calls `prisma.ownership.upsert` with `create: { userId, coinId }` and `update: {}` — an existing row's `ownedAt` is left untouched (upsert's `update: {}` writes nothing), so re-marking an already-owned coin does not reset `ownedAt`.
4. `owned: false` calls `prisma.ownership.deleteMany({ where: { userId, coinId } })`, never a plain `delete` — the service must not throw when 0 rows match.
5. Response shape is `{ coinId: string, owned: boolean, ownedAt: string | null }`, reflecting the resulting state after the write.
6. An unknown `coinId` (violates the FK to `coins`) is mapped to a `404 Not Found` rather than surfacing a raw Prisma `P2003`/500 — decision made explicitly since neither the task prompt nor `system-design_v2.md` §3/§4.1 pins this down; chosen for consistency with this codebase's existing pattern of mapping known Prisma error codes to clean HTTP responses (see `P2002` → 409 in `apps/api/src/auth`).
7. `GET /collection` exists, requires auth, is unpaginated, and accepts optional `country`/`year` query params (exact match) via a new `FindCollectionQueryDto` (mirrors `FindCatalogQueryDto`'s `@IsOptional()`/`@IsString()`/`@Type(() => Number)` conventions, no pagination fields).
8. `GET /collection` filters via `prisma.ownership.findMany({ where: { userId, coin: { country, year } }, include: { coin: true }, ... })` — a relation filter through `coin`, since `Ownership` itself has no `country`/`year` columns.
9. `GET /sets/:id/gaps` is added to the existing `SetsController`/`SetsService`, requires auth, and — unlike every other `:id` handler in that controller — does **not** call `getOwnedSetOrThrow` and has no 403 branch; it 404s only if the `UserSet` id doesn't exist at all.
10. The gap computation is a single query for the set's coin list (no per-slot/N+1 query), left-joined against `Ownership` filtered to the caller's `userId`.
11. Response includes `ownedCount`, `totalCount = coins.length`, and `completionPercent = Math.round((ownedCount / totalCount) * 100)`, guarded against division by zero (`totalCount === 0` → `0`).
12. New shared types are added to `packages/shared/src/index.ts` alongside the existing exports, without modifying any existing type: an ownership item type, a `{ owned: boolean }` request type, a response type for the PATCH result, a gap-slot type, and a `GapViewResponse` type. Exact field names are finalized against `system-design_v2.md` §3/§4.1 (already reviewed — neither section pins an exact shape beyond what's described in prose, so the task prompt's suggested shapes stand as the contract).
13. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, and `pnpm lint` all pass clean. Note: `packages/shared`'s `dist/` is gitignored and not auto-built — the Coder must rebuild the shared package (`pnpm --filter @coin-collector/shared build`) after editing its `src/index.ts` before trusting a local typecheck/build.
14. `docs/backlog_week2.md` tasks 4.1–4.3 are checked off with a brief note on any deviation (e.g. the 404-on-unknown-coinId decision), matching the style of the already-checked-off Day 1–3 entries.

**Manual pass (explicitly out-of-band — see "Out of scope" below):**

15. Tasks 4.4 and 4.5 in `docs/backlog_week2.md` are already labeled "Manual pass" in the backlog itself, and involve exercising the real dev Neon DB (also what Render points at in prod, per `CLAUDE.md`) end-to-end: idempotency of repeated PATCH calls, `GET /collection` filtering against real rows, set-deletion/ownership isolation, clone-lineage isolation (`onDelete: SetNull`), gap-view on a set the caller doesn't own, and 401 checks on all three new endpoints. These are performed as a separate live-DB verification step outside the automated Coder/sandbox pipeline (which has no real DB credentials), with every throwaway row cleaned up afterward. Backlog items 4.4/4.5 stay unchecked with a "pending manual pass" note unless that manual pass is actually run and confirmed.

## Out of scope

- Everything under Day 5 in `docs/backlog_week2.md`: the two-user end-to-end public-set-flow manual pass, the mint-mark/variety dedup re-check, finalizing every remaining shared DTO, the gap-computation automated test suite, and the full endpoint-by-endpoint auth manual pass.
- `is_public` / per-set privacy — every set stays public and cloneable, per `system-design_v2.md` §4.6.
- Drag-and-drop / mid-set reordering — untouched by this task.
- Rate limiting or abuse protection on the new endpoints — explicitly deferred per `system-design_v2.md` §5.
- Actually executing the live-DB manual verification pass (items 4.4/4.5 and the additional live checks listed in acceptance criterion 15) as part of the automated pipeline run — the pipeline's sandbox has no real DB credentials; this is documented as a deferred manual step, consistent with prior runs against this repo.
- Any frontend work (`apps/web`) — this is backend-only, Week 3 per the roadmap.

## Open questions

None — the task, `system-design_v2.md` §2.3/§3/§4.1/§4.6, and `docs/backlog_week2.md`'s Day 4 section are in full agreement on scope and edge-case behavior. The two judgment calls the task prompt explicitly leaves open (whether `ownedAt` should survive a re-upsert, and whether an unknown `coinId` should 404) are resolved above (criteria 3 and 6) rather than left for the Architect to re-derive.
