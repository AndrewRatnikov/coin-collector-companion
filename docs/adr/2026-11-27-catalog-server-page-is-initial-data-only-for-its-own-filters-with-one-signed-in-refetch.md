# The catalog's server page is TanStack initial data only for the server's exact filters, and a signed-in visitor refetches it once after mount

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_133045` (search visibility phase 3)
- **Code:** `apps/web/src/components/catalog/catalog-page-view.tsx`, `apps/web/src/lib/hooks/use-catalog.ts`, `apps/web/src/lib/catalog-view.ts`, `apps/web/src/lib/catalog-api.ts`

## Context

[2026-11-27-set-pages-pass-server-data-to-client-views-as-initial-data](2026-11-27-set-pages-pass-server-data-to-client-views-as-initial-data.md) passes server data to client views as `initialData` with `staleTime: Infinity` and no browser refetch. The catalog differs in two ways. Its query key depends on the filters, which change in the browser. And the list carries signed-in fields (`owned`, `inSetsCount`, see [2026-10-19-catalog-badges-from-two-batched-queries](2026-10-19-catalog-badges-from-two-batched-queries.md)) that the anonymous server response cannot have.

## Decision

- `useCatalog(filters, options?)` accepts `{ initialData }` and then sets `initialData`, `staleTime: Infinity`, `refetchOnMount: false` and `refetchOnWindowFocus: false`. Without it the options are unchanged, so the landing page and `/catalog/mine` are unaffected. The query key stays `['catalog', filters]`.
- `CatalogPageView` passes the server page only while `catalogFiltersToQueryString(filters)` equals that of the server's filters. Any other combination is fetched in the browser, with `keepPreviousData` as before.
- When the stored token is found in the mount effect and a server page is in use, the view calls `refetch()` once per mount (guarded by a ref) so the token-bearing request adds the ownership badges. With no initial data it does not refetch.
- The query string is built by one function, `catalogFiltersToQueryString`, used by both `getCatalog` in the browser and `loadCatalogPage` on the server, so the two URLs cannot drift.

## Alternatives considered

- **`initialData` for whatever key is current.** Rejected: after a filter change the server page would be shown as the new result and never fetched, because of `staleTime: Infinity`.
- **A viewer-specific query key.** Rejected: it changes the key that `ownership-cache.ts` patches.
- **Always refetching on mount.** Rejected: it costs a browser request for every anonymous visitor.

## Consequences

- Anonymous visitors make no browser request for the first view. Signed-in visitors make one extra request, and the badges appear after it.
- Signed-in visitors see the badge-less server rows briefly before the refetch returns.
