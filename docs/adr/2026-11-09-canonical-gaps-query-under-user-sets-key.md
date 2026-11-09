# The curated checklist gaps query is keyed `['user-sets', 'canonical', id, 'gaps']`

- **Status:** Accepted
- **Date:** 2026-11-09
- **Source:** orchestrator run `run_20261109_220451` (own progress on curated checklists and public sets, Phase 2: Web)
- **Code:** `apps/web/src/lib/hooks/use-user-sets.ts`, `apps/web/src/lib/user-sets-api.ts`, `apps/web/src/app/sets/canonical/[id]/page.tsx`

## Context

The curated checklist page needs the viewer's progress from the Phase 1 endpoint `GET /sets/canonical/:id/gaps` ([2026-11-08-canonical-checklist-gaps-separate-endpoint](2026-11-08-canonical-checklist-gaps-separate-endpoint.md)). That progress must follow ownership edits made elsewhere in the app. Every ownership mutation already invalidates the `['user-sets']` prefix, while the optimistic gap patching matches only 3-part gap keys (`isGapsKey`).

## Decision

`getCanonicalSetGaps(id)` in `user-sets-api.ts` and `useCanonicalSetGaps(id, { enabled })` in `use-user-sets.ts` sit beside `getSetGaps` / `useSetGaps`. The query key is `['user-sets', 'canonical', id, 'gaps']`. The query is enabled only when `enabled` is true and `id` is non-empty; the page passes `enabled: isLoggedIn`.

## Alternatives considered

- **`['canonical-sets', id, 'gaps']` in `use-canonical-sets.ts`.** Rejected: ownership mutations would not invalidate it, so progress would go stale after edits elsewhere, and new invalidation code would be needed.

## Consequences

- Progress refreshes through existing invalidation, with no new code in the mutations.
- The 4-part key keeps the query out of the optimistic gap patching, so a canonical view is refetched rather than patched in place.
- Coupling is by key shape: a test that factory-mocks `@/lib/hooks/use-user-sets` while rendering the canonical page must include `useCanonicalSetGaps`.
- Production needs the Phase 1 endpoint deployed first; otherwise the canonical page shows no progress.
