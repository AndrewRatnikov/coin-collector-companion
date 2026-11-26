/**
 * Tests for: Morgan and Peace dollar fixtures (growth backlog 2.6), the canonical set templates
 * built from them, the Morgan and Peace key dates (keyDates blocks citing the manual key-date source files),
 * provenance in the saved sources, the README sections, the backlog tick and the history paragraphs.
 * Contract source: runs/run_20261125_195719/plan.md § Interface Contract, updated by
 * runs/run_20261126_061240/plan.md § Interface Contract (Eisenhower Philadelphia dollars are now null) and by
 * runs/run_20261126_230345/plan.md § Interface Contract (Morgan 1889-CC, Peace 1928, Morgan key dates v2,
 * Peace key dates v1)
 * Covers criteria: #1 to #12 and #14 (README part) (from runs/run_20261125_195719/prd.md) and
 * #6 to #13 (from runs/run_20261126_230345/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only with fs.readFileSync (plus readdirSync on the real template directory);
 * no network, no database, no mocks.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeIdentityField } from '@coin-collector/shared';
import { toSpecFields } from '../../../scripts/import-catalog/lib/specs';
import type { RawCoinEntry, RawFixtureFile } from '../../../scripts/import-catalog/lib/types';
import { latestTemplateVersions, resolveTemplatePaths } from './seed-canonical-sets';
import type { SeedTemplate } from './seed-canonical-sets';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const IMPORT_CATALOG_DIR = path.join(REPO_ROOT, 'scripts/import-catalog');
const FIXTURES_DIR = path.join(IMPORT_CATALOG_DIR, 'fixtures');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'seed/templates');

type Fixture = RawFixtureFile & {
  yearRange?: [number, number];
  mintageSums?: Record<string, number[]>;
  'rules-note'?: string;
  keyDates?: { source: string; quote: string; coins: string[] };
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
function label(c: RawCoinEntry): string {
  const mark = c.mintMark === null || c.mintMark === undefined ? '' : `-${c.mintMark}`;
  const variety = c.variety === null || c.variety === undefined || c.variety === '' ? '' : ` (${c.variety})`;
  return `${c.year}${mark}${variety}`;
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

const MORGAN_FILE = 'us-dollars-morgan.json';
const PEACE_FILE = 'us-dollars-peace.json';
const MORGAN_ALL = 'morgan-dollars-1878-1921.v1.json';
const MORGAN_KEY = 'morgan-dollars-key-dates.v1.json';
const MORGAN_KEY_V2 = 'morgan-dollars-key-dates.v2.json';
const PEACE_ALL = 'peace-dollars-1921-1935.v1.json';
const PEACE_KEY = 'peace-dollars-key-dates.v1.json';
const MORGAN_RAW = 'sources/Morgan_dollar.2026-11-25.json';
const PEACE_RAW = 'sources/Peace_dollar.2026-11-25.json';
const MORGAN_KEY_SOURCE = 'sources/manual-morgan-dollar-key-dates.2026-11-26.json';
const PEACE_KEY_SOURCE = 'sources/manual-peace-dollar-key-dates.2026-11-26.json';
const MORGAN_KEY_QUOTE = 'Rare & Key Dates: 1889-CC, 1893-S, 1895 (Proof)';
const PEACE_KEY_QUOTE = 'the 1928, which serves as the series key';
const README_HEADING = '## `us-dollars-morgan.json` / `us-dollars-peace.json` (Morgan and Peace silver dollars)';
const MODERN_HEADING = '## us-dollars-*.json (five files: Presidential through Susan B. Anthony)';
const OLD_HISTORY_HEADER = '**Morgan and Peace dollars (2026-11-25), backlog_growth.md 2.6:**';
const NEW_HISTORY_HEADER =
  '**Susan B. Anthony mintages and Morgan and Peace key dates (2026-11-26), backlog_growth.md 2.6, 2.10:**';

const morgan = loadFixture(MORGAN_FILE);
const peace = loadFixture(PEACE_FILE);
const BOTH: Fixture[] = [morgan, peace];
const bothCoins = [...morgan.coins, ...peace.coins];

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function expectedMorganMarks(year: number): string[] {
  if (year === 1878) return ['', 'CC', 'S'];
  if (year >= 1879 && year <= 1885) return ['', 'CC', 'O', 'S'];
  if (year >= 1886 && year <= 1888) return ['', 'O', 'S'];
  if (year >= 1889 && year <= 1893) return ['', 'CC', 'O', 'S'];
  if (year === 1894) return ['', 'O', 'S'];
  if (year === 1895) return ['O', 'S'];
  if (year >= 1896 && year <= 1904) return ['', 'O', 'S'];
  if (year === 1921) return ['', 'D', 'S'];
  return [];
}
function expectedPeaceMarks(year: number): string[] {
  if (year === 1921) return [''];
  if ([1922, 1923, 1926, 1927, 1934].includes(year)) return ['', 'D', 'S'];
  if ([1924, 1925, 1928, 1935].includes(year)) return ['', 'S'];
  return [];
}
const MORGAN_YEARS = [...Array.from({ length: 27 }, (_, i) => 1878 + i), 1921];
const PEACE_YEARS = [1921, 1922, 1923, 1924, 1925, 1926, 1927, 1928, 1934, 1935];

describe('identity, counts and year coverage (criteria 1, 2, 3)', () => {
  it('Morgan file: USA, Dollar, Morgan Dollar, 1878-1921, 95 coins', () => {
    expect(morgan.country).toBe('USA');
    expect(morgan.denomination).toBe('Dollar');
    expect(morgan.name).toBe('Morgan Dollar');
    expect(morgan.yearRange).toEqual([1878, 1921]);
    expect(morgan.coins).toHaveLength(95);
  });

  it('Peace file: USA, Dollar, Peace Dollar, 1921-1935, 24 coins', () => {
    expect(peace.country).toBe('USA');
    expect(peace.denomination).toBe('Dollar');
    expect(peace.name).toBe('Peace Dollar');
    expect(peace.yearRange).toEqual([1921, 1935]);
    expect(peace.coins).toHaveLength(24);
  });

  it('together 119 coins, and the names differ from each other and from the modern dollar names', () => {
    expect(bothCoins).toHaveLength(119);
    expect(morgan.name).not.toBe(peace.name);
    const modern = allFixtures.filter(
      (f) => f.denomination === 'Dollar' && f.name !== 'Morgan Dollar' && f.name !== 'Peace Dollar',
    );
    expect(modern.length).toBeGreaterThan(0);
    for (const f of modern) expect([morgan.name, peace.name]).not.toContain(f.name);
  });

  it('Morgan covers exactly 1878-1904 and 1921', () => {
    const years = [...new Set(morgan.coins.map((c) => c.year))].sort((a, b) => a - b);
    expect(years).toEqual(MORGAN_YEARS);
    expect(years.some((y) => y >= 1905 && y <= 1920)).toBe(false);
    expect(years.some((y) => y > 1921)).toBe(false);
  });

  it('Peace covers exactly 1921-1928 and 1934-1935', () => {
    const years = [...new Set(peace.coins.map((c) => c.year))].sort((a, b) => a - b);
    expect(years).toEqual(PEACE_YEARS);
    expect(years.some((y) => y >= 1929 && y <= 1933)).toBe(false);
    expect(years).not.toContain(1964);
    expect(years.some((y) => y > 1935)).toBe(false);
  });

  it('has the exact top-level keys in order (Morgan and Peace both with keyDates between specs and coins)', () => {
    const expected = [
      '$schema-note',
      'sources',
      'rules-note',
      'country',
      'denomination',
      'name',
      'yearRange',
      'specs',
      'keyDates',
      'coins',
    ];
    const mk = Object.keys(readJson<Record<string, unknown>>(path.join(FIXTURES_DIR, MORGAN_FILE)));
    expect(mk).toEqual(expected);
    const pk = Object.keys(readJson<Record<string, unknown>>(path.join(FIXTURES_DIR, PEACE_FILE)));
    expect(pk).toEqual(expected);
  });

  it('every coin has exactly year, mintMark, variety, isKeyDate, mintage and no image or specs', () => {
    for (const c of bothCoins) {
      expect(Object.keys(c).sort()).toEqual(['isKeyDate', 'mintMark', 'mintage', 'variety', 'year']);
      expect(typeof c.isKeyDate).toBe('boolean');
    }
  });

  it('coins are in source order: year ascending, then Philadelphia, O, S, CC, D (Morgan) / null, D, S (Peace)', () => {
    const morganRank: Record<string, number> = { '': 0, O: 1, S: 2, CC: 3, D: 4 };
    const peaceRank: Record<string, number> = { '': 0, D: 1, S: 2 };
    const order = (rank: Record<string, number>) => (a: RawCoinEntry, b: RawCoinEntry) =>
      a.year - b.year || rank[sanitizeIdentityField(a.mintMark)] - rank[sanitizeIdentityField(b.mintMark)];
    expect(morgan.coins).toEqual([...morgan.coins].sort(order(morganRank)));
    expect(peace.coins).toEqual([...peace.coins].sort(order(peaceRank)));
  });
});

describe('mint marks per year (criteria 1, 2)', () => {
  it('Morgan matches the contract mint mark set for every year 1878-1921', () => {
    const wrong: string[] = [];
    for (let y = 1878; y <= 1921; y++) {
      const got = marksOf(morgan.coins, y);
      const want = expectedMorganMarks(y);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${y}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('Peace matches the contract mint mark set for every year 1921-1935', () => {
    const wrong: string[] = [];
    for (let y = 1921; y <= 1935; y++) {
      const got = marksOf(peace.coins, y);
      const want = expectedPeaceMarks(y);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${y}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('unmarked Philadelphia coins are null (not "", not "P"); no P or W mark anywhere', () => {
    for (const c of bothCoins) {
      expect(c.mintMark === null || ['O', 'S', 'CC', 'D'].includes(c.mintMark as string)).toBe(true);
    }
    expect(morgan.coins.find((c) => c.year === 1878 && c.mintMark === null)).toBeDefined();
    expect(peace.coins.find((c) => c.year === 1922 && c.mintMark === null)).toBeDefined();
    expect(bothCoins.some((c) => c.mintMark === 'P' || c.mintMark === 'W')).toBe(false);
  });
});

describe('exclusions (criteria 1, 2, 5)', () => {
  it('the proof-only 1895 Philadelphia Morgan is absent; 1895 O and S are present', () => {
    expect(morgan.coins.find((c) => c.year === 1895 && c.mintMark === null)).toBeUndefined();
    expect(morgan.coins.filter((c) => c.year === 1895)).toHaveLength(2);
  });

  it('no Peace 1964 coin and no Morgan or Peace coin after 1935 except none', () => {
    expect(peace.coins.some((c) => c.year === 1964)).toBe(false);
    expect(morgan.coins.some((c) => c.year > 1921)).toBe(false);
    expect(peace.coins.some((c) => c.year > 1935)).toBe(false);
  });

  it('no variety suggests proofs, specimens or die varieties', () => {
    for (const c of bothCoins) {
      expect(c.variety ?? '').not.toMatch(/proof|specimen|8TF|7TF|tail|high relief|vam/i);
    }
  });
});

describe('varieties (criterion 6)', () => {
  it('only the two 1921 Philadelphia coins have a variety: Morgan and Peace', () => {
    const withVariety = bothCoins.filter((c) => (c.variety ?? null) !== null);
    expect(withVariety).toHaveLength(2);
    expect(morgan.coins.filter((c) => (c.variety ?? null) !== null)).toEqual([
      expect.objectContaining({ year: 1921, mintMark: null, variety: 'Morgan' }),
    ]);
    expect(peace.coins.filter((c) => (c.variety ?? null) !== null)).toEqual([
      expect.objectContaining({ year: 1921, mintMark: null, variety: 'Peace' }),
    ]);
  });

  it('the 1921 S and D Morgan coins have no variety', () => {
    expect(morgan.coins.find((c) => c.year === 1921 && c.mintMark === 'S')?.variety ?? null).toBeNull();
    expect(morgan.coins.find((c) => c.year === 1921 && c.mintMark === 'D')?.variety ?? null).toBeNull();
  });

  it('1878 Philadelphia is a single coin without a tail-feather variety', () => {
    const rows = morgan.coins.filter((c) => c.year === 1878 && c.mintMark === null);
    expect(rows).toHaveLength(1);
    expect(rows[0].variety ?? null).toBeNull();
    expect(rows[0].mintage).toBe(10508800);
  });

  it('across all fixtures only these two Dollar coins have variety Morgan or Peace', () => {
    const hits = allFixtures
      .filter((f) => f.denomination === 'Dollar')
      .flatMap((f) => f.coins.filter((c) => c.variety === 'Morgan' || c.variety === 'Peace').map((c) => fixtureKey(f, c)));
    expect(hits.sort()).toEqual(['USA|Dollar|1921||Morgan', 'USA|Dollar|1921||Peace']);
  });
});

describe('specs (criterion 3)', () => {
  it.each([
    ['Morgan', morgan],
    ['Peace', peace],
  ] as const)('%s coins are 38.1 mm, 26.73 g, 2.4 mm, 90% silver', (_label, file) => {
    for (const c of file.coins) {
      const s = toSpecFields(file, c);
      expect(s.diameterMm).toBe(38.1);
      expect(s.weightG).toBe(26.73);
      expect(s.thicknessMm).toBe(2.4);
      expect(s.material).toBe('Silver (90% silver, 10% copper)');
    }
  });

  it('differs from the Eisenhower dollar specs (falsifiable)', () => {
    const eisenhower = allFixtures.find((f) => /eisenhower/i.test(f.name));
    expect(eisenhower).toBeDefined();
    if (eisenhower) {
      expect(toSpecFields(eisenhower, eisenhower.coins[0]).weightG).not.toBe(26.73);
    }
  });

  it('no per-coin specs or images', () => {
    for (const c of bothCoins) {
      expect((c as { specs?: unknown }).specs).toBeUndefined();
      expect(c.image ?? null).toBeNull();
    }
  });

  it('the saved infoboxes give the same specs', () => {
    for (const rel of [MORGAN_RAW, PEACE_RAW]) {
      const wt = wikitextOf(rel);
      expect(wt).toMatch(/\|\s*Mass\s*=\s*26\.73/);
      expect(wt).toMatch(/\|\s*Diameter\s*=\s*38\.1/);
      expect(wt).toMatch(/\|\s*Thickness\s*=\s*2\.4/);
    }
    expect(wikitextOf(MORGAN_RAW)).toContain('90.0% Silver');
    expect(wikitextOf(PEACE_RAW)).toContain('.900 [[silver]]');
  });
});

describe('mintages and exact figures (criterion 4)', () => {
  it.each([
    [1878, null, 10508800],
    [1878, 'CC', 2212000],
    [1889, 'CC', 350000],
    [1893, 'S', 100000],
    [1895, 'O', 450000],
    [1895, 'S', 400000],
    [1921, 'S', 21695000],
    [1921, 'D', 20345000],
  ] as const)('Morgan %i %s has mintage %i', (year, mark, mintage) => {
    const hits = morgan.coins.filter((c) => c.year === year && c.mintMark === mark);
    expect(hits).toHaveLength(1);
    expect(hits[0].mintage).toBe(mintage);
  });

  it('Morgan 1921 Philadelphia (Morgan) has 44,690,000', () => {
    expect(morgan.coins.find((c) => c.year === 1921 && c.mintMark === null)?.mintage).toBe(44690000);
  });

  it.each([
    [1921, null, 1006473],
    [1928, null, 360649],
    [1928, 'S', 1632000],
    [1934, 'S', 1011000],
    [1935, 'S', 1964000],
  ] as const)('Peace %i %s has mintage %i', (year, mark, mintage) => {
    const hits = peace.coins.filter((c) => c.year === year && c.mintMark === mark);
    expect(hits).toHaveLength(1);
    expect(hits[0].mintage).toBe(mintage);
  });

  it('has no mintageSums key and no null mintage', () => {
    for (const f of BOTH) expect(f.mintageSums).toBeUndefined();
    expect(bothCoins.filter((c) => (c.mintage ?? null) === null)).toEqual([]);
  });

  it.each([
    ['Morgan', morgan, MORGAN_RAW],
    ['Peace', peace, PEACE_RAW],
  ] as const)('%s: every mintage appears in the saved wikitext as the comma-formatted figure', (_l, file, raw) => {
    const wikitext = wikitextOf(raw);
    expect(wikitext.length).toBeGreaterThan(1000);
    const missing = file.coins
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

describe('provenance (criterion 7)', () => {
  it.each([
    ['Morgan', morgan, MORGAN_RAW, 'Morgan dollar'],
    ['Peace', peace, PEACE_RAW, 'Peace dollar'],
  ] as const)('%s cites its saved article response and the revision matches', (_l, file, rawRel, title) => {
    expect(file.sources?.[0]?.rawResponse).toBe(rawRel);
    expect(file.sources?.[1]?.type).toBe('physical specs');
    const abs = path.join(IMPORT_CATALOG_DIR, rawRel);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe(title);
    expect(file.sources?.[0]?.revisionId).toBe(raw.parse.revid);
  });
});

describe('key dates (criteria 6, 7, 10 of run_20261126_230345)', () => {
  it('Morgan flags exactly 1889-CC and 1893-S, 93 others are false', () => {
    const flagged = morgan.coins.filter((c) => c.isKeyDate === true).map(label);
    expect(flagged).toEqual(['1889-CC', '1893-S']);
    expect(morgan.coins.filter((c) => c.isKeyDate === false)).toHaveLength(93);
  });

  it('Peace flags exactly 1928, 23 others are false', () => {
    const flagged = peace.coins.filter((c) => c.isKeyDate === true).map(label);
    expect(flagged).toEqual(['1928']);
    expect(peace.coins.filter((c) => c.isKeyDate === false)).toHaveLength(23);
    expect(peace.coins.every((c) => 'isKeyDate' in c)).toBe(true);
  });

  it('the scarce dates the manual files list are not flagged', () => {
    for (const [year, mark] of [
      [1884, 'S'],
      [1886, 'O'],
      [1892, 'S'],
      [1893, 'O'],
      [1895, 'O'],
      [1896, 'O'],
      [1893, 'CC'],
    ] as const) {
      expect(morgan.coins.find((c) => c.year === year && c.mintMark === mark)?.isKeyDate).toBe(false);
    }
    expect(morgan.coins.find((c) => c.year === 1901 && c.mintMark === null)?.isKeyDate).toBe(false);
    expect(peace.coins.find((c) => c.year === 1934 && c.mintMark === 'S')?.isKeyDate).toBe(false);
    expect(peace.coins.find((c) => c.year === 1921 && c.mintMark === null)?.isKeyDate).toBe(false);
  });

  it.each([
    ['Morgan', morgan, MORGAN_KEY_SOURCE, MORGAN_KEY_QUOTE, ['1889-CC', '1893-S']],
    ['Peace', peace, PEACE_KEY_SOURCE, PEACE_KEY_QUOTE, ['1928']],
  ] as const)('%s keyDates block: exact source, quote and labels; quote is in the raw source file', (_l, file, source, quote, coins) => {
    const kd = file.keyDates;
    expect(kd).toBeDefined();
    expect(Object.keys(kd ?? {})).toEqual(['source', 'quote', 'coins']);
    expect(kd?.source).toBe(source);
    expect(kd?.quote).toBe(quote);
    expect(kd?.coins).toEqual(coins);
    const abs = path.join(IMPORT_CATALOG_DIR, kd?.source ?? 'missing');
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs, 'utf8')).toContain(kd?.quote);
    for (const l of kd?.coins ?? []) expect(kd?.quote).toContain(l);
  });

  it.each([
    ['Morgan', morgan],
    ['Peace', peace],
  ] as const)('%s keyDates.coins equal the labels of the flagged rows in fixture order', (_l, file) => {
    expect(file.keyDates?.coins).toEqual(file.coins.filter((c) => c.isKeyDate === true).map(label));
  });

  it('the Morgan and Peace key-date blocks differ (falsifiable)', () => {
    expect(morgan.keyDates?.coins).not.toEqual(peace.keyDates?.coins);
    expect(morgan.keyDates?.source).not.toBe(peace.keyDates?.source);
  });

  it('the saved Peace article has no "key date" wording that names a coin', () => {
    expect(wikitextOf(PEACE_RAW)).not.toMatch(/key date/i);
  });
});

describe('rules-note (criteria 5, 6, 12)', () => {
  it('Morgan note mentions its required topics and the manual key-date source', () => {
    const note = morgan['rules-note'] ?? '';
    expect(note.trim().length).toBeGreaterThan(0);
    for (const n of [
      '1895',
      'proof',
      'null',
      '8TF',
      '7TF',
      'Morgan',
      'Peace',
      '1893-S',
      '1889-CC',
      'manual-morgan-dollar-key-dates.2026-11-26.json',
    ]) {
      expect(note).toContain(n);
    }
  });

  it('Peace note mentions its required topics and the manual key-date source', () => {
    const note = peace['rules-note'] ?? '';
    expect(note.trim().length).toBeGreaterThan(0);
    for (const n of [
      'null',
      '1921',
      'Morgan',
      'Peace',
      'high relief',
      '1964',
      'key date',
      '1928',
      'manual-peace-dollar-key-dates.2026-11-26.json',
    ]) {
      expect(note).toContain(n);
    }
    expect(note).not.toContain('no cited source names a key date');
  });
});

describe('no duplicate natural keys (criterion 6)', () => {
  it.each([MORGAN_FILE, PEACE_FILE])('%s has none', (file) => {
    const f = loadFixture(file);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('both files together have none, and the two 1921 Philadelphia keys differ', () => {
    expect(duplicates(BOTH.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
    expect(allFixtureKeys).toContain('USA|Dollar|1921||Morgan');
    expect(allFixtureKeys).toContain('USA|Dollar|1921||Peace');
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles).toEqual(expect.arrayContaining([MORGAN_FILE, PEACE_FILE]));
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('templates (criteria 8, 9, 10, 11)', () => {
  const morganAll = loadTemplate(MORGAN_ALL);
  const morganKeyV1 = loadTemplate(MORGAN_KEY);
  const morganKeyV2 = loadTemplate(MORGAN_KEY_V2);
  const peaceAll = loadTemplate(PEACE_ALL);
  const peaceKey = loadTemplate(PEACE_KEY);

  it('Morgan Dollars 1878-1921: exact name, description, 95 coins in fixture order', () => {
    expect(morganAll.name).toBe('Morgan Dollars 1878-1921');
    expect((morganAll.description ?? '').trim().length).toBeGreaterThan(0);
    expect(morganAll.coins).toHaveLength(95);
    expect(morganAll.coins).toEqual(asTemplateCoins(morgan));
  });

  it('Peace Dollars 1921-1935: exact name, description, 24 coins in fixture order', () => {
    expect(peaceAll.name).toBe('Peace Dollars 1921-1935');
    expect((peaceAll.description ?? '').trim().length).toBeGreaterThan(0);
    expect(peaceAll.coins).toHaveLength(24);
    expect(peaceAll.coins).toEqual(asTemplateCoins(peace));
  });

  it('Morgan Dollar Key Dates v1 is unchanged: cited description, the single 1893-S coin', () => {
    expect(morganKeyV1.name).toBe('Morgan Dollar Key Dates');
    const d = morganKeyV1.description ?? '';
    for (const n of ['Wikipedia', 'Morgan dollar', '1893-S']) expect(d).toContain(n);
    expect(morganKeyV1.coins).toEqual([{ country: 'USA', denomination: 'Dollar', year: 1893, mintMark: 'S', variety: '' }]);
  });

  it('Morgan Dollar Key Dates v2: exact name, description and the 1889-CC and 1893-S coins', () => {
    expect(morganKeyV2.name).toBe('Morgan Dollar Key Dates');
    expect(morganKeyV2.description).toBe(
      'The key dates of the Morgan dollar series as named by the cited sources (PCGS and APMEX, with English Wikipedia naming the 1893-S): the 1889-CC and the 1893-S.',
    );
    expect(morganKeyV2.coins).toEqual([
      { country: 'USA', denomination: 'Dollar', year: 1889, mintMark: 'CC', variety: '' },
      { country: 'USA', denomination: 'Dollar', year: 1893, mintMark: 'S', variety: '' },
    ]);
  });

  it('Peace Dollar Key Dates v1: exact name, description and the single 1928 coin', () => {
    expect(peaceKey.name).toBe('Peace Dollar Key Dates');
    expect(peaceKey.description).toBe(
      'The key date of the Peace dollar series as named by the cited source (Newman Numismatic Portal encyclopedia, Washington University in St. Louis): the 1928.',
    );
    expect(peaceKey.coins).toEqual([
      { country: 'USA', denomination: 'Dollar', year: 1928, mintMark: '', variety: '' },
    ]);
  });

  it('key-date template coins are exactly the flagged fixture coins, in fixture order', () => {
    expect(morganKeyV2.coins).toEqual(asTemplateCoins({ ...morgan, coins: morgan.coins.filter((c) => c.isKeyDate === true) }));
    expect(peaceKey.coins).toEqual(asTemplateCoins({ ...peace, coins: peace.coins.filter((c) => c.isKeyDate === true) }));
    // v1 is no longer the flagged set: it lacks the 1889-CC (falsifiable)
    expect(morganKeyV1.coins).not.toEqual(morganKeyV2.coins);
    expect(morganKeyV1.coins).toHaveLength(1);
    expect(morganKeyV2.coins).toHaveLength(2);
  });

  it('uses empty strings for no mint mark and no variety', () => {
    for (const t of [morganAll, peaceAll, morganKeyV1, morganKeyV2, peaceKey]) {
      for (const c of t.coins) {
        expect(typeof c.mintMark).toBe('string');
        expect(typeof c.variety).toBe('string');
        expect(c.country).toBe('USA');
        expect(c.denomination).toBe('Dollar');
      }
    }
  });

  it('this run\'s four names are each used by exactly one newest-version template', () => {
    const all = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => path.join(TEMPLATES_DIR, f));
    const names = latestTemplateVersions(all).map((p) => readJson<SeedTemplate>(p).name);
    for (const ours of [
      'Morgan Dollars 1878-1921',
      'Morgan Dollar Key Dates',
      'Peace Dollars 1921-1935',
      'Peace Dollar Key Dates',
    ]) {
      expect(names.filter((n) => n === ours)).toHaveLength(1);
    }
  });

  it('the seed picks Morgan key dates v2 and not v1, and picks the Peace key-dates template', () => {
    const picked = resolveTemplatePaths([]).map((p) => path.basename(p));
    expect(picked).toContain(MORGAN_KEY_V2);
    expect(picked).not.toContain(MORGAN_KEY);
    expect(picked).toContain(PEACE_KEY);
  });

  it('latestTemplateVersions keeps v2 over v1 for the Morgan key dates (falsifiable)', () => {
    const listing = [MORGAN_KEY, MORGAN_KEY_V2, PEACE_KEY].map((f) => path.join(TEMPLATES_DIR, f));
    expect(latestTemplateVersions(listing).map((p) => path.basename(p))).toEqual([MORGAN_KEY_V2, PEACE_KEY]);
    expect(latestTemplateVersions([listing[0]]).map((p) => path.basename(p))).toEqual([MORGAN_KEY]);
  });

  it.each([MORGAN_ALL, MORGAN_KEY, MORGAN_KEY_V2, PEACE_ALL, PEACE_KEY])(
    '%s: every coin matches exactly one fixture row',
    (file) => {
      const unresolved: string[] = [];
      for (const coin of loadTemplate(file).coins) {
        const matches = allFixtureKeys.filter((k) => k === templateKey(coin)).length;
        if (matches !== 1) unresolved.push(`${templateKey(coin)} x${matches}`);
      }
      expect(unresolved).toEqual([]);
    },
  );

  it('a coin that is in no fixture would be flagged (falsifiable)', () => {
    const fake = templateKey({ country: 'USA', denomination: 'Dollar', year: 1895, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('README sections (criteria 5, 7, 13, 14)', () => {
  const readme = fs.readFileSync(path.join(FIXTURES_DIR, 'README.md'), 'utf8');
  const section = readSection(readme, README_HEADING);
  const modern = readSection(readme, MODERN_HEADING);

  it('has the exact new heading and a non-empty section', () => {
    expect(section.length).toBeGreaterThan(200);
  });

  it('names both files, both articles, 1895, 8TF, 1893-S, null and 2.9', () => {
    for (const needle of [MORGAN_FILE, PEACE_FILE, 'Morgan dollar', 'Peace dollar', '1895', '8TF', '1893-S', 'null', '2.9']) {
      expect(section).toContain(needle);
    }
  });

  it('names the new key dates, the new checklists, the v2 file and the not-given 1893-CC', () => {
    for (const needle of [
      '1889-CC',
      '1928',
      'Peace Dollar Key Dates',
      'morgan-dollars-key-dates.v2.json',
      'peace-dollars-key-dates.v1.json',
      'manual-morgan-dollar-key-dates.2026-11-26.json',
      'manual-peace-dollar-key-dates.2026-11-26.json',
      '1893-CC',
    ]) {
      expect(section).toContain(needle);
    }
  });

  it('the modern dollar section keeps its heading and points to the Morgan file', () => {
    expect(modern.length).toBeGreaterThan(200);
    expect(modern).toContain(MORGAN_FILE);
    expect(modern).toContain('Morgan');
  });

  it('readSection stops at the next level-2 heading (falsifiable)', () => {
    expect(readSection('## a\nx\n## b\ny', '## a')).toBe('## a\nx');
    expect(readSection('## a\nx', '## missing')).toBe('');
  });
});

describe('backlog (criterion 13)', () => {
  const backlog = fs.readFileSync(path.join(REPO_ROOT, 'docs/backlog_growth.md'), 'utf8');
  const lines = backlog.split('\n');
  const line = lines.find((l) => l.startsWith('- [x] 2.6 '));

  it('ticks 2.6 and names 2.9, both key-date sets, 1889-CC, 1928 and seed:canonical', () => {
    expect(line).toBeDefined();
    for (const n of ['2.9', 'Morgan Dollar Key Dates', 'Peace Dollar Key Dates', '1889-CC', '1928', 'seed:canonical']) {
      expect(line).toContain(n);
    }
  });

  it('leaves 2.9 unticked and 2.1 ticked', () => {
    expect(lines.some((l) => l.startsWith('- [ ] 2.9 '))).toBe(true);
    expect(lines.some((l) => l.startsWith('- [x] 2.1 '))).toBe(true);
    expect(lines.some((l) => l.startsWith('- [ ] 2.6 '))).toBe(false);
  });
});

describe('history (criterion 13)', () => {
  const history = fs.readFileSync(path.join(REPO_ROOT, 'docs/history.md'), 'utf8');
  const historyLines = history.split('\n');

  it('keeps the 2026-11-25 paragraph as written, with counts, the 1893-S key date, the 1895 exclusion and Peace', () => {
    const para = historyLines.find((l) => l.startsWith(OLD_HISTORY_HEADER));
    expect(para).toBeDefined();
    for (const n of ['2.6', '95', '24', '1893-S', '1895', 'Peace']) expect(para).toContain(n);
  });

  it('has the new 2026-11-26 paragraph with the key dates, the manual sources and the pending 2.9 pass', () => {
    const para = historyLines.find((l) => l.startsWith(NEW_HISTORY_HEADER));
    expect(para).toBeDefined();
    for (const n of ['1889-CC', '1928', '2.9', 'manual']) expect(para).toContain(n);
  });
});

describe('existing data is unchanged (criterion 13)', () => {
  it('the modern dollar fixtures other than Eisenhower still have no null mint mark', () => {
    const modern = allFixtures.filter(
      (f) =>
        f.denomination === 'Dollar' &&
        f.name !== 'Morgan Dollar' &&
        f.name !== 'Peace Dollar' &&
        f.name !== 'Eisenhower Dollars',
    );
    expect(modern.length).toBeGreaterThanOrEqual(4);
    for (const f of modern) expect(f.coins.some((c) => c.mintMark === null)).toBe(false);
  });

  it('the Eisenhower null rows are all dated 1971-1978', () => {
    const eisenhower = allFixtures.find((f) => f.name === 'Eisenhower Dollars');
    expect(eisenhower).toBeDefined();
    const nulls = (eisenhower?.coins ?? []).filter((c) => c.mintMark === null);
    expect(nulls.length).toBeGreaterThan(0);
    for (const c of nulls) {
      expect(c.year).toBeGreaterThanOrEqual(1971);
      expect(c.year).toBeLessThanOrEqual(1978);
    }
  });

  it('eisenhower-dollars.v1.json still has 16 coins', () => {
    expect(loadTemplate('eisenhower-dollars.v1.json').coins).toHaveLength(16);
  });
});
