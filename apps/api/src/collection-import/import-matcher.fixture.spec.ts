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
