# An un-owned coin stays on the Collection page as "Removed" through a page-local, display-only list

- **Status:** Accepted
- **Date:** 2026-10-19
- **Source:** orchestrator run `run_20261019_073415` (signed-in redesign, Phase 6 Collection page; PRD criterion that a removed coin stays in place with Undo)
- **Code:** `apps/web/src/app/collection/page.tsx`, `apps/web/src/lib/collection-view.ts`, `apps/web/src/lib/ownership-cache.ts`

## Context

On the Collection page, removing a coin must leave its card in place, marked "Removed", with an Undo toast. But the shared optimistic `useSetOwnership` patches the `['collection']` caches through `applyOwnershipToCollection`, which drops an un-owned coin from every collection list. The same cache feeds the Add coins sheet and the coin page. [2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md) requires that ownership changes show everywhere at once, and rejects a client ownership store.

## Decision

The page keeps a `removed` list in `useState`. `handleToggle` appends the item to it before calling the mutation. The page renders `mergeSessionRemoved(owned, removed)`: the cached items, plus any removed item whose `coinId` is no longer in them (the cached copy wins). Whether a coin is owned is always read from presence in the cached `data`, so rollback after a failed save and Undo (which calls the same mutation with `owned: true`) need no extra handling. The list holds no ownership state. A `pendingRef` set ignores a second click on a coin whose request is pending.

The toast is shown from `onSettled`, so it appears after the request and the refetch, not at the click. Removed coins disappear on reload, because the API returns only owned coins.

## Alternatives considered

- **Change `applyOwnershipToCollection` to keep un-owned items with a flag.** Changes what `['collection']` means for the Add coins sheet and the coin page. Rejected.
- **Delay the request until the toast expires.** Breaks the "updates everywhere at once" rule of the optimistic-toggle ADR, and a closed tab would lose the change. Rejected.
- **A client ownership store.** Already rejected by the optimistic-toggle ADR.

## Consequences

- The shared cache semantics are unchanged. Other pages see the coin as not owned immediately.
- The "Removed" card is a page-session artefact: navigating away or reloading clears it, and a country whose coins were all removed keeps its chip until then.
- Because the toast waits for the refetch, a failed save shows the card's failed state instead of a "removed" toast.
- Any new view that needs to keep un-owned items visible has to copy this pattern. Revisit if a second page needs it, and consider moving the list into a shared hook.
