# The Add coins sheet derives set membership, ownership, hiding and the results count on the client, with no API change

- **Status:** Accepted
- **Date:** 2026-10-18
- **Source:** orchestrator run `run_20261018_161537` (signed-in redesign, Phase 5 Add coins sheet; the PRD put backend changes out of scope)
- **Code:** `apps/web/src/lib/add-coins.ts`, `apps/web/src/components/sets/add-coins-sheet.tsx`, `apps/web/src/app/sets/[id]/page.tsx`, `apps/api/src/catalog/catalog.service.ts`

## Context

The Add coins sheet must show an "In this set" badge, a "Owned" badge, a "Hide coins in this set" toggle and an exact results count. `GET /catalog` items carry no ownership or set membership (that arrives with a later redesign phase), and `GET /catalog` takes no "exclude this set" parameter. The set page already holds the set's gap slots, and `GET /collection` returns every owned coin in one unpaginated list. `GET /catalog` caps `limit` at 100.

## Decision

Everything is computed in the browser from data that is already loaded. No endpoint or shared type changed.

- **In this set:** the ids of the set page's gap `slots` (`inSetCoinIds`), plus coins added in the open sheet's session.
- **Owned:** `useCollection()` ids plus the slots with `owned` set.
- **Hide coins in this set:** not sent to the API. `getVisibleAddCoinsRows` filters the loaded page. Coins added during the session stay visible (`stickyCoinIds`) until a filter changes, so a row doesn't vanish under the cursor.
- **Results count:** `countAddCoinsResults` returns the API `total` minus the set's coins that match the same filters. "Match" is `coinMatchesAddCoinsFilters`, a hand-written mirror of `CatalogService.findAll`: case-insensitive equals for country and denomination, case-insensitive `contains` on `name`, exact year.
- `hideInSet` is never put into the catalog query (`toCatalogFilters`). The sheet is rendered only while open, so its state resets on reopen.

## Alternatives considered

- **A new `excludeSetId` catalog parameter.** Exact, with pagination handled by the server. Rejected because it is a backend change and the PRD ruled those out.
- **Wait for per-item `owned` / `inSetsCount` on catalog items.** Would give badges for free but blocks this phase on a later one.

## Consequences

- No deploy ordering with the API; the change ships with the web app alone.
- The count is exact only while `coinMatchesAddCoinsFilters` matches the API's where clause. If `CatalogService.findAll` changes how it filters (new fields, different matching), this mirror must change with it. Nothing tests the two against each other.
- The count subtracts only coins that were in the set's slots, not coins added during the session, until the gaps query refetches.
- Hiding works on the loaded page only, so with the toggle on a page can show fewer than 20 rows until "Show more" is pressed (the limit is capped at 100).
- "Owned" for coins outside the set waits on `GET /collection`; until it loads, only the set's own coins can show Owned.
- Revisit when catalog items gain `owned` and set membership: the client-side sets and the mirror can then be dropped.
