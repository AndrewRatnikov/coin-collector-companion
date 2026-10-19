import { compareDenominations, getCoinName, type CatalogCoin, type OwnershipItem } from '@coin-collector/shared';

// Pure view logic for /collection: search, country chips, year range, grouping, which
// subgroups start open, and keeping coins removed this session on screen. No React.

export interface CollectionViewFilters {
  query: string;
  country: string | null;
  yearFrom: string;
  yearTo: string;
}

export const EMPTY_COLLECTION_FILTERS: CollectionViewFilters = { query: '', country: null, yearFrom: '', yearTo: '' };

export type CollectionLayout = 'cards' | 'rows';

/** With no filter active, this many subgroups (in page order) start open. */
export const DEFAULT_OPEN_SUBGROUPS = 3;

export type CollectionSubgroupKind = 'series' | 'denomination';

export interface CollectionSubgroup {
  key: string;
  name: string;
  kind: CollectionSubgroupKind;
  items: OwnershipItem[];
}

export interface CollectionCountryGroup {
  country: string;
  count: number;
  subgroups: CollectionSubgroup[];
}

export interface CountryChip {
  country: string;
  count: number;
}

export interface CountryChips {
  allCount: number;
  chips: CountryChip[];
}

const YEAR_MAX_DIGITS = 4;

/** Digits only, at most 4: '19a0' -> '190', '20255' -> '2025'. */
export function sanitizeYearInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, YEAR_MAX_DIGITS);
}

export function hasActiveFilters(filters: CollectionViewFilters): boolean {
  return filters.query.trim() !== '' || filters.country !== null || filters.yearFrom !== '' || filters.yearTo !== '';
}

function subgroupOf(coin: CatalogCoin): { name: string; kind: CollectionSubgroupKind } {
  const { eyebrow, title } = getCoinName(coin);
  if (eyebrow !== '') return { name: eyebrow, kind: 'series' };
  // A plain coin titled by its type name ("Lincoln Wheat Cent") groups with the key dates
  // whose eyebrow is that same type name.
  if (title !== '' && title === (coin.name ?? '').trim()) return { name: title, kind: 'series' };
  return { name: (coin.denomination ?? '').trim(), kind: 'denomination' };
}

/** The series (eyebrow), else the type name when it is the title, else the denomination. */
export function getSubgroupName(coin: CatalogCoin): string {
  return subgroupOf(coin).name;
}

export function getSubgroupKind(coin: CatalogCoin): CollectionSubgroupKind {
  return subgroupOf(coin).kind;
}

/** Case-insensitive substring match on title, series, denomination and subgroup name. */
export function matchesCollectionSearch(coin: CatalogCoin, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === '') return true;
  const { eyebrow, title } = getCoinName(coin);
  const haystack = [title, eyebrow, coin.denomination, getSubgroupName(coin)].join(' ').toLowerCase();
  return haystack.includes(needle);
}

function matchesFilters(coin: CatalogCoin, filters: CollectionViewFilters): boolean {
  if (filters.country !== null && coin.country !== filters.country) return false;
  if (filters.yearFrom !== '' && coin.year < parseInt(filters.yearFrom, 10)) return false;
  if (filters.yearTo !== '' && coin.year > parseInt(filters.yearTo, 10)) return false;
  return matchesCollectionSearch(coin, filters.query);
}

/** Search, country and inclusive year range. Keeps the input order; never mutates. */
export function filterCollection(
  items: readonly OwnershipItem[],
  filters: CollectionViewFilters,
): OwnershipItem[] {
  return items.filter((item) => matchesFilters(item.coin, filters));
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, 'en');
}

/**
 * One chip per country in `items` (sorted), each counting the items that match every filter
 * except the country; `allCount` is the same count across all countries.
 */
export function getCountryChips(items: readonly OwnershipItem[], filters: CollectionViewFilters): CountryChips {
  const withoutCountry: CollectionViewFilters = { ...filters, country: null };
  const counts = new Map<string, number>();
  let allCount = 0;
  for (const item of items) {
    const country = item.coin.country;
    const matches = matchesFilters(item.coin, withoutCountry);
    counts.set(country, (counts.get(country) ?? 0) + (matches ? 1 : 0));
    if (matches) allCount += 1;
  }
  const chips = [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => compareText(a.country, b.country));
  return { allCount, chips };
}

function compareItems(a: OwnershipItem, b: OwnershipItem): number {
  const year = a.coin.year - b.coin.year;
  if (year !== 0) return year;
  const mint = compareText(a.coin.mintMark ?? '', b.coin.mintMark ?? '');
  if (mint !== 0) return mint;
  const title = compareText(getCoinName(a.coin).title, getCoinName(b.coin).title);
  if (title !== 0) return title;
  if (a.coinId < b.coinId) return -1;
  if (a.coinId > b.coinId) return 1;
  return 0;
}

function compareSubgroups(a: CollectionSubgroup, b: CollectionSubgroup): number {
  if (a.kind !== b.kind) return a.kind === 'series' ? -1 : 1;
  return a.kind === 'series' ? compareText(a.name, b.name) : compareDenominations(a.name, b.name);
}

/**
 * Country sections (sorted), each with series subgroups (by name) then denomination subgroups
 * (by value). Coins sort by year, mint mark, title, id: never by ownedAt, so a card never moves.
 */
export function groupCollection(items: readonly OwnershipItem[]): CollectionCountryGroup[] {
  const byCountry = new Map<string, Map<string, CollectionSubgroup>>();
  for (const item of items) {
    const country = item.coin.country;
    const { name, kind } = subgroupOf(item.coin);
    let subgroups = byCountry.get(country);
    if (!subgroups) {
      subgroups = new Map();
      byCountry.set(country, subgroups);
    }
    const key = `${country}|${name}`;
    let subgroup = subgroups.get(key);
    if (!subgroup) {
      subgroup = { key, name, kind, items: [] };
      subgroups.set(key, subgroup);
    }
    subgroup.items.push(item);
  }

  return [...byCountry.entries()]
    .sort(([a], [b]) => compareText(a, b))
    .map(([country, subgroupMap]) => {
      const subgroups = [...subgroupMap.values()].sort(compareSubgroups);
      for (const subgroup of subgroups) subgroup.items.sort(compareItems);
      const count = subgroups.reduce((sum, subgroup) => sum + subgroup.items.length, 0);
      return { country, count, subgroups };
    });
}

/** `items` plus the removed items it no longer holds (the `items` copy wins). Same array when nothing is added. */
export function mergeSessionRemoved(
  items: readonly OwnershipItem[],
  removed: readonly OwnershipItem[],
): OwnershipItem[] {
  const present = new Set(items.map((item) => item.coinId));
  const extra = removed.filter((item) => !present.has(item.coinId));
  if (extra.length === 0) return items as OwnershipItem[];
  return [...items, ...extra];
}

/** A manual toggle wins; otherwise everything is open while filtering, else the first 3 on the page. */
export function isSubgroupOpen(
  index: number,
  key: string,
  filtersActive: boolean,
  overrides: Readonly<Record<string, boolean>>,
): boolean {
  return overrides[key] ?? (filtersActive || index < DEFAULT_OPEN_SUBGROUPS);
}
