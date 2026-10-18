/**
 * Tests for: lib/add-coins.ts (pure filter / row-action / count logic for the Add coins sheet)
 * Contract source: runs/run_20261018_161537/plan.md § Interface Contract → Module: add-coins (pure)
 * Covers criteria: #4, #5, #6, #9, #10, #12 (the pure part of each)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin } from '@coin-collector/shared';
import {
  ADD_COINS_MAX_LIMIT,
  ADD_COINS_PAGE_SIZE,
  ADD_COINS_SEARCH_DEBOUNCE_MS,
  EMPTY_ADD_COINS_FILTERS,
  coinMatchesAddCoinsFilters,
  countAddCoinsResults,
  countSessionAdded,
  getAddCoinsRowAction,
  getVisibleAddCoinsRows,
  isInSetForHiding,
  toCatalogFilters,
  type AddCoinsEntry,
  type AddCoinsFilterState,
  type AddCoinsSession,
} from '@/lib/add-coins';

function coin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'coin-a',
    country: 'Ukraine',
    denomination: '10 Hryvnias',
    year: 2025,
    mintMark: '',
    variety: '',
    name: 'Ukraine Commemorative 10 Hryvnias',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function session(entries: Record<string, AddCoinsEntry>): AddCoinsSession {
  return new Map(Object.entries(entries));
}

const NO_SESSION: AddCoinsSession = new Map();
const NONE: ReadonlySet<string> = new Set();

describe('constants', () => {
  it('exposes the page size, the API cap and the debounce', () => {
    expect(ADD_COINS_PAGE_SIZE).toBe(20);
    expect(ADD_COINS_MAX_LIMIT).toBe(100);
    expect(ADD_COINS_SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('EMPTY_ADD_COINS_FILTERS has every filter unset', () => {
    expect(EMPTY_ADD_COINS_FILTERS).toEqual({
      search: '',
      country: '',
      denomination: '',
      year: undefined,
      hideInSet: false,
    });
  });
});

describe('toCatalogFilters', () => {
  it('returns only page and limit for empty filters (keys absent, not empty strings)', () => {
    const result = toCatalogFilters(EMPTY_ADD_COINS_FILTERS, 20);

    expect(result).toEqual({ page: 1, limit: 20 });
    expect(Object.keys(result).sort()).toEqual(['limit', 'page']);
  });

  it('maps every filter, turns year into yearMin = yearMax and never sends hideInSet', () => {
    const state: AddCoinsFilterState = {
      ...EMPTY_ADD_COINS_FILTERS,
      search: 'odesa',
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      year: 2025,
      hideInSet: true,
    };

    expect(toCatalogFilters(state, 40)).toEqual({
      page: 1,
      limit: 40,
      name: 'odesa',
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      yearMin: 2025,
      yearMax: 2025,
    });
  });

  it('only includes the filters that are set', () => {
    expect(toCatalogFilters({ ...EMPTY_ADD_COINS_FILTERS, country: 'Poland' }, 20)).toEqual({
      page: 1,
      limit: 20,
      country: 'Poland',
    });
    expect(toCatalogFilters({ ...EMPTY_ADD_COINS_FILTERS, year: 1999 }, 60)).toEqual({
      page: 1,
      limit: 60,
      yearMin: 1999,
      yearMax: 1999,
    });
  });
});

describe('coinMatchesAddCoinsFilters', () => {
  it('matches everything when no filter is set', () => {
    expect(coinMatchesAddCoinsFilters(coin(), EMPTY_ADD_COINS_FILTERS)).toBe(true);
  });

  it('compares country case-insensitively and exactly', () => {
    expect(coinMatchesAddCoinsFilters(coin(), { ...EMPTY_ADD_COINS_FILTERS, country: 'ukraine' })).toBe(true);
    expect(coinMatchesAddCoinsFilters(coin(), { ...EMPTY_ADD_COINS_FILTERS, country: 'UKRAINE' })).toBe(true);
    expect(coinMatchesAddCoinsFilters(coin(), { ...EMPTY_ADD_COINS_FILTERS, country: 'Ukrain' })).toBe(false);
    expect(coinMatchesAddCoinsFilters(coin(), { ...EMPTY_ADD_COINS_FILTERS, country: 'Poland' })).toBe(false);
  });

  it('compares denomination case-insensitively and exactly', () => {
    const filters = { ...EMPTY_ADD_COINS_FILTERS };
    expect(coinMatchesAddCoinsFilters(coin(), { ...filters, denomination: '10 hryvnias' })).toBe(true);
    expect(coinMatchesAddCoinsFilters(coin(), { ...filters, denomination: '10 Hryvnia' })).toBe(false);
    expect(coinMatchesAddCoinsFilters(coin(), { ...filters, denomination: '5 Hryvnias' })).toBe(false);
  });

  it('searches coin.name by case-insensitive substring', () => {
    const c = coin({ name: 'Lincoln Wheat Cent' });
    expect(coinMatchesAddCoinsFilters(c, { ...EMPTY_ADD_COINS_FILTERS, search: 'wheat' })).toBe(true);
    expect(coinMatchesAddCoinsFilters(c, { ...EMPTY_ADD_COINS_FILTERS, search: 'LINCOLN W' })).toBe(true);
    expect(coinMatchesAddCoinsFilters(c, { ...EMPTY_ADD_COINS_FILTERS, search: 'buffalo' })).toBe(false);
  });

  it('matches the year exactly', () => {
    expect(coinMatchesAddCoinsFilters(coin({ year: 2025 }), { ...EMPTY_ADD_COINS_FILTERS, year: 2025 })).toBe(true);
    expect(coinMatchesAddCoinsFilters(coin({ year: 2025 }), { ...EMPTY_ADD_COINS_FILTERS, year: 2024 })).toBe(false);
  });

  it('requires all set filters to match and ignores hideInSet', () => {
    const state = { ...EMPTY_ADD_COINS_FILTERS, country: 'Ukraine', year: 2025 };
    expect(coinMatchesAddCoinsFilters(coin({ year: 2025 }), state)).toBe(true);
    expect(coinMatchesAddCoinsFilters(coin({ year: 2026 }), state)).toBe(false);
    expect(coinMatchesAddCoinsFilters(coin(), { ...EMPTY_ADD_COINS_FILTERS, hideInSet: true })).toBe(true);
  });
});

describe('getAddCoinsRowAction', () => {
  it('is add for a coin that is neither in the set nor in the session', () => {
    expect(getAddCoinsRowAction('c1', NONE, NO_SESSION)).toBe('add');
  });

  it('is already for a coin in the set', () => {
    expect(getAddCoinsRowAction('c1', new Set(['c1']), NO_SESSION)).toBe('already');
    expect(getAddCoinsRowAction('c2', new Set(['c1']), NO_SESSION)).toBe('add');
  });

  it('lets a session status adding / added / undoing win over the in-set state', () => {
    const inSet = new Set(['c1']);
    expect(getAddCoinsRowAction('c1', inSet, session({ c1: { status: 'adding', error: null } }))).toBe('adding');
    expect(getAddCoinsRowAction('c1', inSet, session({ c1: { status: 'added', error: null } }))).toBe('added');
    expect(getAddCoinsRowAction('c1', inSet, session({ c1: { status: 'undoing', error: null } }))).toBe('undoing');
    expect(getAddCoinsRowAction('c1', NONE, session({ c1: { status: 'added', error: null } }))).toBe('added');
  });

  it('gives add for an idle entry that only carries an add error on a coin not in the set', () => {
    expect(getAddCoinsRowAction('c1', NONE, session({ c1: { status: 'idle', error: 'add' } }))).toBe('add');
  });

  it('gives already for an idle entry on a coin that is in the set', () => {
    expect(getAddCoinsRowAction('c1', new Set(['c1']), session({ c1: { status: 'idle', error: null } }))).toBe(
      'already',
    );
  });
});

describe('isInSetForHiding', () => {
  it('is true for set coins and for added / undoing session coins', () => {
    expect(isInSetForHiding('c1', new Set(['c1']), NO_SESSION)).toBe(true);
    expect(isInSetForHiding('c2', NONE, session({ c2: { status: 'added', error: null } }))).toBe(true);
    expect(isInSetForHiding('c2', NONE, session({ c2: { status: 'undoing', error: null } }))).toBe(true);
  });

  it('is false for other coins, including adding and idle ones', () => {
    expect(isInSetForHiding('c3', NONE, NO_SESSION)).toBe(false);
    expect(isInSetForHiding('c3', NONE, session({ c3: { status: 'adding', error: null } }))).toBe(false);
    expect(isInSetForHiding('c3', NONE, session({ c3: { status: 'idle', error: 'add' } }))).toBe(false);
  });
});

describe('getVisibleAddCoinsRows', () => {
  const A = coin({ id: 'a' });
  const B = coin({ id: 'b' });
  const C = coin({ id: 'c' });
  const D = coin({ id: 'd' });
  const items = [A, B, C, D];

  it('returns every item, in order, when hideInSet is false', () => {
    const result = getVisibleAddCoinsRows(items, {
      hideInSet: false,
      inSetCoinIds: new Set(['a']),
      session: NO_SESSION,
      stickyCoinIds: NONE,
    });

    expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops in-set and added coins when hideInSet is true, keeping the order of the rest', () => {
    const result = getVisibleAddCoinsRows(items, {
      hideInSet: true,
      inSetCoinIds: new Set(['a']),
      session: session({ c: { status: 'added', error: null } }),
      stickyCoinIds: NONE,
    });

    expect(result.map((c) => c.id)).toEqual(['b', 'd']);
  });

  it('keeps sticky coins even though they are in the set or added', () => {
    const result = getVisibleAddCoinsRows(items, {
      hideInSet: true,
      inSetCoinIds: new Set(['a']),
      session: session({ c: { status: 'added', error: null } }),
      stickyCoinIds: new Set(['c']),
    });

    expect(result.map((c) => c.id)).toEqual(['b', 'c', 'd']);
  });

  it('keeps a coin that is only adding (not yet in the set)', () => {
    const result = getVisibleAddCoinsRows(items, {
      hideInSet: true,
      inSetCoinIds: NONE,
      session: session({ b: { status: 'adding', error: null } }),
      stickyCoinIds: NONE,
    });

    expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('countAddCoinsResults', () => {
  const A = coin({ id: 'a', country: 'Ukraine', year: 2025 });
  const B = coin({ id: 'b', country: 'Ukraine', year: 2026 });
  const P = coin({ id: 'p', country: 'Poland', year: 2025 });

  it('returns total when not hiding, whatever the set holds', () => {
    expect(
      countAddCoinsResults({ total: 10, state: EMPTY_ADD_COINS_FILTERS, setCoins: [A, B, P], stickyCoinIds: NONE }),
    ).toBe(10);
  });

  it('subtracts the set coins that match the same filters when hiding', () => {
    const hiding = { ...EMPTY_ADD_COINS_FILTERS, hideInSet: true };

    expect(countAddCoinsResults({ total: 10, state: hiding, setCoins: [A, B, P], stickyCoinIds: NONE })).toBe(7);
    expect(
      countAddCoinsResults({
        total: 10,
        state: { ...hiding, country: 'Ukraine' },
        setCoins: [A, B, P],
        stickyCoinIds: NONE,
      }),
    ).toBe(8);
    expect(
      countAddCoinsResults({
        total: 10,
        state: { ...hiding, country: 'Ukraine', year: 2026 },
        setCoins: [A, B, P],
        stickyCoinIds: NONE,
      }),
    ).toBe(9);
  });

  it('counts a set coin once even when its id repeats', () => {
    const hiding = { ...EMPTY_ADD_COINS_FILTERS, hideInSet: true };

    expect(countAddCoinsResults({ total: 5, state: hiding, setCoins: [A, A, B], stickyCoinIds: NONE })).toBe(3);
  });

  it('does not subtract sticky coins', () => {
    const hiding = { ...EMPTY_ADD_COINS_FILTERS, hideInSet: true };

    expect(countAddCoinsResults({ total: 5, state: hiding, setCoins: [A, B], stickyCoinIds: new Set(['a']) })).toBe(4);
  });

  it('never goes below 0', () => {
    const hiding = { ...EMPTY_ADD_COINS_FILTERS, hideInSet: true };

    expect(countAddCoinsResults({ total: 1, state: hiding, setCoins: [A, B, P], stickyCoinIds: NONE })).toBe(0);
  });
});

describe('countSessionAdded', () => {
  it('is 0 for an empty session', () => {
    expect(countSessionAdded(NO_SESSION)).toBe(0);
  });

  it('counts added and undoing entries only', () => {
    expect(
      countSessionAdded(
        session({
          a: { status: 'added', error: null },
          b: { status: 'undoing', error: null },
          c: { status: 'adding', error: null },
          d: { status: 'idle', error: 'add' },
        }),
      ),
    ).toBe(2);
    expect(countSessionAdded(session({ a: { status: 'added', error: null } }))).toBe(1);
  });
});
