# PRD: SetsModule — create/rename/delete/list surface (Week 2, Day 1)

**Run:** run_20260719_200109
**Date:** 2026-07-19

## Goal

Coin Collector Companion users need a way to organize coins from the catalog into personal "sets" (e.g. "My Lincoln Cents") that they can build from scratch, or bootstrap by cloning either an admin-curated canonical set or another user's existing public set. This task delivers the foundational CRUD surface for that feature — creating a set (blank or cloned), listing a user's own sets, renaming a set, and deleting a set — as a new `SetsModule` in the existing NestJS API (`apps/api/src`). It does not yet cover adding/removing individual coins from a set (Day 2) or any read-only discovery endpoints for canonical/public sets (Day 2) — those build on top of what's delivered here.

## User stories

- As a logged-in user, I want to create a blank named set so that I can start building a personal collection list from scratch.
- As a logged-in user, I want to create a new set by cloning an existing canonical (admin-curated) set so that I don't have to manually add every coin in a well-known series myself.
- As a logged-in user, I want to create a new set by cloning any other user's set so that I can reuse someone else's curated list as my own independent starting point.
- As a logged-in user, I want to see a list of only my own sets so that I can navigate to the one I want to edit.
- As a logged-in user, I want to rename one of my sets so that I can fix a typo or reorganize my collection's labels.
- As a logged-in user, I want to delete a set I no longer want so that my set list stays relevant, without losing any of my "owned coin" tracking data elsewhere in the app.
- As a logged-in user, I want the API to reject another user's attempt to rename or delete my set (403) so that only I control my own sets.

## Acceptance criteria

1. `GET /sets` requires a valid bearer token (401 without one) and returns only the calling user's own `UserSet` rows — never another user's — with no pagination wrapper (plain array/list).
2. `POST /sets` requires auth and accepts exactly three body shapes: `{ name }` (blank set), `{ name, cloneFrom: { type: 'canonical', id } }`, and `{ name, cloneFrom: { type: 'user', id } }`. `cloneFrom.type` must be exactly `'canonical'` or `'user'` and `cloneFrom.id` must be a valid UUID when `cloneFrom` is present; invalid input is rejected with a 400 via class-validator.
3. Blank creation (`{ name }`) creates a `UserSet` row owned by the caller with no `UserSetCoin` rows and both `clonedFromCanonicalId`/`clonedFromUserSetId` left null.
4. Clone-from-canonical creation copies every `CanonicalSetCoin` row for the given `canonicalSetId` into new `UserSetCoin` rows on the new set, preserving each source row's `position` value unchanged (no renumbering), and sets `clonedFromCanonicalId` to the source id (`clonedFromUserSetId` stays null).
5. Clone-from-user creation performs the same copy operation, sourcing from another `UserSet`'s `UserSetCoin` rows, and works against **any** `UserSet` in the database regardless of who owns it (no ownership/visibility check on the clone source) — sets `clonedFromUserSetId` to the source id (`clonedFromCanonicalId` stays null).
6. The service enforces that at most one of `clonedFromCanonicalId`/`clonedFromUserSetId` is ever set on a created row — this is a handler-level invariant, not a DB constraint.
7. A clone operation's set-creation and coin-copy both happen inside a single `prisma.$transaction` — either both succeed or neither does.
8. `PATCH /sets/:id` requires auth, updates only the `name` field, uses `ParseUUIDPipe` on `:id`, returns 404 if no `UserSet` with that id exists at all, and returns 403 if it exists but belongs to a different user than the caller.
9. `DELETE /sets/:id` requires auth, uses `ParseUUIDPipe` on `:id`, applies the same 404 (no such row) / 403 (belongs to someone else) ownership check as `PATCH`, and on success deletes the `UserSet` row, relying on the schema's `onDelete: Cascade` on `UserSetCoin.userSetId` to remove its join rows — the handler code never queries or mutates the `Ownership` table.
10. After a set is deleted, any coin that was marked owned via the `Ownership` table remains owned (verified indirectly in this task by confirming the delete handler contains no `Ownership` access — `GET /collection` to directly observe this doesn't exist until Day 4).
11. All new response/request shapes needed by these endpoints (e.g. a set summary shape, the `cloneFrom` request shape) are added to `packages/shared/src/index.ts` alongside the existing `CatalogCoin`/`PaginatedResponse` exports (not removed or altered) so both `apps/api` and `apps/web` can import them.
12. Every route in the new `SetsController` has `@ApiTags`/`@ApiOperation`/`@ApiOkResponse` Swagger decorators, following the existing `CatalogController` pattern.
13. `SetsModule` is registered in `apps/api/src/app.module.ts`'s `imports` array.
14. A full manual verification pass (register two throwaway users; user A creates/renames/deletes a blank set and confirms it disappears from `GET /sets`; user A clones a manually-seeded canonical set and its coins/positions/`clonedFromCanonicalId` are confirmed correct; user B gets 403 — not 404 — on `PATCH`/`DELETE` against user A's set; unauthenticated `GET /sets` returns 401) is executed against the real dev database and all throwaway data created during it is cleaned up afterward.
15. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, and `pnpm lint` all pass cleanly after this task's changes.

## Out of scope

- `PATCH /sets/:id/coins` (adding/removing individual coins from an existing set) — Week 2 Day 2.
- `GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id` (read-only discovery endpoints for canonical/public sets) — Week 2 Day 2.
- `GET /collection` and `GET /sets/:id/gaps` — Week 2 Day 4.
- The real canonical-set seed script/templates under `seed/templates/` — Week 2 Day 3; this task's manual verification instead hand-seeds one throwaway `CanonicalSet`/`CanonicalSetCoin` row directly via Prisma Studio/psql.
- Any `is_public` column, per-set visibility/privacy flag, drag-and-drop/mid-set reordering, theme/subject tags, or rate limiting on the new write endpoints — all explicitly deferred per `docs/backlog_week2.md`'s "Explicitly NOT this week" section.
- Any frontend/`apps/web` work.

## Open questions

None — the task, referenced design docs (`docs/system-design_v2.md` §3, §4.1, §4.6) and backlog (`docs/backlog_week2.md` Day 1) fully specify behavior, edge cases, and scope boundaries.
