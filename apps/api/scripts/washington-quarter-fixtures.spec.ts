/**
 * Tests for: Washington quarter fixtures 1932-1998 (growth backlog 2.4), the canonical set template built
 * from them, provenance in the saved source, the README section and the backlog tick.
 * Contract source: runs/run_20261125_061116/plan.md § Interface Contract
 * Covers criteria: #2, #3, #4, #5, #6, #7, #9, #10, #11, #15, #16 (from runs/run_20261125_061116/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only with fs.readFileSync; no network, no database, no mocks.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeIdentityField } from '@coin-collector/shared';
import { toSpecFields } from '../../../scripts/import-catalog/lib/specs';
import type { RawCoinEntry, RawFixtureFile } from '../../../scripts/import-catalog/lib/types';
import type { SeedTemplate } from './seed-canonical-sets';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const IMPORT_CATALOG_DIR = path.join(REPO_ROOT, 'scripts/import-catalog');
const FIXTURES_DIR = path.join(IMPORT_CATALOG_DIR, 'fixtures');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'seed/templates');

type Fixture = RawFixtureFile & {
  yearRange?: [number, number];
  mintageSums?: Record<string, number[]>;
  'rules-note'?: string;
  keyDates?: unknown;
};

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
function loadFixture(name: string): Fixture {
  return readJson<Fixture>(path.join(FIXTURES_DIR, name));
}
function loadTemplate(name: string): SeedTemplate {
  return readJson<SeedTemplate>(path.join(TEMPLATES_DIR, name));
}
function fixtureKey(file: Pick<RawFixtureFile, 'country' | 'denomination'>, c: RawCoinEntry): string {
  return `${file.country}|${file.denomination}|${c.year}|${sanitizeIdentityField(c.mintMark)}|${sanitizeIdentityField(c.variety)}`;
}
function templateKey(c: SeedTemplate['coins'][number]): string {
  return `${c.country}|${c.denomination}|${c.year}|${c.mintMark}|${c.variety}`;
}
function asTemplateCoins(file: Fixture): SeedTemplate['coins'] {
  return file.coins.map((c) => ({
    country: file.country,
    denomination: file.denomination,
    year: c.year,
    mintMark: sanitizeIdentityField(c.mintMark),
    variety: sanitizeIdentityField(c.variety),
  }));
}
function duplicates(keys: string[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const k of keys) {
    if (seen.has(k)) dup.add(k);
    seen.add(k);
  }
  return [...dup];
}
function marksOf(coins: RawCoinEntry[], year: number): string[] {
  return [...new Set(coins.filter((c) => c.year === year).map((c) => sanitizeIdentityField(c.mintMark)))].sort();
}
function readSection(markdown: string, headingLine: string): string {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => l.trimEnd() === headingLine);
  if (start < 0) return '';
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      end = i;
      break;
    }
  }
  return lines.slice(start, end).join('\n');
}
function wikitextOf(rel: string): string {
  const raw = readJson<{ parse: { wikitext: string | { '*': string } } }>(path.join(IMPORT_CATALOG_DIR, rel));
  return typeof raw.parse.wikitext === 'string' ? raw.parse.wikitext : raw.parse.wikitext['*'];
}
function mintageFigureAppears(wikitext: string, n: number): boolean {
  const formatted = n.toLocaleString('en-US');
  const escaped = formatted.replace(/[.*+?^${}()|[\]\\,]/g, '\\$&');
  return new RegExp(`(?<![\\d,])${escaped}(?![\\d,])`).test(wikitext);
}

const SILVER_FILE = 'us-quarters-washington-silver.json';
const CLAD_FILE = 'us-quarters-washington-clad.json';
const TEMPLATE = 'washington-quarters-1932-1998.v1.json';
const RAW_REL = 'sources/Washington_quarter_mintage_figures.2026-11-21.json';
const README_HEADING = '## `us-quarters-washington-*.json` (two files: silver and clad, 1932-1998)';
const LATER_FILES = [
  'us-quarters-50-state.json',
  'us-quarters-america-the-beautiful.json',
  'us-quarters-american-women.json',
  'us-quarters-crossing-the-delaware.json',
  'us-quarters-dc-and-territories.json',
  'us-quarters-semiquincentennial.json',
];

const silver = loadFixture(SILVER_FILE);
const clad = loadFixture(CLAD_FILE);
const BOTH: Fixture[] = [silver, clad];
const bothCoins = [...silver.coins, ...clad.coins];

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function expectedMarks(year: number): string[] {
  if (year === 1932) return ['', 'D', 'S'];
  if (year === 1934) return ['', 'D'];
  if (year <= 1937) return ['', 'D', 'S'];
  if (year === 1938) return ['', 'S'];
  if (year <= 1948) return ['', 'D', 'S'];
  if (year === 1949) return ['', 'D'];
  if (year <= 1954) return ['', 'D', 'S'];
  if (year <= 1964) return ['', 'D'];
  if (year <= 1967) return [''];
  if (year <= 1979) return ['', 'D'];
  return ['D', 'P'];
}

const EXPECTED_YEARS: number[] = [];
for (let y = 1932; y <= 1998; y++) if (y !== 1933 && y !== 1975) EXPECTED_YEARS.push(y);

describe('identity, counts and year range (criteria 3, 6, 15)', () => {
  it('silver file: USA, Quarter, Washington Quarter, 1932-1964, 83 coins', () => {
    expect(silver.country).toBe('USA');
    expect(silver.denomination).toBe('Quarter');
    expect(silver.name).toBe('Washington Quarter');
    expect(silver.yearRange).toEqual([1932, 1964]);
    expect(silver.coins).toHaveLength(83);
    const ys = silver.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1932);
    expect(Math.max(...ys)).toBe(1964);
  });

  it('clad file: USA, Quarter, Washington Quarter, 1965-1998, 63 coins', () => {
    expect(clad.country).toBe('USA');
    expect(clad.denomination).toBe('Quarter');
    expect(clad.name).toBe('Washington Quarter');
    expect(clad.yearRange).toEqual([1965, 1998]);
    expect(clad.coins).toHaveLength(63);
    const ys = clad.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1965);
    expect(Math.max(...ys)).toBe(1998);
  });

  it('covers 1932 and 1934-1998 except 1975, 146 coins, no 1933, no 1975, nothing after 1998', () => {
    const years = new Set(bothCoins.map((c) => c.year));
    expect([...years].sort((a, b) => a - b)).toEqual(EXPECTED_YEARS);
    expect(years.has(1933)).toBe(false);
    expect(years.has(1975)).toBe(false);
    expect(bothCoins.some((c) => c.year > 1998)).toBe(false);
    expect(bothCoins).toHaveLength(146);
  });

  it('every coin has exactly year, mintMark, variety, isKeyDate, mintage and no specs or image', () => {
    for (const c of bothCoins) {
      expect(Object.keys(c).sort()).toEqual(['isKeyDate', 'mintMark', 'mintage', 'variety', 'year']);
    }
  });

  it('is business strikes only: no S or W after 1964, no set-only or satin rows', () => {
    for (const c of clad.coins) {
      expect(['D', 'P', null]).toContain(c.mintMark);
      expect(c.variety ?? '').not.toMatch(/proof|satin|special|uncirculated|silver-clad|first time/i);
    }
    for (const c of silver.coins) expect(c.variety ?? null).toBeNull();
    expect(silver.coins.filter((c) => c.year === 1964)).toHaveLength(2);
  });
});

describe('mint marks per year (criteria 4, 16)', () => {
  it('matches the contract mint mark set for every covered year', () => {
    const wrong: string[] = [];
    for (const y of EXPECTED_YEARS) {
      const got = marksOf(bothCoins, y);
      const want = expectedMarks(y);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${y}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('1965-1967 are one no-mark coin each; 1965 carries the (P) figure', () => {
    for (const y of [1965, 1966, 1967]) {
      const rows = clad.coins.filter((c) => c.year === y);
      expect(rows).toHaveLength(1);
      expect(rows[0].mintMark).toBeNull();
    }
    expect(clad.coins.find((c) => c.year === 1965)?.mintage).toBe(1819717540);
    expect(clad.coins.find((c) => c.year === 1966)?.mintage).toBe(821101500);
    expect(clad.coins.find((c) => c.year === 1967)?.mintage).toBe(1524031848);
  });

  it('P appears from 1980 and never before', () => {
    const pYears = bothCoins.filter((c) => c.mintMark === 'P').map((c) => c.year);
    expect(Math.min(...pYears)).toBe(1980);
    expect(Math.max(...pYears)).toBe(1998);
    expect(pYears).toHaveLength(19);
  });

  it('1932 D and S figures; the 1932 coins are not flagged as key dates', () => {
    expect(silver.coins.find((c) => c.year === 1932 && c.mintMark === 'D')?.mintage).toBe(436800);
    expect(silver.coins.find((c) => c.year === 1932 && c.mintMark === 'S')?.mintage).toBe(408000);
  });
});

describe('1976 Bicentennial (criterion 16)', () => {
  it('has exactly a no-mark and a D coin, both variety Bicentennial, with the source figures', () => {
    const rows = clad.coins.filter((c) => c.year === 1976);
    expect(rows).toHaveLength(2);
    const nm = rows.find((c) => c.mintMark === null);
    const d = rows.find((c) => c.mintMark === 'D');
    expect(nm?.variety).toBe('Bicentennial');
    expect(d?.variety).toBe('Bicentennial');
    expect(nm?.mintage).toBe(809784016);
    expect(d?.mintage).toBe(860118839);
  });

  it('is the only variety in either file, and there is no 1975 coin', () => {
    const withVariety = bothCoins.filter((c) => (c.variety ?? null) !== null);
    expect(withVariety.map((c) => c.year)).toEqual([1976, 1976]);
    expect(bothCoins.some((c) => c.year === 1975)).toBe(false);
  });
});

describe('null mintages (criterion 5)', () => {
  it('no coin has a null mintage', () => {
    expect(bothCoins.filter((c) => (c.mintage ?? null) === null)).toEqual([]);
  });
});

describe('specs (criterion 6)', () => {
  it('silver coins are 24.26 mm, 6.25 g, 1.75 mm thick, 90% silver', () => {
    for (const c of silver.coins) {
      const s = toSpecFields(silver, c);
      expect(s.diameterMm).toBe(24.26);
      expect(s.weightG).toBe(6.25);
      expect(s.thicknessMm).toBe(1.75);
      expect(s.material).toBe('Silver (90% silver, 10% copper)');
    }
  });

  it('clad coins are 24.26 mm, 5.67 g, 1.75 mm thick, copper-nickel clad copper: different from silver', () => {
    for (const c of clad.coins) {
      const s = toSpecFields(clad, c);
      expect(s.diameterMm).toBe(24.26);
      expect(s.weightG).toBe(5.67);
      expect(s.thicknessMm).toBe(1.75);
      expect(s.material).toBe('Copper-nickel clad copper (91.67% copper, 8.33% nickel)');
    }
    expect(toSpecFields(clad, clad.coins[0]).weightG).not.toBe(toSpecFields(silver, silver.coins[0]).weightG);
  });

  it('no per-coin specs or images', () => {
    for (const c of bothCoins) {
      expect((c as { specs?: unknown }).specs).toBeUndefined();
      expect(c.image ?? null).toBeNull();
    }
  });
});

describe('key dates (criterion 9)', () => {
  it('no cited source names key dates: every coin is isKeyDate false and no keyDates block', () => {
    for (const c of bothCoins) expect(c.isKeyDate).toBe(false);
    for (const f of BOTH) expect(f.keyDates).toBeUndefined();
  });

  it('there is no quarter key-date template', () => {
    const names = fs.readdirSync(TEMPLATES_DIR).filter((f) => /washington.*key|key.*washington/i.test(f));
    expect(names).toEqual([]);
  });
});

describe('rules-note (criteria 4, 15, 16)', () => {
  it.each([
    ['silver', silver, ['parentheses', 'null', '1932']],
    ['clad', clad, ['parentheses', 'null', 'Bicentennial', '1776-1976', '1980']],
  ] as const)('%s file mentions its required topics', (_label, file, needles) => {
    const note = file['rules-note'];
    expect(typeof note).toBe('string');
    for (const n of needles) expect(note).toContain(n);
  });
});

describe('provenance (criteria 2, 5)', () => {
  it('both files cite the already-saved 2026-11-21 quarter article response', () => {
    for (const f of BOTH) {
      expect(f.sources?.[0]?.rawResponse).toBe(RAW_REL);
      expect((f.sources?.[0] as { fetchedAt?: string } | undefined)?.fetchedAt).toBe('2026-11-21');
      expect(f.sources?.[1]?.type).toBe('physical specs');
    }
  });

  it('no second 2026-11-25 quarter response was committed', () => {
    expect(fs.existsSync(path.join(IMPORT_CATALOG_DIR, 'sources/Washington_quarter_mintage_figures.2026-11-25.json'))).toBe(false);
  });

  it('the saved response is the quarter article revision named in sources[0]', () => {
    const abs = path.join(IMPORT_CATALOG_DIR, RAW_REL);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe('Washington quarter mintage figures');
    for (const f of BOTH) expect(f.sources?.[0]?.revisionId).toBe(raw.parse.revid);
  });

  it('has no mintageSums key', () => {
    for (const f of BOTH) expect(f.mintageSums).toBeUndefined();
  });

  it('every mintage appears in the wikitext as the comma-formatted figure', () => {
    const wikitext = wikitextOf(RAW_REL);
    expect(wikitext.length).toBeGreaterThan(1000);
    const missing = bothCoins
      .filter((c) => !mintageFigureAppears(wikitext, c.mintage as number))
      .map((c) => `${c.year} ${c.mintMark} ${c.mintage}`);
    expect(missing).toEqual([]);
  });

  it('the figure matcher respects digit and comma boundaries (falsifiable)', () => {
    expect(mintageFigureAppears('| 1,234,567 |', 1234567)).toBe(true);
    expect(mintageFigureAppears('| 11,234,567 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 1,234,567,890 |', 1234567)).toBe(false);
  });
});

describe('no duplicate natural keys (criterion 5)', () => {
  it.each([SILVER_FILE, CLAD_FILE])('%s has none', (file) => {
    const f = loadFixture(file);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('both files together have none', () => {
    expect(duplicates(BOTH.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles).toEqual(expect.arrayContaining([SILVER_FILE, CLAD_FILE, ...LATER_FILES]));
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('template (criterion 7)', () => {
  const template = loadTemplate(TEMPLATE);

  it('Washington Quarters 1932-1998: exact name, description, 146 coins', () => {
    expect(template.name).toBe('Washington Quarters 1932-1998');
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
    expect(template.coins).toHaveLength(146);
  });

  it('is the silver then clad coins in file order', () => {
    expect(template.coins).toEqual([...asTemplateCoins(silver), ...asTemplateCoins(clad)]);
    expect(template.coins[0].year).toBe(1932);
    expect(template.coins[template.coins.length - 1].year).toBe(1998);
  });

  it('uses empty strings for no mint mark and no variety, Bicentennial only in 1976', () => {
    for (const c of template.coins) {
      expect(typeof c.mintMark).toBe('string');
      expect(typeof c.variety).toBe('string');
      expect(c.variety === '' || (c.variety === 'Bicentennial' && c.year === 1976)).toBe(true);
    }
  });

  it('template names are unique across the directory', () => {
    const names = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => loadTemplate(f).name);
    expect(names.filter((n) => n === 'Washington Quarters 1932-1998')).toHaveLength(1);
  });

  it('every coin matches exactly one fixture row', () => {
    const unresolved: string[] = [];
    for (const coin of template.coins) {
      const matches = allFixtureKeys.filter((k) => k === templateKey(coin)).length;
      if (matches !== 1) unresolved.push(`${templateKey(coin)} x${matches}`);
    }
    expect(unresolved).toEqual([]);
  });

  it('a coin that is in no fixture would be flagged (falsifiable)', () => {
    const fake = templateKey({ country: 'USA', denomination: 'Quarter', year: 1975, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('existing 1999-2026 quarter data is unchanged (sanity, criterion 11)', () => {
  it.each(LATER_FILES)('%s still exists with only 1999 or later coins', (file) => {
    expect(allFixtureFiles).toContain(file);
    const f = loadFixture(file);
    expect(f.coins.length).toBeGreaterThan(0);
    expect(f.coins.every((c) => c.year >= 1999)).toBe(true);
    expect(f.denomination).toBe('Quarter');
  });

  it('the 50 State template keeps its name and 100 coins', () => {
    const t = loadTemplate('50-state-quarters.v1.json');
    expect(t.name).toBe('50 State Quarters');
    expect(t.coins).toHaveLength(100);
  });

  it('no new quarter coin is dated after 1998', () => {
    expect(Math.max(...bothCoins.map((c) => c.year))).toBe(1998);
  });
});

describe('README section (criteria 2, 10)', () => {
  const readme = fs.readFileSync(path.join(FIXTURES_DIR, 'README.md'), 'utf8');
  const section = readSection(readme, README_HEADING);

  it('names both files, the article, 2.9 and Bicentennial', () => {
    expect(section.length).toBeGreaterThan(200);
    for (const needle of [SILVER_FILE, CLAD_FILE, 'Washington quarter mintage figures', '2.9', 'Bicentennial']) {
      expect(section).toContain(needle);
    }
  });

  it('readSection stops at the next level-2 heading (falsifiable)', () => {
    expect(readSection('## a\nx\n## b\ny', '## a')).toBe('## a\nx');
    expect(readSection('## a\nx', '## missing')).toBe('');
  });
});

describe('backlog and history (criteria 1, 11)', () => {
  it('ticks 2.4 and notes the pending manual pass under 2.9', () => {
    const backlog = fs.readFileSync(path.join(REPO_ROOT, 'docs/backlog_growth.md'), 'utf8');
    const line = backlog.split('\n').find((l) => l.startsWith('- [x] 2.4 '));
    expect(line).toBeDefined();
    expect(line).toContain('2.9');
  });

  it('has the dated history paragraph', () => {
    const history = fs.readFileSync(path.join(REPO_ROOT, 'docs/history.md'), 'utf8');
    expect(history).toContain('**Jefferson nickels, Roosevelt dimes and Washington quarters 1932-1998 (2026-11-25), backlog_growth.md 2.2-2.4:**');
  });
});
