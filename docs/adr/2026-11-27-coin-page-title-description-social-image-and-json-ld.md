# The coin page title, description, social image and structured data follow one format: collector notation, known specs only, a Thing with PropertyValues

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_133045` (search visibility phase 3; the user's task fixed the title notation, the BreadcrumbList and the Thing with PropertyValues, and ruled out Product and ratings)
- **Code:** `apps/web/src/lib/catalog-seo.ts`, `apps/web/src/components/seo/coin-page-json-ld.tsx`, `apps/web/src/lib/set-page-seo.ts`, `apps/web/src/app/catalog/[coinId]/page.tsx`

## Context

[2026-11-27-set-pages-share-one-title-format-and-repeat-the-social-image](2026-11-27-set-pages-share-one-title-format-and-repeat-the-social-image.md) set the title format and the explicit social image for the set pages. The coin page needs the same for about 1,700 coins, and search engines should get the coin's specs without claims the site cannot back (there is no offer and there are no ratings).

## Decision

- **Heading.** `coinPageHeading` is `{year}-{mintMark} {getCoinName(coin).title}` (just the year when there is no mint mark). The prefix is not added when the title already equals or starts with it. The shared `getCoinName` subtitle and eyebrow are not used.
- **Title.** The heading, country and denomination (empty parts dropped), joined with ` · `, then ` · Coin Companion`, for example `1909-S VDB · United States · 1 Cent · Coin Companion`.
- **Description.** One sentence with the heading, country and denomination, then `Mintage: n.`, `Composition: m.` and `Diameter: d mm.` only for known values. It never contains `null` or an empty phrase.
- **Canonical.** `{origin}/catalog/{id}`.
- **Social image.** Open Graph and Twitter use the coin's `imageUrl` only when it has a recorded `imageLicense` (`hasLicensedImage`). Otherwise they use the site default image (`defaultOpenGraphImage`, `defaultTwitterImage`, exported from `lib/set-page-seo.ts`). The Twitter card is `summary` for the square coin image and `summary_large_image` for the default.
- **Fallback.** For an unavailable or not-found coin, generic title and description and the default images; `not-found` adds `robots: { index: false, follow: false }`.
- **JSON-LD.** `CoinPageJsonLd`, a server component, renders a BreadcrumbList (Catalog > country > denomination > coin) and a schema.org `Thing` with `name`, `url`, `image` (only when licensed) and `additionalProperty` PropertyValues in this order: Year, Mint mark, Variety, Mintage, Composition, Diameter (`MMT`, mm), Weight (`GRM`, g), each only when known. Both go through `serializeJsonLd`.

## Alternatives considered

- **Including the `getCoinName` subtitle in the title.** Rejected: it repeats country and denomination.
- **A schema.org type for goods for sale (Product).** Rejected: there is no offer, and the rule is not to invent offers or ratings. `catalog-seo.ts` is kept free of the words for offers, ratings and reviews so a grep can check it.

## Consequences

- A coin without a licensed image never advertises an unlicensed picture in link previews.
- The format is one pure module with tests per page type (`lib/page-metadata.test.ts`), so changing it is cheap.
- A `Thing` is a weak schema.org type; search engines show no rich result for it. It is there for machine readers, and a better type can replace it without changing the page.
