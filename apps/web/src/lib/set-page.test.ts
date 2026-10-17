/**
 * Tests for: set-page (pure helpers)
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Pure module: set-page.ts
 * Covers criteria: #2, #5, #12, #13
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin, GapSlot, GapViewResponse } from '@coin-collector/shared';
import { buildYearGroups, getSetKind, getSetSharedParts, removeCoinsFromGaps } from '@/lib/set-page';

function makeSlot(
  id: string,
  position: number,
  over: Partial<CatalogCoin> & { owned?: boolean } = {},
): GapSlot {
  const { owned = false, ...coinOver } = over;
  return {
    id: `usc-${id}`,
    position,
    owned,
    coin: {
      id: `coin-${id}`,
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
      ...coinOver,
    },
  };
}

function makeGaps(slots: GapSlot[]): GapViewResponse {
  const ownedCount = slots.filter((s) => s.owned).length;
  return {
    setId: 'set-1',
    ownedCount,
    totalCount: slots.length,
    completionPercent: slots.length === 0 ? 0 : Math.round((ownedCount / slots.length) * 100),
    slots,
  };
}

describe('buildYearGroups', () => {
  it('groups by coin year, years ascending, whatever the input order', () => {
    const slots = [
      makeSlot('c', 2, { year: 2026 }),
      makeSlot('a', 0, { year: 2024 }),
      makeSlot('b', 1, { year: 2025 }),
    ];

    expect(buildYearGroups(slots).map((g) => g.year)).toEqual([2024, 2025, 2026]);
  });

  it('orders slots inside a group by position ascending', () => {
    const slots = [
      makeSlot('x3', 5, { year: 2025 }),
      makeSlot('x1', 1, { year: 2025 }),
      makeSlot('x2', 3, { year: 2025 }),
    ];

    const [group] = buildYearGroups(slots);

    expect(group.slots.map((s) => s.coin.id)).toEqual(['coin-x1', 'coin-x2', 'coin-x3']);
  });

  it('counts owned and total over every slot of the year', () => {
    const slots = [
      makeSlot('a', 0, { year: 2025, owned: true }),
      makeSlot('b', 1, { year: 2025, owned: false }),
      makeSlot('c', 2, { year: 2025, owned: true }),
      makeSlot('d', 3, { year: 2026, owned: false }),
    ];

    const groups = buildYearGroups(slots);

    expect(groups[0]).toMatchObject({ year: 2025, ownedCount: 2, totalCount: 3 });
    expect(groups[1]).toMatchObject({ year: 2026, ownedCount: 0, totalCount: 1 });
  });

  it('lists the missing coin ids of the year in position order as markableCoinIds', () => {
    const slots = [
      makeSlot('b', 2, { year: 2025, owned: false }),
      makeSlot('a', 0, { year: 2025, owned: true }),
      makeSlot('c', 1, { year: 2025, owned: false }),
    ];

    const [group] = buildYearGroups(slots);

    expect(group.markableCoinIds).toEqual(['coin-c', 'coin-b']);
  });

  it('leaves markableCoinIds empty when the year is fully owned', () => {
    const [group] = buildYearGroups([makeSlot('a', 0, { owned: true }), makeSlot('b', 1, { owned: true })]);
    expect(group.markableCoinIds).toEqual([]);
  });

  it('excludes busy coins from markableCoinIds but keeps them in the counts and slots', () => {
    const slots = [
      makeSlot('a', 0, { owned: false }),
      makeSlot('b', 1, { owned: false }),
      makeSlot('c', 2, { owned: false }),
    ];

    const [group] = buildYearGroups(slots, { busyCoinIds: new Set(['coin-b']) });

    expect(group.markableCoinIds).toEqual(['coin-a', 'coin-c']);
    expect(group.slots).toHaveLength(3);
    expect(group.totalCount).toBe(3);
  });

  it('with missingOnly shows only missing slots, but counts stay whole-year', () => {
    const slots = [
      makeSlot('a', 0, { owned: true }),
      makeSlot('b', 1, { owned: false }),
      makeSlot('c', 2, { owned: true }),
    ];

    const [group] = buildYearGroups(slots, { missingOnly: true });

    expect(group.slots.map((s) => s.coin.id)).toEqual(['coin-b']);
    expect(group.ownedCount).toBe(2);
    expect(group.totalCount).toBe(3);
  });

  it('with missingOnly keeps an owned slot visible while it is busy (pending or failed)', () => {
    const slots = [makeSlot('a', 0, { owned: true }), makeSlot('b', 1, { owned: true })];

    const [group] = buildYearGroups(slots, { missingOnly: true, busyCoinIds: new Set(['coin-b']) });

    expect(group.slots.map((s) => s.coin.id)).toEqual(['coin-b']);
  });

  it('drops groups with no visible slots under missingOnly', () => {
    const slots = [
      makeSlot('a', 0, { year: 2025, owned: true }),
      makeSlot('b', 1, { year: 2026, owned: false }),
    ];

    expect(buildYearGroups(slots, { missingOnly: true }).map((g) => g.year)).toEqual([2026]);
    expect(buildYearGroups(slots).map((g) => g.year)).toEqual([2025, 2026]);
  });

  it('returns no groups for a fully owned set under missingOnly, and none for no slots', () => {
    expect(buildYearGroups([makeSlot('a', 0, { owned: true })], { missingOnly: true })).toEqual([]);
    expect(buildYearGroups([])).toEqual([]);
  });

  it('does not mutate its input', () => {
    const slots = [makeSlot('b', 1, { year: 2026 }), makeSlot('a', 0, { year: 2025 })];
    const snapshot = slots.map((s) => s.id);

    buildYearGroups(slots, { missingOnly: true });

    expect(slots.map((s) => s.id)).toEqual(snapshot);
  });
});

describe('getSetKind', () => {
  it("is 'curated' when clonedFromCanonicalId is set", () => {
    expect(getSetKind({ clonedFromCanonicalId: 'canon-1', clonedFromUserSetId: null })).toBe('curated');
  });

  it("is 'copied' when only clonedFromUserSetId is set", () => {
    expect(getSetKind({ clonedFromCanonicalId: null, clonedFromUserSetId: 'set-9' })).toBe('copied');
  });

  it("is 'own' when neither is set", () => {
    expect(getSetKind({ clonedFromCanonicalId: null, clonedFromUserSetId: null })).toBe('own');
  });

  it("gives 'curated' priority when both are set", () => {
    expect(getSetKind({ clonedFromCanonicalId: 'canon-1', clonedFromUserSetId: 'set-9' })).toBe('curated');
  });
});

describe('getSetSharedParts', () => {
  it('returns the shared country and denomination and a year range with an en dash', () => {
    const slots = [makeSlot('a', 0, { year: 2025 }), makeSlot('b', 1, { year: 2026 })];

    expect(getSetSharedParts(slots)).toEqual({
      country: 'Ukraine',
      denomination: '10 Hryvnias',
      years: '2025–2026',
    });
  });

  it('returns a single year when every slot has the same year', () => {
    const slots = [makeSlot('a', 0, { year: 2025 }), makeSlot('b', 1, { year: 2025 })];
    expect(getSetSharedParts(slots).years).toBe('2025');
  });

  it('uses the min and max year of an unordered set', () => {
    const slots = [makeSlot('a', 0, { year: 2027 }), makeSlot('b', 1, { year: 2024 }), makeSlot('c', 2, { year: 2026 })];
    expect(getSetSharedParts(slots).years).toBe('2024–2027');
  });

  it('returns null for a country that differs between slots, keeping the shared denomination', () => {
    const slots = [makeSlot('a', 0, { country: 'Ukraine' }), makeSlot('b', 1, { country: 'Poland' })];

    const parts = getSetSharedParts(slots);

    expect(parts.country).toBeNull();
    expect(parts.denomination).toBe('10 Hryvnias');
  });

  it('returns null for a denomination that differs, keeping the shared country', () => {
    const slots = [makeSlot('a', 0, { denomination: '1 Cent' }), makeSlot('b', 1, { denomination: '5 Cents' })];

    const parts = getSetSharedParts(slots);

    expect(parts.denomination).toBeNull();
    expect(parts.country).toBe('Ukraine');
  });

  it('returns all null for no slots', () => {
    expect(getSetSharedParts([])).toEqual({ country: null, denomination: null, years: null });
  });
});

describe('removeCoinsFromGaps', () => {
  it('drops the matching slots and recounts owned, total and percent', () => {
    const gaps = makeGaps([
      makeSlot('a', 0, { owned: true }),
      makeSlot('b', 1, { owned: false }),
      makeSlot('c', 2, { owned: false }),
    ]);

    const next = removeCoinsFromGaps(gaps, ['coin-b']);

    expect(next.slots.map((s) => s.coin.id)).toEqual(['coin-a', 'coin-c']);
    expect(next.totalCount).toBe(2);
    expect(next.ownedCount).toBe(1);
    expect(next.completionPercent).toBe(50);
  });

  it('recounts differently when an owned coin is removed', () => {
    const gaps = makeGaps([
      makeSlot('a', 0, { owned: true }),
      makeSlot('b', 1, { owned: false }),
      makeSlot('c', 2, { owned: false }),
    ]);

    const next = removeCoinsFromGaps(gaps, ['coin-a']);

    expect(next.ownedCount).toBe(0);
    expect(next.totalCount).toBe(2);
    expect(next.completionPercent).toBe(0);
  });

  it('rounds the percentage like the API', () => {
    const gaps = makeGaps([
      makeSlot('a', 0, { owned: true }),
      makeSlot('b', 1, { owned: true }),
      makeSlot('c', 2, { owned: false }),
      makeSlot('d', 3, { owned: false }),
    ]);

    // 2 of 3 owned = 66.67 -> 67
    expect(removeCoinsFromGaps(gaps, ['coin-d']).completionPercent).toBe(67);
  });

  it('removes several coins at once', () => {
    const gaps = makeGaps([makeSlot('a', 0), makeSlot('b', 1), makeSlot('c', 2)]);
    expect(removeCoinsFromGaps(gaps, ['coin-a', 'coin-c']).slots.map((s) => s.coin.id)).toEqual(['coin-b']);
  });

  it('returns the same reference when nothing matched', () => {
    const gaps = makeGaps([makeSlot('a', 0), makeSlot('b', 1)]);
    expect(removeCoinsFromGaps(gaps, ['coin-zzz'])).toBe(gaps);
    expect(removeCoinsFromGaps(gaps, [])).toBe(gaps);
  });

  it('does not mutate the input', () => {
    const gaps = makeGaps([makeSlot('a', 0), makeSlot('b', 1)]);
    removeCoinsFromGaps(gaps, ['coin-a']);
    expect(gaps.slots).toHaveLength(2);
    expect(gaps.totalCount).toBe(2);
  });

  it('empties the slots when every coin is removed', () => {
    const gaps = makeGaps([makeSlot('a', 0, { owned: true })]);
    const next = removeCoinsFromGaps(gaps, ['coin-a']);
    expect(next.slots).toEqual([]);
    expect(next.totalCount).toBe(0);
    expect(next.ownedCount).toBe(0);
  });
});
