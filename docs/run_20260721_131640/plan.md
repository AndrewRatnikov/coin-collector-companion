# Technical Plan: Anonymous browse — catalog + canonical sets (Week 3, Day 2)

**Run:** run_20260721_131640
**Date:** 2026-07-21

## Summary

Adds four read-only, anonymous-accessible routes to `apps/web` — `/catalog`, `/catalog/[coinId]`, `/sets/canonical`, `/sets/canonical/[id]` — backed by two new API-client modules (`catalog-api.ts`, `canonical-sets-api.ts`) and their TanStack Query hooks, plus one new shared formatter in `packages/shared`. Every page is a `'use client'` component following the same shape Day 1 already established (`login/page.tsx`, `dashboard/page.tsx`): local component state, `data-testid`s on every meaningful element, no wrapping in `RequireAuth` since these routes are anonymous per system-design_v2.md §3.1's route table.

## Approach

- **`packages/shared/src/index.ts`** gets one new export, `formatCoinLabel(coin: CatalogCoin): string`, implementing SD §3.1's compact label (`{country} {denomination} ({year} {mintMark})`, dropping the parenthetical to just `{year}` when `mintMark === ''`). This is additive — no existing export changes shape. `apps/web`'s `node_modules/@coin-collector/shared` resolves through the package's build output; the Coder must run `pnpm --filter @coin-collector/shared build` after editing `src/index.ts`, before touching any `apps/web` file that imports the new export (per memory.md's recorded gotcha on `packages/shared/dist/` not being auto-rebuilt).
- **`catalog-api.ts`** wraps `apiFetch` for `GET /catalog` (query-string built from an optional filters object: `country`, `denomination`, `name`, `yearMin`, `yearMax`, `page`, `limit` — all optional, omitted from the query string when `undefined` or `''`) and `GET /catalog/:id`. Typed directly against `packages/shared`'s `CatalogCoin`/`PaginatedResponse<CatalogCoin>` — confirmed against `apps/api/src/catalog/catalog.controller.ts` and `find-catalog-query.dto.ts`, which is the real, already-built endpoint this consumes.
- **`use-catalog.ts`** wraps `catalog-api.ts` in `useCatalog(filters)` (query key includes the filters object so distinct filter/page combinations cache independently) and `useCoin(id)`.
- **`canonical-sets-api.ts`** wraps `GET /sets/canonical` and `GET /sets/canonical/:id`. Confirmed against `apps/api/src/sets/sets.controller.ts`: `findAllCanonical` returns a **plain `CanonicalSetSummary[]`, not a `PaginatedResponse`** — there is no pagination on this endpoint, so the list page renders the full array with no page/limit UI. `findCanonicalById` returns `CanonicalSetDetail` (`CanonicalSetSummary & { coins: CanonicalSetCoinItem[] }`), each `coins[]` entry carrying its own `position` for explicit sort order.
- **`use-canonical-sets.ts`** wraps those in `useCanonicalSets()` and `useCanonicalSet(id)`.
- **`catalog/page.tsx`**: an uncontrolled-until-submit filter form (country / denomination / name-substring / year-min / year-max text inputs, explicit submit button — no live search, matching SD §3.1) that on submit sets the `filters` state driving `useCatalog`, plus a results list rendered via `formatCoinLabel` and Prev/Next pagination driven by `PaginatedResponse`'s `page`/`limit`/`total`. Loading state uses the existing `ListSkeleton`; each result links to `/catalog/[coinId]`.
- **`catalog/[coinId]/page.tsx`**: this is the **first dynamic route in this codebase** (Day 1 shipped no dynamic segments). Confirmed against this Next.js 16.2.10 install's generated route types (`apps/web/.next/types/validator.ts`): the `params` prop on an App Router page is `Promise<ParamMap[Route]>`, in both Server and Client Components. Since this page needs `'use client'` (it uses a query hook), it must unwrap params with React's `use()`: `const { coinId } = use(params)`. Renders the coin's identity fields, its image when `imageUrl` is non-null, and `imageSource`/`imageLicense` credited inline next to the image (per-image Commons credit, SD §4.3 — distinct from `SiteFooter`'s blanket Wikipedia note, which stays untouched).
- **`sets/canonical/page.tsx`**: renders the full `CanonicalSetSummary[]` (name + description), each linking to `/sets/canonical/[id]`. No pagination controls (endpoint doesn't paginate).
- **`sets/canonical/[id]/page.tsx`**: same `Promise<params>` + `use()` pattern as the coin detail page. Renders name, description, and `coins` sorted by `position`, each row via `formatCoinLabel`. Includes a "Clone into my sets" CTA (`<Link>` to `/sets/new?cloneFrom=canonical&cloneFromId={id}` — `/sets/new` itself doesn't exist until Day 3, this only has to pre-fill the eventual source per backlog 3.4) that is **entirely absent from the DOM** (not just disabled) when `getStoredToken()` returns falsy, and present when it returns a token. Checked client-side the same way `RequireAuth` already checks it (`@/lib/auth-token`'s `getStoredToken`), but this page itself is never wrapped in `RequireAuth` — it must render for anonymous visitors too, per SD §3.1.
- No route in this task is added to any auth-gate list — Day 1's `RequireAuth` wrapper is only applied by the pages that use it (`dashboard/page.tsx`), there is no central route-list file to edit. None of the four new pages import or use `RequireAuth`.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/index.ts` | MODIFY | Add `formatCoinLabel(coin)` formatter, shared by both apps |
| `apps/web/src/lib/catalog-api.ts` | CREATE | `getCatalog`/`getCoin` wrapping `apiFetch` |
| `apps/web/src/lib/hooks/use-catalog.ts` | CREATE | `useCatalog`/`useCoin` TanStack Query hooks |
| `apps/web/src/lib/canonical-sets-api.ts` | CREATE | `getCanonicalSets`/`getCanonicalSet` wrapping `apiFetch` |
| `apps/web/src/lib/hooks/use-canonical-sets.ts` | CREATE | `useCanonicalSets`/`useCanonicalSet` TanStack Query hooks |
| `apps/web/src/app/catalog/page.tsx` | CREATE | Catalog filter form + paginated results grid |
| `apps/web/src/app/catalog/[coinId]/page.tsx` | CREATE | Coin detail page |
| `apps/web/src/app/sets/canonical/page.tsx` | CREATE | Canonical sets list |
| `apps/web/src/app/sets/canonical/[id]/page.tsx` | CREATE | Canonical set detail + gated clone CTA |

## Interface Contract

### Module: shared coin-label formatter
- **File:** `packages/shared/src/index.ts`
- **Export:** `export function formatCoinLabel(coin: CatalogCoin): string` (added alongside existing exports — none of which change)
- **Behavior:** returns `` `${coin.country} ${coin.denomination} (${coin.year} ${coin.mintMark})` `` when `coin.mintMark !== ''`, else `` `${coin.country} ${coin.denomination} (${coin.year})` ``.
- **Dependencies:** none (pure function operating on the already-exported `CatalogCoin` interface in the same file).

### Module: catalog-api
- **File:** `apps/web/src/lib/catalog-api.ts`
- **Exports:**
  ```typescript
  export interface CatalogFilters {
    country?: string;
    denomination?: string;
    name?: string;
    yearMin?: number;
    yearMax?: number;
    page?: number;
    limit?: number;
  }
  export function getCatalog(filters?: CatalogFilters): Promise<PaginatedResponse<CatalogCoin>>;
  export function getCoin(id: string): Promise<CatalogCoin>;
  ```
- **Behavior:** `getCatalog` builds a query string from every defined, non-empty-string filter key and calls `apiFetch<PaginatedResponse<CatalogCoin>>(`/catalog${qs}`)`. `getCoin` calls `apiFetch<CatalogCoin>(`/catalog/${id}`)`.
- **Dependencies:** `apiFetch` from `./api-client`; `CatalogCoin`/`PaginatedResponse` from `@coin-collector/shared`.

### Module: use-catalog hooks
- **File:** `apps/web/src/lib/hooks/use-catalog.ts`
- **Exports:**
  ```typescript
  export function useCatalog(filters: CatalogFilters): UseQueryResult<PaginatedResponse<CatalogCoin>>;
  export function useCoin(id: string): UseQueryResult<CatalogCoin>;
  ```
- **Behavior:** `useCatalog` — `useQuery({ queryKey: ['catalog', filters], queryFn: () => getCatalog(filters) })`. `useCoin` — `useQuery({ queryKey: ['catalog', 'coin', id], queryFn: () => getCoin(id), enabled: Boolean(id) })`.
- **Dependencies:** `useQuery` from `@tanstack/react-query`; `getCatalog`/`getCoin`/`CatalogFilters` from `@/lib/catalog-api`.

### Module: canonical-sets-api
- **File:** `apps/web/src/lib/canonical-sets-api.ts`
- **Exports:**
  ```typescript
  export function getCanonicalSets(): Promise<CanonicalSetSummary[]>;
  export function getCanonicalSet(id: string): Promise<CanonicalSetDetail>;
  ```
- **Behavior:** `getCanonicalSets` calls `apiFetch<CanonicalSetSummary[]>('/sets/canonical')` — **not** paginated, matches the real controller. `getCanonicalSet` calls `apiFetch<CanonicalSetDetail>(`/sets/canonical/${id}`)`.
- **Dependencies:** `apiFetch` from `./api-client`; `CanonicalSetSummary`/`CanonicalSetDetail` from `@coin-collector/shared`.

### Module: use-canonical-sets hooks
- **File:** `apps/web/src/lib/hooks/use-canonical-sets.ts`
- **Exports:**
  ```typescript
  export function useCanonicalSets(): UseQueryResult<CanonicalSetSummary[]>;
  export function useCanonicalSet(id: string): UseQueryResult<CanonicalSetDetail>;
  ```
- **Behavior:** `useCanonicalSets` — `useQuery({ queryKey: ['canonical-sets'], queryFn: getCanonicalSets })`. `useCanonicalSet` — `useQuery({ queryKey: ['canonical-sets', id], queryFn: () => getCanonicalSet(id), enabled: Boolean(id) })`.
- **Dependencies:** `useQuery` from `@tanstack/react-query`; `getCanonicalSets`/`getCanonicalSet` from `@/lib/canonical-sets-api`.

### Component: CatalogPage
- **File:** `apps/web/src/app/catalog/page.tsx`
- **Export:** `export default function CatalogPage()`
- **Props:** none (route page)
- **Test selectors:**
  - `data-testid="catalog-page"` — root `<main>`
  - `data-testid="catalog-filter-form"` — the filter `<form>`
  - `data-testid="catalog-filter-country"` — country text input
  - `data-testid="catalog-filter-denomination"` — denomination text input
  - `data-testid="catalog-filter-name"` — name-substring text input
  - `data-testid="catalog-filter-year-min"` — year-min number input
  - `data-testid="catalog-filter-year-max"` — year-max number input
  - `data-testid="catalog-filter-submit"` — submit button (`type="submit"`)
  - `data-testid="catalog-loading"` — shown while `useCatalog` is loading (wraps `ListSkeleton`)
  - `data-testid="catalog-error"` — shown when the query errors
  - `data-testid="catalog-results"` — `<ul>` wrapping result rows
  - `data-testid="catalog-item"` — repeated on every `<li>` result row (one per coin; assert via `getAllByTestId`); each row's text content includes `formatCoinLabel(coin)` and links to `/catalog/${coin.id}`
  - `data-testid="catalog-empty"` — shown when `data.items.length === 0`
  - `data-testid="catalog-page-prev"` — Prev button, `disabled` when `page <= 1`
  - `data-testid="catalog-page-next"` — Next button, `disabled` when `page * limit >= total`
  - `data-testid="catalog-page-indicator"` — text showing current page (e.g. contains `data.page`)
- **Dependencies:** `useCatalog` from `@/lib/hooks/use-catalog`; `CatalogFilters` type from `@/lib/catalog-api`; `formatCoinLabel` from `@coin-collector/shared`; `ListSkeleton` from `@/components/ui/list-skeleton`; `Link` from `next/link`.

### Component: CoinDetailPage
- **File:** `apps/web/src/app/catalog/[coinId]/page.tsx`
- **Export:** `export default function CoinDetailPage({ params }: { params: Promise<{ coinId: string }> })`
- **Props:** `params: Promise<{ coinId: string }>` — unwrapped via `use(params)` from `'react'` (Next.js 16 App Router contract, confirmed against `.next/types/validator.ts`)
- **Test selectors:**
  - `data-testid="coin-detail-page"` — root `<main>`
  - `data-testid="coin-detail-loading"` — shown while `useCoin` is loading
  - `data-testid="coin-detail-error"` — shown when the query errors
  - `data-testid="coin-detail-label"` — the coin's `formatCoinLabel` output
  - `data-testid="coin-detail-country"` — country field
  - `data-testid="coin-detail-denomination"` — denomination field
  - `data-testid="coin-detail-year"` — year field
  - `data-testid="coin-detail-mint-mark"` — mint mark field
  - `data-testid="coin-detail-variety"` — variety field
  - `data-testid="coin-detail-image"` — `<img>`, rendered only when `coin.imageUrl` is non-null
  - `data-testid="coin-detail-attribution"` — credit line showing `imageSource`/`imageLicense`, rendered only alongside the image (i.e. only when `imageUrl` is non-null)
- **Dependencies:** `useCoin` from `@/lib/hooks/use-catalog`; `formatCoinLabel` from `@coin-collector/shared`; `use` from `react`.

### Component: CanonicalSetsPage
- **File:** `apps/web/src/app/sets/canonical/page.tsx`
- **Export:** `export default function CanonicalSetsPage()`
- **Props:** none
- **Test selectors:**
  - `data-testid="canonical-sets-page"` — root `<main>`
  - `data-testid="canonical-sets-loading"` — shown while loading
  - `data-testid="canonical-sets-error"` — shown on error
  - `data-testid="canonical-sets-list"` — `<ul>` wrapping items
  - `data-testid="canonical-set-item"` — repeated per set (`getAllByTestId`); links to `/sets/canonical/${set.id}`, text includes `set.name`
  - `data-testid="canonical-sets-empty"` — shown when the array is empty
- **Dependencies:** `useCanonicalSets` from `@/lib/hooks/use-canonical-sets`; `Link` from `next/link`.

### Component: CanonicalSetDetailPage
- **File:** `apps/web/src/app/sets/canonical/[id]/page.tsx`
- **Export:** `export default function CanonicalSetDetailPage({ params }: { params: Promise<{ id: string }> })`
- **Props:** `params: Promise<{ id: string }>` — unwrapped via `use(params)`
- **Test selectors:**
  - `data-testid="canonical-set-detail-page"` — root `<main>`
  - `data-testid="canonical-set-detail-loading"` — shown while loading
  - `data-testid="canonical-set-detail-error"` — shown on error
  - `data-testid="canonical-set-detail-name"` — set name
  - `data-testid="canonical-set-detail-description"` — set description
  - `data-testid="canonical-set-coin-list"` — `<ul>` wrapping the ordered coin list (sorted by `position`)
  - `data-testid="canonical-set-coin-item"` — repeated per coin (`getAllByTestId`); text includes `formatCoinLabel(item.coin)`
  - `data-testid="canonical-set-clone-cta"` — present in the DOM only when `getStoredToken()` is truthy; absent (not merely disabled) when falsy; links to `/sets/new?cloneFrom=canonical&cloneFromId=${id}`
- **Dependencies:** `useCanonicalSet` from `@/lib/hooks/use-canonical-sets`; `formatCoinLabel` from `@coin-collector/shared`; `getStoredToken` from `@/lib/auth-token`; `use` from `react`; `Link` from `next/link`.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `catalog-api.ts` exports `getCatalog`/`getCoin` | Module: catalog-api |
| 2. `use-catalog.ts` exports `useCatalog`/`useCoin` | Module: use-catalog hooks |
| 3. Shared `formatCoinLabel` formatter | Module: shared coin-label formatter |
| 4. `/catalog` filter form + paginated grid, anonymous | Component: CatalogPage |
| 5. `/catalog/[coinId]` full identity fields + per-image attribution | Component: CoinDetailPage |
| 6. `canonical-sets-api.ts` exports `getCanonicalSets`/`getCanonicalSet` | Module: canonical-sets-api |
| 7. `use-canonical-sets.ts` exports corresponding hooks | Module: use-canonical-sets hooks |
| 8. `/sets/canonical` list | Component: CanonicalSetsPage |
| 9. `/sets/canonical/[id]` detail + auth-gated clone CTA | Component: CanonicalSetDetailPage |
| 10. New routes not added to any auth guard | Approach section — no `RequireAuth` import in any of the four new pages |

## Risks and open questions

- **Pagination boundary math for `catalog-page-next`'s `disabled` state** (`page * limit >= total`) is a Coder-discretion detail as long as it never allows navigating past the last page or before page 1 — exact off-by-one handling isn't prescribed further than that.
- **Empty-string vs. `undefined` filter values**: `getCatalog` must omit empty-string filter fields from the query string (an empty `country=''` sent to the API is functionally "no filter" per `FindCatalogQueryDto`'s `@IsOptional()`, but an explicit empty string is needlessly different from omitting the key) — left as a Coder implementation detail, not a new decision.
- **`react`'s `use()` for unwrapping `params`** is new to this codebase (first dynamic route). If the sandbox's installed Next.js version behaves differently than `.next/types/validator.ts` indicates, that's a signal to re-open this contract with the Architect, not something the Coder should silently work around.
