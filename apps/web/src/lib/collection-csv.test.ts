/**
 * Tests for: buildCollectionCsv / COLLECTION_CSV_HEADER (@coin-collector/shared)
 * Contract source: runs/run_20261111_062918/plan.md § Interface Contract (Function: buildCollectionCsv)
 * Covers criteria: #5, #6, #7, #8, #9, #10 (from prd.md)
 *
 * CONTRACT_GAPs: none
 *
 * The web suite reads @coin-collector/shared from dist/, so build shared first.
 */

import { describe, expect, it } from 'vitest';
import {
  COIN_GRADES,
  COLLECTION_CSV_HEADER,
  buildCollectionCsv,
  type CollectionCsvItem,
} from '@coin-collector/shared';

const BOM = '﻿';
const HEADER = 'Country,Denomination,Year,Mint mark,Variety,Grade,Series,Key date,Mintage,Owned since';

type ItemCoin = CollectionCsvItem['coin'];

function makeItem(
  coin: Partial<ItemCoin> = {},
  extra: { grade?: CollectionCsvItem['grade']; ownedAt?: CollectionCsvItem['ownedAt'] } = {},
): CollectionCsvItem {
  return {
    coin: {
      country: 'USA',
      denomination: '1 Cent',
      year: 1943,
      mintMark: '',
      variety: '',
      name: 'Lincoln Cent',
      isKeyDate: false,
      mintage: null,
      ...coin,
    },
    grade: extra.grade ?? null,
    ownedAt: extra.ownedAt ?? new Date(2026, 0, 5, 12),
  };
}

function lines(csv: string): string[] {
  return csv.split('\r\n');
}

function dataLines(csv: string): string[] {
  return lines(csv).slice(1);
}

describe('COLLECTION_CSV_HEADER', () => {
  it('is the exact header string', () => {
    expect(COLLECTION_CSV_HEADER).toBe(HEADER);
  });
});

