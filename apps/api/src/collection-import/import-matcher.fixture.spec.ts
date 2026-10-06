/**
 * Tests for: 300-row messy fixture against the real catalog fixtures (decode + parse + suggestMapping + match)
 * Contract source: runs/run_20261005_212015/plan.md § Test notes (Fixture spec) and § Interface Contract
 * Covers criteria: #12, #13, #23 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only (scripts/import-catalog/fixtures/*.json and the __fixtures__ CSVs next to
 * this spec) with fs.readFileSync; no network, no database.
 */

import * as fs from 'fs';
import * as path from 'path';
import { sanitizeIdentityField } from '@coin-collector/shared';
import { suggestMapping } from './column-mapping';
import { decodeCsvBuffer, parseCsv } from './csv-parser';
import { type CatalogSnapshotCoin, matchRows } from './import-matcher';

const CATALOG_FIXTURES_DIR = path.resolve(__dirname, '../../../../scripts/import-catalog/fixtures');
const CSV_DIR = path.resolve(__dirname, '__fixtures__');

interface CatalogFixtureFile {
  country: string;
  denomination: string;
  coins: Array<{ year: number; mintMark: string | null; variety: string | null }>;
}

function buildCatalog(): CatalogSnapshotCoin[] {
  const catalog: CatalogSnapshotCoin[] = [];
  const files = fs.readdirSync(CATALOG_FIXTURES_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(CATALOG_FIXTURES_DIR, file), 'utf8')) as CatalogFixtureFile;
    for (const c of data.coins) {
      const mintMark = sanitizeIdentityField(c.mintMark);
      const variety = sanitizeIdentityField(c.variety);
      const key = `${data.country}|${data.denomination}|${c.year}|${mintMark}|${variety}`;
      catalog.push({
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
  return catalog;
}

const EXPECTED = JSON.parse(fs.readFileSync(path.join(CSV_DIR, 'messy-expected.json'), 'utf8')) as Record<
  string,
  Record<string, string | null>
>;

function loadBuffer(fileName: string): Buffer {
  const raw = fs.readFileSync(path.join(CSV_DIR, fileName));
  if (fileName === 'messy-semicolon.csv') {
    // Simulate an Excel "CSV UTF-8" export: BOM + CRLF line endings.
    const text = raw.toString('utf8').replace(/\r?\n/g, '\r\n');
    return Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, 'utf8')]);
  }
  return raw;
}

const CASES: Array<{ file: string; delimiter: ',' | ';' | '\t' }> = [
  { file: 'messy-comma.csv', delimiter: ',' },
  { file: 'messy-semicolon.csv', delimiter: ';' },
  { file: 'messy-tab.csv', delimiter: '\t' },
];

const catalog = buildCatalog();
const catalogIds = new Set(catalog.map((c) => c.id));

function run(fileName: string) {
  const parsed = parseCsv(decodeCsvBuffer(loadBuffer(fileName)));
  const mapping = suggestMapping(parsed.headers);
  const results = matchRows({ rows: parsed.rows, mapping, catalog, ownedCoinIds: new Set() });
  return { parsed, mapping, results };
}

describe('catalog snapshot built from scripts/import-catalog/fixtures', () => {
  it('contains the real fixture coins (USA cents and Ukrainian coins)', () => {
    expect(catalog.length).toBeGreaterThan(300);
    expect(catalog.some((c) => c.country === 'USA' && c.denomination === 'Cent' && c.year === 1909)).toBe(true);
    expect(catalog.some((c) => c.country === 'Ukraine')).toBe(true);
    expect(catalogIds.has('USA|Cent|1909|S|VDB')).toBe(true);
  });
});

describe.each(CASES)('messy fixture $file', ({ file, delimiter }) => {
  it('is parsed with the expected delimiter and has an expected entry for every data row', () => {
    const { parsed } = run(file);
    expect(parsed.delimiter).toBe(delimiter);
    const expected = EXPECTED[file];
    expect(expected).toBeDefined();
    expect(parsed.rows.map((r) => String(r.line)).sort()).toEqual(Object.keys(expected).sort());
  });

  it('gets a usable default mapping from its headers', () => {
    const { mapping } = run(file);
    expect(mapping.country).toBeDefined();
    expect(mapping.denomination).toBeDefined();
    expect(mapping.year !== undefined || mapping.combined !== undefined).toBe(true);
  });

  it('only expects coins that exist in the catalog', () => {
    for (const key of Object.values(EXPECTED[file])) {
      if (key !== null) expect(catalogIds.has(key)).toBe(true);
    }
  });

  it('never matches a row whose expected coin is null', () => {
    const { results } = run(file);
    const expected = EXPECTED[file];
    const wronglyMatched = results.filter((r) => expected[String(r.line)] === null && r.status === 'matched');
    expect(wronglyMatched.map((r) => [r.line, r.values, r.coin?.id])).toEqual([]);
  });

  it('matches or lists as candidate at least 80% of the rows that have a catalog coin', () => {
    const { results } = run(file);
    const expected = EXPECTED[file];
    const withCoin = results.filter((r) => expected[String(r.line)] !== null);
    const good = withCoin.filter((r) => {
      const key = expected[String(r.line)] as string;
      return (
        (r.status === 'matched' && r.coin?.id === key) ||
        (r.status === 'ambiguous' && r.candidates.some((c) => c.id === key))
      );
    });
    expect(withCoin.length).toBeGreaterThan(50);
    expect(good.length / withCoin.length).toBeGreaterThanOrEqual(0.8);
  });
});

