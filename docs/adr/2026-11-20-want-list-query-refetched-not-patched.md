# The combined want list query is keyed `['user-sets', 'wants']` and is refetched, never optimistically patched

- **Status:** Accepted
- **Date:** 2026-11-20
- **Source:** orchestrator run `run_20261120_215525` (want list Phase 3, growth 5.3, web; `docs/backlog_want-list.md` item 3.1)
- **Code:** `apps/web/src/lib/hooks/use-user-sets.ts`, `apps/web/src/lib/user-sets-api.ts`, `apps/web/src/lib/hooks/use-collection.ts`

## Context

The `/want-list` page reads `GET /sets/wants` ([2026-11-18-combined-want-list-computed-on-the-server](2026-11-18-combined-want-list-computed-on-the-server.md)). Its content changes whenever the user toggles ownership, saves a grade, or edits a set. Every one of those mutations already invalidates the `['user-sets']` prefix on settle, while optimistic patching in `use-collection.ts` touches only queries matched by `isGapsKey`, which accepts exactly 3-part keys (`['user-sets', id, 'gaps']`). The same split was used for the canonical gaps query in [2026-11-09-canonical-gaps-query-under-user-sets-key](2026-11-09-canonical-gaps-query-under-user-sets-key.md).

## Decision

`useWantList()` in `use-user-sets.ts` is a plain `useQuery<WantListResponse>` with `queryKey: ['user-sets', 'wants']` and `queryFn: getWantList`, which calls `apiFetch('/sets/wants')`. The key has 2 parts, so `isGapsKey` never matches it and the optimistic patchers leave it alone; the settle-time invalidation of `['user-sets']` refetches it. No code in `use-collection.ts` or `ownership-cache.ts` changed. Tests in `use-collection.test.tsx` pin that the cached value is untouched while a mutation is pending and is invalidated after it settles.

## Alternatives considered

- A top-level `['want-list']` key: ownership and grade mutations would not refresh it without new invalidation code.
- Patching the cached list optimistically: dedupe and target-grade rules live on the server, so a client patch would duplicate them and could disagree with the next refetch.

## Consequences

The want list is always server-correct, at the cost of a refetch after each ownership change (not instant while the page is open, which matters little since toggling happens on set pages). Any new query that must stay unpatched can follow the same rule: a key that is not 3 parts under `['user-sets']`. The coupling is implicit: if `isGapsKey` is ever loosened to match 2-part keys, this query would be patched with the wrong shape; the tests catch that.
