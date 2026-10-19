/**
 * Tests for: coin-page helpers
 * Contract source: runs/run_20261019_205931/plan.md § Interface Contract → Module: coin-page helpers
 * Covers criteria: #1 (country href), #6 (panel state), #9 (set rows), #12 (spec rows)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import type { GapViewResponse } from '@coin-collector/shared';
import {
  COIN_SPEC_KEYS,
  catalogCountryHref,
  getCoinSetRows,
  getCoinSpecRows,
  getOwnershipPanelState,
} from '@/lib/coin-page';

const FULL = {
  diameterMm: 19.05,
  weightG: 3.11,
  thicknessMm: null,
  material: 'Bronze',
  mintage: 484000,
  mintMark: 'S',
};

function gap(setId: string, coinIds: string[], owned: number, total: number, percent: number): GapViewResponse {
  return {
    setId,
    ownedCount: owned,
    totalCount: total,
    completionPercent: percent,
    slots: coinIds.map((id, i) => ({ id: `${setId}-slot-${i}`, position: i, coin: { id } as never, owned: false })),
  };
}

describe('COIN_SPEC_KEYS', () => {
  it('lists the six spec keys in display order', () => {
    expect([...COIN_SPEC_KEYS]).toEqual(['diameter', 'weight', 'thickness', 'material', 'mintage', 'mintMark']);
  });
});

describe('getCoinSpecRows', () => {
  it('always returns six rows in order, with formatted values and null for unknown', () => {
    const rows = getCoinSpecRows(FULL, 'en');
    expect(rows.map((r) => r.key)).toEqual(['diameter', 'weight', 'thickness', 'material', 'mintage', 'mintMark']);
    expect(rows.map((r) => r.value)).toEqual(['19.05 mm', '3.11 g', null, 'Bronze', '484,000', 'S']);
  });

  it('formats different inputs differently', () => {
    const rows = getCoinSpecRows(
      { diameterMm: 24.3, weightG: 5, thicknessMm: 1.75, material: 'Nickel', mintage: 1234567, mintMark: 'D' },
      'en',
    );
    expect(rows.map((r) => r.value)).toEqual(['24.3 mm', '5 g', '1.75 mm', 'Nickel', '1,234,567', 'D']);
  });

  it('returns six null values when nothing is recorded', () => {
    const rows = getCoinSpecRows(
      { diameterMm: null, weightG: null, thicknessMm: null, material: null, mintage: null, mintMark: '' },
      'en',
    );
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.value === null)).toBe(true);
  });

  it('treats an empty material and an empty mint mark as null', () => {
    const rows = getCoinSpecRows({ ...FULL, material: '', mintMark: '' }, 'en');
    expect(rows[3].value).toBeNull();
    expect(rows[5].value).toBeNull();
  });
});

describe('getCoinSetRows', () => {
  const sets = [
    { id: 'set-a', name: 'Wheat Cents' },
    { id: 'set-b', name: 'Key Dates' },
    { id: 'set-c', name: 'Loading One' },
  ];

  it('marks containment and copies counts from the gaps, index aligned', () => {
    const rows = getCoinSetRows(
      sets,
      [gap('set-a', ['coin-1', 'x'], 2, 7, 29), gap('set-b', ['y'], 5, 10, 50), undefined],
      'coin-1',
    );
    expect(rows).toEqual([
      { id: 'set-a', name: 'Wheat Cents', loaded: true, containsCoin: true, ownedCount: 2, totalCount: 7, percent: 29 },
      { id: 'set-b', name: 'Key Dates', loaded: true, containsCoin: false, ownedCount: 5, totalCount: 10, percent: 50 },
      { id: 'set-c', name: 'Loading One', loaded: false, containsCoin: false, ownedCount: 0, totalCount: 0, percent: 0 },
    ]);
  });

  it('depends on the coin id', () => {
    const gaps = [gap('set-a', ['coin-1'], 1, 2, 50), gap('set-b', ['coin-2'], 0, 1, 0), undefined];
    expect(getCoinSetRows(sets, gaps, 'coin-2').map((r) => r.containsCoin)).toEqual([false, true, false]);
    expect(getCoinSetRows(sets, gaps, 'coin-1').map((r) => r.containsCoin)).toEqual([true, false, false]);
  });

  it('returns an empty list for no sets', () => {
    expect(getCoinSetRows([], [], 'coin-1')).toEqual([]);
  });
});

describe('catalogCountryHref', () => {
  it('builds a catalog link with the country query param', () => {
    expect(catalogCountryHref('USA')).toBe('/catalog?country=USA');
  });

  it('encodes spaces', () => {
    expect(catalogCountryHref('United States')).toBe('/catalog?country=United+States');
  });
});

describe('getOwnershipPanelState', () => {
  it('maps owned and not owned when idle', () => {
    expect(getOwnershipPanelState({ owned: true, pending: false, failed: false })).toBe('owned');
    expect(getOwnershipPanelState({ owned: false, pending: false, failed: false })).toBe('not-owned');
  });

  it('failed wins over owned', () => {
    expect(getOwnershipPanelState({ owned: true, pending: false, failed: true })).toBe('failed');
    expect(getOwnershipPanelState({ owned: false, pending: false, failed: true })).toBe('failed');
  });

  it('pending wins over failed and owned', () => {
    expect(getOwnershipPanelState({ owned: true, pending: true, failed: true })).toBe('pending');
    expect(getOwnershipPanelState({ owned: false, pending: true, failed: false })).toBe('pending');
  });
});
