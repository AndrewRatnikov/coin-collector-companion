// Pure logic for the Add coins sheet (signed-in redesign, Phase 5): filter state to catalog
// params, the per-row action, client-side "Hide coins in this set" and the counts.
import type { CatalogCoin } from '@coin-collector/shared';
import type { CatalogFilters } from '@/lib/catalog-api';

export const ADD_COINS_PAGE_SIZE = 20;
/** GET /catalog caps `limit` at 100. */
export const ADD_COINS_MAX_LIMIT = 100;
export const ADD_COINS_SEARCH_DEBOUNCE_MS = 300;

export interface AddCoinsFilterState {
  /** The applied (debounced, trimmed) search text, not the raw input. */
  search: string;
  /** '' = any. */
  country: string;
  /** '' = any. */
  denomination: string;
  year: number | undefined;
  /** Client-side only; never sent to the API. */
  hideInSet: boolean;
}

export const EMPTY_ADD_COINS_FILTERS: AddCoinsFilterState = {
  search: '',
  country: '',
  denomination: '',
  year: undefined,
  hideInSet: false,
};

export function toCatalogFilters(state: AddCoinsFilterState, limit: number): CatalogFilters {
  const filters: CatalogFilters = { page: 1, limit };
  if (state.search !== '') filters.name = state.search;
  if (state.country !== '') filters.country = state.country;
  if (state.denomination !== '') filters.denomination = state.denomination;
  if (state.year !== undefined) {
    filters.yearMin = state.year;
    filters.yearMax = state.year;
  }
  return filters;
}

/**
 * Mirrors CatalogService.findAll's where clause: country and denomination are a
 * case-insensitive equals, search is a case-insensitive substring of `name`, year is exact.
 */
export function coinMatchesAddCoinsFilters(coin: CatalogCoin, state: AddCoinsFilterState): boolean {
  if (state.country !== '' && coin.country.toLowerCase() !== state.country.toLowerCase()) return false;
  if (state.denomination !== '' && coin.denomination.toLowerCase() !== state.denomination.toLowerCase()) {
    return false;
  }
  if (state.search !== '' && !coin.name.toLowerCase().includes(state.search.toLowerCase())) return false;
  if (state.year !== undefined && coin.year !== state.year) return false;
  return true;
}

export type AddCoinsEntryStatus = 'idle' | 'adding' | 'added' | 'undoing';
/** An `idle` entry exists only to carry an add error. */
export interface AddCoinsEntry {
  status: AddCoinsEntryStatus;
  error: 'add' | 'undo' | null;
}
/** Keyed by coin id. */
export type AddCoinsSession = ReadonlyMap<string, AddCoinsEntry>;
export type AddCoinsRowAction = 'add' | 'adding' | 'added' | 'undoing' | 'already';

export function getAddCoinsRowAction(
  coinId: string,
  inSetCoinIds: ReadonlySet<string>,
  session: AddCoinsSession,
): AddCoinsRowAction {
  const status = session.get(coinId)?.status;
  if (status === 'adding' || status === 'added' || status === 'undoing') return status;
  return inSetCoinIds.has(coinId) ? 'already' : 'add';
}

export function isInSetForHiding(coinId: string, inSetCoinIds: ReadonlySet<string>, session: AddCoinsSession): boolean {
  if (inSetCoinIds.has(coinId)) return true;
  const status = session.get(coinId)?.status;
  return status === 'added' || status === 'undoing';
}

export function getVisibleAddCoinsRows(
  items: CatalogCoin[],
  opts: {
    hideInSet: boolean;
    inSetCoinIds: ReadonlySet<string>;
    session: AddCoinsSession;
    stickyCoinIds: ReadonlySet<string>;
  },
): CatalogCoin[] {
  if (!opts.hideInSet) return items;
  return items.filter(
    (coin) => opts.stickyCoinIds.has(coin.id) || !isInSetForHiding(coin.id, opts.inSetCoinIds, opts.session),
  );
}

export function countAddCoinsResults(args: {
  total: number;
  state: AddCoinsFilterState;
  setCoins: CatalogCoin[];
  stickyCoinIds: ReadonlySet<string>;
}): number {
  const { total, state, setCoins, stickyCoinIds } = args;
  if (!state.hideInSet) return total;
  const hidden = new Set<string>();
  for (const coin of setCoins) {
    if (stickyCoinIds.has(coin.id)) continue;
    if (coinMatchesAddCoinsFilters(coin, state)) hidden.add(coin.id);
  }
  return Math.max(0, total - hidden.size);
}

export function countSessionAdded(session: AddCoinsSession): number {
  let count = 0;
  for (const entry of session.values()) {
    if (entry.status === 'added' || entry.status === 'undoing') count += 1;
  }
  return count;
}
