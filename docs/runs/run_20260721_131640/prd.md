# PRD: Anonymous browse — catalog + canonical sets (Week 3, Day 2)

**Run:** run_20260721_131640
**Date:** 2026-07-21

## Goal

Anonymous (and logged-in) visitors to the coin-collector-companion web app need to be able to browse the full coin catalog and the site's canonical reference sets without logging in, per system-design_v2.md §3.1's anonymous-read route table. This is the second of five build days for `apps/web`; Day 1 already shipped auth (token storage, login/signup, `apiFetch` Bearer attachment, route protection for the write-requiring routes). Day 2 builds the read-only browsing surface on top of that: a filterable, paginated catalog list, a coin detail page, a canonical-set list, and a canonical-set detail page — all backed by the already-complete v2 API (catalog + canonical-sets endpoints, per docs/system-design_v2.md §3 and Week 1/2's closed backend). Nothing here touches the API; this is `apps/web` consuming endpoints that already exist and are already tested server-side.

## User stories

- As an anonymous visitor, I want to filter and browse the coin catalog by country, denomination, name, and year range so that I can find coins I'm interested in without creating an account.
- As an anonymous visitor, I want to open a coin's detail page so that I can see its full identity fields and image (with proper attribution) before deciding to track it.
- As an anonymous visitor, I want to browse the list of canonical reference sets (e.g. "Lincoln Wheat Cents") so that I can see what collecting templates exist.
- As an anonymous visitor, I want to open a canonical set's detail page and see its ordered coin list so that I can evaluate the set before cloning it.
- As a logged-in visitor viewing a canonical set, I want a "Clone into my sets" call-to-action so that I can start my own copy of it (the clone action itself ships Day 3; today it only needs to be visibly present and correctly gated by auth state).

## Acceptance criteria

1. `apps/web/src/lib/catalog-api.ts` exports `getCatalog(filters)` and `getCoin(id)`, both wrapping `apiFetch` against `GET /catalog` and `GET /catalog/:id` respectively, typed directly against `packages/shared`'s `CatalogCoin` and `PaginatedResponse<CatalogCoin>` (no local type mirror — these already exist in `packages/shared`).
2. `apps/web/src/lib/hooks/use-catalog.ts` exports `useCatalog(filters)` (TanStack Query, query key derived from the filters object so distinct filter combinations cache independently) and `useCoin(id)`, both built on (1).
3. `packages/shared/src/index.ts` exports one coin-label formatter function (e.g. `formatCoinLabel(coin)`) producing the SD §3.1 compact label `{country} {denomination} ({year} {mintMark})`, dropping the parenthetical to just `{year}` when `mintMark === ''`. This is the single implementation both the catalog page and any future consumer use — no duplicated string-building logic in a page component.
4. `apps/web/src/app/catalog/page.tsx` renders: (a) a plain filter form with fields for country, denomination, coin-name substring, and year range (min/max), submitted explicitly (no live/autocomplete search-as-you-type); (b) a paginated grid/list of results using `PaginatedResponse`'s `page`/`limit`/`total`, each item rendered via (3)'s formatter. The route is not gated by auth — reachable and functional with no stored token.
5. `apps/web/src/app/catalog/[coinId]/page.tsx` renders a coin's full identity fields (country, denomination, year, mintMark, variety, name), its image when `imageUrl` is non-null, and `imageSource`/`imageLicense` credited inline next to the image (distinct from the blanket footer Wikipedia attribution — this is per-image Commons licensing credit, SD §4.3). Not gated by auth.
6. `apps/web/src/lib/canonical-sets-api.ts` exports `getCanonicalSets()` and `getCanonicalSet(id)`, typed against `packages/shared`'s `CanonicalSetSummary` and `CanonicalSetDetail`.
7. `apps/web/src/lib/hooks/use-canonical-sets.ts` exports `useCanonicalSets()` and `useCanonicalSet(id)` hooks built on (6).
8. `apps/web/src/app/sets/canonical/page.tsx` renders a list of canonical sets (name, description). Not gated by auth.
9. `apps/web/src/app/sets/canonical/[id]/page.tsx` renders a canonical set's detail: name, description, and its ordered coin list (via `CanonicalSetDetail.coins`, sorted by `position`, each coin rendered via (3)'s formatter). Includes a "Clone into my sets" call-to-action that is disabled or hidden when no token is present (checked via Day 1's `getStoredToken`) and visible/enabled when a token is present — the CTA does not need to perform the actual clone (that's Day 3's `createSet` flow); it only needs to be correctly gated and present as a link/button. The page itself is not gated by auth (readable anonymously per SD §3.1's route table).
10. None of the routes added in this task (`/catalog`, `/catalog/[coinId]`, `/sets/canonical`, `/sets/canonical/[id]`) are added to Day 1's auth-guard route list — they must remain reachable with no stored token, and existing protected routes (`/dashboard`, `/collection`, `/sets/new`, `/sets/[id]`) must remain unaffected.

## Out of scope

- The actual "clone into my sets" mutation/flow and `apps/web/src/lib/user-sets-api.ts`'s `createSet` — Day 3.
- `/sets/public`, `/dashboard`, `/sets/new`, and any other route not listed above — Day 3/4.
- Any Tailwind styling/visual-polish pass — Day 5 (backlog explicitly separates styling from functional build days).
- Top-level navigation links to these new routes — Day 5 (5.2), since no navigation exists yet anywhere in the app.
- Any backend/API change — Weeks 1–2 already closed the full API surface; catalog and canonical-sets endpoints are consumed as-is.
- Theme/subject-tag filtering on the catalog form — explicitly cut from v1 (PRD Requirement 15); the filter form is exactly country/denomination/name-substring/year-range, nothing more.
- The live browser manual pass described in backlog item 2.5 (real fixture-data filtering/pagination check, console-error check against real running dev servers) — that is a human-run verification step outside this pipeline's automated test/sandbox stages, consistent with this project's established convention (per memory.md's gotcha on deferring live-DB/live-server verification to a manual pass rather than the automated Coder/sandbox stages). Automated tests in this task cover component/hook behavior against mocked `apiFetch` responses, not real network calls to a running dev server or the real Neon dev DB.

## Open questions

None — the backlog item (docs/backlog_week3.md, Day 2, items 2.1–2.5) and system-design_v2.md §3.1/§4.3 fully specify scope, fields, and route-gating behavior. The Architect should confirm the exact `GET /catalog` query-param names and `CanonicalSetDetail`/`CatalogCoin` field shapes directly against `packages/shared/src/index.ts` and the existing `apps/api/src/catalog`/`apps/api/src/sets` controllers rather than re-deriving them from prose.
