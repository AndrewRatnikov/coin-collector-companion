# GET /catalog adds `owned` and `inSetsCount` for signed-in callers with two batched queries keyed by the page's coin ids

- **Status:** Accepted
- **Date:** 2026-10-19
- **Source:** orchestrator run `run_20261019_221037` (signed-in redesign, Phase 8, catalog badges)
- **Code:** `apps/api/src/catalog/catalog.service.ts`, `apps/api/src/catalog/catalog.controller.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/catalog-api.ts`, `apps/web/src/lib/ownership-cache.ts`, `apps/web/src/components/catalog/catalog-results-list.tsx`, `apps/web/src/app/catalog/page.tsx`
- **Supersedes:** `docs/design/2026-10-17_signed-in-redesign.md` Phase 8, API bullet ("Compute them in the same query")

## Context

Phase 8 of the signed-in redesign shows "Owned" and "In N sets" badges on catalog rows. `GET /catalog` already runs behind `OptionalJwtAuthGuard` and passes `userId` to `CatalogService.findAll`. The design brief said to compute the two values "in the same query" and to leave `CATALOG_COIN_SELECT` unchanged. Existing tests assert the exact select, and the select constant is also what keeps `submittedByUserId` out of responses.

## Decision

- When `userId` is set and the page is non-empty, `findAll` runs the unchanged coin `findMany` and `count`, then `addViewerFields` runs two queries in parallel: `ownership.findMany` and `userSetCoin.findMany`. Both are filtered by `coinId: { in: coinIds }` for the page's ids. The second one uses `userSet: { userId }`. The results are joined in memory: `owned` is set membership, `inSetsCount` is the number of membership rows for the coin.
- Only the caller's own user sets are counted. Canonical sets (`CanonicalSetCoin`) are not. `UserSetCoin` is unique per (set, coin), so each row is one distinct set.
- Query count per signed-in page is fixed (list, count, plus 2). An empty page makes no extra query. The `submittedByMe` branch is enriched the same way.
- Anonymous callers, including those with an invalid token, get the rows untouched, with neither key present. `CATALOG_COIN_SELECT`, `SUBMITTED_COIN_SELECT`, the `where` clause and `total` are unchanged.
- The fields are typed on a new shared `CatalogListItem` (`CatalogCoin` plus optional `owned` and `inSetsCount`) used only by `GET /catalog` and `getCatalog`. `CatalogCoin` is unchanged, so set, collection, admin and import payloads do not appear to carry ownership.
- On the web, `CatalogResultsList` shows the badges only when the catalog page passes `showOwnership={isLoggedIn}`. The query key stays `['catalog', filters]`. `applyOwnershipToCatalogPage` also updates `owned` on cached catalog items that carry the field. `inSetsCount` is left to the refetch.

## Alternatives considered

- **Relation fields inside the coin `findMany` select** (`ownerships` filtered by user, a filtered `_count` of set memberships). This would change the select on the signed-in path and break the exact-select assertions. It would need separately typed Prisma calls for catalog and submitted, anonymous and signed-in. Prisma loads such relations as separate queries anyway, so it would not be one SQL statement.
- **Raw SQL.** It would bypass `CATALOG_COIN_SELECT`, the guard against leaking `submittedByUserId`.
- **A separate `/catalog/ownership` endpoint.** It adds a second client round trip and a new API surface.
- **Adding the optional fields to `CatalogCoin`.** Every other endpoint using that type would imply ownership data it never has.
- **Putting auth in the catalog query key, or clearing the cache on logout.** The first breaks the 2-element key shape that `isCatalogListKey` and the optimistic patcher rely on. The second does not fit `SiteNav`, which works without a `QueryClientProvider`.
- **Invalidating every catalog list on every ownership toggle.** More refetches, and existing hook tests would change.

## Consequences

- "Same query" in the design brief now means same request, not same SQL statement. The design doc still says otherwise.
- Signed-in catalog requests pay one more round trip (two parallel queries over at most 100 ids). The anonymous path is byte-identical to before.
- A mocked unit test cannot prove the `userSet: { userId }` relation filter. `apps/api/test/catalog-viewer-badges.e2e-spec.ts` covers it, and the sandbox Test command does not run e2e, so only Verify does.
- After logout, a cached signed-in page cannot show badges because of the render-time gate, and the page refetches on mount. After switching accounts in one tab, the previous user's badges can show briefly until that refetch lands, as for other cached queries.
- Extends [2026-10-17-optimistic-ownership-toggle](2026-10-17-optimistic-ownership-toggle.md), which noted that catalog items carry no ownership until this phase. It does not contradict it.
