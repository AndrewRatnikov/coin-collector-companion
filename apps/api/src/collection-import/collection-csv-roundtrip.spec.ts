/**
 * Tests for: buildCollectionCsv output through parseCsv -> suggestMapping -> matchRows (import round trip)
 * Contract source: runs/run_20261111_062918/plan.md § Interface Contract (Function: buildCollectionCsv; Existing modules the tests import)
 * Covers criteria: #11 (from runs/run_20261111_062918/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Test 2 reads checked-in files only (scripts/import-catalog/fixtures/*.json) with fs.readFileSync,
 * the same way import-matcher.fixture.spec.ts does; no network, no database.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  COIN_GRADES,
  type CoinGrade,
  type CollectionCsvItem,
  buildCollectionCsv,
  sanitizeIdentityField,
} from '@coin-collector/shared';
import { suggestMapping } from './column-mapping';
import { decodeCsvBuffer, parseCsv } from './csv-parser';
import { collectGradeWarnings } from './import-grades';
import { type CatalogSnapshotCoin, matchRows } from './import-matcher';

interface Entry {
  coin: CatalogSnapshotCoin;
  grade: CoinGrade | null;
}

function coinOf(
  id: string,
  country: string,
  denomination: string,
  year: number,
  mintMark: string,
  variety: string,
  name: string,
): CatalogSnapshotCoin {
  return { id, country, denomination, year, mintMark, variety, name };
}

function toItem(entry: Entry): CollectionCsvItem {
  return {
    coin: { ...entry.coin, isKeyDate: false, mintage: null },
    grade: entry.grade,
    ownedAt: new Date(2026, 0, 5, 12),
  };
}

function roundTrip(entries: Entry[], catalog: CatalogSnapshotCoin[]) {
  const csv = buildCollectionCsv(entries.map(toItem));
  const parsed = parseCsv(decodeCsvBuffer(Buffer.from(csv, 'utf8')));
  const mapping = suggestMapping(parsed.headers);
  const results = matchRows({ rows: parsed.rows, mapping, catalog, ownedCoinIds: new Set() });
  const warnings = collectGradeWarnings(parsed.rows, mapping);
  return { csv, parsed, mapping, results, warnings };
}

describe('collection CSV round trip (inline catalog)', () => {
  // Listed in the order the export sorts them: country (code-unit), denomination (numeric), year, mint, variety.
  const expectedOrder: Entry[] = [
    { coin: coinOf('c-1909-s', 'USA', 'Cent', 1909, 'S', '', 'Lincoln Cent'), grade: 'VF' },
    { coin: coinOf('c-1944', 'USA', 'Cent', 1944, '', '', 'Lincoln Cent'), grade: null },
    { coin: coinOf('c-1955', 'USA', 'Cent', 1955, '', '', 'Lincoln "Wheat", Cent'), grade: 'XF' },
    {
      coin: coinOf('c-1955-dd', 'USA', 'Cent', 1955, '', 'Doubled Die, Obverse', 'Lincoln Cent'),
      grade: 'AU',
    },
    { coin: coinOf('c-1999-wide', 'USA', 'Cent', 1999, '', '"Wide AM"', 'Lincoln Cent'), grade: 'UNC' },
    { coin: coinOf('c-uk-5', 'Ukraine', '5 Kopiyok', 2011, '', '', '5 Kopiyok'), grade: 'VG' },
    { coin: coinOf('c-uk-10', 'Ukraine', '10 Kopiyok', 2011, '', '', '10 Kopiyok'), grade: 'F' },
  ];
  const catalog = expectedOrder.map((e) => e.coin);

  it('maps the export header with no manual mapping and no combined column', () => {
    const { mapping } = roundTrip([...expectedOrder].reverse(), catalog);
    expect(mapping).toEqual({ country: 0, denomination: 1, year: 2, mintMark: 3, variety: 4, grade: 5 });
    expect(mapping).not.toHaveProperty('combined');
  });

  it('parses one row per exported coin', () => {
    const { parsed } = roundTrip([...expectedOrder].reverse(), catalog);
    expect(parsed.rows).toHaveLength(expectedOrder.length);
  });

  it('matches every row to its original coin with its grade, and raises no warnings', () => {
    // Input is reversed so the export has to sort it back into expectedOrder.
    const { results, warnings } = roundTrip([...expectedOrder].reverse(), catalog);

    expect(results.map((r) => r.status)).toEqual(expectedOrder.map(() => 'matched'));
    expect(results.map((r) => r.coin?.id)).toEqual(expectedOrder.map((e) => e.coin.id));
    expect(results.map((r) => r.grade)).toEqual(expectedOrder.map((e) => e.grade));
    expect(results.every((r) => r.duplicateOfLine === null)).toBe(true);
    expect(warnings).toEqual([]);
  });

  it('keeps the variety coin and the plain coin of the same year apart', () => {
    const { results } = roundTrip([...expectedOrder].reverse(), catalog);
    const plain = results.find((r) => r.coin?.id === 'c-1955');
    const variety = results.find((r) => r.coin?.id === 'c-1955-dd');
    expect(plain?.grade).toBe('XF');
    expect(variety?.grade).toBe('AU');
  });

  it('a different grade assignment comes back differently (the grades are really read from the file)', () => {
    const swapped: Entry[] = expectedOrder.map((e, i) => ({
      ...e,
      grade: i === 1 ? 'G' : e.grade,
    }));
    const { results } = roundTrip(swapped, catalog);
    expect(results[1].grade).toBe('G');
    expect(results[1].coin?.id).toBe('c-1944');
  });
});

describe('collection CSV round trip (whole fixture catalog)', () => {
  const CATALOG_FIXTURES_DIR = path.resolve(__dirname, '../../../../scripts/import-catalog/fixtures');

  interface CatalogFixtureFile {
    country: string;
    denomination: string;
    coins: Array<{ year: number; mintMark: string | null; variety: string | null }>;
  }

  function buildCatalog(): CatalogSnapshotCoin[] {
    const result: CatalogSnapshotCoin[] = [];
    const files = fs.readdirSync(CATALOG_FIXTURES_DIR).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const data = JSON.parse(
        fs.readFileSync(path.join(CATALOG_FIXTURES_DIR, file), 'utf8'),
      ) as CatalogFixtureFile;
      for (const c of data.coins) {
        const mintMark = sanitizeIdentityField(c.mintMark);
        const variety = sanitizeIdentityField(c.variety);
        const key = `${data.country}|${data.denomination}|${c.year}|${mintMark}|${variety}`;
        result.push({
          id: key,
          name: key,
          country: data.country,
          denomination: data.denomination,
          year: c.year,
          mintMark,
          variety,
        });
      }
    }
    return result;
  }

  it('exports every catalog coin with a cycling grade and imports each back onto itself', () => {
    const catalog = buildCatalog();
    expect(catalog.length).toBeGreaterThan(300);

    const cycle: Array<CoinGrade | null> = [null, ...COIN_GRADES];
    const entries: Entry[] = catalog.map((coin, i) => ({ coin, grade: cycle[i % cycle.length] }));
    const gradeById = new Map(entries.map((e) => [e.coin.id, e.grade]));

    const { parsed, mapping, results, warnings } = roundTrip(entries, catalog);

    expect(mapping).toEqual({ country: 0, denomination: 1, year: 2, mintMark: 3, variety: 4, grade: 5 });
    expect(parsed.rows).toHaveLength(catalog.length);

    const notMatched = results.filter((r) => r.status !== 'matched').map((r) => [r.line, r.status, r.values]);
    expect(notMatched).toEqual([]);

    const wrongGrade = results
      .filter((r) => r.grade !== gradeById.get(r.coin?.id ?? ''))
      .map((r) => [r.line, r.coin?.id, r.grade]);
    expect(wrongGrade).toEqual([]);

    expect(new Set(results.map((r) => r.coin?.id))).toEqual(new Set(catalog.map((c) => c.id)));
    expect(results.every((r) => r.duplicateOfLine === null)).toBe(true);
    expect(warnings).toEqual([]);
    expect(new Set(gradeById.values()).size).toBeGreaterThan(1);
  });
});