describe('messy fixtures combined (criterion #23)', () => {
  it('has about 300 data rows across the three files', () => {
    const total = CASES.reduce((sum, c) => sum + run(c.file).parsed.rows.length, 0);
    expect(total).toBeGreaterThanOrEqual(290);
    expect(total).toBeLessThanOrEqual(330);
  });

  it('reaches at least 80% overall, and the null-key rows are a real part of the fixture', () => {
    let withCoin = 0;
    let good = 0;
    let withoutCoin = 0;
    for (const { file } of CASES) {
      const { results } = run(file);
      const expected = EXPECTED[file];
      for (const r of results) {
        const key = expected[String(r.line)];
        if (key === null) {
          withoutCoin += 1;
          continue;
        }
        withCoin += 1;
        if (
          (r.status === 'matched' && r.coin?.id === key) ||
          (r.status === 'ambiguous' && r.candidates.some((c) => c.id === key))
        ) {
          good += 1;
        }
      }
    }
    expect(withoutCoin).toBeGreaterThanOrEqual(30);
    expect(good / withCoin).toBeGreaterThanOrEqual(0.8);
  });

  it('has Ukrainian rows with catalog coins in every file (criteria 15, 16, 18, 23)', () => {
    let ukraineRows = 0;
    for (const { file } of CASES) {
      const rows = Object.values(EXPECTED[file]).filter((k) => k !== null && k.startsWith('Ukraine|'));
      expect(rows.length).toBeGreaterThanOrEqual(10);
      ukraineRows += rows.length;
    }
    expect(ukraineRows).toBeGreaterThanOrEqual(40);
  });

  it('matches Ukrainian rows whose country, denomination and variety are spelled in different ways', () => {
    const comma = run('messy-comma.csv').results;
    const byLine = (line: number) => comma.find((r) => r.line === line);
    // "Ucrania", "10 гривень": the only 10 Hryvnias coin of 2021.
    expect(byLine(33)?.status).toBe('matched');
    expect(byLine(33)?.coin?.id).toBe('Ukraine|10 Hryvnias|2021||');
    // "Ukraine, 10 Hryvnias, 2022" with no variety resolves to the plain coin, not to the commemorative.
    expect(byLine(34)?.status).toBe('matched');
    expect(byLine(34)?.coin?.id).toBe('Ukraine|10 Hryvnias|2022||');
    // Commemorative named in the Variety column.
    expect(byLine(35)?.coin?.id).toBe('Ukraine|10 Hryvnias|2023||Antonivskyi Bridge');
    expect(byLine(36)?.coin?.id).toBe('Ukraine|10 Hryvnias|2023||Air Defense: A Reliable Shield of Ukraine');
    // Partial subject name.
    expect(byLine(42)?.coin?.id).toBe('Ukraine|10 Hryvnias|2025||We Are Strong. We Are Together: Donetsk Oblast');
    // "2 kopecks" is 2 Kopiyky only; "25 копеек" is 25 Kopiyok only.
    expect(byLine(45)?.coin?.id).toBe('Ukraine|2 Kopiyky|2006||');
    expect(byLine(46)?.coin?.id).toBe('Ukraine|25 Kopiyok|2008||');
  });

  it('keeps blank-variety commemorative years and amount-less kopiyka rows ambiguous', () => {
    const comma = run('messy-comma.csv').results;
    const byLine = (line: number) => comma.find((r) => r.line === line);
    // 2026 has only commemoratives, none plain.
    const blank2026 = byLine(44);
    expect(blank2026?.status).toBe('ambiguous');
    expect(blank2026?.reason).toBe('multiple_matches');
    expect(blank2026?.candidates.length).toBeGreaterThan(5);
    // "kopiyky" with no amount lists every kopiyka denomination of that year.
    const kopiyky = byLine(48);
    expect(kopiyky?.status).toBe('ambiguous');
    const ids = kopiyky?.candidates.map((c) => c.id) ?? [];
    expect(ids).toContain('Ukraine|2 Kopiyky|2010||');
    expect(ids).toContain('Ukraine|50 Kopiyok|2010||');
    expect(ids.every((id) => id.includes('Kopiy') && id.includes('|2010|'))).toBe(true);
  });

  it('matches Ukrainian commemoratives given in the combined Coin column of the tab file', () => {
    const tab = run('messy-tab.csv').results;
    const byLine = (line: number) => tab.find((r) => r.line === line);
    expect(byLine(13)?.coin?.id).toBe('Ukraine|10 Hryvnias|2023||Antonivskyi Bridge');
    expect(byLine(14)?.coin?.id).toBe('Ukraine|10 Hryvnias|2023||Support Forces of the Armed Forces of Ukraine');
    expect(byLine(18)?.coin?.id).toBe(
      'Ukraine|10 Hryvnias|2026||In Memory of Those Executed, Tortured or Killed in Captivity',
    );
    expect(byLine(20)?.coin?.id).toBe('Ukraine|1 Hryvnia|2012||UEFA Euro 2012 Final Tournament');
  });

  it('resolves duplicate coins in the comma file to the first row (duplicateOfLine)', () => {
    const { results } = run('messy-comma.csv');
    const first = results.find((r) => r.line === 57);
    const dup = results.find((r) => r.line === 64);
    expect(first?.coin?.id).toBe('USA|Cent|1909|S|VDB');
    expect(first?.duplicateOfLine).toBeNull();
    expect(dup?.coin?.id).toBe('USA|Cent|1909|S|VDB');
    expect(dup?.duplicateOfLine).toBe(57);
  });
});
