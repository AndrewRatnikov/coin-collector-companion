/**
 * Tests for: new-set-preview helpers (PREVIEW_LIMIT, buildCoinPreview, summarizeSourceCoins, formatYearRange)
 * Contract source: runs/run_20261013_062900/plan.md § Interface Contract → Module: apps/web/src/lib/new-set-preview.ts
 * Covers criteria: #10, #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin } from '@coin-collector/shared';
import {
  PREVIEW_LIMIT,
  buildCoinPreview,
  formatYearRange,
  summarizeSourceCoins,
  type SourceCoinItem,
} from '@/lib/new-set-preview';

function makeCoin(id: string, year: number, country = 'Ukraine'): CatalogCoin {
  return {
    id,
    country,
    denomination: '1 Hryvnia',
    year,
    mintMark: '',
    variety: '',
    name: `Coin ${id}`,
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
  };
}

function makeItem(position: number, year: number, country?: string): SourceCoinItem {
  return { position, coin: makeCoin(`coin-${position}`, year, country) };
}

describe('PREVIEW_LIMIT', () => {
  it('is 60', () => {
    expect(PREVIEW_LIMIT).toBe(60);
  });
});

describe('buildCoinPreview', () => {
  it('returns no groups and rest 0 for empty input', () => {
    expect(buildCoinPreview([])).toEqual({ groups: [], rest: 0 });
  });

  it('groups coins by year with groups ordered by year ascending, whatever the position order', () => {
    const items = [makeItem(1, 2005), makeItem(2, 1999), makeItem(3, 2005), makeItem(4, 2010)];

    const preview = buildCoinPreview(items);

    expect(preview.groups.map((g) => g.year)).toEqual([1999, 2005, 2010]);
    expect(preview.rest).toBe(0);
  });

  it('keeps coins inside a year group in position order, even when the input is unsorted', () => {
    const items = [makeItem(30, 2001), makeItem(10, 2001), makeItem(20, 2001)];

    const preview = buildCoinPreview(items);

    expect(preview.groups).toHaveLength(1);
    expect(preview.groups[0].coins.map((c) => c.id)).toEqual(['coin-10', 'coin-20', 'coin-30']);
  });

  it('caps at the default limit of 60 and reports the remainder (187 items give 60 coins and rest 127)', () => {
    const items = Array.from({ length: 187 }, (_, i) => makeItem(i + 1, 1992 + (i % 35)));

    const preview = buildCoinPreview(items);

    const total = preview.groups.reduce((sum, g) => sum + g.coins.length, 0);
    expect(total).toBe(60);
    expect(preview.rest).toBe(127);
  });

  it('takes the first N coins by position, not the first N by year', () => {
    // Position 1 is the newest year; a year-first cut would pick 1990/1991 instead.
    const items = [makeItem(1, 2020), makeItem(2, 2021), makeItem(3, 1990), makeItem(4, 1991)];

    const preview = buildCoinPreview(items, 2);

    expect(preview.groups.map((g) => g.year)).toEqual([2020, 2021]);
    expect(preview.rest).toBe(2);
  });

  it('respects a custom limit, and a different limit gives a different cut', () => {
    const items = Array.from({ length: 10 }, (_, i) => makeItem(i + 1, 2000 + i));

    const small = buildCoinPreview(items, 3);
    const large = buildCoinPreview(items, 7);

    expect(small.groups.reduce((n, g) => n + g.coins.length, 0)).toBe(3);
    expect(small.rest).toBe(7);
    expect(large.groups.reduce((n, g) => n + g.coins.length, 0)).toBe(7);
    expect(large.rest).toBe(3);
  });

  it('has rest 0 when the item count equals the limit, and never goes negative below it', () => {
    const exact = Array.from({ length: 60 }, (_, i) => makeItem(i + 1, 2000));
    const fewer = Array.from({ length: 5 }, (_, i) => makeItem(i + 1, 2000));

    expect(buildCoinPreview(exact).rest).toBe(0);
    expect(buildCoinPreview(fewer).rest).toBe(0);
  });

  it('does not mutate the input array', () => {
    const items = [makeItem(3, 2003), makeItem(1, 2001), makeItem(2, 2002)];
    const snapshot = items.map((i) => i.position);

    buildCoinPreview(items);

    expect(items.map((i) => i.position)).toEqual(snapshot);
  });
});

describe('summarizeSourceCoins', () => {
  it('returns zero count, null years and no countries for empty input', () => {
    expect(summarizeSourceCoins([])).toEqual({
      count: 0,
      minYear: null,
      maxYear: null,
      countries: [],
    });
  });

  it('counts all items and finds min/max year over all of them (not only the first 60)', () => {
    const items = Array.from({ length: 100 }, (_, i) => makeItem(i + 1, 2000));
    items.push(makeItem(101, 1943), makeItem(102, 2026));

    const summary = summarizeSourceCoins(items);

    expect(summary.count).toBe(102);
    expect(summary.minYear).toBe(1943);
    expect(summary.maxYear).toBe(2026);
  });

  it('gives equal min and max for a single-year set, and different values for a different set', () => {
    const one = summarizeSourceCoins([makeItem(1, 1943), makeItem(2, 1943)]);
    const two = summarizeSourceCoins([makeItem(1, 1909), makeItem(2, 1958)]);

    expect([one.minYear, one.maxYear]).toEqual([1943, 1943]);
    expect([two.minYear, two.maxYear]).toEqual([1909, 1958]);
  });

  it('returns distinct countries sorted alphabetically', () => {
    const items = [
      makeItem(1, 2000, 'Ukraine'),
      makeItem(2, 2001, 'Canada'),
      makeItem(3, 2002, 'Ukraine'),
      makeItem(4, 2003, 'Austria'),
    ];

    expect(summarizeSourceCoins(items).countries).toEqual(['Austria', 'Canada', 'Ukraine']);
  });

  it('returns a single country for a one-country set', () => {
    const items = [makeItem(1, 2000, 'USA'), makeItem(2, 2001, 'USA')];

    expect(summarizeSourceCoins(items).countries).toEqual(['USA']);
  });
});

describe('formatYearRange', () => {
  it('formats a span with an en dash and no spaces', () => {
    expect(formatYearRange(2025, 2026)).toBe('2025–2026');
    expect(formatYearRange(1909, 1958)).toBe('1909–1958');
  });

  it('returns a single year when min equals max', () => {
    expect(formatYearRange(1943, 1943)).toBe('1943');
  });

  it('returns an empty string when either value is null', () => {
    expect(formatYearRange(null, null)).toBe('');
    expect(formatYearRange(1943, null)).toBe('');
    expect(formatYearRange(null, 1943)).toBe('');
  });
});
