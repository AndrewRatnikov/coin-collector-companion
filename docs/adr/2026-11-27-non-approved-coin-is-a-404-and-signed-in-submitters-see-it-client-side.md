# A non-approved coin is a real 404 on every server request, and the segment's not-found view shows a signed-in submitter the client coin view

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_133045` (search visibility phase 3: server-render the coin page and first catalog page; the mechanism for PRD criterion 4a was left to the Architect)
- **Code:** `apps/web/src/app/catalog/[coinId]/page.tsx`, `apps/web/src/app/catalog/[coinId]/not-found.tsx`, `apps/web/src/components/catalog/coin-not-found-view.tsx`, `apps/web/src/lib/server-catalog.ts`, `apps/web/src/lib/coin-page.ts`, `apps/web/src/app/sitemap.ts`

## Context

A submitter can open their own pending or rejected coin at `/catalog/[coinId]`; the API returns it only with their token. Crawlers must get a 404 for a coin that is not approved, and must see none of its data. The web server cannot tell who is signed in: the access token lives in localStorage, and the refresh cookie is host-only on the API domain. [2026-11-26-public-pages-server-rendered-with-cached-api-data](2026-11-26-public-pages-server-rendered-with-cached-api-data.md) (c) only turns an API 404 into `notFound()`.

## Decision

- `loadCoin` in `lib/server-catalog.ts` returns `not-found` for: an id that fails `isCoinId` (a UUID-shaped regex, checked before any API call), an API `http` error with status 404 or 400, and a loaded coin whose `status` is not `approved` (its data is dropped). Any other failure is `unavailable`, and the page then renders the client view with no initial data at HTTP 200.
- The page and `generateMetadata` both use `loadCoin`. The page calls `notFound()` on `not-found`. `generateMetadata` returns the fallback metadata with `robots: { index: false, follow: false }`.
- `app/catalog/[coinId]/not-found.tsx` renders the client `CoinNotFoundView`. The server HTML is always the anonymous 404 content. After mount, if a token is stored and the path has an id (`coinIdFromPathname(usePathname())`), the view renders `CoinDetailView` with no initial data, so the browser fetches `GET /catalog/:id` with the token and the submitter sees their coin, including the pending badge.
- `app/sitemap.ts` keeps only list items with `status === 'approved'` as a defensive check.

## Alternatives considered

- **404 only for anonymous requests, a 200 noindex shell for signed-in ones.** Rejected: the server cannot see who is signed in.
- **A "signed-in" marker cookie on the web domain.** Rejected: it adds auth surface for one page.
- **A 200 noindex shell for every non-approved coin.** Rejected: crawlers get a 200 for a page that should not exist, against the 404 requirement.

## Consequences

- Crawlers get a real 404 and no coin data. The submitter's page works as before, but shows the not-found content for one frame until the mount effect swaps in the coin view.
- The API response for a pending coin is cached for `COIN_REVALIDATE_SECONDS` (one day), so a freshly approved coin can stay a 404 for up to 24 hours. Shortening it would wake the Render API more often.
- This extends the 404 rule of the 2026-11-26 ADR to coins: a malformed id and a non-approved coin are 404s too. The 400 mapping carries [2026-11-27-set-page-loads-map-api-outcomes-to-ok-not-found-unavailable](2026-11-27-set-page-loads-map-api-outcomes-to-ok-not-found-unavailable.md) over to coins.
