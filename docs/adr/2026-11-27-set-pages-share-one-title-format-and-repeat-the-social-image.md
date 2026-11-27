# Set pages share one title format and their Open Graph and Twitter metadata repeat the static social image explicitly

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_120807` (search visibility phase 2; the task left the title format to be decided once)
- **Code:** `apps/web/src/lib/set-page-seo.ts`, `apps/web/src/components/seo/set-page-json-ld.tsx`

## Context

The three set pages need their own title, description, canonical URL and Open Graph and Twitter tags. Next's metadata merge replaces a parent's resolved `openGraph` and `twitter` wholesale, and the root `opengraph-image.png` and `twitter-image.png` file images are merged only at the root segment (checked in `next/dist/lib/metadata/metadata-resolution-primitives.js`). A page that sets `openGraph` without `images` therefore loses the preview card image.

## Decision

- The title is `"{set name} checklist · Coin Companion"` (`setPageTitle`, separator U+00B7), used for canonical and public sets alike. The list page uses `Coin checklists · Coin Companion`. When the set isn't loaded, the pages use fixed fallback titles and descriptions.
- The description is `"{N} coins, {first}-{last}."` (a single year is shown alone, no coins gives `0 coins.`), followed by the checklist's own description, or for public sets by `Public coin set shared on Coin Companion.`
- Every builder in `lib/set-page-seo.ts` returns `alternates.canonical` and `openGraph` and `twitter` objects with the same title and description, and always lists the root images as absolute URLs (`${origin}/opengraph-image.png`, `${origin}/twitter-image.png`, 1200x630, the alt text from `opengraph-image.alt.txt`). Origins come from `siteOrigin()`.
- JSON-LD is built by pure functions in the same module and rendered by server components: BreadcrumbList on all three pages, ItemList of coin names and `/catalog/{id}` URLs on the two detail pages, CollectionPage (no ItemList) on the list page. Coin names come from `getCoinName` (eyebrow, title, subtitle joined by ` · `), following [2026-10-17-coin-name-from-one-shared-function](2026-10-17-coin-name-from-one-shared-function.md).
- On the detail pages the JSON-LD is rendered only when the data loaded.

## Alternatives considered

- **Leaving `images` out and relying on the file convention.** Rejected: the merge rule above drops the image.
- **Moving the Open Graph defaults into `layout.tsx` config.** Rejected: a child `openGraph` would still replace it.
- **`formatCoinLabel` for coin names.** Rejected: it drops the variety, which the task requires.

## Consequences

- Every overridden page keeps its preview card. The image URL has no cache-busting hash, unlike the tags Next generates for the file convention.
- One title and description format covers all public pages; phase 3 reuses the builders for the catalog pages.
- If the root image files are renamed or moved, `set-page-seo.ts` must change too.
