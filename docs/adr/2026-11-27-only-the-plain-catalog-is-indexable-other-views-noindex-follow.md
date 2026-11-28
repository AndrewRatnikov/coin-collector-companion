# Only the plain catalog is indexable: every other view is noindex,follow with its canonical on /catalog, and the server renders the page the URL asks for

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_133045` (search visibility phase 3; PRD criteria settled in the PRD review: filtered pages get noindex,follow to avoid thousands of thin variants)
- **Code:** `apps/web/src/lib/catalog-seo.ts`, `apps/web/src/lib/catalog-view.ts`, `apps/web/src/app/catalog/page.tsx`

## Context

`/catalog` takes filters, sort, search and page from the URL. Each combination is a different URL, and crawlers would find thousands of thin variants of one list. The first catalog page also has to carry real coin links in the HTML.

## Decision

- `catalogPageMetadata(state, origin)` always sets `alternates.canonical` to `{origin}/catalog`. When `isPlainCatalogView(state)` is false it adds `robots: { index: false, follow: true }`.
- `isPlainCatalogView` compares the parsed view state with the empty state (`catalogViewStateToSearchParams(state).toString() === ''`). Unknown query keys never reach the state, so `?utm_source=x`, `?page=1`, `?sort=bogus` and `?country=` count as plain and stay indexable.
- `app/catalog/page.tsx` parses `searchParams` with `parseCatalogSearchParams` and loads the results page that URL asks for through `loadCatalogPage` (anonymous, `hideOwned` never sent). `?page=3` renders page 3. A page past the end shows the existing empty state at HTTP 200, as the client did before.

## Alternatives considered

- **Deciding by which query keys are present.** Rejected: `?utm_source=x` or `?page=1` would become noindex.
- **Indexing filtered pages.** Rejected: thousands of thin variants.
- **Always rendering page 1 on the server.** Rejected: for `?page=n` the first client render would not match the server HTML.

## Consequences

- The index signal is consolidated on `/catalog`. Filtered views still pass link equity to coins (`follow`), and coins are also reached through the sitemap.
- Each distinct filter URL gets its own one-hour data cache entry in Next. Crawlers mostly follow sitemap URLs, so this is accepted.
- If a filtered view such as a country page should rank on its own, this rule must be revisited with real landing content.
