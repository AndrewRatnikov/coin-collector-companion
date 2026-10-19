# The Collection page filters, counts and groups one unfiltered GET /collection on the client

- **Status:** Accepted
- **Date:** 2026-10-19
- **Source:** orchestrator run `run_20261019_073415` (signed-in redesign, Phase 6 Collection page; the PRD ruled out backend changes)
- **Code:** `apps/web/src/lib/collection-view.ts`, `apps/web/src/app/collection/page.tsx`, `apps/web/src/components/collection/collection-filter-bar.tsx`, `apps/web/src/lib/ownership-cache.ts`

## Context

The redesigned `/collection` page has live search, country chips that each show a count, a year range, and coins grouped by country and then by series. The chip counts depend on the other active filters (search and years), across all countries. `GET /collection` accepts optional `country` and `year` parameters, but it returns one unpaginated list, and it has no endpoint for per-country counts. `OwnershipItem` already carries the full `CatalogCoin`, so grouping needs no extra data. The same list is cached as `['collection', {}]` and is already used by the Add coins sheet and the coin page.

## Decision

The page calls `useCollection()` with no argument, once, and does everything else in the browser through the pure module `collection-view.ts`:

- `filterCollection` applies the search (substring over title, eyebrow, denomination and subgroup name), the inclusive year range and the country.
- `getCountryChips` builds one chip per country in the unfiltered list. Each count is computed with the country filter dropped, so a chip can show 0.
- `groupCollection` groups by country, then by subgroup. The order is deterministic and does not use `ownedAt`.

`CollectionFilters`, `getCollection(filters)` and the API query DTO are unchanged. `ownership-cache.ts` still reads filtered cache keys. This page just doesn't create them.

## Alternatives considered

- **Send the filters to the API.** One request per keystroke, and chip counts across countries would need a new endpoint. Rejected.
- **Remove the `country` and `year` params from the API and the web client.** That is an API change, which the PRD ruled out, and it gives nothing in this phase. Rejected.

## Consequences

- No API deploy ordering: the change ships with the web app alone.
- The whole collection is held and re-filtered in memory on every keystroke. This is fine for a personal collection. Revisit if collections grow to the point where the single unpaginated response or the re-grouping is slow, at which point pagination and server-side counts would be needed together.
- The server-side `country` and `year` params are now unused by the web app but still exist.
- The filter, count and sort rules live in one tested module, so the grouping rule can change without touching the page.
