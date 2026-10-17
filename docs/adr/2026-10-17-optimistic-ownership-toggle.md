# Ownership toggles are optimistic through the existing `useSetOwnership` mutation, with snapshot rollback

- **Status:** Accepted
- **Date:** 2026-10-17
- **Source:** orchestrator run `run_20261017_142658` (signed-in redesign, Phase 1 Foundations)
- **Code:** `apps/web/src/lib/hooks/use-collection.ts` (`useSetOwnership`), `apps/web/src/lib/ownership-cache.ts`

## Context

[2026-10-09-album-view-client-side-projection](2026-10-09-album-view-client-side-projection.md) had `useSetOwnership` invalidate the gaps query and keep no local copy of ownership. The result is a visible delay after every toggle. The redesign requires ownership to update instantly everywhere. Gap data is keyed `['user-sets', id, 'gaps']` and is shared by the set page, dashboard, coin page and public set page.

## Decision

`useSetOwnership` is upgraded in place, keeping its name and `onSettled` contract.

- `onMutate` cancels in-flight `collection`, `user-sets` and `catalog` queries. It snapshots the matching queries that already hold data: collection lists, gaps keys, and catalog list keys (`isCatalogListKey`). It then patches them with the pure functions in `ownership-cache.ts`:
  - `applyOwnershipToGaps` sets `owned` on every slot of the coin and recounts `ownedCount` and `completionPercent` with the API's rounding.
  - `applyOwnershipToCollection` removes the coin, or prepends it when it matches the list's country and year filters.
  - `applyOwnershipToCatalogPage` drops the coin from `hideOwned` lists only, and decrements `total`.
- `onError` restores the snapshots and records the coin in `failedCoinIds`, which the hook returns.
- `onSettled` still invalidates `user-sets`, `collection` and the `hideOwned` catalog lists, and waits for the refetch before calling the caller's `onSettled`. Server state remains authoritative.

Catalog items carry no ownership until Phase 8, so only `hideOwned` lists can change.

## Alternatives considered

- **A new parallel hook.** Rejected: two ownership paths would drift.
- **Invalidate only (the previous behaviour).** Rejected: it fails "updates instantly everywhere".
- **A client ownership store (Context).** Rejected: it would duplicate server state, against the "no local copy" rule of the 2026-10-09 ADR.

## Consequences

- Patching the shared gaps keys updates every card and set count at once.
- Rollback restores whole snapshots, so a failed toggle can briefly undo another in-flight coin's optimistic change until the settle refetch. Phase 4's bulk `PATCH /collection` should revisit this.
- The hook returns `{ ...mutation, failedCoinIds }`, a new object each render. Callers that need stability should use `mutate` directly.
- If the coin is not on a loaded catalog page, the patch returns that page unchanged and `total` is corrected by the refetch.
