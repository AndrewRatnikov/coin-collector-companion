/**
 * Tests for: @/lib/landing/lincoln-sample
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Module: lincoln-sample
 * Covers criteria: #9 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import {
  LINCOLN_SAMPLE_CSV_NAME,
  LINCOLN_SAMPLE_KEY_DATE_IDS,
  LINCOLN_SAMPLE_MOBILE_SLOTS,
  LINCOLN_SAMPLE_SET_NAME,
  LINCOLN_SAMPLE_SLOTS,
  collectorLabel,
} from '@/lib/landing/lincoln-sample';

const EXPECTED_IDS = [
  'sample-1909',
  'sample-1909-VDB',
  'sample-1909-S',
  'sample-1909-S-VDB',
  'sample-1910',
  'sample-1910-S',
  ...[1911, 1912, 1913, 1914, 1915, 1916].flatMap((year) => [
    `sample-${year}`,
    `sample-${year}-D`,
    `sample-${year}-S`,
  ]),
];

const EXPECTED_MISSING = [
  'sample-1909-S-VDB',
  'sample-1909-S',
  'sample-1910-S',
  'sample-1912-S',
  'sample-1914-D',
  'sample-1914-S',
  'sample-1915-S',
  'sample-1916-S',
];

describe('names', () => {
  it('exports the set name and the CSV name', () => {
    expect(LINCOLN_SAMPLE_SET_NAME).toBe('Lincoln Wheat Cents');
    expect(LINCOLN_SAMPLE_CSV_NAME).toBe('Lincoln Wheat Cents sample');
  });
});

describe('LINCOLN_SAMPLE_SLOTS', () => {
  it('has 24 slots in chronological order with the documented ids', () => {
    expect(LINCOLN_SAMPLE_SLOTS).toHaveLength(24);
    expect(LINCOLN_SAMPLE_SLOTS.map((s) => s.id)).toEqual(EXPECTED_IDS);
    expect(new Set(LINCOLN_SAMPLE_SLOTS.map((s) => s.id)).size).toBe(24);
  });

  it('numbers positions 1 to 24 and uses the coin id as the slot id', () => {
    expect(LINCOLN_SAMPLE_SLOTS.map((s) => s.position)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    for (const slot of LINCOLN_SAMPLE_SLOTS) {
      expect(slot.id).toBe(slot.coin.id);
      expect(slot.grade).toBeNull();
    }
  });

  it('owns 16 of 24 and misses exactly the documented 8', () => {
    expect(LINCOLN_SAMPLE_SLOTS.filter((s) => s.owned)).toHaveLength(16);
    expect(LINCOLN_SAMPLE_SLOTS.filter((s) => !s.owned).map((s) => s.id)).toEqual(EXPECTED_MISSING);
  });

  it('covers 1909 to 1916 with the right year counts', () => {
    const years = LINCOLN_SAMPLE_SLOTS.map((s) => s.coin.year);
    expect(years[0]).toBe(1909);
    expect(years.at(-1)).toBe(1916);
    expect(years.filter((y) => y === 1909)).toHaveLength(4);
    expect(years.filter((y) => y === 1910)).toHaveLength(2);
    for (const year of [1911, 1912, 1913, 1914, 1915, 1916]) {
      expect(years.filter((y) => y === year)).toHaveLength(3);
    }
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });

  it('builds full CatalogCoins for a United States 1 Cent bronze coin', () => {
    for (const { coin } of LINCOLN_SAMPLE_SLOTS) {
      expect(coin.country).toBe('United States');
      expect(coin.denomination).toBe('1 Cent');
      expect(coin.material).toBe('Bronze');
      expect(coin.name).toBe('Lincoln Wheat Cent');
      expect(coin.status).toBe('approved');
      expect(coin.imageUrl).toBeNull();
      expect(coin.imageSource).toBeNull();
      expect(coin.imageLicense).toBeNull();
      expect(coin.diameterMm).toBeNull();
      expect(coin.weightG).toBeNull();
      expect(coin.thicknessMm).toBeNull();
      expect(coin.mintage).toBeNull();
      expect(coin.submittedAt).toBeNull();
      expect(coin.createdAt).toEqual(new Date('2026-11-16T00:00:00Z'));
      expect(coin.updatedAt).toEqual(new Date('2026-11-16T00:00:00Z'));
      expect(typeof coin.mintMark).toBe('string');
      expect(typeof coin.variety).toBe('string');
    }
  });

  it('fills mint marks and varieties from the id', () => {
    const byId = new Map(LINCOLN_SAMPLE_SLOTS.map((s) => [s.id, s.coin]));
    expect(byId.get('sample-1909')).toMatchObject({ year: 1909, mintMark: '', variety: '' });
    expect(byId.get('sample-1909-VDB')).toMatchObject({ year: 1909, mintMark: '', variety: 'VDB' });
    expect(byId.get('sample-1909-S')).toMatchObject({ year: 1909, mintMark: 'S', variety: '' });
    expect(byId.get('sample-1909-S-VDB')).toMatchObject({ year: 1909, mintMark: 'S', variety: 'VDB' });
    expect(byId.get('sample-1914-D')).toMatchObject({ year: 1914, mintMark: 'D', variety: '' });
  });

  it('flags only 1909-S VDB, 1909-S and 1914-D as key dates', () => {
    const keyIds = LINCOLN_SAMPLE_SLOTS.filter((s) => s.coin.isKeyDate).map((s) => s.id);
    expect(keyIds).toEqual(['sample-1909-S', 'sample-1909-S-VDB', 'sample-1914-D']);
  });
});

describe('LINCOLN_SAMPLE_KEY_DATE_IDS', () => {
  it('holds exactly the three key date ids', () => {
    expect([...LINCOLN_SAMPLE_KEY_DATE_IDS].sort()).toEqual(
      ['sample-1909-S', 'sample-1909-S-VDB', 'sample-1914-D'].sort(),
    );
    expect(LINCOLN_SAMPLE_KEY_DATE_IDS.has('sample-1914-S')).toBe(false);
  });
});

describe('LINCOLN_SAMPLE_MOBILE_SLOTS', () => {
  it('is the first 12 slots, 1909 to 1912', () => {
    expect(LINCOLN_SAMPLE_MOBILE_SLOTS).toHaveLength(12);
    expect(LINCOLN_SAMPLE_MOBILE_SLOTS.map((s) => s.id)).toEqual(EXPECTED_IDS.slice(0, 12));
    expect(LINCOLN_SAMPLE_MOBILE_SLOTS.at(-1)?.coin.year).toBe(1912);
  });

  it('owns 8 of 12 and misses four', () => {
    expect(LINCOLN_SAMPLE_MOBILE_SLOTS.filter((s) => s.owned)).toHaveLength(8);
    expect(LINCOLN_SAMPLE_MOBILE_SLOTS.filter((s) => !s.owned).map((s) => s.id)).toEqual([
      'sample-1909-S-VDB',
      'sample-1909-S',
      'sample-1910-S',
      'sample-1912-S',
    ]);
  });
});

describe('collectorLabel', () => {
  it('writes the year alone for a plain coin', () => {
    expect(collectorLabel({ year: 1909, mintMark: '', variety: '' })).toBe('1909');
    expect(collectorLabel({ year: 1911, mintMark: '', variety: '' })).toBe('1911');
  });

  it('adds the mint mark with a hyphen', () => {
    expect(collectorLabel({ year: 1909, mintMark: 'S', variety: '' })).toBe('1909-S');
    expect(collectorLabel({ year: 1914, mintMark: 'D', variety: '' })).toBe('1914-D');
  });

  it('adds the variety after a space', () => {
    expect(collectorLabel({ year: 1909, mintMark: '', variety: 'VDB' })).toBe('1909 VDB');
    expect(collectorLabel({ year: 1909, mintMark: 'S', variety: 'VDB' })).toBe('1909-S VDB');
  });

  it('labels every sample slot uniquely', () => {
    const labels = LINCOLN_SAMPLE_SLOTS.map((s) => collectorLabel(s.coin));
    expect(new Set(labels).size).toBe(24);
    expect(labels).toContain('1909-S VDB');
  });
});
