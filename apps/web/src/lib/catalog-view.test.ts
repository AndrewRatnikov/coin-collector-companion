/**
 * Tests for: catalog-view (pure URL/state/pagination/row-text helpers)
 * Contract source: runs/run_20261011_105146/plan.md § Interface Contract → Module: catalog-view.ts (CREATE)
 * Covers criteria: #10, #11, #13, #14, #16 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it } from 'vitest';
import {
  CATALOG_PAGE_SIZE,
  EMPTY_CATALOG_VIEW_STATE,
  catalogViewStateToFilters,
  catalogViewStateToSearchParams,
  countActiveFilters,
  getCatalogRowText,
  getPaginationItems,
  parseCatalogSearchParams,
  parseYearInput,
  type CatalogViewState,
} from '@/lib/catalog-view';

function state(overrides: Partial<CatalogViewState> = {}): CatalogViewState {
  return { ...EMPTY_CATALOG_VIEW_STATE, ...overrides };
}

describe('CATALOG_PAGE_SIZE / EMPTY_CATALOG_VIEW_STATE', () => {
  it('page size is 20', () => {
    expect(CATALOG_PAGE_SIZE).toBe(20);
  });

  it('the empty state has the documented defaults', () => {
    expect(EMPTY_CATALOG_VIEW_STATE).toMatchObject({
      country: '',
      denominations: [],
      name: '',
      keyDateOnly: false,
      hideOwned: false,
      sort: 'year_asc',
      page: 1,
    });
    expect(EMPTY_CATALOG_VIEW_STATE.yearMin).toBeUndefined();
    expect(EMPTY_CATALOG_VIEW_STATE.yearMax).toBeUndefined();
  });
});

describe('parseYearInput (criterion #10)', () => {
  it.each([
    ['1990', 1990],
    ['  1990  ', 1990],
    ['1', 1],
    ['9999', 9999],
    ['2025', 2025],
  ])('parses %j as %d', (text, expected) => {
    expect(parseYearInput(text)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '0', '10000', '-5', '19.5', '12a', '1,990', '1e3', '+5'])(
    'ignores %j',
    (text) => {
      expect(parseYearInput(text)).toBeUndefined();
    },
  );
});

describe('parseCatalogSearchParams (criterion #11)', () => {
  it('returns the defaults for an empty query string', () => {
    expect(parseCatalogSearchParams(new URLSearchParams())).toEqual(EMPTY_CATALOG_VIEW_STATE);
  });

  it('reads every supported param', () => {
    const params = new URLSearchParams(
      'country=Ukraine&denomination=5%20Kopiyok&denomination=10%20Hryvnias&name=wheat&yearMin=1900&yearMax=1950&keyDateOnly=true&hideOwned=true&sort=year_desc&page=3',
    );

    expect(parseCatalogSearchParams(params)).toEqual({
      country: 'Ukraine',
      denominations: ['5 Kopiyok', '10 Hryvnias'],
      name: 'wheat',
      yearMin: 1900,
      yearMax: 1950,
      keyDateOnly: true,
      hideOwned: true,
      sort: 'year_desc',
      page: 3,
    });
  });

  it('reads a different set of values differently (not hard-coded)', () => {
    const parsed = parseCatalogSearchParams(new URLSearchParams('country=USA&sort=name_asc&page=7'));
    expect(parsed.country).toBe('USA');
    expect(parsed.sort).toBe('name_asc');
    expect(parsed.page).toBe(7);
    expect(parsed.denominations).toEqual([]);
  });

  it('trims country and name', () => {
    const parsed = parseCatalogSearchParams(new URLSearchParams([['country', '  USA '], ['name', '  lincoln  ']]));
    expect(parsed.country).toBe('USA');
    expect(parsed.name).toBe('lincoln');
  });

  it('trims, drops empty and de-duplicates denominations, keeping first-seen order', () => {
    const parsed = parseCatalogSearchParams(
      new URLSearchParams([
        ['denomination', ' Cent '],
        ['denomination', ''],
        ['denomination', '  '],
        ['denomination', '1 Dime'],
        ['denomination', 'Cent'],
      ]),
    );
    expect(parsed.denominations).toEqual(['Cent', '1 Dime']);
  });

  it('ignores invalid years', () => {
    const parsed = parseCatalogSearchParams(new URLSearchParams('yearMin=abc&yearMax=0'));
    expect(parsed.yearMin).toBeUndefined();
    expect(parsed.yearMax).toBeUndefined();
  });

  it('only treats the literal "true" as true for keyDateOnly and hideOwned', () => {
    const parsed = parseCatalogSearchParams(new URLSearchParams('keyDateOnly=1&hideOwned=false'));
    expect(parsed.keyDateOnly).toBe(false);
    expect(parsed.hideOwned).toBe(false);
  });

  it('falls back to year_asc for an unknown sort', () => {
    expect(parseCatalogSearchParams(new URLSearchParams('sort=bogus')).sort).toBe('year_asc');
  });

  it.each(['abc', '0', '-1', '2.5', ''])('falls back to page 1 for page=%j', (page) => {
    expect(parseCatalogSearchParams(new URLSearchParams([['page', page]])).page).toBe(1);
  });

  it('accepts any plain object exposing get and getAll', () => {
    const parsed = parseCatalogSearchParams({
      get: (name) => (name === 'country' ? 'Canada' : null),
      getAll: () => [],
    });
    expect(parsed.country).toBe('Canada');
  });
});

describe('catalogViewStateToSearchParams (criterion #11)', () => {
  it('writes an empty query string for the default state', () => {
    expect(catalogViewStateToSearchParams(EMPTY_CATALOG_VIEW_STATE).toString()).toBe('');
  });

  it('writes every set value with API param names, in the documented order', () => {
    const params = catalogViewStateToSearchParams(
      state({
        country: 'Ukraine',
        denominations: ['5 Kopiyok', '10 Hryvnias'],
        name: 'wheat',
        yearMin: 1900,
        yearMax: 1950,
        keyDateOnly: true,
        hideOwned: true,
        sort: 'year_desc',
        page: 3,
      }),
    );

    expect(params.toString()).toBe(
      'country=Ukraine&denomination=5+Kopiyok&denomination=10+Hryvnias&name=wheat&yearMin=1900&yearMax=1950&keyDateOnly=true&hideOwned=true&sort=year_desc&page=3',
    );
    expect(params.getAll('denomination')).toEqual(['5 Kopiyok', '10 Hryvnias']);
  });

  it('omits defaults: sort year_asc, page 1, false flags, empty strings', () => {
    const params = catalogViewStateToSearchParams(state({ country: 'USA', sort: 'year_asc', page: 1, name: '' }));
    expect(params.toString()).toBe('country=USA');
  });

  it('writes sort name_asc and page 2 when they differ from the defaults', () => {
    const params = catalogViewStateToSearchParams(state({ sort: 'name_asc', page: 2 }));
    expect(params.get('sort')).toBe('name_asc');
    expect(params.get('page')).toBe('2');
  });

  it('round-trips through parseCatalogSearchParams', () => {
    const original = state({
      country: 'USA',
      denominations: ['1 Cent', '5 Cents'],
      name: 'lincoln wheat',
      yearMin: 1909,
      keyDateOnly: true,
      sort: 'name_asc',
      page: 4,
    });

    const parsed = parseCatalogSearchParams(new URLSearchParams(catalogViewStateToSearchParams(original).toString()));

    expect(parsed).toEqual(original);
  });
});

describe('catalogViewStateToFilters (criteria #10, #11)', () => {
  it('returns only page and limit for the default state', () => {
    const filters = catalogViewStateToFilters(EMPTY_CATALOG_VIEW_STATE, false);
    expect(filters).toEqual({ page: 1, limit: 20 });
    expect(Object.keys(filters).sort()).toEqual(['limit', 'page']);
  });

  it('includes only the set values', () => {
    const filters = catalogViewStateToFilters(
      state({
        country: 'Ukraine',
        denominations: ['5 Kopiyok', '10 Hryvnias'],
        name: 'x',
        yearMin: 1990,
        yearMax: 2000,
        keyDateOnly: true,
        sort: 'year_desc',
        page: 2,
      }),
      false,
    );

    expect(filters).toEqual({
      page: 2,
      limit: 20,
      country: 'Ukraine',
      denomination: ['5 Kopiyok', '10 Hryvnias'],
      name: 'x',
      yearMin: 1990,
      yearMax: 2000,
      keyDateOnly: true,
      sort: 'year_desc',
    });
  });

  it('omits denomination when none are ticked', () => {
    expect(Object.keys(catalogViewStateToFilters(state({ country: 'USA' }), false))).not.toContain('denomination');
  });

  it('omits sort when it is year_asc', () => {
    expect(Object.keys(catalogViewStateToFilters(state({ sort: 'year_asc' }), false))).not.toContain('sort');
  });

  it('sends hideOwned: true only when logged in', () => {
    const view = state({ hideOwned: true });
    expect(catalogViewStateToFilters(view, true)).toMatchObject({ hideOwned: true });
    expect(Object.keys(catalogViewStateToFilters(view, false))).not.toContain('hideOwned');
  });

  it('omits keyDateOnly and hideOwned when false', () => {
    const keys = Object.keys(catalogViewStateToFilters(state(), true));
    expect(keys).not.toContain('keyDateOnly');
    expect(keys).not.toContain('hideOwned');
  });
});

describe('countActiveFilters (criterion #16)', () => {
  it('is 0 for the default state', () => {
    expect(countActiveFilters(EMPTY_CATALOG_VIEW_STATE, true)).toBe(0);
    expect(countActiveFilters(EMPTY_CATALOG_VIEW_STATE, false)).toBe(0);
  });

  it('counts a country as 1', () => {
    expect(countActiveFilters(state({ country: 'Ukraine' }), false)).toBe(1);
  });

  it('counts any number of denominations as 1', () => {
    expect(countActiveFilters(state({ denominations: ['a'] }), false)).toBe(1);
    expect(countActiveFilters(state({ denominations: ['a', 'b', 'c'] }), false)).toBe(1);
  });

  it('counts the year range as 1 whether one or both bounds are set', () => {
    expect(countActiveFilters(state({ yearMin: 1900 }), false)).toBe(1);
    expect(countActiveFilters(state({ yearMax: 1950 }), false)).toBe(1);
    expect(countActiveFilters(state({ yearMin: 1900, yearMax: 1950 }), false)).toBe(1);
  });

  it('counts keyDateOnly as 1', () => {
    expect(countActiveFilters(state({ keyDateOnly: true }), false)).toBe(1);
  });

  it('counts hideOwned only when logged in', () => {
    expect(countActiveFilters(state({ hideOwned: true }), true)).toBe(1);
    expect(countActiveFilters(state({ hideOwned: true }), false)).toBe(0);
  });

  it('does not count search or sort', () => {
    expect(countActiveFilters(state({ name: 'wheat', sort: 'name_asc', page: 4 }), true)).toBe(0);
  });

  it('adds the groups up', () => {
    const view = state({
      country: 'Ukraine',
      denominations: ['a', 'b'],
      yearMin: 1990,
      keyDateOnly: true,
      hideOwned: true,
    });
    expect(countActiveFilters(view, true)).toBe(5);
    expect(countActiveFilters(view, false)).toBe(4);
  });
});

describe('getPaginationItems (criterion #14)', () => {
  it.each<[number, number, (number | 'ellipsis')[]]>([
    [1, 9, [1, 2, 3, 'ellipsis', 9]],
    [5, 9, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 9]],
    [3, 9, [1, 2, 3, 4, 'ellipsis', 9]],
    [9, 9, [1, 'ellipsis', 7, 8, 9]],
    [1, 1, [1]],
    [2, 2, [1, 2]],
    [1, 4, [1, 2, 3, 4]],
    [4, 7, [1, 2, 3, 4, 5, 6, 7]],
  ])('current %d of %d gives %j', (current, total, expected) => {
    expect(getPaginationItems(current, total)).toEqual(expected);
  });

  it('treats totalPages below 1 as 1', () => {
    expect(getPaginationItems(1, 0)).toEqual([1]);
  });
});

describe('getCatalogRowText (criterion #13)', () => {
  it('plain coin: title is the denomination, no subtitle, bare year', () => {
    expect(
      getCatalogRowText({ year: 1992, mintMark: '', variety: '', denomination: '25 Kopiyok' }),
    ).toEqual({ title: '25 Kopiyok', subtitle: '', yearLabel: '1992' });
  });

  it('series variety: title is the part after ": ", subtitle is the series', () => {
    expect(
      getCatalogRowText({
        year: 2025,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        denomination: '10 Hryvnias',
      }),
    ).toEqual({ title: 'Donetsk Oblast', subtitle: 'We Are Strong. We Are Together', yearLabel: '2025' });
  });

  it('single-part variety with a mint mark: title is the variety, year label has the mint mark', () => {
    expect(getCatalogRowText({ year: 1909, mintMark: 'S', variety: 'VDB', denomination: 'Cent' })).toEqual({
      title: 'VDB',
      subtitle: '',
      yearLabel: '1909 S',
    });
  });

  it('no variety but a mint mark: title is the denomination', () => {
    expect(getCatalogRowText({ year: 1999, mintMark: 'D', variety: '', denomination: 'Cent' })).toEqual({
      title: 'Cent',
      subtitle: '',
      yearLabel: '1999 D',
    });
  });

  it('a whitespace-only variety counts as no variety', () => {
    expect(getCatalogRowText({ year: 1950, mintMark: '', variety: '   ', denomination: '5 Cents' }).title).toBe(
      '5 Cents',
    );
  });

  it('never repeats the year in the title for a plain coin', () => {
    expect(getCatalogRowText({ year: 1992, mintMark: '', variety: '', denomination: '25 Kopiyok' }).title).not.toContain(
      '1992',
    );
  });
});
