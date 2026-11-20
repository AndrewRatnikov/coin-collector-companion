# The combined want list is computed on the server by one GET /sets/wants in three queries, deduplicated per coin, while the per-set list stays in the browser

- **Status:** Accepted
- **Date:** 2026-11-18
- **Source:** orchestrator run `run_20261120_211112` (want list Phase 2, growth 5.3 server side; `docs/backlog_want-list.md` decision 5 and items 2.1 to 2.5)
- **Code:** `packages/shared/src/index.ts`, `apps/api/src/sets/want-list.ts`, `apps/api/src/sets/sets.service.ts`, `apps/api/src/sets/sets.controller.ts`

## Context

Phase 3 of the want-list backlog adds a `/want-list` page: every coin the user still wants across all of their sets, in one list. Until now the only want data came per set, from `GET /sets/:id/gaps`, which the web app turns into the per-set missing page ([2026-11-19-one-want-list-table-component-for-every-want-list](2026-11-19-one-want-list-table-component-for-every-want-list.md), [2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows](2026-11-19-missing-csv-in-want-list-order-with-upgrade-rows.md)). Building the combined list in the browser would mean one `/gaps` request per set and a merge whose dedupe and upgrade rules would live only in the web app. The dashboard already shows "Coins still missing across your sets" from `GET /sets/summary`'s `uniqueMissingCount` ([2026-10-18-sets-summary-endpoint-computes-suggestion-server-side](2026-10-18-sets-summary-endpoint-computes-suggestion-server-side.md)), and the combined list must agree with that number.

## Decision

- One authenticated endpoint, `GET /sets/wants` (no `@Public()`), declared in `SetsController` right after `GET /sets/summary` and before every `:id` route. It returns the shared `WantListResponse`: `{ setCount, missing: WantCoin[], upgrades: UpgradeWant[] }`, where `WantCoin = { coin, sets: { id, name }[] }` and `UpgradeWant = WantCoin & { grade, targetGrade }`.
- `SetsService.getWantList(userId)` runs exactly three Prisma queries in one `Promise.all`, whatever the number of sets or coins (including an empty account): the caller's set count; the caller's `UserSetCoin` rows with the coin through `CATALOG_COIN_SELECT` and the set's `id`, `name` and `minGrade`; and the caller's `Ownership` rows (`coinId`, `grade`) for coins in their sets. The ownership query restricts to those coins with a relation filter scoped by the caller's `userId` (`coin.userSetCoins.some.userSet.userId`), not with a `coinId IN (...)` list from the slot query, so it does not wait for the first query and carries no parameter list.
- The pure `buildWantList` (`apps/api/src/sets/want-list.ts`) does the rest:
  - **Dedupe:** one entry per coin. A coin the caller doesn't own is in `missing`, with `sets` listing every caller set that contains it.
  - **Upgrades:** an owned coin is in `upgrades` when it fails `meetsMinGrade` for at least one containing set. `targetGrade` is the highest `minGrade` among the sets it fails, `grade` is the caller's recorded grade (or `null`), and `sets` lists the failing sets only. An ungraded owned coin fails every set that has a minimum and passes every set without one, so it is an upgrade only where a minimum exists.
  - A coin is classified once, so it is never in both lists.
  - **Order:** both lists by country, then denomination (`localeCompare` with `numeric: true`), then year, mint mark and variety, with the coin id as a final tie-break; `sets` by name, then id.
- `setCount` counts every set the caller owns, including sets with no coins, so it matches the My sets page.
- `missing.length` equals `GET /sets/summary`'s `uniqueMissingCount` for the same caller: both take the caller's set coins with no ownership row, with no coin-status filter, deduplicated by coin. An e2e test pins it.
- The per-set list stays client-side: `/sets/[id]/missing` keeps building its want list in the browser from `GET /sets/:id/gaps`.

## Alternatives considered

- **The web app calls `GET /sets/:id/gaps` once per set and merges.** Rejected: N requests that grow with the number of sets, and the dedupe and target-grade rules would live in the browser, untested against the server's counts.
- **Extend `GET /sets/summary`.** Rejected: the summary is a small tile payload the dashboard loads on every visit; the list is large and only the want-list page needs it.
- **A per-set query loop on the server.** Rejected: N queries per request.
- **A dependent `coinId IN (...)` ownership query after the slot query.** Rejected: a second serial round trip and an unbounded parameter list, where the relation filter gives the same rows in parallel.

## Consequences

- Phase 3 builds the `/want-list` page on this endpoint, rendering it with `WantListTable`; it ships only after the endpoint is live on Render.
- No pagination: the response is bounded by one user's sets, like `GET /sets`.
- The endpoint must keep selecting coins through `CATALOG_COIN_SELECT`, so `submittedByUserId` and `rejectionReason` never leak; an e2e test checks `submittedByUserId`.
- Any new literal route under `/sets` must also be declared before the `:id` routes.
- No schema change or migration.
