/**
 * Tests for: lib/collection-view (pure filter, chip-count, grouping, subgroup-open and session-merge logic)
 * Contract source: runs/run_20261019_073415/plan.md § Interface Contract → Module: collection-view
 * Covers criteria: #2, #3, #4, #5, #6, #8 (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin, OwnershipItem } from '@coin-collector/shared';
import {
  DEFAULT_OPEN_SUBGROUPS,
  EMPTY_COLLECTION_FILTERS,
  filterCollection,
  getCountryChips,
  getSubgroupKind,
  getSubgroupName,
  groupCollection,
  hasActiveFilters,
  isSubgroupOpen,
  matchesCollectionSearch,
  mergeSessionRemoved,
  sanitizeYearInput,
  type CollectionViewFilters,
} from '@/lib/collection-view';

const BASE: CatalogCoin = {
  id: 'base',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: 'Bronze',
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

function coin(over: Partial<CatalogCoin> & { id: string }): CatalogCoin {
  return { ...BASE, ...over };
}

function item(c: CatalogCoin, ownedAt = '2026-01-02T00:00:00.000Z'): OwnershipItem {
  return { coinId: c.id, coin: c, ownedAt: new Date(ownedAt) };
}

function ids(items: readonly OwnershipItem[]): string[] {
  return items.map((i) => i.coinId);
}

function filters(over: Partial<CollectionViewFilters> = {}): CollectionViewFilters {
  return { ...EMPTY_COLLECTION_FILTERS, ...over };
}

const DONETSK = coin({
  id: 'donetsk',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
  material: 'Brass-plated steel',
});
const ODESA = coin({
  id: 'odesa',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  variety: 'We Are Strong. We Are Together: Odesa Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
  material: 'Brass-plated steel',
});
const K25 = coin({
  id: 'k25',
  country: 'Ukraine',
  denomination: '25 Kopiyok',
  year: 1992,
  name: 'Ukraine 25 Kopiyok',
  material: null,
});
const K10 = coin({
  id: 'k10',
  country: 'Ukraine',
  denomination: '10 Kopiyok',
  year: 1992,
  name: 'Ukraine 10 Kopiyok',
  material: null,
});
const CENT09 = coin({ id: 'cent-1909' });
const CENT09D = coin({ id: 'cent-1909-d', mintMark: 'D' });
const VDB = coin({ id: 'vdb', mintMark: 'S', variety: 'VDB', isKeyDate: true });
const CENT10 = coin({ id: 'cent-1910', year: 1910 });
const CENT11 = coin({ id: 'cent-1911', year: 1911 });

// Deliberately scrambled so every ordering rule is falsifiable.
const ALL: OwnershipItem[] = [
  item(CENT11),
  item(K25),
  item(VDB),
  item(ODESA),
  item(CENT09D),
  item(K10),
  item(CENT10),
  item(DONETSK),
  item(CENT09),
];

describe('constants', () => {
  it('opens the first 3 subgroups by default', () => {
    expect(DEFAULT_OPEN_SUBGROUPS).toBe(3);
  });

  it('starts with every filter empty', () => {
    expect(EMPTY_COLLECTION_FILTERS).toEqual({ query: '', country: null, yearFrom: '', yearTo: '' });
  });
});

describe('sanitizeYearInput', () => {
  it('removes non-digits', () => {
    expect(sanitizeYearInput('19a0')).toBe('190');
    expect(sanitizeYearInput('abc')).toBe('');
    expect(sanitizeYearInput('-1.9')).toBe('19');
  });

  it('keeps at most 4 digits', () => {
    expect(sanitizeYearInput('20255')).toBe('2025');
    expect(sanitizeYearInput('123456789')).toBe('1234');
  });

  it('leaves a valid year alone, and empty stays empty', () => {
    expect(sanitizeYearInput('1909')).toBe('1909');
    expect(sanitizeYearInput('')).toBe('');
  });
});

describe('hasActiveFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveFilters(EMPTY_COLLECTION_FILTERS)).toBe(false);
  });

  it('ignores a whitespace-only query', () => {
    expect(hasActiveFilters(filters({ query: '   ' }))).toBe(false);
  });

  it('is true for each single active filter', () => {
    expect(hasActiveFilters(filters({ query: 'cent' }))).toBe(true);
    expect(hasActiveFilters(filters({ country: 'USA' }))).toBe(true);
    expect(hasActiveFilters(filters({ yearFrom: '1900' }))).toBe(true);
    expect(hasActiveFilters(filters({ yearTo: '2000' }))).toBe(true);
  });
});

describe('getSubgroupName and getSubgroupKind', () => {
  it('uses the series (eyebrow) for a series coin', () => {
    expect(getSubgroupName(DONETSK)).toBe('We Are Strong. We Are Together');
    expect(getSubgroupKind(DONETSK)).toBe('series');
  });

  it('uses the type name for a plain coin titled by it', () => {
    expect(getSubgroupName(CENT09)).toBe('Lincoln Wheat Cent');
    expect(getSubgroupKind(CENT09)).toBe('series');
  });

  it('groups a key date under its eyebrow, together with the plain coin', () => {
    expect(getSubgroupName(VDB)).toBe('Lincoln Wheat Cent');
    expect(getSubgroupKind(VDB)).toBe('series');
    expect(getSubgroupName(VDB)).toBe(getSubgroupName(CENT09));
  });

  it('falls back to the denomination when the name adds nothing', () => {
    expect(getSubgroupName(K25)).toBe('25 Kopiyok');
    expect(getSubgroupKind(K25)).toBe('denomination');
    expect(getSubgroupName(K10)).toBe('10 Kopiyok');
  });

  it('falls back to the denomination when the coin has an empty name', () => {
    const nameless = coin({ id: 'nameless', country: 'Ukraine', denomination: '25 Kopiyok', name: '' });
    expect(getSubgroupName(nameless)).toBe('25 Kopiyok');
    expect(getSubgroupKind(nameless)).toBe('denomination');
  });
});

describe('matchesCollectionSearch', () => {
  it('matches everything for an empty or blank query', () => {
    expect(matchesCollectionSearch(DONETSK, '')).toBe(true);
    expect(matchesCollectionSearch(K25, '   ')).toBe(true);
  });

  it('matches the title, case-insensitively', () => {
    expect(matchesCollectionSearch(DONETSK, 'donetsk')).toBe(true);
    expect(matchesCollectionSearch(DONETSK, 'DONETSK')).toBe(true);
    expect(matchesCollectionSearch(DONETSK, 'odesa')).toBe(false);
  });

  it('matches the series (eyebrow)', () => {
    expect(matchesCollectionSearch(DONETSK, 'we are strong')).toBe(true);
    expect(matchesCollectionSearch(CENT09, 'we are strong')).toBe(false);
  });

  it('matches the denomination', () => {
    expect(matchesCollectionSearch(DONETSK, 'hryvnias')).toBe(true);
    expect(matchesCollectionSearch(K25, 'hryvnias')).toBe(false);
    expect(matchesCollectionSearch(K25, 'kopiyok')).toBe(true);
  });

  it('matches the subgroup name and trims the query', () => {
    expect(matchesCollectionSearch(VDB, 'lincoln')).toBe(true);
    expect(matchesCollectionSearch(VDB, '  lincoln  ')).toBe(true);
    expect(matchesCollectionSearch(VDB, 'zzz')).toBe(false);
  });
});

describe('filterCollection', () => {
  it('keeps everything, in input order, for the empty filters', () => {
    const result = filterCollection(ALL, EMPTY_COLLECTION_FILTERS);
    expect(ids(result)).toEqual(ids(ALL));
  });

  it('filters by search', () => {
    expect(ids(filterCollection(ALL, filters({ query: 'donetsk' })))).toEqual(['donetsk']);
    expect(ids(filterCollection(ALL, filters({ query: 'kopiyok' })))).toEqual(['k25', 'k10']);
  });

  it('filters by country', () => {
    expect(ids(filterCollection(ALL, filters({ country: 'Ukraine' })))).toEqual(['k25', 'odesa', 'k10', 'donetsk']);
    expect(filterCollection(ALL, filters({ country: 'USA' }))).toHaveLength(5);
  });

  it('treats the lower year bound as inclusive', () => {
    expect(ids(filterCollection(ALL, filters({ yearFrom: '1910' })))).toEqual([
      'cent-1911',
      'k25',
      'odesa',
      'k10',
      'cent-1910',
      'donetsk',
    ]);
    expect(filterCollection(ALL, filters({ yearFrom: '1911' }))).toHaveLength(5);
  });

  it('treats the upper year bound as inclusive', () => {
    expect(ids(filterCollection(ALL, filters({ yearTo: '1909' })))).toEqual(['vdb', 'cent-1909-d', 'cent-1909']);
    expect(ids(filterCollection(ALL, filters({ yearTo: '1910' })))).toHaveLength(4);
  });

  it('combines both bounds, either of which may be blank', () => {
    expect(ids(filterCollection(ALL, filters({ yearFrom: '1910', yearTo: '1911' })))).toEqual([
      'cent-1911',
      'cent-1910',
    ]);
    expect(filterCollection(ALL, filters({ yearFrom: '1992', yearTo: '1992' }))).toHaveLength(2);
  });

  it('matches nothing when the lower bound is above the upper bound', () => {
    expect(filterCollection(ALL, filters({ yearFrom: '2000', yearTo: '1900' }))).toEqual([]);
  });

  it('combines search, country and years', () => {
    const result = filterCollection(ALL, filters({ query: 'lincoln', country: 'USA', yearFrom: '1910' }));
    expect(ids(result)).toEqual(['cent-1911', 'cent-1910']);
  });

  it('does not mutate its input', () => {
    const input = [...ALL];
    const before = ids(input);
    const result = filterCollection(input, filters({ query: 'lincoln' }));
    expect(ids(input)).toEqual(before);
    expect(result).not.toBe(input);
  });
});

describe('getCountryChips', () => {
  it('has one chip per country, sorted, with counts, and an All count', () => {
    const { allCount, chips } = getCountryChips(ALL, EMPTY_COLLECTION_FILTERS);

    expect(allCount).toBe(9);
    expect(chips).toEqual([
      { country: 'Ukraine', count: 4 },
      { country: 'USA', count: 5 },
    ]);
  });

  it('reflects the search in every count and keeps a zero chip', () => {
    const { allCount, chips } = getCountryChips(ALL, filters({ query: 'lincoln' }));

    expect(allCount).toBe(5);
    expect(chips).toEqual([
      { country: 'Ukraine', count: 0 },
      { country: 'USA', count: 5 },
    ]);
  });

  it('reflects the years', () => {
    const { allCount, chips } = getCountryChips(ALL, filters({ yearTo: '1909' }));

    expect(allCount).toBe(3);
    expect(chips).toEqual([
      { country: 'Ukraine', count: 0 },
      { country: 'USA', count: 3 },
    ]);
  });

  it('ignores the selected country', () => {
    const none = getCountryChips(ALL, filters({ query: 'lincoln' }));
    const picked = getCountryChips(ALL, filters({ query: 'lincoln', country: 'Ukraine' }));

    expect(picked).toEqual(none);
  });

  it('derives the chips from the items it is given', () => {
    expect(getCountryChips([item(K25), item(K10)], EMPTY_COLLECTION_FILTERS)).toEqual({
      allCount: 2,
      chips: [{ country: 'Ukraine', count: 2 }],
    });
    expect(getCountryChips([], EMPTY_COLLECTION_FILTERS)).toEqual({ allCount: 0, chips: [] });
  });
});

describe('groupCollection', () => {
  it('returns no groups for no items', () => {
    expect(groupCollection([])).toEqual([]);
  });

  it('sorts the countries and counts the coins in each', () => {
    const groups = groupCollection(ALL);

    expect(groups.map((g) => g.country)).toEqual(['Ukraine', 'USA']);
    expect(groups.map((g) => g.count)).toEqual([4, 5]);
  });

  it('puts series subgroups before denomination subgroups, denominations by numeral', () => {
    const [ukraine] = groupCollection(ALL);

    expect(ukraine.subgroups.map((s) => s.name)).toEqual([
      'We Are Strong. We Are Together',
      '10 Kopiyok',
      '25 Kopiyok',
    ]);
    expect(ukraine.subgroups.map((s) => s.kind)).toEqual(['series', 'denomination', 'denomination']);
  });

  it('keys each subgroup as country|name', () => {
    const [ukraine, usa] = groupCollection(ALL);

    expect(ukraine.subgroups.map((s) => s.key)).toEqual([
      'Ukraine|We Are Strong. We Are Together',
      'Ukraine|10 Kopiyok',
      'Ukraine|25 Kopiyok',
    ]);
    expect(usa.subgroups.map((s) => s.key)).toEqual(['USA|Lincoln Wheat Cent']);
  });

  it('keeps plain and key-date coins of one type in one subgroup, ordered by year then mint mark', () => {
    const usa = groupCollection(ALL)[1];

    expect(usa.subgroups).toHaveLength(1);
    expect(ids(usa.subgroups[0].items)).toEqual(['cent-1909', 'cent-1909-d', 'vdb', 'cent-1910', 'cent-1911']);
  });

  it('breaks a year and mint mark tie by title', () => {
    const ukraine = groupCollection(ALL)[0];
    expect(ids(ukraine.subgroups[0].items)).toEqual(['donetsk', 'odesa']);

    const reversed = groupCollection([item(ODESA), item(DONETSK)])[0];
    expect(ids(reversed.subgroups[0].items)).toEqual(['donetsk', 'odesa']);
  });

  it('breaks a full tie by coin id', () => {
    const a = coin({ id: 'cent-a' });
    const b = coin({ id: 'cent-b' });

    expect(ids(groupCollection([item(b), item(a)])[0].subgroups[0].items)).toEqual(['cent-a', 'cent-b']);
    expect(ids(groupCollection([item(a), item(b)])[0].subgroups[0].items)).toEqual(['cent-a', 'cent-b']);
  });

  it('does not depend on ownedAt', () => {
    const early = groupCollection([
      item(CENT10, '2026-01-01T00:00:00.000Z'),
      item(CENT09, '2026-03-01T00:00:00.000Z'),
    ]);
    const late = groupCollection([
      item(CENT10, '2026-05-01T00:00:00.000Z'),
      item(CENT09, '2026-02-01T00:00:00.000Z'),
    ]);

    expect(ids(early[0].subgroups[0].items)).toEqual(['cent-1909', 'cent-1910']);
    expect(ids(late[0].subgroups[0].items)).toEqual(['cent-1909', 'cent-1910']);
  });

  it('does not mutate its input', () => {
    const input = [...ALL];
    const before = ids(input);
    groupCollection(input);
    expect(ids(input)).toEqual(before);
  });
});

describe('mergeSessionRemoved', () => {
  it('returns the same array when nothing is added', () => {
    const items = [item(CENT09), item(CENT10)];

    expect(mergeSessionRemoved(items, [])).toBe(items);
    expect(mergeSessionRemoved(items, [item(CENT09)])).toBe(items);
  });

  it('adds removed items that are no longer in the list, after the current ones', () => {
    const items = [item(CENT09)];
    const merged = mergeSessionRemoved(items, [item(CENT10), item(DONETSK)]);

    expect(ids(merged)).toEqual(['cent-1909', 'cent-1910', 'donetsk']);
  });

  it('prefers the copy in the current list over the removed copy', () => {
    const current = item(CENT09, '2026-06-01T00:00:00.000Z');
    const stale = item(CENT09, '2026-01-01T00:00:00.000Z');
    const merged = mergeSessionRemoved([current], [stale]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(current);
  });

  it('does not mutate its inputs', () => {
    const items = [item(CENT09)];
    const removed = [item(CENT10)];
    mergeSessionRemoved(items, removed);

    expect(ids(items)).toEqual(['cent-1909']);
    expect(ids(removed)).toEqual(['cent-1910']);
  });
});

describe('isSubgroupOpen', () => {
  it('opens the first 3 subgroups by page position when no filter is active', () => {
    expect([0, 1, 2, 3, 4].map((i) => isSubgroupOpen(i, 'k', false, {}))).toEqual([true, true, true, false, false]);
  });

  it('opens every subgroup when a filter is active', () => {
    expect(isSubgroupOpen(3, 'k', true, {})).toBe(true);
    expect(isSubgroupOpen(40, 'k', true, {})).toBe(true);
  });

  it('lets an override close an open-by-default subgroup, even with filters', () => {
    expect(isSubgroupOpen(0, 'k', false, { k: false })).toBe(false);
    expect(isSubgroupOpen(0, 'k', true, { k: false })).toBe(false);
  });

  it('lets an override open a closed-by-default subgroup', () => {
    expect(isSubgroupOpen(5, 'k', false, { k: true })).toBe(true);
  });

  it('only applies an override to its own key', () => {
    expect(isSubgroupOpen(5, 'other', false, { k: true })).toBe(false);
    expect(isSubgroupOpen(0, 'other', false, { k: false })).toBe(true);
  });
});
