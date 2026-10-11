# Catalog page redesign: filter sidebar (2026-10-11)

Implementation brief for the redesigned `/catalog` page. Reference markup: [`2026-10-11_catalog-sidebar/catalog-sidebar.dc.html`](2026-10-11_catalog-sidebar/catalog-sidebar.dc.html). It's a template with `{{holes}}`, `<sc-for>` and `<sc-if>`, and a `renderVals()` script with sample data at the bottom. Read it for exact values and structure; it isn't runnable HTML.

**Status:** Andrew chose this layout over the "filters on top" variant. Not yet implemented. Related brief: [`2026-10-10_album-view.md`](2026-10-10_album-view.md); its tokens table applies here too.

## Goal

The current catalog is hard to scan:

- Each row is about 135px tall, so only about 5 coins fit on screen.
- The label "Ukraine 25 Kopiyok (1992)" repeats country and year in every row.
- Filters are five free-text underlined fields behind a Search button.

The new page:

- puts filters in a left sidebar of options you can see and tick;
- uses dense, about 56px rows with aligned columns;
- applies filters as you change them, with no Search button.

## Scope

**Web**

- `apps/web/src/app/catalog/page.tsx`: new layout.
- New `apps/web/src/components/catalog/catalog-filter-sidebar.tsx`.
- New `apps/web/src/components/catalog/catalog-results-list.tsx`.
- `lib/catalog-api.ts`, `lib/hooks/use-catalog.ts`: new params, plus a facets hook.
- i18n `en.ts` and `es.ts`.
- Tests.

**API**

- `apps/api/src/catalog/dto/find-catalog-query.dto.ts`: new params.
- `catalog.service.ts`: the where/orderBy changes and a facets query.
- `catalog.controller.ts`: new `GET /catalog/facets`.

**Shared**

- `packages/shared/src/index.ts`: `CatalogSort` and `CatalogFacets` types. Rebuild shared after editing it.

**Don't touch** `components/catalog/catalog-filter-form.tsx`. The set editor's Add-coins sheet and `sets/new` still use it, so keep it as it is for them.

Out of scope:

- facet counts like "Ukraine (218)";
- a grid view on the catalog;
- coin images in rows, beyond `imageUrl` when it's present (see Rows);
- anything on the scope-firewall list in CLAUDE.md.

No schema change and no migration.

## Layout

The page container goes from `max-w-[1080px]` to `max-w-[1200px]`.

1. **Title row** (flex, wraps, baseline-aligned):
   - left: `h1` "Catalog" (Cormorant 36px/1.1, weight 600), then `{total} coins` in `font-mono` 14px `neutral-700`;
   - right: the link "Can't find a coin? Add it" (14px, `accent-700`, underlined; shown only when logged in, as today). It opens the existing Add-coin Sheet.
   - The bottom border under the title row goes away.
