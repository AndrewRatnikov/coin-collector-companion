/**
 * Tests for: Roosevelt dime fixtures (growth backlog 2.3), the canonical set template built from them,
 * provenance in the saved source, the README section and the backlog tick.
 * Contract source: runs/run_20261125_061116/plan.md § Interface Contract
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #10, #14 (from runs/run_20261125_061116/prd.md)
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

const SILVER_FILE = 'us-dimes-roosevelt-silver.json';
const CLAD_FILE = 'us-dimes-roosevelt-clad.json';
const TEMPLATE = 'roosevelt-dimes-1946-2026.v1.json';
const RAW_REL = 'sources/Roosevelt_dime_mintage_figures.2026-11-25.json';
const README_HEADING = '## `us-dimes-roosevelt-*.json` (two files: silver and clad)';

const silver = loadFixture(SILVER_FILE);
const clad = loadFixture(CLAD_FILE);
const BOTH: Fixture[] = [silver, clad];
const bothCoins = [...silver.coins, ...clad.coins];

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function expectedMarks(year: number): string[] {
  if (year <= 1955) return ['D', 'P', 'S'];
  if (year <= 1964) return ['D', 'P'];
  if (year <= 1967) return [''];
  if (year <= 1979) return ['', 'D'];
  if (year === 1982) return ['', 'D', 'P'];
  return ['D', 'P'];
}

describe('identity, counts and year range (criteria 3, 6, 14)', () => {
  it('silver file: USA, Dime, Roosevelt Dime, 1946-1964, 48 coins', () => {
    expect(silver.country).toBe('USA');
    expect(silver.denomination).toBe('Dime');
    expect(silver.name).toBe('Roosevelt Dime');
    expect(silver.yearRange).toEqual([1946, 1964]);
    expect(silver.coins).toHaveLength(48);
    const ys = silver.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1946);
    expect(Math.max(...ys)).toBe(1964);
  });

  it('clad file: USA, Dime, Roosevelt Dime, 1965-2025, 120 coins', () => {
    expect(clad.country).toBe('USA');
    expect(clad.denomination).toBe('Dime');
    expect(clad.name).toBe('Roosevelt Dime');
    expect(clad.yearRange).toEqual([1965, 2025]);
    expect(clad.coins).toHaveLength(120);
    const ys = clad.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(1965);
    expect(Math.max(...ys)).toBe(2025);
  });

  it('covers every year 1946-2025, 168 coins, no 2026 and no 1945', () => {
    const years = new Set(bothCoins.map((c) => c.year));
    for (let y = 1946; y <= 2025; y++) expect(years.has(y)).toBe(true);
    expect(years.has(2026)).toBe(false);
    expect(years.has(1945)).toBe(false);
    expect(bothCoins).toHaveLength(168);
  });

  it('every coin has exactly year, mintMark, variety, isKeyDate, mintage', () => {
    for (const c of bothCoins) {
      expect(Object.keys(c).sort()).toEqual(['isKeyDate', 'mintMark', 'mintage', 'variety', 'year']);
    }
  });

  it('is business strikes only: no variety at all, no W or S after 1955, no 1996 W', () => {
    for (const c of bothCoins) {
      expect(c.variety ?? null).toBeNull();
      expect(c.mintMark).not.toBe('W');
    }
    expect(clad.coins.some((c) => c.mintMark === 'S')).toBe(false);
    expect(clad.coins.filter((c) => c.year === 1996)).toHaveLength(2);
    expect(silver.coins.filter((c) => c.mintMark === 'S').every((c) => c.year <= 1955)).toBe(true);
  });
});

describe('mint marks per year (criteria 4, 14)', () => {
  it('matches the contract mint mark set for every year 1946-2025', () => {
    const wrong: string[] = [];
    for (let y = 1946; y <= 2025; y++) {
      const got = marksOf(bothCoins, y);
      const want = expectedMarks(y);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push(`${y}: ${JSON.stringify(got)} != ${JSON.stringify(want)}`);
    }
    expect(wrong).toEqual([]);
  });

  it('1965, 1966 and 1967 are one no-mark coin each with the combined source figure', () => {
    const want: Record<number, number> = { 1965: 1652140570, 1966: 1382734540, 1967: 2244007320 };
    for (const [y, m] of Object.entries(want)) {
      const rows = clad.coins.filter((c) => c.year === Number(y));
      expect(rows).toHaveLength(1);
      expect(rows[0].mintMark).toBeNull();
      expect(rows[0].mintage).toBe(m);
    }
  });

  it('silver dimes keep the source plain P (not null) and clad 1968-1979 use null', () => {
    for (const c of silver.coins) expect(c.mintMark).not.toBeNull();
    expect(silver.coins.filter((c) => c.mintMark === 'P')).toHaveLength(19);
    for (let y = 1968; y <= 1979; y++) {
      expect(clad.coins.filter((c) => c.year === y && c.mintMark === null)).toHaveLength(1);
    }
    expect(clad.coins.find((c) => c.year === 1980 && c.mintMark === 'P')).toBeDefined();
  });
});

describe('1982 no-mark dime and null mintages (criterion 5)', () => {
  it('1982 has a no-mark coin without variety and with a null mintage', () => {
    const rows = clad.coins.filter((c) => c.year === 1982 && c.mintMark === null);
    expect(rows).toHaveLength(1);
    expect(rows[0].variety ?? null).toBeNull();
    expect(rows[0].mintage).toBeNull();
  });

  it('is the only null mintage in either file', () => {
    const nulls = bothCoins.filter((c) => (c.mintage ?? null) === null).map((c) => `${c.year}-${c.mintMark}`);
    expect(nulls).toEqual(['1982-null']);
  });

  it('1982 P and D carry real figures', () => {
    for (const m of ['P', 'D']) {
      const c = clad.coins.find((x) => x.year === 1982 && x.mintMark === m);
      expect(typeof c?.mintage).toBe('number');
    }
  });
});

describe('specs (criterion 6)', () => {
  it('silver coins are 17.91 mm, 2.5 g, 90% silver', () => {
    for (const c of silver.coins) {
      const s = toSpecFields(silver, c);
      expect(s.diameterMm).toBe(17.91);
      expect(s.weightG).toBe(2.5);
      expect(s.thicknessMm).toBeNull();
      expect(s.material).toBe('Silver (90% silver, 10% copper)');
    }
  });

  it('clad coins are 17.91 mm, 2.268 g, copper-nickel clad copper: different from silver', () => {
    for (const c of clad.coins) {
      const s = toSpecFields(clad, c);
      expect(s.diameterMm).toBe(17.91);
      expect(s.weightG).toBe(2.268);
      expect(s.thicknessMm).toBeNull();
      expect(s.material).toBe('Copper-nickel clad copper (75% copper, 25% nickel outer layers, pure copper core)');
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
});

describe('rules-note (criteria 4, 14)', () => {
  it.each([
    ['silver', silver, ['parentheses', 'null', 'plain P', '2.9']],
    ['clad', clad, ['parentheses', 'null', '1965-1967', '1982']],
  ] as const)('%s file mentions its required topics', (_label, file, needles) => {
    const note = file['rules-note'];
    expect(typeof note).toBe('string');
    for (const n of needles) expect(note).toContain(n);
  });
});

describe('provenance (criteria 2, 5)', () => {
  it('both files cite the saved dime article response', () => {
    for (const f of BOTH) {
      expect(f.sources?.[0]?.rawResponse).toBe(RAW_REL);
      expect(f.sources?.[1]?.type).toBe('physical specs');
    }
  });

  it('the saved response is the dime article revision named in sources[0]', () => {
    const abs = path.join(IMPORT_CATALOG_DIR, RAW_REL);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe('Roosevelt dime mintage figures');
    for (const f of BOTH) expect(f.sources?.[0]?.revisionId).toBe(raw.parse.revid);
  });

  it('has no mintageSums key', () => {
    for (const f of BOTH) expect(f.mintageSums).toBeUndefined();
  });

  it('every non-null mintage appears in the wikitext as the comma-formatted figure', () => {
    const wikitext = wikitextOf(RAW_REL);
    expect(wikitext.length).toBeGreaterThan(1000);
    const missing = bothCoins
      .filter((c) => c.mintage !== null && c.mintage !== undefined)
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
    expect(allFixtureFiles).toEqual(expect.arrayContaining([SILVER_FILE, CLAD_FILE]));
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('template (criterion 7)', () => {
  const template = loadTemplate(TEMPLATE);

  it('Roosevelt Dimes 1946-2026: exact name, description, 168 coins', () => {
    expect(template.name).toBe('Roosevelt Dimes 1946-2026');
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
    expect(template.coins).toHaveLength(168);
  });

  it('is the silver then clad coins in file order', () => {
    expect(template.coins).toEqual([...asTemplateCoins(silver), ...asTemplateCoins(clad)]);
    expect(template.coins[0].year).toBe(1946);
    expect(template.coins[template.coins.length - 1].year).toBe(2025);
  });

  it('uses empty strings for no mint mark and no variety', () => {
    for (const c of template.coins) {
      expect(typeof c.mintMark).toBe('string');
      expect(c.variety).toBe('');
      expect(c.denomination).toBe('Dime');
    }
  });

  it('template names are unique across the directory', () => {
    const names = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => loadTemplate(f).name);
    expect(names.filter((n) => n === 'Roosevelt Dimes 1946-2026')).toHaveLength(1);
  });

  it('every coin matches exactly one fixture row', () => {
    const unresolved: string[] = [];
    for (const coin of template.coins) {
      const matches = allFixtureKeys.filter((k) => k === templateKey(coin)).length;
      if (matches !== 1) unresolved.push(`${templateKey(coin)} x${matches}`);
    }
    expect(unresolved).toEqual([]);
  });

  it('there is no dime key-date template (no source names key dates)', () => {
    const names = fs.readdirSync(TEMPLATES_DIR).filter((f) => /dime/i.test(f));
    expect(names).toEqual([TEMPLATE]);
  });

  it('a coin that is in no fixture would be flagged (falsifiable)', () => {
    const fake = templateKey({ country: 'USA', denomination: 'Dime', year: 2026, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('README section (criteria 2, 8, 10)', () => {
  const readme = fs.readFileSync(path.join(FIXTURES_DIR, 'README.md'), 'utf8');
  const section = readSection(readme, README_HEADING);

  it('names both files, the article, 2.9, 2026 and the plain P decision', () => {
    expect(section.length).toBeGreaterThan(200);
    for (const needle of [SILVER_FILE, CLAD_FILE, 'Roosevelt dime mintage figures', '2.9', '2026', 'plain P']) {
      expect(section).toContain(needle);
    }
  });

  it('readSection stops at the next level-2 heading (falsifiable)', () => {
    expect(readSection('## a\nx\n## b\ny', '## a')).toBe('## a\nx');
    expect(readSection('## a\nx', '## missing')).toBe('');
  });
});

describe('backlog and history (criteria 1, 11)', () => {
  it('ticks 2.3 and notes the pending manual pass under 2.9', () => {
    const backlog = fs.readFileSync(path.join(REPO_ROOT, 'docs/backlog_growth.md'), 'utf8');
    const line = backlog.split('\n').find((l) => l.startsWith('- [x] 2.3 '));
    expect(line).toBeDefined();
    expect(line).toContain('2.9');
  });

  it('has the dated history paragraph', () => {
    const history = fs.readFileSync(path.join(REPO_ROOT, 'docs/history.md'), 'utf8');
    expect(history).toContain('**Jefferson nickels, Roosevelt dimes and Washington quarters 1932-1998 (2026-11-25), backlog_growth.md 2.2-2.4:**');
  });
});
