/**
 * Tests for: ownership-cache (pure optimistic cache patchers)
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Module: ownership-cache
 *                   runs/run_20261019_221037/plan.md § Interface Contract → Function: applyOwnershipToCatalogPage
 *                   runs/run_20261102_194108/plan.md § Interface Contract → Web: applyOwnershipToCollection
 *                   runs/run_20261102_220909/plan.md § Interface Contract → Functions: grade cache patchers
 * Covers criteria: #14 (from run_20261017_142658's prd.md), #11 (from run_20261019_221037's prd.md),
 *                  #5, #6 (from run_20261102_194108's prd.md: a new optimistic row is ungraded)
 *                  #4, #6, #11 (from run_20261102_220909's prd.md: grade patchers, un-own clears grade, counts untouched)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type {
  CatalogCoin,
  CatalogListItem,
  GapViewResponse,
  OwnershipItem,
  PaginatedResponse,
} from '@coin-collector/shared';
import {
  applyGradeToCollection,
  applyGradeToGaps,
  applyOwnershipToCatalogPage,
  applyOwnershipToCollection,
  applyOwnershipToGaps,
  isCatalogListKey,
} from '@/lib/ownership-cache';

function makeCoin(id: string, over: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id,
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
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

const COIN_1 = makeCoin('coin-1');
const COIN_2 = makeCoin('coin-2', { year: 1910 });
const COIN_3 = makeCoin('coin-3', { year: 1911 });
const CANADA_COIN = makeCoin('coin-ca', { country: 'Canada', year: 1937 });

function makeGaps(): GapViewResponse {
  return {
    setId: 'set-1',
    ownedCount: 1,
    totalCount: 3,
    completionPercent: 33,
    minGrade: null,
    slots: [
      { id: 'slot-1', position: 0, coin: COIN_1, owned: false, grade: null },
      { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: null },
      { id: 'slot-3', position: 2, coin: COIN_3, owned: false, grade: null },
    ],
  };
}

describe('applyOwnershipToGaps', () => {
  it('marks the matching slot owned, recounts ownedCount and recomputes the rounded percent', () => {
    const result = applyOwnershipToGaps(makeGaps(), 'coin-1', true);

    expect(result.slots.map((s) => s.owned)).toEqual([true, true, false]);
    expect(result.ownedCount).toBe(2);
    expect(result.totalCount).toBe(3);
    expect(result.completionPercent).toBe(67);
  });

  it('marks the matching slot missing and gives a different count and percent', () => {
    const result = applyOwnershipToGaps(makeGaps(), 'coin-2', false);

    expect(result.slots.map((s) => s.owned)).toEqual([false, false, false]);
    expect(result.ownedCount).toBe(0);
    expect(result.completionPercent).toBe(0);
  });

  it('rounds the percent like the API (1 of 3 is 33, 2 of 3 is 67, 3 of 3 is 100)', () => {
    const allButOne = applyOwnershipToGaps(makeGaps(), 'coin-3', true);
    expect(allButOne.ownedCount).toBe(2);
    expect(allButOne.completionPercent).toBe(67);

    const complete = applyOwnershipToGaps(allButOne, 'coin-1', true);
    expect(complete.ownedCount).toBe(3);
    expect(complete.completionPercent).toBe(100);
  });

  it('leaves the other slots and the other fields untouched', () => {
    const gaps = makeGaps();
    const result = applyOwnershipToGaps(gaps, 'coin-1', true);

    expect(result.setId).toBe('set-1');
    expect(result.slots[1]).toEqual(gaps.slots[1]);
    expect(result.slots[2]).toEqual(gaps.slots[2]);
    expect(result.slots[0]).toEqual({ ...gaps.slots[0], owned: true });
  });

  it('updates every slot that holds the coin', () => {
    const gaps: GapViewResponse = {
      ...makeGaps(),
      ownedCount: 0,
      totalCount: 3,
      completionPercent: 0,
      slots: [
        { id: 'slot-1', position: 0, coin: COIN_1, owned: false, grade: null },
        { id: 'slot-2', position: 1, coin: COIN_2, owned: false, grade: null },
        { id: 'slot-3', position: 2, coin: COIN_1, owned: false, grade: null },
      ],
    };
    const result = applyOwnershipToGaps(gaps, 'coin-1', true);

    expect(result.slots.map((s) => s.owned)).toEqual([true, false, true]);
    expect(result.ownedCount).toBe(2);
  });

  it('returns the same reference when the coin is not in the set', () => {
    const gaps = makeGaps();
    expect(applyOwnershipToGaps(gaps, 'coin-unknown', true)).toBe(gaps);
  });

  it('keeps the values when the slot already has the requested state', () => {
    const gaps = makeGaps();
    expect(applyOwnershipToGaps(gaps, 'coin-2', true)).toEqual(gaps);
  });

  it('returns the same reference for an empty set', () => {
    const empty: GapViewResponse = {
      setId: 'set-0',
      ownedCount: 0,
      totalCount: 0,
      completionPercent: 0,
      minGrade: null,
      slots: [],
    };
    expect(applyOwnershipToGaps(empty, 'coin-1', true)).toBe(empty);
  });

  it('does not mutate its input', () => {
    const gaps = makeGaps();
    const snapshot = JSON.stringify(gaps);
    applyOwnershipToGaps(gaps, 'coin-1', true);
    expect(JSON.stringify(gaps)).toBe(snapshot);
  });

  describe('un-own clears the slot grade (run_20261102_220909 criterion #6)', () => {
    function gradedGaps(): GapViewResponse {
      return {
        ...makeGaps(),
        ownedCount: 2,
        completionPercent: 67,
        slots: [
          { id: 'slot-1', position: 0, coin: COIN_1, owned: true, grade: 'VF' },
          { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: 'AU' },
          { id: 'slot-3', position: 2, coin: COIN_3, owned: false, grade: null },
        ],
      };
    }

    it('sets grade to null on the slot that becomes un-owned, leaving other grades alone', () => {
      const result = applyOwnershipToGaps(gradedGaps(), 'coin-1', false);

      expect(result.slots[0].owned).toBe(false);
      expect(result.slots[0].grade).toBeNull();
      expect(result.slots[1].owned).toBe(true);
      expect(result.slots[1].grade).toBe('AU');
    });

    it('clears a different slot grade for a different coin', () => {
      const result = applyOwnershipToGaps(gradedGaps(), 'coin-2', false);

      expect(result.slots[1].grade).toBeNull();
      expect(result.slots[0].grade).toBe('VF');
    });

    it('does not invent a grade when a slot becomes owned', () => {
      const result = applyOwnershipToGaps(gradedGaps(), 'coin-3', true);
      expect(result.slots[2].owned).toBe(true);
      expect(result.slots[2].grade).toBeNull();
    });

    it('with minGrade null adds no upgrade keys when un-owning', () => {
      const result = applyOwnershipToGaps(gradedGaps(), 'coin-1', false);
      expect(result.slots[0]).not.toHaveProperty('needsUpgrade');
      expect(result).not.toHaveProperty('upgradeCount');
    });

    it('with a minGrade, an un-owned slot no longer needs an upgrade and upgradeCount is recomputed', () => {
      const gaps: GapViewResponse = {
        ...gradedGaps(),
        minGrade: 'XF',
        upgradeCount: 1,
        slots: [
          { id: 'slot-1', position: 0, coin: COIN_1, owned: true, grade: 'VF', needsUpgrade: true },
          { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: 'AU', needsUpgrade: false },
          { id: 'slot-3', position: 2, coin: COIN_3, owned: false, grade: null, needsUpgrade: false },
        ],
      };
      const result = applyOwnershipToGaps(gaps, 'coin-1', false);

      expect(result.slots[0].grade).toBeNull();
      expect(result.slots[0].needsUpgrade).toBe(false);
      expect(result.slots[1].needsUpgrade).toBe(false);
      expect(result.upgradeCount).toBe(0);
    });
  });
});

describe('applyGradeToGaps', () => {
  function gradedGaps(): GapViewResponse {
    return {
      setId: 'set-1',
      ownedCount: 2,
      totalCount: 3,
      completionPercent: 67,
      minGrade: null,
      slots: [
        { id: 'slot-1', position: 0, coin: COIN_1, owned: true, grade: 'F' },
        { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: null },
        { id: 'slot-3', position: 2, coin: COIN_3, owned: false, grade: null },
      ],
    };
  }

  function gapsWithMin(): GapViewResponse {
    return {
      setId: 'set-1',
      ownedCount: 2,
      totalCount: 3,
      completionPercent: 67,
      minGrade: 'VF',
      upgradeCount: 1,
      slots: [
        { id: 'slot-1', position: 0, coin: COIN_1, owned: true, grade: 'F', needsUpgrade: true },
        { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: 'XF', needsUpgrade: false },
        { id: 'slot-3', position: 2, coin: COIN_3, owned: false, grade: null, needsUpgrade: false },
      ],
    };
  }

  it('sets the grade on the owned slot of that coin only', () => {
    const result = applyGradeToGaps(gradedGaps(), 'coin-1', 'XF');

    expect(result.slots.map((s) => s.grade)).toEqual(['XF', null, null]);
  });

  it('sets a different grade on a different coin', () => {
    const result = applyGradeToGaps(gradedGaps(), 'coin-2', 'UNC');

    expect(result.slots.map((s) => s.grade)).toEqual(['F', 'UNC', null]);
  });

  it('can clear a grade with null', () => {
    const result = applyGradeToGaps(gradedGaps(), 'coin-1', null);

    expect(result.slots[0].grade).toBeNull();
    expect(result.slots[0].owned).toBe(true);
  });

  it('leaves slots with owned false alone', () => {
    const gaps = gradedGaps();
    const result = applyGradeToGaps(gaps, 'coin-3', 'VF');

    expect(result.slots[2]).toEqual(gaps.slots[2]);
    expect(result.slots[2].grade).toBeNull();
    expect(result).toBe(gaps);
  });

  it('updates every owned slot that holds the coin', () => {
    const gaps: GapViewResponse = {
      ...gradedGaps(),
      slots: [
        { id: 'slot-1', position: 0, coin: COIN_1, owned: true, grade: null },
        { id: 'slot-2', position: 1, coin: COIN_2, owned: true, grade: null },
        { id: 'slot-3', position: 2, coin: COIN_1, owned: true, grade: 'G' },
      ],
    };
    const result = applyGradeToGaps(gaps, 'coin-1', 'AU');

    expect(result.slots.map((s) => s.grade)).toEqual(['AU', null, 'AU']);
  });

  it('never touches ownedCount, totalCount or completionPercent', () => {
    const before = gradedGaps();
    const result = applyGradeToGaps(before, 'coin-1', 'UNC');

    expect(result.ownedCount).toBe(before.ownedCount);
    expect(result.totalCount).toBe(before.totalCount);
    expect(result.completionPercent).toBe(before.completionPercent);
    expect(result.setId).toBe('set-1');
    expect(result.slots[1]).toBe(before.slots[1]);
  });

  it('returns the same reference when the coin is not in the set', () => {
    const gaps = gradedGaps();
    expect(applyGradeToGaps(gaps, 'coin-unknown', 'VF')).toBe(gaps);
  });

  it('returns the same reference when the owned slot already has that grade', () => {
    const gaps = gradedGaps();
    expect(applyGradeToGaps(gaps, 'coin-1', 'F')).toBe(gaps);
    expect(applyGradeToGaps(gaps, 'coin-2', null)).toBe(gaps);
  });

  it('returns the same reference for an empty set', () => {
    const empty: GapViewResponse = {
      setId: 'set-0',
      ownedCount: 0,
      totalCount: 0,
      completionPercent: 0,
      minGrade: null,
      slots: [],
    };
    expect(applyGradeToGaps(empty, 'coin-1', 'VF')).toBe(empty);
  });

  it('with minGrade null adds neither needsUpgrade nor upgradeCount', () => {
    const result = applyGradeToGaps(gradedGaps(), 'coin-1', 'XF');

    expect(result.slots[0]).not.toHaveProperty('needsUpgrade');
    expect(result).not.toHaveProperty('upgradeCount');
  });

  it('with a minGrade, an upgrade below the minimum keeps needsUpgrade true', () => {
    const result = applyGradeToGaps(gapsWithMin(), 'coin-1', 'VG');

    expect(result.slots[0].grade).toBe('VG');
    expect(result.slots[0].needsUpgrade).toBe(true);
    expect(result.upgradeCount).toBe(1);
  });

  it('with a minGrade, reaching the minimum clears needsUpgrade and recomputes upgradeCount', () => {
    const result = applyGradeToGaps(gapsWithMin(), 'coin-1', 'VF');

    expect(result.slots[0].needsUpgrade).toBe(false);
    expect(result.upgradeCount).toBe(0);
  });

  it('with a minGrade, dropping below the minimum sets needsUpgrade and raises upgradeCount', () => {
    const result = applyGradeToGaps(gapsWithMin(), 'coin-2', 'G');

    expect(result.slots[1].grade).toBe('G');
    expect(result.slots[1].needsUpgrade).toBe(true);
    expect(result.slots[0].needsUpgrade).toBe(true);
    expect(result.upgradeCount).toBe(2);
  });

  it('with a minGrade, counts and completion are still untouched', () => {
    const before = gapsWithMin();
    const result = applyGradeToGaps(before, 'coin-1', 'UNC');

    expect(result.ownedCount).toBe(before.ownedCount);
    expect(result.totalCount).toBe(before.totalCount);
    expect(result.completionPercent).toBe(before.completionPercent);
    expect(result.minGrade).toBe('VF');
  });

  it('does not mutate its input', () => {
    const gaps = gapsWithMin();
    const snapshot = JSON.stringify(gaps);
    applyGradeToGaps(gaps, 'coin-1', 'UNC');
    applyGradeToGaps(gaps, 'coin-2', null);
    expect(JSON.stringify(gaps)).toBe(snapshot);
  });
});

describe('applyOwnershipToCollection', () => {
  const OWNED_AT = new Date('2026-10-17T10:00:00.000Z');
  const EARLIER = new Date('2026-01-02T00:00:00.000Z');
  const items: OwnershipItem[] = [
    { coinId: 'coin-2', coin: COIN_2, ownedAt: EARLIER, grade: null },
    { coinId: 'coin-3', coin: COIN_3, ownedAt: EARLIER, grade: null },
  ];

  it('prepends a newly owned coin that matches empty filters (the API orders by ownedAt desc)', () => {
    const result = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, {}, OWNED_AT);

    expect(result.map((i) => i.coinId)).toEqual(['coin-1', 'coin-2', 'coin-3']);
    expect(result[0]).toEqual({ coinId: 'coin-1', coin: COIN_1, ownedAt: OWNED_AT, grade: null });
  });

  it('prepends the new row ungraded even when the existing rows carry grades', () => {
    const graded: OwnershipItem[] = [
      { coinId: 'coin-2', coin: COIN_2, ownedAt: EARLIER, grade: 'XF' },
      { coinId: 'coin-3', coin: COIN_3, ownedAt: EARLIER, grade: 'G' },
    ];
    const result = applyOwnershipToCollection(graded, 'coin-1', true, COIN_1, {}, OWNED_AT);

    expect(result[0].grade).toBeNull();
    expect(result.slice(1).map((i) => i.grade)).toEqual(['XF', 'G']);
  });

  it('treats an undefined or empty-string filter value as matching everything', () => {
    expect(applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { country: undefined }, OWNED_AT)).toHaveLength(3);
    expect(applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { country: '' }, OWNED_AT)).toHaveLength(3);
    expect(applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { year: undefined }, OWNED_AT)).toHaveLength(3);
  });

  it('inserts when the coin matches the country filter and skips it when it does not', () => {
    const match = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { country: 'USA' }, OWNED_AT);
    expect(match.map((i) => i.coinId)).toEqual(['coin-1', 'coin-2', 'coin-3']);

    const miss = applyOwnershipToCollection(items, 'coin-ca', true, CANADA_COIN, { country: 'USA' }, OWNED_AT);
    expect(miss).toEqual(items);
    expect(miss.map((i) => i.coinId)).not.toContain('coin-ca');
  });

  it('inserts when the coin matches the exact year filter and skips it when it does not', () => {
    const match = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { year: 1909 }, OWNED_AT);
    expect(match.map((i) => i.coinId)).toEqual(['coin-1', 'coin-2', 'coin-3']);

    const miss = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { year: 1910 }, OWNED_AT);
    expect(miss.map((i) => i.coinId)).toEqual(['coin-2', 'coin-3']);
  });

  it('needs both filters to match', () => {
    const miss = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { country: 'USA', year: 1910 }, OWNED_AT);
    expect(miss.map((i) => i.coinId)).toEqual(['coin-2', 'coin-3']);
    const hit = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, { country: 'USA', year: 1909 }, OWNED_AT);
    expect(hit.map((i) => i.coinId)).toEqual(['coin-1', 'coin-2', 'coin-3']);
  });

  it('does not duplicate a coin that is already in the list', () => {
    const result = applyOwnershipToCollection(items, 'coin-2', true, COIN_2, {}, OWNED_AT);
    expect(result.map((i) => i.coinId)).toEqual(['coin-2', 'coin-3']);
    expect(result).toEqual(items);
  });

  it('leaves the list unchanged when owned but no coin is known', () => {
    const result = applyOwnershipToCollection(items, 'coin-1', true, null, {}, OWNED_AT);
    expect(result).toEqual(items);
  });

  it('removes the item when owned is false, and keeps the others in order', () => {
    const result = applyOwnershipToCollection(items, 'coin-2', false, COIN_2, {}, OWNED_AT);
    expect(result.map((i) => i.coinId)).toEqual(['coin-3']);

    const other = applyOwnershipToCollection(items, 'coin-3', false, null, {}, OWNED_AT);
    expect(other.map((i) => i.coinId)).toEqual(['coin-2']);
  });

  it('removes regardless of the filters', () => {
    const result = applyOwnershipToCollection(items, 'coin-2', false, null, { country: 'Canada' }, OWNED_AT);
    expect(result.map((i) => i.coinId)).toEqual(['coin-3']);
  });

  it('returns the same reference when removing a coin that is not in the list', () => {
    expect(applyOwnershipToCollection(items, 'coin-unknown', false, null, {}, OWNED_AT)).toBe(items);
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(items);
    applyOwnershipToCollection(items, 'coin-1', true, COIN_1, {}, OWNED_AT);
    applyOwnershipToCollection(items, 'coin-2', false, null, {}, OWNED_AT);
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});

describe('applyGradeToCollection', () => {
  const EARLIER = new Date('2026-01-02T00:00:00.000Z');
  const ITEM_2: OwnershipItem = { coinId: 'coin-2', coin: COIN_2, ownedAt: EARLIER, grade: null };
  const ITEM_3: OwnershipItem = { coinId: 'coin-3', coin: COIN_3, ownedAt: EARLIER, grade: 'G' };
  const items: OwnershipItem[] = [ITEM_2, ITEM_3];

  it('sets the grade on the matching item and keeps the others by reference', () => {
    const result = applyGradeToCollection(items, 'coin-2', 'VF');

    expect(result).not.toBe(items);
    expect(result[0]).toEqual({ ...ITEM_2, grade: 'VF' });
    expect(result[1]).toBe(ITEM_3);
  });

  it('sets a different grade on a different item', () => {
    const result = applyGradeToCollection(items, 'coin-3', 'UNC');

    expect(result[0]).toBe(ITEM_2);
    expect(result[1].grade).toBe('UNC');
    expect(result.map((i) => i.coinId)).toEqual(['coin-2', 'coin-3']);
  });

  it('can clear a grade with null', () => {
    const result = applyGradeToCollection(items, 'coin-3', null);

    expect(result[1].grade).toBeNull();
    expect(result[1].coinId).toBe('coin-3');
  });

  it('returns the same reference when the coin is not listed', () => {
    expect(applyGradeToCollection(items, 'coin-unknown', 'VF')).toBe(items);
  });

  it('returns the same reference when the item already has that grade', () => {
    expect(applyGradeToCollection(items, 'coin-3', 'G')).toBe(items);
    expect(applyGradeToCollection(items, 'coin-2', null)).toBe(items);
  });

  it('returns the same reference for an empty list', () => {
    const empty: OwnershipItem[] = [];
    expect(applyGradeToCollection(empty, 'coin-1', 'VF')).toBe(empty);
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(items);
    applyGradeToCollection(items, 'coin-2', 'AU');
    applyGradeToCollection(items, 'coin-3', null);
    expect(JSON.stringify(items)).toBe(snapshot);
    expect(items[0]).toBe(ITEM_2);
    expect(ITEM_2.grade).toBeNull();
  });
});

describe('applyOwnershipToCatalogPage', () => {
  const page: PaginatedResponse<CatalogCoin> = { items: [COIN_1, COIN_2, COIN_3], page: 2, limit: 20, total: 45 };

  it('removes the coin and decrements the total when hideOwned is on and the coin became owned', () => {
    const result = applyOwnershipToCatalogPage(page, 'coin-2', true, { hideOwned: true });

    expect(result.items.map((c) => c.id)).toEqual(['coin-1', 'coin-3']);
    expect(result.total).toBe(44);
    expect(result.page).toBe(2);
    expect(result.limit).toBe(20);
  });

  it('removes a different coin and decrements from a different total', () => {
    const small: PaginatedResponse<CatalogCoin> = { items: [COIN_1, COIN_2], page: 1, limit: 20, total: 2 };
    const result = applyOwnershipToCatalogPage(small, 'coin-1', true, { hideOwned: true });

    expect(result.items.map((c) => c.id)).toEqual(['coin-2']);
    expect(result.total).toBe(1);
  });

  it('is unchanged when hideOwned is off', () => {
    expect(applyOwnershipToCatalogPage(page, 'coin-2', true, { hideOwned: false })).toBe(page);
    expect(applyOwnershipToCatalogPage(page, 'coin-2', true, {})).toBe(page);
  });

  it('is unchanged when the coin became missing, even with hideOwned on', () => {
    expect(applyOwnershipToCatalogPage(page, 'coin-2', false, { hideOwned: true })).toBe(page);
  });

  it('does not mutate its input', () => {
    const snapshot = JSON.stringify(page);
    applyOwnershipToCatalogPage(page, 'coin-2', true, { hideOwned: true });
    expect(JSON.stringify(page)).toBe(snapshot);
  });

  describe('owned patching on signed-in catalog pages (run_20261019_221037 criterion #11)', () => {
    const L1: CatalogListItem = { ...COIN_1, owned: false, inSetsCount: 2 };
    const L2: CatalogListItem = { ...COIN_2, owned: true, inSetsCount: 0 };
    const L3: CatalogListItem = { ...COIN_3, owned: false, inSetsCount: 1 };
    const listPage: PaginatedResponse<CatalogListItem> = { items: [L1, L2, L3], page: 2, limit: 20, total: 45 };

    it('false to true: returns a new page with only that item updated, others identical by reference, same total', () => {
      const result = applyOwnershipToCatalogPage(listPage, 'coin-1', true, {});

      expect(result).not.toBe(listPage);
      expect(result.items[0].owned).toBe(true);
      expect(result.items[0].id).toBe('coin-1');
      expect(result.items[1]).toBe(L2);
      expect(result.items[2]).toBe(L3);
      expect(result.total).toBe(45);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
    });

    it('true to false: the reverse patch on a different item', () => {
      const result = applyOwnershipToCatalogPage(listPage, 'coin-2', false, {});

      expect(result).not.toBe(listPage);
      expect(result.items[1].owned).toBe(false);
      expect(result.items[0]).toBe(L1);
      expect(result.items[2]).toBe(L3);
      expect(result.total).toBe(45);
    });

    it('preserves inSetsCount and the other coin fields on the patched item', () => {
      const result = applyOwnershipToCatalogPage(listPage, 'coin-1', true, {});

      expect(result.items[0]).toEqual({ ...L1, owned: true });
      expect(result.items[0].inSetsCount).toBe(2);
    });

    it('returns the same reference when the item already has the requested owned value', () => {
      expect(applyOwnershipToCatalogPage(listPage, 'coin-2', true, {})).toBe(listPage);
      expect(applyOwnershipToCatalogPage(listPage, 'coin-1', false, {})).toBe(listPage);
    });

    it('returns the same reference when the coin is not on the page', () => {
      expect(applyOwnershipToCatalogPage(listPage, 'coin-unknown', true, {})).toBe(listPage);
    });

    it('returns the same reference for an item without an owned key (signed-out page)', () => {
      const signedOut: PaginatedResponse<CatalogListItem> = { items: [COIN_1, COIN_2], page: 1, limit: 20, total: 2 };

      expect(applyOwnershipToCatalogPage(signedOut, 'coin-1', true, {})).toBe(signedOut);
    });

    it('patches only the item that has an owned key when others on the page lack it', () => {
      const mixed: PaginatedResponse<CatalogListItem> = { items: [COIN_1, L2], page: 1, limit: 20, total: 2 };
      const result = applyOwnershipToCatalogPage(mixed, 'coin-2', false, {});

      expect(result.items[0]).toBe(COIN_1);
      expect(result.items[1].owned).toBe(false);
    });

    it('hideOwned and now owned still removes the coin and decrements the total', () => {
      const result = applyOwnershipToCatalogPage(listPage, 'coin-1', true, { hideOwned: true });

      expect(result.items.map((c) => c.id)).toEqual(['coin-2', 'coin-3']);
      expect(result.total).toBe(44);
    });

    it('hideOwned and now missing patches owned instead of removing', () => {
      const result = applyOwnershipToCatalogPage(listPage, 'coin-2', false, { hideOwned: true });

      expect(result.items.map((c) => c.id)).toEqual(['coin-1', 'coin-2', 'coin-3']);
      expect(result.items[1].owned).toBe(false);
      expect(result.total).toBe(45);
    });

    it('does not mutate its input', () => {
      const snapshot = JSON.stringify(listPage);
      applyOwnershipToCatalogPage(listPage, 'coin-1', true, {});
      applyOwnershipToCatalogPage(listPage, 'coin-2', false, {});

      expect(JSON.stringify(listPage)).toBe(snapshot);
      expect(listPage.items[0]).toBe(L1);
      expect(L1.owned).toBe(false);
    });
  });
});

describe('isCatalogListKey', () => {
  it('is true for the useCatalog list keys (a plain filters object)', () => {
    expect(isCatalogListKey(['catalog', { hideOwned: true }])).toBe(true);
    expect(isCatalogListKey(['catalog', { country: 'USA', page: 2 }])).toBe(true);
    expect(isCatalogListKey(['catalog', {}])).toBe(true);
  });

  it('is false for a single coin, the facets and my submissions', () => {
    expect(isCatalogListKey(['catalog', 'coin', 'coin-1'])).toBe(false);
    expect(isCatalogListKey(['catalog', 'facets', 'USA'])).toBe(false);
    expect(isCatalogListKey(['catalog', 'mine'])).toBe(false);
  });

  it('is false for other roots and for a bare or malformed catalog key', () => {
    expect(isCatalogListKey(['collection', {}])).toBe(false);
    expect(isCatalogListKey(['user-sets', 'set-1', 'gaps'])).toBe(false);
    expect(isCatalogListKey(['catalog'])).toBe(false);
    expect(isCatalogListKey(['catalog', null])).toBe(false);
    expect(isCatalogListKey(['catalog', ['a']])).toBe(false);
  });
});
