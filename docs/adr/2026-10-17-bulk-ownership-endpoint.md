# Bulk ownership changes go through one idempotent `PATCH /collection` request and a hook that shares the single-coin cache patching

- **Status:** Accepted
- **Date:** 2026-10-17
- **Source:** orchestrator run `run_20261017_210503` (signed-in redesign, Phase 4, Set page)
- **Code:** `apps/api/src/collection/collection.service.ts`, `apps/api/src/collection/collection.controller.ts`, `apps/api/src/collection/dto/bulk-set-ownership.dto.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/collection-api.ts`, `apps/web/src/lib/hooks/use-collection.ts`

## Context

The redesigned set page can change many coins at once: "Mark all N as owned" for a year, select mode with Mark owned / Mark missing, and the undo of each. The only ownership endpoint was `PATCH /collection/:coinId`, one coin per request. [2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md) already established that ownership caches are patched in one place (`ownership-cache.ts`) and rolled back from snapshots.

## Decision

- **API:** `PATCH /collection` with body `{ coinIds: string[], owned: boolean }` (`BulkSetOwnershipDto`: non-empty array, at most 1000 entries, each a UUID v4). It sits behind the global JWT guard and uses the user from the token. The response is `{ coinIds, owned }` with ids de-duplicated in first-seen order. Types `BulkSetOwnershipRequest` / `BulkSetOwnershipResponse` live in `packages/shared`.
- **Semantics:** `CollectionService.setOwnershipBulk` is idempotent. For `owned: true` it first counts the coins; if any id doesn't exist it throws `NotFoundException('Coin not found')` and writes nothing. Then it runs `ownership.createMany({ skipDuplicates: true })`, so existing `ownedAt` values are untouched. A `P2003` foreign-key error (coin deleted in between) is also mapped to 404. For `owned: false` it runs `ownership.deleteMany`.
- **Web:** `setOwnershipBulk` in `collection-api.ts` calls it. `useBulkSetOwnership` is a sibling of `useSetOwnership` in `use-collection.ts`. Both use the same private helpers for the optimistic patch, snapshot restore and invalidation, applying the `ownership-cache.ts` patchers once per coin. `useSetOwnership` keeps its public API.
- The set page drives per-coin pending and failed state from the bulk hook's `onSettled` and mutate options; on error every id in the request is marked failed.

## Alternatives considered

- **N calls to `PATCH /collection/:coinId`.** The brief forbids it, and N requests mean N independent rollbacks and N toasts for one user action.
- **Widening `useSetOwnership`'s variables to a single-or-many union.** It would break the typed `onSettled(variables.coinId)` contract that existing callers and tests rely on.
- **A separate cache-patching path for bulk.** The optimistic-toggle ADR rejects parallel ownership paths because they drift.

## Consequences

- One request per user action, and one place that patches ownership caches.
- The bulk call is all-or-nothing on unknown coins when marking owned, so a stale id fails the whole request. The web rolls everything back and flags every coin as failed.
- The 1000-id cap bounds the largest set a single "Mark all" can cover. A larger set would need chunking on the client or a higher cap.
- Undo of a bulk action is another bulk call with the inverse `owned` value, restricted to the ids that actually changed.