describe('buildCollectionCsv structure', () => {
  it('starts with the BOM and the header line', () => {
    const csv = buildCollectionCsv([makeItem()]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(lines(csv)[0]).toBe(`${BOM}${HEADER}`);
  });

  it('joins lines with CRLF and has no trailing CRLF', () => {
    const csv = buildCollectionCsv([makeItem({ year: 1943 }), makeItem({ year: 1944 })]);
    expect(lines(csv)).toHaveLength(3);
    expect(csv.endsWith('\r\n')).toBe(false);
    expect(csv).not.toMatch(/[^\r]\n/);
  });

  it('an empty collection gives exactly BOM + header', () => {
    expect(buildCollectionCsv([])).toBe(`${BOM}${HEADER}`);
  });
});

describe('buildCollectionCsv row values', () => {
  it('writes all ten cells in header order', () => {
    const csv = buildCollectionCsv([
      makeItem(
        {
          country: 'USA',
          denomination: '1 Cent',
          year: 1909,
          mintMark: 'S',
          variety: 'VDB',
          name: 'Lincoln Wheat Cent',
          isKeyDate: true,
          mintage: 484000,
        },
        { grade: 'VF', ownedAt: new Date(2026, 0, 5, 23, 30) },
      ),
    ]);
    expect(dataLines(csv)).toEqual(['USA,1 Cent,1909,S,VDB,VF,Lincoln Wheat Cent,yes,484000,2026-01-05']);
  });

  it('passes every grade code through unchanged', () => {
    for (const grade of COIN_GRADES) {
      const csv = buildCollectionCsv([makeItem({}, { grade })]);
      expect(dataLines(csv)[0].split(',')[5]).toBe(grade);
    }
    const written = COIN_GRADES.map((grade) => dataLines(buildCollectionCsv([makeItem({}, { grade })]))[0].split(',')[5]);
    expect(new Set(written).size).toBe(COIN_GRADES.length);
  });

  it('writes an empty grade cell for null', () => {
    const csv = buildCollectionCsv([makeItem({}, { grade: null })]);
    expect(dataLines(csv)[0].split(',')[5]).toBe('');
  });

  it('writes empty cells for an empty mint mark and variety', () => {
    const cells = dataLines(buildCollectionCsv([makeItem({ mintMark: '', variety: '' })]))[0].split(',');
    expect(cells[3]).toBe('');
    expect(cells[4]).toBe('');
    const filled = dataLines(buildCollectionCsv([makeItem({ mintMark: 'D', variety: 'Wide' })]))[0].split(',');
    expect(filled[3]).toBe('D');
    expect(filled[4]).toBe('Wide');
  });

  it('writes mintage as the number, or empty when null', () => {
    expect(dataLines(buildCollectionCsv([makeItem({ mintage: 1234567 })]))[0].split(',')[8]).toBe('1234567');
    expect(dataLines(buildCollectionCsv([makeItem({ mintage: null })]))[0].split(',')[8]).toBe('');
  });

  it('writes yes or no for the key date flag', () => {
    expect(dataLines(buildCollectionCsv([makeItem({ isKeyDate: true })]))[0].split(',')[7]).toBe('yes');
    expect(dataLines(buildCollectionCsv([makeItem({ isKeyDate: false })]))[0].split(',')[7]).toBe('no');
  });

  it('writes the coin name in the Series column', () => {
    expect(dataLines(buildCollectionCsv([makeItem({ name: 'Wheat Cent' })]))[0].split(',')[6]).toBe('Wheat Cent');
    expect(dataLines(buildCollectionCsv([makeItem({ name: 'Other Name' })]))[0].split(',')[6]).toBe('Other Name');
  });
});

describe('buildCollectionCsv owned since (local time)', () => {
  const ownedSince = (ownedAt: CollectionCsvItem['ownedAt']) =>
    dataLines(buildCollectionCsv([makeItem({}, { ownedAt })]))[0].split(',')[9];

  it('formats a Date in local time, even late in the evening', () => {
    expect(ownedSince(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('formats an ISO string made from a local Date, as GET /collection sends it', () => {
    expect(ownedSince(new Date(2026, 9, 1, 12).toISOString())).toBe('2026-10-01');
  });

  it('gives different dates for different inputs', () => {
    expect(ownedSince(new Date(2026, 2, 7, 12))).toBe('2026-03-07');
    expect(ownedSince(new Date(2025, 10, 20, 12))).toBe('2025-11-20');
  });
});

describe('buildCollectionCsv sorting', () => {
  const idOf = (line: string) => line.split(',').slice(0, 5).join(',');

  it('sorts by country with a code-unit comparison (USA before Ukraine)', () => {
    const csv = buildCollectionCsv([makeItem({ country: 'Ukraine' }), makeItem({ country: 'USA' })]);
    expect(dataLines(csv).map((l) => l.split(',')[0])).toEqual(['USA', 'Ukraine']);
  });

  it('sorts denominations numerically within a country', () => {
    const csv = buildCollectionCsv([
      makeItem({ country: 'Ukraine', denomination: '10 Kopiyok' }),
      makeItem({ country: 'Ukraine', denomination: '5 Kopiyok' }),
    ]);
    expect(dataLines(csv).map((l) => l.split(',')[1])).toEqual(['5 Kopiyok', '10 Kopiyok']);
  });

  it('sorts by year ascending numerically within a denomination', () => {
    const csv = buildCollectionCsv([makeItem({ year: 1955 }), makeItem({ year: 1909 }), makeItem({ year: 1944 })]);
    expect(dataLines(csv).map((l) => l.split(',')[2])).toEqual(['1909', '1944', '1955']);
  });

  it('sorts by mint mark, empty first, then by variety, empty first', () => {
    const csv = buildCollectionCsv([
      makeItem({ mintMark: 'S', variety: '' }),
      makeItem({ mintMark: 'D', variety: 'Wide' }),
      makeItem({ mintMark: '', variety: 'Wide' }),
      makeItem({ mintMark: 'D', variety: '' }),
      makeItem({ mintMark: '', variety: '' }),
    ]);
    expect(dataLines(csv).map((l) => idOf(l).split(',').slice(3).join(','))).toEqual([
      ',',
      ',Wide',
      'D,',
      'D,Wide',
      'S,',
    ]);
  });

  it('applies the keys in order: country, denomination, year, mint mark, variety', () => {
    const csv = buildCollectionCsv([
      makeItem({ country: 'Ukraine', denomination: '5 Kopiyok', year: 2011 }),
      makeItem({ country: 'USA', denomination: '5 Cents', year: 1944 }),
      makeItem({ country: 'USA', denomination: '1 Cent', year: 1955 }),
      makeItem({ country: 'USA', denomination: '1 Cent', year: 1909, mintMark: 'S' }),
      makeItem({ country: 'USA', denomination: '1 Cent', year: 1909, mintMark: '' }),
    ]);
    expect(dataLines(csv).map((l) => l.split(',').slice(0, 4).join(','))).toEqual([
      'USA,1 Cent,1909,',
      'USA,1 Cent,1909,S',
      'USA,1 Cent,1955,',
      'USA,5 Cents,1944,',
      'Ukraine,5 Kopiyok,2011,',
    ]);
  });

  it('gives the same output whatever the input order', () => {
    const items = [
      makeItem({ year: 1909 }),
      makeItem({ year: 1944 }),
      makeItem({ year: 1955, mintMark: 'D' }),
      makeItem({ year: 1955, mintMark: '' }),
    ];
    expect(buildCollectionCsv([...items].reverse())).toBe(buildCollectionCsv(items));
  });

  it('does not mutate the input array', () => {
    const items = [makeItem({ year: 1955 }), makeItem({ year: 1909 }), makeItem({ year: 1944 })];
    const before = [...items];
    const snapshot = structuredClone(items);

    buildCollectionCsv(items);

    expect(items).toEqual(snapshot);
    expect(items.map((i) => i.coin.year)).toEqual([1955, 1909, 1944]);
    items.forEach((item, index) => expect(item).toBe(before[index]));
  });
});

describe('buildCollectionCsv quoting and formula prefix', () => {
  it('quotes a country with a comma', () => {
    const csv = buildCollectionCsv([makeItem({ country: 'Korea, South' })]);
    expect(dataLines(csv)[0].startsWith('"Korea, South",1 Cent,')).toBe(true);
  });

  it('quotes a variety with a quote and doubles it', () => {
    const csv = buildCollectionCsv([makeItem({ variety: '"Wide AM"' })]);
    expect(dataLines(csv)[0]).toContain(',"""Wide AM""",');
  });

  it('quotes a name with a comma', () => {
    const csv = buildCollectionCsv([makeItem({ name: 'Cent, Wheat' })]);
    expect(dataLines(csv)[0]).toContain(',"Cent, Wheat",');
  });

  it('prefixes a leading = in a name, variety and country', () => {
    const csv = buildCollectionCsv([makeItem({ country: '=C', variety: '+V', name: '@N' })]);
    const row = dataLines(csv)[0];
    expect(row.startsWith("'=C,")).toBe(true);
    expect(row).toContain(",'+V,");
    expect(row).toContain(",'@N,");
  });

  it('applies the prefix and the quoting together', () => {
    const csv = buildCollectionCsv([makeItem({ name: '=a,b' })]);
    expect(dataLines(csv)[0]).toContain(`,"'=a,b",`);
  });

  it('leaves plain values unquoted', () => {
    const row = dataLines(buildCollectionCsv([makeItem({ name: 'Plain' })]))[0];
    expect(row).not.toContain('"');
    expect(row).not.toContain("'");
  });
});
