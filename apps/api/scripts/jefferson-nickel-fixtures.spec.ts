/**
 * Tests for: Jefferson nickel fixtures (growth backlog 2.2), the two canonical set templates built
 * from them, their key dates, provenance in the saved source, the README section and the backlog tick.
 * Contract source: runs/run_20261125_061116/plan.md § Interface Contract
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #10, #12, #13 (from runs/run_20261125_061116/prd.md)
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

const CN_FILE = 'us-nickels-jefferson-copper-nickel.json';
const WAR_FILE = 'us-nickels-jefferson-wartime-silver.json';
const ALL_TEMPLATE = 'jefferson-nickels-1938-2026.v1.json';
const KEY_TEMPLATE = 'jefferson-nickels-key-dates.v1.json';
const RAW_REL = 'sources/United_States_nickel_mintage_figures.2026-11-25.json';
const README_HEADING = '## `us-nickels-jefferson-*.json` (two files: copper-nickel and wartime silver)';

const cn = loadFixture(CN_FILE);
const war = loadFixture(WAR_FILE);
const BOTH: Fixture[] = [cn, war];
const bothCoins = [...cn.coins, ...war.coins];

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function expectedMarks(year: number): string[] {
  if (year <= 1941) return ['', 'D', 'S'];
  if (year === 1942) return ['', 'D', 'P', 'S'];
  if (year <= 1945) return ['D', 'P', 'S'];
  if (year === 1950) return ['', 'D'];
  if (year <= 1954) return ['', 'D', 'S'];
  if (year <= 1964) return ['', 'D'];
  if (year <= 1967) return [''];
  if (year <= 1970) return ['D', 'S'];
  if (year <= 1979) return ['', 'D'];
  return ['D', 'P'];
}

describe('identity, counts and year range (criteria 3, 6, 12)', () => {
  it('copper-nickel file: USA, Nickel, Jefferson Nickel, 1938-2025, 183 coins', () => {
    expect(cn.country).toBe('USA');
    expect(cn.denomination).toBe('Nickel');
    expect(cn.name).toBe('Jefferson Nickel');
    expect(cn.yearRange).toEqual([1938, 2025]);
    expect(cn.coins).toHaveLength(183);
    const ys = cn.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1938);
    expect(Math.max(...ys)).toBe(2025);
  });

  it('wartime file: USA, Nickel, Jefferson Nickel, 1942-1945, 11 coins', () => {
    expect(war.country).toBe('USA');
    expect(war.denomination).toBe('Nickel');
    expect(war.name).toBe('Jefferson Nickel');
    expect(war.yearRange).toEqual([1942, 1945]);
    expect(war.coins).toHaveLength(11);
    const ys = war.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1942);
    expect(Math.max(...ys)).toBe(1945);
  });

  it('covers every year 1938-2025 across both files and has no 2026 coin', () => {
    const years = new Set(bothCoins.map((c) => c.year));
    for (let y = 1938; y <= 2025; y++) expect(years.has(y)).toBe(true);
    expect(years.has(2026)).toBe(false);
    expect(years.has(1937)).toBe(false);
    expect(bothCoins).toHaveLength(194);
  });

  it('has the exact top-level keys in order for the copper-nickel file', () => {
    const keys = Object.keys(readJson<Record<string, unknown>>(path.join(FIXTURES_DIR, CN_FILE)));
    expect(keys).toEqual([
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
    ]);
  });

  it('every coin has exactly year, mintMark, variety, isKeyDate, mintage and no image or specs', () => {
    for (const c of bothCoins) {
      expect(Object.keys(c).sort()).toEqual(['isKeyDate', 'mintMark', 'mintage', 'variety', 'year']);
      expect(typeof c.isKeyDate).toBe('boolean');
    }
  });

  it('is business strikes only: no proof, set, satin or enhanced varieties; no Buffalo 1938 D row', () => {
    for (const c of bothCoins) {
      expect(c.variety ?? '').not.toMatch(/proof|satin|special|uncirculated|enhanced|matte|indian head/i);
      expect(c.variety ?? '').not.toMatch(/composition/i);
    }
    expect(cn.coins.filter((c) => c.year === 1938)).toHaveLength(3);
    expect(cn.coins.filter((c) => c.year === 1994)).toHaveLength(2);
    expect(cn.coins.filter((c) => c.year === 1997)).toHaveLength(2);
    expect(cn.coins.filter((c) => c.year === 2017)).toHaveLength(2);
  });
});

describe('mint marks per year (criterion 4)', () => {
  it('matches the contract mint mark set for every year 1938-2025', () => {
    const wrong: string[] = [];
    for (let y = 1938; y <= 2025; y++) {
      const got = marksOf(bothCoins, y);
      const want = expectedMarks(y);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${y}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('1942 has no-mark and D in copper-nickel and P and S in the wartime file', () => {
    expect(marksOf(cn.coins, 1942)).toEqual(['', 'D']);
    expect(marksOf(war.coins, 1942)).toEqual(['P', 'S']);
  });

  it('wartime file is 1942 P and S then 1943-1945 P, D, S, all P-bearing marks real and null-free', () => {
    const keys = war.coins.map((c) => `${c.year}${c.mintMark}`).sort();
    expect(keys).toEqual(['1942P', '1942S', '1943D', '1943P', '1943S', '1944D', '1944P', '1944S', '1945D', '1945P', '1945S']);
    for (const c of war.coins) expect(c.variety ?? null).toBeNull();
  });

  it('no coin has a W mint mark and unmarked coins use null, not an empty string or "P" before 1980', () => {
    for (const c of bothCoins) {
      expect(c.mintMark).not.toBe('W');
      expect(c.mintMark).not.toBe('');
      if (c.year < 1980 && c.year !== 1942 && !(c.year >= 1943 && c.year <= 1945)) expect(c.mintMark).not.toBe('P');
    }
    expect(cn.coins.find((c) => c.year === 1965)?.mintMark).toBeNull();
    expect(cn.coins.find((c) => c.year === 1980 && c.mintMark === 'P')).toBeDefined();
  });

  it('1965, 1966 and 1967 are one no-mark coin each with the source figure', () => {
    const want: Record<number, number> = { 1965: 136131380, 1966: 156208283, 1967: 107325800 };
    for (const [y, m] of Object.entries(want)) {
      const rows = cn.coins.filter((c) => c.year === Number(y));
      expect(rows).toHaveLength(1);
      expect(rows[0].mintMark).toBeNull();
      expect(rows[0].mintage).toBe(m);
    }
  });

  it('1942 no-mark and P figures, and 1950 D, 1939 D figures', () => {
    expect(cn.coins.find((c) => c.year === 1942 && c.mintMark === null)?.mintage).toBe(49818600);
    expect(war.coins.find((c) => c.year === 1942 && c.mintMark === 'P')?.mintage).toBe(57900600);
    expect(cn.coins.find((c) => c.year === 1950 && c.mintMark === 'D')?.mintage).toBe(2630030);
    expect(cn.coins.find((c) => c.year === 1939 && c.mintMark === 'D')?.mintage).toBe(3514000);
  });
});

describe('varieties: Westward Journey (criterion 13)', () => {
  it('only 2004 and 2005 have varieties, exactly the eight designs', () => {
    const withVariety = bothCoins.filter((c) => (c.variety ?? null) !== null);
    expect(withVariety.every((c) => c.year === 2004 || c.year === 2005)).toBe(true);
    const keys = withVariety.map((c) => `${c.year}|${c.mintMark}|${c.variety}`).sort();
    const want = [
      ...['P', 'D'].flatMap((m) => [`2004|${m}|Louisiana Purchase`, `2004|${m}|Keelboat`]),
      ...['P', 'D'].flatMap((m) => [`2005|${m}|American Bison`, `2005|${m}|Ocean in View`]),
    ].sort();
    expect(keys).toEqual(want);
    expect(withVariety).toHaveLength(8);
  });

  it('2004 and 2005 have no coin without a variety, and 2003 and 2006 have none with one', () => {
    for (const y of [2004, 2005]) {
      const rows = cn.coins.filter((c) => c.year === y);
      expect(rows).toHaveLength(4);
      expect(rows.every((c) => (c.variety ?? null) !== null)).toBe(true);
    }
    for (const y of [2003, 2006]) {
      const rows = cn.coins.filter((c) => c.year === y);
      expect(rows).toHaveLength(2);
      expect(rows.every((c) => (c.variety ?? null) === null)).toBe(true);
    }
  });
});

describe('specs (criteria 6, 12)', () => {
  it('copper-nickel coins are 21.21 mm, 5 g, no thickness, copper-nickel', () => {
    for (const c of cn.coins) {
      const s = toSpecFields(cn, c);
      expect(s.diameterMm).toBe(21.21);
      expect(s.weightG).toBe(5);
      expect(s.thicknessMm).toBeNull();
      expect(s.material).toBe('Copper-nickel (75% copper, 25% nickel)');
    }
  });

  it('wartime coins are 21.21 mm, 5 g, silver alloy: a different material from the copper-nickel file', () => {
    for (const c of war.coins) {
      const s = toSpecFields(war, c);
      expect(s.diameterMm).toBe(21.21);
      expect(s.weightG).toBe(5);
      expect(s.thicknessMm).toBeNull();
      expect(s.material).toBe('Silver alloy (56% copper, 35% silver, 9% manganese)');
    }
    expect(toSpecFields(war, war.coins[0]).material).not.toBe(toSpecFields(cn, cn.coins[0]).material);
  });

  it('no per-coin specs or images', () => {
    for (const c of bothCoins) {
      expect((c as { specs?: unknown }).specs).toBeUndefined();
      expect(c.image ?? null).toBeNull();
    }
  });
});

describe('key dates (criterion 9)', () => {
  it('flags exactly 1939 D and 1950 D in the copper-nickel file', () => {
    const flagged = cn.coins.filter((c) => c.isKeyDate === true).map((c) => `${c.year}-${c.mintMark}`).sort();
    expect(flagged).toEqual(['1939-D', '1950-D']);
    expect(cn.coins.filter((c) => c.isKeyDate === false)).toHaveLength(181);
  });

  it('wartime file flags nothing and has no keyDates block', () => {
    expect(war.coins.every((c) => c.isKeyDate === false)).toBe(true);
    expect(war.keyDates).toBeUndefined();
  });

  it('keyDates block names the source, a verbatim quote and the two labels', () => {
    const kd = cn.keyDates;
    expect(kd).toBeDefined();
    expect(kd?.coins).toEqual(['1939-D', '1950-D']);
    expect(kd?.source).toBe(RAW_REL);
    expect(fs.existsSync(path.join(IMPORT_CATALOG_DIR, kd?.source ?? 'missing'))).toBe(true);
    const wikitext = wikitextOf(kd?.source ?? '');
    expect(kd?.quote.length).toBeGreaterThan(10);
    expect(wikitext).toContain(kd?.quote);
    for (const label of kd?.coins ?? []) expect(kd?.quote).toContain(label);
  });
});

describe('rules-note (criteria 4, 6, 12, 13)', () => {
  it.each([
    ['copper-nickel', cn, ['parentheses', 'null', '1942', '1965-1967', 'Westward Journey']],
    ['wartime', war, ['parentheses', 'null', '1942', 'large mint mark']],
  ] as const)('%s file mentions its required topics', (_label, file, needles) => {
    const note = file['rules-note'];
    expect(typeof note).toBe('string');
    expect((note ?? '').trim().length).toBeGreaterThan(0);
    for (const n of needles) expect(note).toContain(n);
  });
});

describe('provenance (criteria 2, 5)', () => {
  it('both files cite the saved nickel article response', () => {
    for (const f of BOTH) {
      expect(f.sources?.[0]?.rawResponse).toBe(RAW_REL);
      expect(f.sources?.[1]?.type).toBe('physical specs');
    }
  });

  it('the saved response is the nickel article revision named in sources[0]', () => {
    const abs = path.join(IMPORT_CATALOG_DIR, RAW_REL);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe('United States nickel mintage figures');
    for (const f of BOTH) expect(f.sources?.[0]?.revisionId).toBe(raw.parse.revid);
  });

  it('has no mintageSums key and no null mintage', () => {
    for (const f of BOTH) expect(f.mintageSums).toBeUndefined();
    expect(bothCoins.filter((c) => (c.mintage ?? null) === null)).toEqual([]);
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
  it.each([CN_FILE, WAR_FILE])('%s has none', (file) => {
    const f = loadFixture(file);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('both files together have none', () => {
    expect(duplicates(BOTH.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles).toEqual(expect.arrayContaining([CN_FILE, WAR_FILE]));
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('templates (criterion 7)', () => {
  const all = loadTemplate(ALL_TEMPLATE);
  const key = loadTemplate(KEY_TEMPLATE);

  it('Jefferson Nickels 1938-2026: exact name, description, 194 coins', () => {
    expect(all.name).toBe('Jefferson Nickels 1938-2026');
    expect((all.description ?? '').trim().length).toBeGreaterThan(0);
    expect(all.coins).toHaveLength(194);
  });

  it('is the copper-nickel then wartime coins stable-sorted by year', () => {
    const expected = [...asTemplateCoins(cn), ...asTemplateCoins(war)].sort((a, b) => a.year - b.year);
    expect(all.coins).toEqual(expected);
    const y1942 = all.coins.filter((c) => c.year === 1942).map((c) => c.mintMark);
    expect(y1942).toEqual(['', 'D', 'P', 'S']);
  });

  it('uses empty strings for no mint mark and no variety', () => {
    for (const c of all.coins) {
      expect(typeof c.mintMark).toBe('string');
      expect(typeof c.variety).toBe('string');
      expect(c.country).toBe('USA');
      expect(c.denomination).toBe('Nickel');
    }
  });

  it('Jefferson Nickel Key Dates: exact name, description, 1939 D then 1950 D', () => {
    expect(key.name).toBe('Jefferson Nickel Key Dates');
    expect((key.description ?? '').trim().length).toBeGreaterThan(0);
    expect(key.coins).toEqual([
      { country: 'USA', denomination: 'Nickel', year: 1939, mintMark: 'D', variety: '' },
      { country: 'USA', denomination: 'Nickel', year: 1950, mintMark: 'D', variety: '' },
    ]);
  });

  it('key-date template coins are exactly the flagged fixture coins', () => {
    const flagged = cn.coins.filter((c) => c.isKeyDate === true);
    expect(key.coins).toEqual(asTemplateCoins({ ...cn, coins: flagged }));
  });

  it('template names are unique across the directory', () => {
    const names = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => loadTemplate(f).name);
    expect(duplicates(names)).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(['Jefferson Nickels 1938-2026', 'Jefferson Nickel Key Dates']));
  });

  it.each([ALL_TEMPLATE, KEY_TEMPLATE])('%s: every coin matches exactly one fixture row', (file) => {
    const unresolved: string[] = [];
    for (const coin of loadTemplate(file).coins) {
      const matches = allFixtureKeys.filter((k) => k === templateKey(coin)).length;
      if (matches !== 1) unresolved.push(`${templateKey(coin)} x${matches}`);
    }
    expect(unresolved).toEqual([]);
  });

  it('a coin that is in no fixture would be flagged (falsifiable)', () => {
    const fake = templateKey({ country: 'USA', denomination: 'Nickel', year: 2026, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('README section (criteria 2, 8, 10)', () => {
  const readme = fs.readFileSync(path.join(FIXTURES_DIR, 'README.md'), 'utf8');
  const section = readSection(readme, README_HEADING);

  it('has the exact heading and a non-empty section', () => {
    expect(section.length).toBeGreaterThan(200);
  });

  it('names both files, the article, 2.9, the key dates and 2026', () => {
    for (const needle of [CN_FILE, WAR_FILE, 'United States nickel mintage figures', '2.9', '1939-D', '1950-D', '2026']) {
      expect(section).toContain(needle);
    }
  });

  it('readSection stops at the next level-2 heading (falsifiable)', () => {
    expect(readSection('## a\nx\n## b\ny', '## a')).toBe('## a\nx');
    expect(readSection('## a\nx', '## missing')).toBe('');
  });
});

describe('backlog (criteria 1, 11)', () => {
  const backlog = fs.readFileSync(path.join(REPO_ROOT, 'docs/backlog_growth.md'), 'utf8');
  const line = backlog.split('\n').find((l) => l.startsWith('- [x] 2.2 '));

  it('ticks 2.2 and notes the pending manual pass under 2.9', () => {
    expect(line).toBeDefined();
    expect(line).toContain('2.9');
  });

  it('does not alter the 2.1 tick', () => {
    expect(backlog.split('\n').some((l) => l.startsWith('- [x] 2.1 '))).toBe(true);
  });
});

describe('history (criterion 11)', () => {
  it('has the dated paragraph for the three series', () => {
    const history = fs.readFileSync(path.join(REPO_ROOT, 'docs/history.md'), 'utf8');
    expect(history).toContain('**Jefferson nickels, Roosevelt dimes and Washington quarters 1932-1998 (2026-11-25), backlog_growth.md 2.2-2.4:**');
  });
});
