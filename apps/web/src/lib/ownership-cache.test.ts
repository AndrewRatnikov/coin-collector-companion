/**
 * Tests for: ownership-cache (pure optimistic cache patchers)
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Module: ownership-cache
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin, GapViewResponse, OwnershipItem, PaginatedResponse } from '@coin-collector/shared';
import {
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
    slots: [
      { id: 'slot-1', position: 0, coin: COIN_1, owned: false },
      { id: 'slot-2', position: 1, coin: COIN_2, owned: true },
      { id: 'slot-3', position: 2, coin: COIN_3, owned: false },
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
        { id: 'slot-1', position: 0, coin: COIN_1, owned: false },
        { id: 'slot-2', position: 1, coin: COIN_2, owned: false },
        { id: 'slot-3', position: 2, coin: COIN_1, owned: false },
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
    const empty: GapViewResponse = { setId: 'set-0', ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] };
    expect(applyOwnershipToGaps(empty, 'coin-1', true)).toBe(empty);
  });

  it('does not mutate its input', () => {
    const gaps = makeGaps();
    const snapshot = JSON.stringify(gaps);
    applyOwnershipToGaps(gaps, 'coin-1', true);
    expect(JSON.stringify(gaps)).toBe(snapshot);
  });
});

describe('applyOwnershipToCollection', () => {
  const OWNED_AT = new Date('2026-10-17T10:00:00.000Z');
  const EARLIER = new Date('2026-01-02T00:00:00.000Z');
  const items: OwnershipItem[] = [
    { coinId: 'coin-2', coin: COIN_2, ownedAt: EARLIER },
    { coinId: 'coin-3', coin: COIN_3, ownedAt: EARLIER },
  ];

  it('prepends a newly owned coin that matches empty filters (the API orders by ownedAt desc)', () => {
    const result = applyOwnershipToCollection(items, 'coin-1', true, COIN_1, {}, OWNED_AT);

    expect(result.map((i) => i.coinId)).toEqual(['coin-1', 'coin-2', 'coin-3']);
    expect(result[0]).toEqual({ coinId: 'coin-1', coin: COIN_1, ownedAt: OWNED_AT });
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
