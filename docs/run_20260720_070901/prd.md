# PRD: Sets — Coin Membership, Canonical-Set Reads, Public-Set Reads (Week 2, Day 2)

**Run:** run_20260720_070901
**Date:** 2026-07-20

## Goal

Extend the existing `SetsModule` (`apps/api/src/sets/`) — which already supports creating, renaming, deleting, listing, and cloning a user's own sets (Week 2 Day 1) — with the ability to actually put coins into those sets, and with read-only, unauthenticated browsing of canonical sets and other users' public sets. This closes the gap between "a set exists" and "a set has coins a user can see, add to, remove from, and discover from other users," which is the next slice of the v2 backend (system-design_v2.md §3, §4.1, §4.6; backlog_week2.md Day 2, tasks 2.1–2.5).

## User stories

- As an authenticated set owner, I want to add coin IDs to my set and have re-adding an already-present coin be a silent no-op, so that double-clicks or retried requests never corrupt my set with duplicate entries.
- As an authenticated set owner, I want to remove coin IDs from my set without affecting my global ownership record for those coins, so that "removing from a set" and "un-owning a coin" stay two independent actions.
- As any visitor (no login), I want to browse the list of canonical (official/seed) sets and view one in detail with its ordered coin list, so that I can discover sets worth cloning before creating an account.
- As any visitor (no login), I want to browse a paginated list of every user's public sets and view one in detail with its ordered coin list, so that I can discover and later clone sets other users have built — without seeing who owns them.
- As the API itself, I want `canonical`/`public` literal routes registered before `:id`-shaped routes in `SetsController`, so that a request for `/sets/canonical` or `/sets/public` is never silently swallowed by a `:id` handler.

## Acceptance criteria

1. `PATCH /sets/:id/coins` requires auth and 404s if the set doesn't exist, 403s if it exists but isn't owned by the caller (reusing `SetsService.getOwnedSetOrThrow`).
2. `PATCH /sets/:id/coins` accepts `{ add?: string[], remove?: string[] }` where each entry is validated as a UUID via class-validator; an invalid (non-UUID) entry in either array is rejected with a 400 before touching the database.
3. Adding coins computes `max(position)` for the target set within one `$transaction` (so concurrent adds can't race the position read), assigns new rows starting at `max(position) + 1` (or `1` if the set is currently empty), and inserts via `createMany({ skipDuplicates: true })` against `@@unique([userSetId, coinId])` — a coin ID already present in the set is silently skipped (no error, no duplicate row, no position increment for the skipped entry).
4. Sending the same coin ID twice in one `add` array, and sending it again across two fully separate `PATCH` calls, both result in exactly one `UserSetCoin` row for that coin — verified by an actual API call in the manual pass, not just code inspection.
5. Removing coins runs `deleteMany({ where: { userSetId: id, coinId: { in: remove } } } )` and never reads or writes the `Ownership` table in this handler.
6. Add-then-remove-then-re-add of the same coin produces no stale position collision and the set's final coin list is correct — verified by an actual API call in the manual pass.
7. `PATCH /sets/:id/coins` returns the updated set's current coin list (or an equivalent summary shape matching system-design_v2.md §3's contract).
8. `GET /sets/canonical` is `@Public()` (no auth required, no 401 on a request with no `Authorization` header) and returns a list of all `CanonicalSet` rows.
9. `GET /sets/canonical/:id` is `@Public()`, validates `:id` with `ParseUUIDPipe`, returns one `CanonicalSet` with its coin list joined and ordered `position: 'asc'`, and 404s on an unknown id.
10. `GET /sets/public` is `@Public()`, returns every `UserSet` row across all users (no `WHERE userId = ...` filter — v1 has no `is_public` column, every set is public per system-design_v2.md §4.6), paginated with the same `{ items, page, limit, total }` shape, `page`/`limit` query-param convention (`@Type(() => Number)`, `@IsInt()`, `@Min(1)`, defaults, `MAX_LIMIT = 100` clamp), and `Promise.all([findMany, count])` pattern as `GET /catalog`.
11. `GET /sets/public/:id` is `@Public()`, validates `:id` with `ParseUUIDPipe`, returns one `UserSet` with its coin list joined and ordered `position: 'asc'`, and 404s on an unknown id.
12. Neither `GET /sets/public` nor `GET /sets/public/:id` expose the owning user's email or any user-identifying field beyond what's already on `UserSetSummary` (id, userId, name, clone-lineage fields, timestamps) — no display name, profile link, or other user detail is added.
13. In `SetsController`, `@Get('canonical')`, `@Get('canonical/:id')`, `@Get('public')`, and `@Get('public/:id')` are declared above the existing `@Patch(':id')`/`@Delete(':id')` handlers and this task's own `@Patch(':id/coins')`, so NestJS's declaration-order route matching resolves `/sets/canonical` and `/sets/public` to their literal handlers rather than being captured as `:id`.
14. A manual pass confirms `GET /sets/canonical` genuinely hits the canonical-list handler (returns a list) rather than a `:id`-shaped handler (which would 400 via `ParseUUIDPipe` choking on the literal string `"canonical"`) — checked by an actual request, not by reading the controller source.
15. All four new read endpoints (`GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id`) return 200 when called with no `Authorization` header.
16. `GET /sets/public` paginates correctly across at least two pages with no overlap and no gap between pages (same bar `GET /catalog` was held to in Week 1) — verified with real or throwaway-seeded `UserSet` rows, and any throwaway data created for this check is cleaned up afterward since this DB is also what Render points at in prod.
17. New request/response shapes needed for this task (canonical-set summary/detail, public-set summary/detail, the coins add/remove request/response) are added to `packages/shared/src/index.ts` alongside the existing exports, without modifying `UserSetSummary`, `CloneFromRequest`, `CreateSetRequestBody`, `CatalogCoin`, or `PaginatedResponse<T>`.
18. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, and `pnpm lint` all pass cleanly.
19. `docs/backlog_week2.md` tasks 2.1–2.5 are checked off, with a brief deviation note (matching the existing style in that file and in CLAUDE.md) if the implementation diverged from this PRD in any way.

## Out of scope

- The real seed script and `seed/templates/*.json` files (Week 2 Day 3).
- `GET /collection`, `PATCH /collection/:coinId`, `GET /sets/:id/gaps` (Week 2 Day 4).
- The public-set clone-flow, deletion-isolation, and clone-lineage manual passes (Week 2 Day 5 — those depend on `GET /sets/:id/gaps`, which doesn't exist yet).
- An `is_public` column, per-set privacy, or any visibility check beyond the existing owner-only write check — every set stays public and cloneable this week (explicit backlog non-goal).
- Mid-set drag-and-drop reordering or any repositioning of existing coins — `PATCH /sets/:id/coins` stays strictly append-only.
- Rate limiting or abuse protection on the new write or anonymous read endpoints.

## Open questions

None — the task, backlog entries, and system-design doc are fully aligned and specific enough to implement without further clarification.
