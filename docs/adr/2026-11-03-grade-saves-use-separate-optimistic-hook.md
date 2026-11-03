# Grade edits go through a separate `useSetGrade` hook that shares the cache helpers of `useSetOwnership`

- **Status:** Accepted
- **Date:** 2026-11-03
- **Source:** orchestrator run `run_20261102_220909` (coin grades, phase 2 of 4: grade picker and chips in the web app; the PRD left "new hook vs. option" open)
- **Code:** `apps/web/src/lib/hooks/use-collection.ts` (`useSetGrade`), `apps/web/src/lib/ownership-cache.ts` (`applyGradeToGaps`, `applyGradeToCollection`), `apps/web/src/lib/collection-api.ts`, `apps/web/src/app/catalog/[coinId]/page.tsx`

## Context

Phase 1 ([2026-11-02-one-optional-adjectival-grade-per-ownership-row](2026-11-02-one-optional-adjectival-grade-per-ownership-row.md)) made a grade a field on the ownership row, written only by `PATCH /collection/:coinId` with `{ owned, grade }`. Phase 2 adds a grade picker on the coin page, which must update instantly like ownership does ([2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md)). The coin page already shows ownership state from `useSetOwnership`: a pending flag, a "Couldn't save, try again" alert from `failedCoinIds`, and a live-region message. Gap slots also carry `grade`, `needsUpgrade` and `upgradeCount` ([2026-11-02-grade-gap-fields-conditional-on-min-grade](2026-11-02-grade-gap-fields-conditional-on-min-grade.md)).

## Decision

`use-collection.ts` exports a new `useSetGrade({ onSettled })`, a separate mutation next to `useSetOwnership` and `useBulkSetOwnership`.

- It calls `setOwnership(coinId, true, grade)`. `collection-api.ts` sends `{ owned }` when `grade` is `undefined` (so ownership toggles never send a grade key) and `{ owned, grade }` otherwise, with `null` clearing the grade. The single write path of the Phase 1 ADR is unchanged.
- It reuses the module's private helpers: `cancelOwnershipQueries`, snapshot type `SetOwnershipContext`, `restoreSnapshots`, `invalidateOwnershipQueries` and `useFailedCoinIds`. Its own optimistic step, `applyOptimisticGrade`, snapshots collection lists and gap views only (catalog lists carry no grade) and patches them with `applyGradeToCollection` and `applyGradeToGaps`.
- It has its own `isPending`, `failedCoinIds` and `onSettled`. `onMutate` clears the coin's failed flag, `onError` restores the snapshots and marks it failed, `onSettled` awaits the invalidation and then calls the caller's `onSettled`. The coin page reads grade failures from `gradeMutation.failedCoinIds` and uses its own live messages (`coinDetail.liveGradeSaved`, `coinDetail.liveGradeFailed`).
- Cache coherence: `applyGradeToGaps` changes only owned slots, leaves counts and completion alone, and recomputes `needsUpgrade` and `upgradeCount` only when the set has a `minGrade`. `applyOwnershipToGaps` now also sets `grade: null` on a slot that becomes un-owned, matching the API deleting the row.

## Alternatives considered

- **A `grade` option on `useSetOwnership`.** Rejected: a failed grade save would land in the ownership `failedCoinIds`, so the panel would show the ownership error and its Retry would re-toggle ownership; the ownership live region would also announce "marked as owned" for a grade change.
- **A separate API wrapper or endpoint for grades.** Rejected by the Phase 1 ADR (one write path, `PATCH /collection/:coinId`).
- **Leaving gap grades stale until the settle refetch.** Rejected: a quick un-own then re-own would briefly show the deleted grade's chip.

## Consequences

- Ownership and grade have independent pending and failed states on one coin. There is still one cache-patching path, which is why [2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md) rejected a parallel hook; the bulk hook in [2026-10-17-bulk-ownership-endpoint](2026-10-17-bulk-ownership-endpoint.md) shares the helpers the same way.
- Inherited caveat: rollback restores whole snapshots, so a failed earlier save can briefly undo a later optimistic value until the refetch.
- Known gap: the grade `failedCoinIds` entry clears only on the next grade save, so after a failed save, un-own and re-own, the alert can still show until the user picks again.
- Any new kind of write on the ownership row should get its own hook on these helpers, not a new option on an existing one.
