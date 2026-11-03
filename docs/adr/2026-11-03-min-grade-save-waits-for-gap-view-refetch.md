# Saving a set's minimum grade is not optimistic: the mutation stays pending until the gap view is refetched

- **Status:** Accepted
- **Date:** 2026-11-03
- **Source:** orchestrator run `run_20261103_192441` (coin grades, phase 3 of 4: minimum grade select in the set page menu)
- **Code:** `apps/web/src/lib/hooks/use-user-sets.ts` (`useUpdateSetMinGrade`), `apps/web/src/lib/user-sets-api.ts` (`updateSetMinGrade`), `apps/web/src/app/sets/[id]/page.tsx`, `apps/web/src/components/sets/set-actions-menu.tsx`

## Context

The owner of a set can now pick a minimum grade (or None) in the set's actions menu. The value lives on the set, and per [2026-11-02-grade-gap-fields-conditional-on-min-grade](2026-11-02-grade-gap-fields-conditional-on-min-grade.md) the server derives every slot's `needsUpgrade` and the set's `upgradeCount` from it. Changing it can flip badges on any slot in the set. Coin ownership and grade writes are optimistic ([2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md), [2026-11-03-grade-saves-use-separate-optimistic-hook](2026-11-03-grade-saves-use-separate-optimistic-hook.md)), but those patch single slots. The task and the PRD require that the client not re-implement the server's upgrade rule.

## Decision

`useUpdateSetMinGrade` in `use-user-sets.ts` is a plain `useMutation` that sends `PATCH /sets/:id` with `{ minGrade }` (`CoinGrade` code or `null`). It has no `onMutate` and writes nothing to the query cache.

- `onSuccess` returns `Promise.all` of `invalidateQueries(['user-sets'])` and `invalidateQueries(['public-sets', id])`. Because react-query awaits the returned promise, the mutation stays `isPending` until the gap view has been refetched.
- While pending, the set page shows the chosen value in the select (`shownMinGrade` reads `minGradeMutation.variables.minGrade`), disables the select (`minGradePending`), and otherwise reads `gaps.minGrade`. After the refetch the select, badges, upgrade count and filter all come from the same gap-view response.
- On error nothing was written to the cache, so there is nothing to roll back. The page sets a local `minGradeFailed` flag and shows `setEditor.minGradeSaveFailed`; the select returns to `gaps.minGrade`.

## Alternatives considered

- **Optimistic patch** of `gaps.minGrade`, every slot's `needsUpgrade` and `upgradeCount`. Rejected: it recomputes the server's rule for the whole set on the client, which the PRD forbids, and the existing cache helpers only recompute single changed slots.
- **Fire-and-forget invalidation** (no returned promise). Rejected: the select would snap back to the old value until the refetch landed.

## Consequences

- A save shows a short pending state (select disabled) instead of an instant change. Acceptable because a set's goal changes rarely.
- The upgrade rule stays in one place, the server. The cache can never show badges that disagree with the select.
- Failure needs no rollback code, so the stale-snapshot caveat of the optimistic hooks does not apply here.
- Pattern: a set-level setting that changes derived per-coin data should be saved this way, not with a client-side recompute. Revisit if the pending time becomes noticeable on large sets.
