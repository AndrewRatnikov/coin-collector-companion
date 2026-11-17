/**
 * Tests for: @/lib/landing/landing-data
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Module: landing-data
 * Covers criteria: #13, #17 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { COVERAGE_FALLBACKS, getCoverageCounts, getFullChecklistHref } from '@/lib/landing/landing-data';

const LINCOLN = 'Lincoln Wheat Cents';
const KEY_DATES = 'Lincoln Wheat Cent Key Dates';
const UKRAINE_CIRC = 'Ukraine Circulation Coins';
const UKRAINE_COMM = 'Ukrainian Circulating Commemoratives';

describe('COVERAGE_FALLBACKS', () => {
  it('is 142 / 7 / 187 / 31', () => {
    expect(COVERAGE_FALLBACKS).toEqual({ coins: 142, keyDates: 7, circulation: 187, commemoratives: 31 });
  });
});

describe('getFullChecklistHref', () => {
  it('links to the Lincoln Wheat Cents set by id', () => {
    expect(
      getFullChecklistHref([
        { id: 's1', name: KEY_DATES },
        { id: 's2', name: LINCOLN },
      ]),
    ).toBe('/sets/canonical/s2');
  });

  it('follows the id of the matching set', () => {
    expect(getFullChecklistHref([{ id: 'other-id', name: LINCOLN }])).toBe('/sets/canonical/other-id');
  });

  it('falls back to the list while the data is missing', () => {
    expect(getFullChecklistHref(undefined)).toBe('/sets/canonical');
  });

  it('falls back to the list when nothing matches, including near-miss names', () => {
    expect(getFullChecklistHref([])).toBe('/sets/canonical');
    expect(getFullChecklistHref([{ id: 's1', name: KEY_DATES }])).toBe('/sets/canonical');
    expect(getFullChecklistHref([{ id: 's3', name: 'lincoln wheat cents' }])).toBe('/sets/canonical');
  });
});

describe('getCoverageCounts', () => {
  it('returns the fallbacks while the data is missing', () => {
    expect(getCoverageCounts(undefined)).toEqual(COVERAGE_FALLBACKS);
  });

  it('returns the fallbacks when no template matches', () => {
    expect(getCoverageCounts([])).toEqual(COVERAGE_FALLBACKS);
    expect(getCoverageCounts([{ name: 'Buffalo Nickels', coinCount: 99 }])).toEqual(COVERAGE_FALLBACKS);
  });

  it('maps the four template names to their coin counts', () => {
    expect(
      getCoverageCounts([
        { name: LINCOLN, coinCount: 150 },
        { name: KEY_DATES, coinCount: 9 },
        { name: UKRAINE_CIRC, coinCount: 200 },
        { name: UKRAINE_COMM, coinCount: 40 },
      ]),
    ).toEqual({ coins: 150, keyDates: 9, circulation: 200, commemoratives: 40 });
  });

  it('follows different counts (not constants)', () => {
    const a = getCoverageCounts([{ name: LINCOLN, coinCount: 10 }]);
    const b = getCoverageCounts([{ name: LINCOLN, coinCount: 20 }]);

    expect(a.coins).toBe(10);
    expect(b.coins).toBe(20);
  });

  it('falls back per field when only some templates are present', () => {
    expect(getCoverageCounts([{ name: UKRAINE_COMM, coinCount: 35 }])).toEqual({
      coins: 142,
      keyDates: 7,
      circulation: 187,
      commemoratives: 35,
    });
    expect(getCoverageCounts([{ name: LINCOLN, coinCount: 150 }, { name: KEY_DATES, coinCount: 8 }])).toEqual({
      coins: 150,
      keyDates: 8,
      circulation: 187,
      commemoratives: 31,
    });
  });
});
