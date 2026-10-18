/**
 * Tests for: my-sets helpers
 * Contract source: runs/run_20261018_105617/plan.md § Interface Contract → Module: my-sets.ts (CREATE)
 * Covers criteria: #4 (closest excludes complete), #6 (sorts, deterministic ties), #8 (popular checklists),
 *                  #5 (source kind) (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { CanonicalSetSummary, UserSetListItem } from '@coin-collector/shared';
import {
  DEFAULT_MY_SETS_SORT,
  MY_SETS_SORTS,
  getClosestToComplete,
  getPopularChecklists,
  getSetSourceKind,
  sortMySets,
} from '@/lib/my-sets';

function makeSet(over: Partial<UserSetListItem> & Pick<UserSetListItem, 'id' | 'name'>): UserSetListItem {
  return {
    userId: 'user-1',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownedCount: 0,
    totalCount: 10,
    firstMissing: null,
    ...over,
  };
}

function makeChecklist(over: Partial<CanonicalSetSummary> & Pick<CanonicalSetSummary, 'id' | 'name'>): CanonicalSetSummary {
  return { description: null, source: 'admin', templateVersion: '1', coinCount: 10, ...over };
}

const ids = (sets: readonly { id: string }[]) => sets.map((s) => s.id);

describe('constants', () => {
  it('lists the four sorts in board order and defaults to closest', () => {
    expect([...MY_SETS_SORTS]).toEqual(['closest', 'recent', 'name', 'most-missing']);
    expect(DEFAULT_MY_SETS_SORT).toBe('closest');
  });
});

describe('sortMySets: closest', () => {
  it('orders incomplete sets by completion ratio descending, then complete sets, then empty sets', () => {
    const sets = [
      makeSet({ id: 'empty', name: 'A empty', ownedCount: 0, totalCount: 0 }),
      makeSet({ id: 'quarter', name: 'Quarter', ownedCount: 1, totalCount: 4 }),
      makeSet({ id: 'done', name: 'Done', ownedCount: 2, totalCount: 2 }),
      makeSet({ id: 'three-quarters', name: 'Three quarters', ownedCount: 3, totalCount: 4 }),
      makeSet({ id: 'half', name: 'Half', ownedCount: 2, totalCount: 4 }),
    ];

    expect(ids(sortMySets(sets, 'closest'))).toEqual(['three-quarters', 'half', 'quarter', 'done', 'empty']);
  });

  it('compares ratios, not raw counts (9 of 100 is behind 1 of 5)', () => {
    const sets = [
      makeSet({ id: 'big', name: 'Big', ownedCount: 9, totalCount: 100 }),
      makeSet({ id: 'small', name: 'Small', ownedCount: 1, totalCount: 5 }),
    ];

    expect(ids(sortMySets(sets, 'closest'))).toEqual(['small', 'big']);
  });

  it('breaks an equal ratio by name (1 of 3 ties with 2 of 6)', () => {
    const sets = [
      makeSet({ id: 'z', name: 'Zed', ownedCount: 2, totalCount: 6 }),
      makeSet({ id: 'a', name: 'Alpha', ownedCount: 1, totalCount: 3 }),
    ];

    expect(ids(sortMySets(sets, 'closest'))).toEqual(['a', 'z']);
    expect(ids(sortMySets([...sets].reverse(), 'closest'))).toEqual(['a', 'z']);
  });

  it('orders complete sets by name and empty sets by name', () => {
    const sets = [
      makeSet({ id: 'e2', name: 'Empty B', ownedCount: 0, totalCount: 0 }),
      makeSet({ id: 'c2', name: 'Complete B', ownedCount: 3, totalCount: 3 }),
      makeSet({ id: 'e1', name: 'Empty A', ownedCount: 0, totalCount: 0 }),
      makeSet({ id: 'c1', name: 'Complete A', ownedCount: 5, totalCount: 5 }),
    ];

    expect(ids(sortMySets(sets, 'closest'))).toEqual(['c1', 'c2', 'e1', 'e2']);
  });

  it('falls back to id when the name is also equal', () => {
    const sets = [
      makeSet({ id: 'b', name: 'Same', ownedCount: 1, totalCount: 2 }),
      makeSet({ id: 'a', name: 'Same', ownedCount: 1, totalCount: 2 }),
    ];

    expect(ids(sortMySets(sets, 'closest'))).toEqual(['a', 'b']);
  });
});

describe('sortMySets: recent', () => {
  it('orders by updatedAt descending', () => {
    const sets = [
      makeSet({ id: 'old', name: 'Old', updatedAt: new Date('2026-01-01T00:00:00.000Z') }),
      makeSet({ id: 'new', name: 'New', updatedAt: new Date('2026-03-01T00:00:00.000Z') }),
      makeSet({ id: 'mid', name: 'Mid', updatedAt: new Date('2026-02-01T00:00:00.000Z') }),
    ];

    expect(ids(sortMySets(sets, 'recent'))).toEqual(['new', 'mid', 'old']);
  });

  it('reads ISO strings, which is what the JSON response carries at runtime', () => {
    const sets = [
      makeSet({ id: 'old', name: 'Old', updatedAt: '2026-01-01T00:00:00.000Z' as unknown as Date }),
      makeSet({ id: 'new', name: 'New', updatedAt: '2026-03-01T00:00:00.000Z' as unknown as Date }),
    ];

    expect(ids(sortMySets(sets, 'recent'))).toEqual(['new', 'old']);
  });

  it('breaks equal timestamps by name', () => {
    const sameTime = new Date('2026-02-01T00:00:00.000Z');
    const sets = [
      makeSet({ id: 'z', name: 'Zed', updatedAt: sameTime }),
      makeSet({ id: 'a', name: 'Alpha', updatedAt: sameTime }),
    ];

    expect(ids(sortMySets(sets, 'recent'))).toEqual(['a', 'z']);
  });
});

describe('sortMySets: name', () => {
  it('orders A to Z regardless of progress', () => {
    const sets = [
      makeSet({ id: 'c', name: 'Cents', ownedCount: 9, totalCount: 10 }),
      makeSet({ id: 'a', name: 'Alpha', ownedCount: 0, totalCount: 10 }),
      makeSet({ id: 'b', name: 'Bravo', ownedCount: 5, totalCount: 10 }),
    ];

    expect(ids(sortMySets(sets, 'name'))).toEqual(['a', 'b', 'c']);
  });

  it('is case-insensitive in the English locale (alpha before Bravo)', () => {
    const sets = [makeSet({ id: 'b', name: 'Bravo' }), makeSet({ id: 'a', name: 'alpha' })];

    expect(ids(sortMySets(sets, 'name'))).toEqual(['a', 'b']);
  });

  it('breaks identical names by id', () => {
    const sets = [makeSet({ id: 'y', name: 'Same' }), makeSet({ id: 'x', name: 'Same' })];

    expect(ids(sortMySets(sets, 'name'))).toEqual(['x', 'y']);
  });
});

describe('sortMySets: most-missing', () => {
  it('orders by coins still missing, descending', () => {
    const sets = [
      makeSet({ id: 'few', name: 'Few', ownedCount: 9, totalCount: 10 }),
      makeSet({ id: 'many', name: 'Many', ownedCount: 1, totalCount: 10 }),
      makeSet({ id: 'some', name: 'Some', ownedCount: 5, totalCount: 10 }),
    ];

    expect(ids(sortMySets(sets, 'most-missing'))).toEqual(['many', 'some', 'few']);
  });

  it('uses the missing count, not the ratio (3 missing of 4 loses to 5 missing of 100)', () => {
    const sets = [
      makeSet({ id: 'ratio', name: 'Ratio', ownedCount: 1, totalCount: 4 }),
      makeSet({ id: 'count', name: 'Count', ownedCount: 95, totalCount: 100 }),
    ];

    expect(ids(sortMySets(sets, 'most-missing'))).toEqual(['count', 'ratio']);
  });

  it('breaks equal missing counts by name', () => {
    const sets = [
      makeSet({ id: 'z', name: 'Zed', ownedCount: 2, totalCount: 5 }),
      makeSet({ id: 'a', name: 'Alpha', ownedCount: 4, totalCount: 7 }),
    ];

    expect(ids(sortMySets(sets, 'most-missing'))).toEqual(['a', 'z']);
  });
});

describe('sortMySets: purity', () => {
  it('returns a new array and leaves the input order untouched', () => {
    const sets = [makeSet({ id: 'b', name: 'Bravo' }), makeSet({ id: 'a', name: 'Alpha' })];
    const snapshot = [...sets];

    const sorted = sortMySets(sets, 'name');

    expect(sorted).not.toBe(sets);
    expect(sets).toEqual(snapshot);
    expect(ids(sets)).toEqual(['b', 'a']);
  });

  it('returns an empty array for no sets', () => {
    expect(sortMySets([], 'closest')).toEqual([]);
  });
});

describe('getClosestToComplete', () => {
  it('returns the incomplete set with the highest completion ratio', () => {
    const sets = [
      makeSet({ id: 'low', name: 'Low', ownedCount: 1, totalCount: 10 }),
      makeSet({ id: 'high', name: 'High', ownedCount: 9, totalCount: 10 }),
      makeSet({ id: 'done', name: 'Done', ownedCount: 4, totalCount: 4 }),
    ];

    expect(getClosestToComplete(sets)?.id).toBe('high');
  });

  it('skips complete sets even when they are listed first', () => {
    const sets = [
      makeSet({ id: 'done', name: 'Done', ownedCount: 4, totalCount: 4 }),
      makeSet({ id: 'low', name: 'Low', ownedCount: 1, totalCount: 10 }),
    ];

    expect(getClosestToComplete(sets)?.id).toBe('low');
  });

  it('returns null when every set is complete', () => {
    const sets = [
      makeSet({ id: 'a', name: 'A', ownedCount: 4, totalCount: 4 }),
      makeSet({ id: 'b', name: 'B', ownedCount: 2, totalCount: 2 }),
    ];

    expect(getClosestToComplete(sets)).toBeNull();
  });

  it('returns null when the only sets are empty', () => {
    expect(getClosestToComplete([makeSet({ id: 'e', name: 'Empty', ownedCount: 0, totalCount: 0 })])).toBeNull();
  });

  it('returns null for no sets', () => {
    expect(getClosestToComplete([])).toBeNull();
  });
});

describe('getPopularChecklists', () => {
  const checklists = [
    makeChecklist({ id: 'c1', name: 'One', coinCount: 12 }),
    makeChecklist({ id: 'c2', name: 'Two', coinCount: 187 }),
    makeChecklist({ id: 'c3', name: 'Three', coinCount: 40 }),
    makeChecklist({ id: 'c4', name: 'Four', coinCount: 75 }),
    makeChecklist({ id: 'c5', name: 'Five', coinCount: 5 }),
  ];

  it('returns the three with the most coins by default', () => {
    expect(ids(getPopularChecklists(checklists))).toEqual(['c2', 'c4', 'c3']);
  });

  it('honours a custom limit', () => {
    expect(ids(getPopularChecklists(checklists, 1))).toEqual(['c2']);
    expect(ids(getPopularChecklists(checklists, 4))).toEqual(['c2', 'c4', 'c3', 'c1']);
  });

  it('returns everything when there are fewer than the limit', () => {
    expect(ids(getPopularChecklists(checklists.slice(0, 2)))).toEqual(['c2', 'c1']);
  });

  it('breaks equal coin counts by name, then id', () => {
    const tied = [
      makeChecklist({ id: 'z', name: 'Zebra', coinCount: 10 }),
      makeChecklist({ id: 'b', name: 'Same', coinCount: 10 }),
      makeChecklist({ id: 'a', name: 'Same', coinCount: 10 }),
      makeChecklist({ id: 'm', name: 'Alpha', coinCount: 10 }),
    ];

    expect(ids(getPopularChecklists(tied, 4))).toEqual(['m', 'a', 'b', 'z']);
  });

  it('does not mutate the input and returns an empty array for none', () => {
    const before = ids(checklists);

    getPopularChecklists(checklists);

    expect(ids(checklists)).toEqual(before);
    expect(getPopularChecklists([])).toEqual([]);
  });
});

describe('getSetSourceKind', () => {
  it('is curated when the set was cloned from a canonical checklist', () => {
    expect(getSetSourceKind({ clonedFromCanonicalId: 'cs-1', clonedFromUserSetId: null })).toBe('curated');
  });

  it('is collector when the set was cloned from another collector set', () => {
    expect(getSetSourceKind({ clonedFromCanonicalId: null, clonedFromUserSetId: 'us-1' })).toBe('collector');
  });

  it('is null for a set built from scratch', () => {
    expect(getSetSourceKind({ clonedFromCanonicalId: null, clonedFromUserSetId: null })).toBeNull();
  });

  it('prefers curated when both ids are set', () => {
    expect(getSetSourceKind({ clonedFromCanonicalId: 'cs-1', clonedFromUserSetId: 'us-1' })).toBe('curated');
  });
});
