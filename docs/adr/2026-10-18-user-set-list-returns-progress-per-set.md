# GET /sets returns a new UserSetListItem with ownedCount, totalCount and firstMissing, and UserSetSummary stays unchanged

- **Status:** Accepted
- **Date:** 2026-10-18
- **Source:** orchestrator run `run_20261018_105617` (Phase 3, My sets page; the user chose the backend change in answers-product.md, Q2)
- **Code:** `apps/api/src/sets/sets.service.ts`, `apps/api/src/sets/sets.controller.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/user-sets-api.ts`

## Context

The old `/dashboard` called `GET /sets` and then `GET /sets/:id/gaps` once per set to get progress. The My sets cards need `ownedCount`, `totalCount` and the next missing coin for every set. The user decided to add these to the `GET /sets` response instead of keeping the per-set calls. [2026-10-13-set-list-endpoints-return-flat-coin-count](2026-10-13-set-list-endpoints-return-flat-coin-count.md) says a count on another list means a new summary type, not a change to `UserSetSummary`. That type is also the response of create and rename, which don't compute progress.

## Decision

`packages/shared/src/index.ts` adds `UserSetListItem extends UserSetSummary` with `ownedCount`, `totalCount` and `firstMissing` (`string | null`). `SetsService.findAllForUser` returns `UserSetListItem[]` from one `userSet.findMany`, ordered by `createdAt asc` as before. It includes each set's coins by `position`, with only the name fields and the caller's `ownerships`. `firstMissing` is `getCoinName(coin).title` of the lowest-position unowned coin, or `null`. The response has no `coins` key. `UserSetSummary` is unchanged. The web `getUserSets()` is typed `UserSetListItem[]` and the page makes no `/gaps` calls.

## Alternatives considered

- Add the fields to `UserSetSummary`: create and rename would have to compute them, which the 2026-10-13 ADR rejected.
- Keep one `/gaps` request per set from the client: N requests per page load.

## Consequences

The page needs one list request, and the existing `['user-sets']` invalidation refreshes it after ownership changes. The list query now reads every slot of every set the user owns, so its cost grows with total slots. The web depends on the new fields, so the API has to be deployed before the web. Old web builds ignore the extra fields.
