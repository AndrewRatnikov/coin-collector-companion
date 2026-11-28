# The checklists that contain a coin are composed on the web server from the cached canonical list and detail endpoints, best effort

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_133045` (search visibility phase 3; the PRD preferred no API change)
- **Code:** `apps/web/src/lib/server-catalog.ts`, `apps/web/src/components/catalog/coin-detail-view.tsx`, `apps/web/src/app/catalog/[coinId]/page.tsx`

## Context

The coin page should link to the curated checklists that contain the coin, in the server HTML, so crawlers get internal links from coins to checklists. The API has no endpoint that answers "which checklists contain this coin".

## Decision

`loadCoinChecklists(coinId)` in `lib/server-catalog.ts` calls `loadCanonicalSets()` and then `loadCanonicalSet(id)` for every checklist. Those calls use the 1-hour data cache and are shared per request through React `cache()`. It keeps, in list order, `{ id, name }` for each checklist whose `coins` include a slot with that coin id. If the list fails it returns `[]`. A checklist whose detail fails is left out. It never throws and never affects the coin result.

The page loads the coin and the checklists in parallel and passes the links to `CoinDetailView`. The "In checklists" section (`coin-detail-checklists`) renders when the list is non-empty and does not depend on sign-in.

## Alternatives considered

- **A new public `GET /catalog/:id/checklists` endpoint.** Rejected: it is an API change the PRD asked to avoid.
- **Rendering the section only in the browser.** Rejected: crawlers would get no links.

## Consequences

- No API change. The cost is one cached request per checklist per hour (about 29 in total), shared by every coin page.
- On a slow API the coin page can wait about 10 s (a 5 s list timeout, then 5 s for the details) while the coin itself answered.
- If the number of checklists grows a lot, or per-coin cost matters, a dedicated endpoint is the revisit point.