2. **Body**: a flex row that wraps, with a 32px gap.
   - **Sidebar** `<aside aria-label="Filters">`: `flex: 0 0 236px`, `bg-surface` (#eae9e9), radius 7px, 18px padding, 22px gap between sections. **Not sticky.**
   - **Results** `<section aria-label="Results">`: `flex: 999 1 560px; min-width: 0`, 14px gap.
3. **Under 720px:** the sidebar is hidden, and a "Filters · {n}" button (42px tall, white, `border-neutral-400`, radius 4px) appears at the start of the results toolbar. `{n}` is the number of active filters. The button opens the existing `Sheet` component with the same sidebar content inside it.

## Sidebar

The header row has the `h2` "Filters" (Cormorant 22px) on the left and a "Clear all" text button on the right (13px, `neutral-700`, underlined). Clear all resets every filter and the search.

Each section is a `<fieldset>` with a `<legend>`: 12px, weight 600, letter-spacing 0.06em, uppercase, `neutral-800`, with 6px below it.

Option rows are `<label>`s with the input inside: min-height 34px, 10px gap, 14px text, radius 4px, `hover:bg-surface` (bleed with `-mx-2 px-2`). Inputs are 16×16 with `accent-color: var(--color-accent-700)`.

| Section | Control | Maps to |
|---|---|---|
| Country | radio list: one per country from facets, then "All countries" | `country` |
| Denomination | checkbox list from facets, **scoped to the selected country** | `denomination` (multi) |
| Years | two inputs side by side, "From" – "To" (`inputMode="numeric"`, `font-mono`, 38px tall, white, `border-neutral-300`, radius 4px; focus: `border-accent` plus a 3px `accent-200` ring) | `yearMin`, `yearMax` |
| Show | "Key dates only" checkbox, and "Hide coins I own" checkbox (**only when logged in**) | `keyDateOnly`, `hideOwned` |

Denomination checkboxes start **unticked**, which means "any". Ticking some narrows the results to just those. This is the opposite of the mock's sample script, which starts everything ticked. Changing country clears the denomination selection.

## Results column

**Toolbar** (flex, wraps, 10px gap):

- the "Filters" button (mobile only);
- a search input (`type="search"`, flex `1 1 240px`, 42px tall, magnifier icon inset at 12px, placeholder "Search by name, e.g. Odesa Oblast", maps to `name`);
- "Sort" with a select: "Year, oldest first" (default), "Year, newest first", "Name A–Z". Maps to `sort` = `year_asc` | `year_desc` | `name_asc`.

**List box:** `bg-neutral-100`, `border-neutral-300`, radius 7px, `overflow-hidden`, 10px top padding.

- **Header row** (`aria-hidden`): 12px, weight 500, uppercase, 0.04em tracking, `neutral-700`, with a bottom `border-divider`.
- Header and rows share one grid: `grid-template-columns: 44px minmax(0,1fr) 64px 130px 20px; column-gap: 16px`, with `px-3`.

**Each row** is an `<li>`, `relative`, padded `py-2 px-3`, with a bottom border `divider/75%` and `hover:bg-surface`. Its cells:

1. **Thumbnail**, 40px round:
   - if `coin.imageUrl` exists, `<img alt="" loading="lazy" class="rounded-full object-cover">`;
   - otherwise a disc (`bg-neutral-300`, 2px `neutral-400` border) showing `getDenominationNumeral(coin.denomination)` in Cormorant 15px, weight 600, `neutral-800`.
2. **Name block:**
   - the title is a `<Link href="/catalog/{id}">` (15px, weight 500, one line with ellipsis) with the stretched-link `::after` covering the whole row, so the whole row is clickable;
   - below it, the variety (12px `neutral-700`) when there is one, plus a "★ Key date" pill (`bg-accent-800 text-accent-100`, 11px) when `isKeyDate`.
   - Title text: reuse `getAlbumCardText(coin)` from `lib/album-layout.ts`, so the catalog and album name coins the same way. Check that it gives "25 Kopiyok" for a plain 1992 coin and "Donetsk Oblast" for a 2025 commemorative. Don't repeat the country or year in the title.
3. **Year**: `font-mono` 14px. Append the mint mark when there is one ("1999 D").
4. **Denomination**: 14px, `neutral-800`. Hidden under 720px.
5. **Chevron** "›": 16px, `neutral-500`, `aria-hidden`.

Row hover: the title turns `accent-700` and underlines. Focus-visible: a 2px `accent-700` outline on the link's `::after` (offset -2px, radius 4px). Under 720px the grid becomes `40px minmax(0,1fr) 56px 16px`.

**Pagination** below the list (space-between, wraps):

- left: "Page 1 of 9" (13px `neutral-700`, numbers in mono);
- right: ‹ prev, page numbers, › next.
  - Buttons are 40×40, mono 14px.
  - The current page is `bg-accent-700 text-white` with `aria-current="page"`.
  - Prev and next have a `border-neutral-300`, and disabled prev or next is `text-neutral-400`.
  - Collapse long ranges as `1 2 3 … 9`: always show first, last, current ±1.

**Empty state:** a `bg-surface` panel, radius 7px, padding 40px 24px, centered, with "No coins match these filters." and a "Clear all filters" text button in `accent-700`. When logged in, add a second link, "Add this coin to the catalog", which opens the Add-coin Sheet.

**Loading:** keep `ListSkeleton` inside the list box. **Error:** keep the existing message.

## Behaviour

- **Apply as you go.** Radio, checkbox and sort changes apply immediately. Search and year inputs are debounced by 300ms; a year field also applies on blur or Enter. Ignore a year that isn't a number between 1 and 9999. Every change resets to page 1.
- **Sync filters to the URL query string** with `useSearchParams` and `router.replace`, using no scroll and the same param names as the API (`?country=Ukraine&denomination=5%20Kopiyok&denomination=10%20Hryvnias&sort=year_desc&page=2`). That way back/forward, reload and sharing a filtered catalog all work. The page reads its initial state from the URL.
- Count in the title row: `data.total`. While loading, keep the previous number (`placeholderData: keepPreviousData` in `useCatalog`) so the header doesn't flicker. Do the same for the list.
- Page size stays 20.

## API changes

**`GET /catalog`**, new optional params on `FindCatalogQueryDto`:

| Param | Type | Behaviour |
|---|---|---|
| `denomination` | `string \| string[]` | Accept a repeated param (`?denomination=a&denomination=b`) and normalise it to an array with `@Transform`. Each entry is a case-insensitive equals, joined with `OR`. A single value behaves exactly as today, which keeps the set-editor callers working. |
| `keyDateOnly` | boolean | `isKeyDate: true`. Use the same `@Transform(value === 'true')` pattern as `submittedByMe`. |
| `hideOwned` | boolean | Only honoured when authenticated, like `submittedByMe`: `ownerships: { none: { userId } }`. Silently ignored for anonymous callers. The route already uses `OptionalJwtAuthGuard` with `@Public()`. |
| `sort` | `'year_asc' \| 'year_desc' \| 'name_asc'`, default `year_asc` | `orderBy`: `[{year:'asc'},{id:'asc'}]` / `[{year:'desc'},{id:'asc'}]` / `[{name:'asc'},{year:'asc'},{id:'asc'}]`. Validate with `@IsIn`. |

Keep using `CATALOG_COIN_SELECT`.

**New `GET /catalog/facets?country=`**, `@Public()`. It returns `CatalogFacets`:

```ts
export interface CatalogFacets {
  countries: string[];      // distinct country of approved coins, A–Z
  denominations: string[];  // distinct denomination of approved coins, scoped to ?country= when given
}
```

Use Prisma `findMany({ where, distinct: ['denomination'], select: { denomination: true } })` (and the same for country). Sort denominations by `getDenominationNumeral` numerically, then by name. **Declare the route before `@Get(':id')`**, otherwise `ParseUUIDPipe` turns `/catalog/facets` into a 400. Add Swagger decorators like the neighbouring routes. Cache it in the web hook with `staleTime: 5 min`.

Add `CatalogSort` and `CatalogFacets` to `packages/shared`, and extend the web `CatalogFilters` (`denomination?: string | string[]`, `keyDateOnly`, `hideOwned`, `sort`). `getCatalog` must append array values as repeated params instead of `String(array)`.

## i18n keys

Add these to both `en.ts` and `es.ts`. Existing `common.*` keys (country, denomination, name, clear) can be reused where they fit.

| Key | en | es |
|---|---|---|
| `catalog.coinCount` | {count} coins | {count} monedas |
| `catalog.filtersHeading` | Filters | Filtros |
| `catalog.filtersButton` | Filters · {count} | Filtros · {count} |
| `catalog.clearAll` | Clear all | Borrar todo |
| `catalog.allCountries` | All countries | Todos los países |
| `catalog.years` | Years | Años |
| `catalog.yearFrom` | From | Desde |
| `catalog.yearTo` | To | Hasta |
| `catalog.show` | Show | Mostrar |
| `catalog.keyDatesOnly` | Key dates only | Solo fechas clave |
| `catalog.hideOwned` | Hide coins I own | Ocultar monedas que tengo |
| `catalog.searchPlaceholder` | Search by name, e.g. Odesa Oblast | Buscar por nombre, p. ej. Odesa Oblast |
| `catalog.searchLabel` | Search coins by name | Buscar monedas por nombre |
| `catalog.sortLabel` | Sort | Ordenar |
| `catalog.sortYearAsc` | Year, oldest first | Año, más antiguas primero |
| `catalog.sortYearDesc` | Year, newest first | Año, más recientes primero |
| `catalog.sortNameAsc` | Name A–Z | Nombre A–Z |
| `catalog.colCoin` | Coin | Moneda |
| `catalog.colYear` | Year | Año |
| `catalog.colDenomination` | Denomination | Denominación |
| `catalog.noMatches` | No coins match these filters. | Ninguna moneda coincide con estos filtros. |
| `catalog.clearAllFilters` | Clear all filters | Borrar todos los filtros |
| `catalog.addThisCoin` | Add this coin to the catalog | Añadir esta moneda al catálogo |
| `catalog.pageOf` | Page {page} of {total} | Página {page} de {total} |
| `catalog.prevPage` / `nextPage` | Previous page / Next page | Página anterior / Página siguiente |

Change `catalog.addCoinCta` to "Can't find a coin? Add it" / "¿No encuentras una moneda? Añádela". Adjust the Spanish to match the tone of the existing `es.ts` if it differs.

## Accessibility

- Real `<fieldset>`, `<legend>` and `<label>` everywhere.
- The search input has an `aria-label`.
- The mobile Filters button has `aria-expanded` and `aria-controls`.
- Results count changes are announced through a visually hidden `aria-live="polite"` region ("{count} coins").
- Hit areas: option rows are at least 34px tall with full-width labels; buttons are at least 40px.
- Secondary text uses `neutral-700`, not `neutral-600`.

## Tests to update or add

- `apps/web/src/app/catalog/page.test.tsx`: it currently drives `catalog-filter-*` inputs plus Submit. Rewrite it for the sidebar and test:
  - live filtering (with fake timers for the debounce);
  - multi-denomination selection;
  - URL sync;
  - the empty state with Clear all;
  - "Hide coins I own" hidden when logged out.

  Keep `data-testid`s stable where possible: `catalog-results`, `catalog-item`, `catalog-pagination`, `catalog-empty`, `catalog-loading`, `catalog-error`. Add `catalog-sidebar`, `catalog-filter-country-{value}`, `catalog-filter-denomination-{value}`, `catalog-filter-year-min/max`, `catalog-filter-key-date`, `catalog-filter-hide-owned`, `catalog-search`, `catalog-sort` and `catalog-clear-all`.
- `apps/api/src/catalog/dto/find-catalog-query.dto.spec.ts`: denomination single vs array; `keyDateOnly`, `hideOwned` and `sort` validation.
- `catalog.service.spec.ts`:
  - the denomination `OR`;
  - `keyDateOnly`;
  - `hideOwned` with and without a userId;
  - each sort;
  - facets (distinct values, country scoping, ordering).
- `catalog.controller.spec.ts`: the facets route, and that it's declared before `:id`.
- `catalog-filter-form.test.tsx` must still pass unchanged.

## Done when

- [ ] The page matches the reference at 1280px and at phone width (where the sidebar becomes a Sheet).
- [ ] Every filter applies without a Search button, and the URL reflects the state and survives a reload.
- [ ] Multiple denominations work together, and Key dates only and Hide coins I own work (the latter only when logged in).
- [ ] Sort works and the facets endpoint returns the right lists.
- [ ] The set editor's Add-coins picker is unchanged.
- [ ] Verification passes: `pnpm lint`, `pnpm --filter @coin-collector/shared build`, typecheck for shared, api and web, `pnpm --filter api exec prisma generate && pnpm --filter api test`, `pnpm --filter web test`.
- [ ] A short entry is added to `docs/history.md`.
