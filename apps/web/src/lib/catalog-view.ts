// Pure helpers behind the /catalog page: URL <-> view state, API filters, the active filter
// count, pagination collapse and row text. No React, no i18n.

import { CATALOG_SORTS, DEFAULT_CATALOG_SORT, type CatalogCoin, type CatalogSort } from '@coin-collector/shared';
import type { CatalogFilters } from '@/lib/catalog-api';
import { splitVariety } from '@/lib/album-layout';

export const CATALOG_PAGE_SIZE = 20;

export interface CatalogViewState {
  country: string; // '' = all countries
  denominations: string[]; // [] = any
  name: string; // search text as applied ('' = none)
  yearMin?: number;
  yearMax?: number;
  keyDateOnly: boolean;
  hideOwned: boolean;
  sort: CatalogSort;
  page: number; // >= 1
}

export const EMPTY_CATALOG_VIEW_STATE: CatalogViewState = {
  country: '',
  denominations: [],
  name: '',
  keyDateOnly: false,
  hideOwned: false,
  sort: DEFAULT_CATALOG_SORT,
  page: 1,
};

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/** A year input's value, or undefined unless it is an integer 1..9999 (whitespace trimmed, digits only). */
export function parseYearInput(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : undefined;
}

function isCatalogSort(value: string | null): value is CatalogSort {
  return value !== null && (CATALOG_SORTS as readonly string[]).includes(value);
}

function parsePage(value: string | null): number {
  if (value === null || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

/** Reads the URL. Unknown or invalid values fall back to the defaults. */
export function parseCatalogSearchParams(params: {
  get(name: string): string | null;
  getAll(name: string): string[];
}): CatalogViewState {
  const denominations: string[] = [];
  for (const raw of params.getAll('denomination')) {
    const value = raw.trim();
    if (value !== '' && !denominations.includes(value)) denominations.push(value);
  }

  const sort = params.get('sort');
  const state: CatalogViewState = {
    country: (params.get('country') ?? '').trim(),
    denominations,
    name: (params.get('name') ?? '').trim(),
    keyDateOnly: params.get('keyDateOnly') === 'true',
    hideOwned: params.get('hideOwned') === 'true',
    sort: isCatalogSort(sort) ? sort : DEFAULT_CATALOG_SORT,
    page: parsePage(params.get('page')),
  };

  const yearMin = parseYearInput(params.get('yearMin') ?? '');
  const yearMax = parseYearInput(params.get('yearMax') ?? '');
  if (yearMin !== undefined) state.yearMin = yearMin;
  if (yearMax !== undefined) state.yearMax = yearMax;
  return state;
}

/** Writes the URL with the API param names, in a fixed order. Defaults and empty values are omitted. */
export function catalogViewStateToSearchParams(state: CatalogViewState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.country !== '') params.set('country', state.country);
  for (const denomination of state.denominations) params.append('denomination', denomination);
  if (state.name !== '') params.set('name', state.name);
  if (state.yearMin !== undefined) params.set('yearMin', String(state.yearMin));
  if (state.yearMax !== undefined) params.set('yearMax', String(state.yearMax));
  if (state.keyDateOnly) params.set('keyDateOnly', 'true');
  if (state.hideOwned) params.set('hideOwned', 'true');
  if (state.sort !== DEFAULT_CATALOG_SORT) params.set('sort', state.sort);
  if (state.page > 1) params.set('page', String(state.page));
  return params;
}

/** Args for useCatalog: page and limit, plus only the values that are set. */
export function catalogViewStateToFilters(state: CatalogViewState, isLoggedIn: boolean): CatalogFilters {
  const filters: CatalogFilters = { page: state.page, limit: CATALOG_PAGE_SIZE };
  if (state.country !== '') filters.country = state.country;
  if (state.denominations.length > 0) filters.denomination = [...state.denominations];
  if (state.name !== '') filters.name = state.name;
  if (state.yearMin !== undefined) filters.yearMin = state.yearMin;
  if (state.yearMax !== undefined) filters.yearMax = state.yearMax;
  if (state.keyDateOnly) filters.keyDateOnly = true;
  if (state.hideOwned && isLoggedIn) filters.hideOwned = true;
  if (state.sort !== DEFAULT_CATALOG_SORT) filters.sort = state.sort;
  return filters;
}

/** The n in "Filters · n". Search and sort don't count. */
export function countActiveFilters(state: CatalogViewState, isLoggedIn: boolean): number {
  let count = 0;
  if (state.country !== '') count += 1;
  if (state.denominations.length > 0) count += 1;
  if (state.yearMin !== undefined || state.yearMax !== undefined) count += 1;
  if (state.keyDateOnly) count += 1;
  if (state.hideOwned && isLoggedIn) count += 1;
  return count;
}

export type PaginationItem = number | 'ellipsis';

/**
 * First, last, and a 3-page window around current (shifted inward at the edges). A gap of one
 * page shows that page; a larger gap shows 'ellipsis'. totalPages < 1 is treated as 1.
 */
export function getPaginationItems(current: number, totalPages: number): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const page = Math.min(Math.max(1, Math.floor(current)), total);

  let start = page - 1;
  let end = page + 1;
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > total) {
    start -= end - total;
    end = total;
  }
  start = Math.max(1, start);

  const pages = new Set<number>([1, total]);
  for (let p = start; p <= end; p += 1) pages.add(p);
  const sorted = [...pages].sort((a, b) => a - b);

  const items: PaginationItem[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous > 0) {
      const gap = p - previous;
      if (gap === 2) items.push(previous + 1);
      else if (gap > 2) items.push('ellipsis');
    }
    items.push(p);
    previous = p;
  }
  return items;
}

export interface CatalogRowText {
  title: string;
  subtitle: string;
  yearLabel: string;
}

/**
 * Row text for the catalog list. A coin with a variety is titled by the variety's design part
 * (the series prefix becomes the subtitle); a plain coin is titled by its denomination, so the
 * year is never repeated in the title.
 */
export function getCatalogRowText(
  coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety' | 'denomination'>,
): CatalogRowText {
  const { eyebrow, title } = splitVariety(coin.variety);
  return {
    title: coin.variety.trim() === '' ? coin.denomination : title,
    subtitle: eyebrow,
    yearLabel: coin.mintMark === '' ? String(coin.year) : `${coin.year} ${coin.mintMark}`,
  };
}
