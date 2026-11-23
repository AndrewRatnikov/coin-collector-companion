# The `catalog_no_results` event fires once per distinct set of sent properties per page mount, never from placeholder data

- **Status:** Accepted
- **Date:** 2026-11-23
- **Source:** orchestrator run `run_20261123_220432` (analytics event for empty catalog searches; the dedupe rule was the Architect's, from an open question in the PRD)
- **Code:** `apps/web/src/app/catalog/page.tsx`, `apps/web/src/lib/catalog-view.ts`, `apps/web/src/app/catalog/analytics.test.tsx`

## Context

`useCatalog` uses `placeholderData: keepPreviousData`. Right after a filter change, `data` is still the previous combination's result while the new query loads. An effect that fires on "zero items" would report an empty previous result under the new filters. The page also re-renders on every state change, and sort, page, Hide owned and Key dates only change the query without changing what the event carries.

## Decision

- `CatalogPageContent` computes `noResults = !isError && !isPlaceholderData && data !== undefined && data.items.length === 0` and fires from one `useEffect` on `[noResults, noResultsProps]`.
- The dedupe key is `JSON.stringify` of the properties actually sent, held in a `useRef<Set<string>>`. A key is added before `track('catalog_no_results', …)` is called.
- The set lives for one page mount. Leaving /catalog and coming back starts over. Going from combination A to B and back to A in the same mount does not fire A again.
- Because the key is the sent properties, a search text that differs only in case or after the 40th character counts as the same combination, and sort or page changes never count as new.

## Alternatives considered

- **Once per consecutive combination:** A to B to A fires A twice and inflates counts.
- **A module-level Set for the whole tab:** survives navigation, is harder to test, and gains little.
- **Keying on the raw view state:** sort, page and the unsent flags would count as new searches.

## Consequences

- Counts approximate distinct empty searches per page visit, not repeated attempts.
- A page beyond the last page (`?page=` out of range) also shows `catalog-empty` and fires; page is not part of the key. Accepted.
- Any later "no results" or view-level event on a page that keeps previous data should follow this pattern: gate on `!isPlaceholderData`, key on what is sent.
- Revisit if the owner wants repeat searches counted across a session.
