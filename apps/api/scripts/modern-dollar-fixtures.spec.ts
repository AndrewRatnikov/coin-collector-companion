/**
 * Tests for: modern US small-size dollar fixtures (growth backlog 2.10), the five canonical set templates
 * built from them, their provenance in the five saved MediaWiki responses (and, for the Susan B. Anthony
 * 1979-1981 mintages, in the committed manual source file), and the fixtures README section.
 * Contract source: runs/run_20261124_215121/plan.md § Step E and § Interface Contract, updated by
 * runs/run_20261126_061240/plan.md § Interface Contract (Eisenhower Philadelphia dollars are null) and by
 * runs/run_20261126_230345/plan.md § Interface Contract (Susan B. Anthony 1979-1981 mintages, sources[1])
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15 (from runs/run_20261124_215121/prd.md)
 * and #2, #4, #7, #8 (from runs/run_20261126_061240/prd.md)
 * and #1 to #5, #11, #12, #13 (from runs/run_20261126_230345/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only (fixtures, templates, saved MediaWiki responses, the manual source file, README)
 * with fs.readFileSync; no network, no database, no mocks. Design lists, names, counts, specs, null sets and the
 * spot values are hard-coded from the contract; everything else is data-driven.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeIdentityField } from '@coin-collector/shared';
import { toSpecFields } from '../../../scripts/import-catalog/lib/specs';
import type { RawCoinEntry, RawFixtureFile } from '../../../scripts/import-catalog/lib/types';
import type { SeedTemplate } from './seed-canonical-sets';

const IMPORT_CATALOG_DIR = path.resolve(__dirname, '../../../scripts/import-catalog');
const FIXTURES_DIR = path.join(IMPORT_CATALOG_DIR, 'fixtures');
const TEMPLATES_DIR = path.resolve(__dirname, '../../../seed/templates');
const README_PATH = path.join(FIXTURES_DIR, 'README.md');
const NEW_ADR_FILE = '2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md';
const ANTHONY_FILE = 'us-dollars-susan-b-anthony.json';
const ANTHONY_MANUAL = 'sources/manual-susan-b-anthony-mintages.2026-11-26.json';

type Fixture = RawFixtureFile & {
  yearRange?: [number, number];
  '$schema-note'?: string;
  'rules-note'?: string;
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

function mintageFigureAppears(wikitext: string, n: number): boolean {
  const formatted = n.toLocaleString('en-US');
  const escaped = formatted.replace(/[.*+?^${}()|[\]\\,]/g, '\\$&');
  return new RegExp(`(?<![\\d,])${escaped}(?![\\d,])`).test(wikitext);
}

type Design = [year: number, variety: string | null];
type Expected = { year: number; mintMark: string | null; variety: string | null };

const PRESIDENTIAL_BY_YEAR: Array<[number, string[]]> = [
  [2007, ['George Washington', 'John Adams', 'Thomas Jefferson', 'James Madison']],
  [2008, ['James Monroe', 'John Quincy Adams', 'Andrew Jackson', 'Martin Van Buren']],
  [2009, ['William Henry Harrison', 'John Tyler', 'James K. Polk', 'Zachary Taylor']],
  [2010, ['Millard Fillmore', 'Franklin Pierce', 'James Buchanan', 'Abraham Lincoln']],
  [2011, ['Andrew Johnson', 'Ulysses S. Grant', 'Rutherford B. Hayes', 'James A. Garfield']],
  [2012, ['Chester A. Arthur', 'Grover Cleveland (1st term)', 'Benjamin Harrison', 'Grover Cleveland (2nd term)']],
  [2013, ['William McKinley', 'Theodore Roosevelt', 'William Howard Taft', 'Woodrow Wilson']],
  [2014, ['Warren G. Harding', 'Calvin Coolidge', 'Herbert Hoover', 'Franklin D. Roosevelt']],
  [2015, ['Harry S. Truman', 'Dwight D. Eisenhower', 'John F. Kennedy', 'Lyndon B. Johnson']],
  [2016, ['Richard Nixon', 'Gerald Ford', 'Ronald Reagan']],
  [2020, ['George H. W. Bush']],
];
const DESIGNS_PRESIDENTIAL: Design[] = PRESIDENTIAL_BY_YEAR.flatMap(([y, names]) =>
  names.map((n): Design => [y, n]),
);

const NATIVE_THEMES: Array<[number, string]> = [
  [2009, 'Three Sisters'],
  [2010, 'Great Law of Peace'],
  [2011, 'Wampanoag Treaty'],
  [2012, 'Trade Routes of the 17th Century'],
  [2013, 'Treaty with the Delawares'],
  [2014, 'Native Hospitality'],
  [2015, 'Mohawk Ironworkers'],
  [2016, 'Code Talkers'],
  [2017, 'Sequoyah'],
  [2018, 'Jim Thorpe'],
  [2019, 'American Indians in Space'],
  [2020, "Elizabeth Peratrovich and Alaska's Anti-Discrimination Law"],
  [2021, 'American Indians in the U.S. Military'],
  [2022, 'Ely S. Parker'],
  [2023, 'Maria Tallchief and American Indians in Ballet'],
  [2024, 'Indian Citizenship Act of 1924'],
  [2025, 'Mary Kawena Pukui'],
  [2026, 'Oneida Indian Nation at Valley Forge'],
];
const DESIGNS_SACAGAWEA: Design[] = [
  ...[2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008].map((y): Design => [y, null]),
  ...NATIVE_THEMES.map(([y, t]): Design => [y, t]),
];

const INNOVATION_BY_YEAR: Array<[number, string[]]> = [
  [2018, ['Introductory']],
  [2019, ['Delaware', 'Pennsylvania', 'New Jersey', 'Georgia']],
  [2020, ['Connecticut', 'Massachusetts', 'Maryland', 'South Carolina']],
  [2021, ['New Hampshire', 'Virginia', 'New York', 'North Carolina']],
  [2022, ['Rhode Island', 'Vermont', 'Kentucky', 'Tennessee']],
  [2023, ['Ohio', 'Louisiana', 'Indiana', 'Mississippi']],
  [2024, ['Illinois', 'Alabama', 'Maine', 'Missouri']],
  [2025, ['Arkansas', 'Michigan', 'Florida', 'Texas']],
  [2026, ['Iowa', 'Wisconsin', 'California', 'Minnesota']],
];
const DESIGNS_INNOVATION: Design[] = INNOVATION_BY_YEAR.flatMap(([y, names]) =>
  names.map((n): Design => [y, n]),
);

const DESIGNS_EISENHOWER: Design[] = [
  [1971, null],
  [1972, null],
  [1973, null],
  [1974, null],
  [1976, 'Type I'],
  [1976, 'Type II'],
  [1977, null],
  [1978, null],
];

const DESIGNS_ANTHONY: Design[] = [
  [1979, null],
  [1980, null],
  [1981, null],
  [1999, null],
];

const SPECS_GOLDEN = {
  diameterMm: 26.49,
  weightG: 8.1,
  thicknessMm: 2,
  material: 'Manganese brass clad copper (88.5% copper, 6% zinc, 3.5% manganese, 2% nickel)',
};
const SPECS_EISENHOWER = {
  diameterMm: 38.1,
  weightG: 22.68,
  thicknessMm: 2.58,
  material: 'Copper-nickel clad copper (91.67% copper, 8.33% nickel)',
};
const SPECS_ANTHONY = {
  diameterMm: 26.5,
  weightG: 8.1,
  thicknessMm: 2,
  material: 'Copper-nickel clad copper (75% copper, 25% nickel outer layers, pure copper core)',
};

interface Program {
  label: string;
  file: string;
  template: string;
  name: string;
  range: [number, number];
  count: number;
  designs: Design[];
  mints: (year: number) => Array<string | null>;
  specs: typeof SPECS_GOLDEN;
  needles: string[];
  rawResponse: RegExp;
  fileTitle: string;
  title: string;
  revid: number;
  articleTitle: string;
}

const PD = (): string[] => ['P', 'D'];
const EISENHOWER_FILE = 'us-dollars-eisenhower.json';

const PROGRAMS: Program[] = [
  {
    label: 'Presidential',
    file: 'us-dollars-presidential.json',
    template: 'presidential-dollars-2007-2020.v1.json',
    name: 'Presidential Dollars',
    range: [2007, 2020],
    count: 80,
    designs: DESIGNS_PRESIDENTIAL,
    mints: PD,
    specs: SPECS_GOLDEN,
    needles: ['26.49', '8.100', '2.00', '88.5%'],
    rawResponse: /^sources\/Presidential_dollar_coins\.(\d{4}-\d{2}-\d{2})\.json$/,
    fileTitle: 'Presidential_dollar_coins',
    title: 'Presidential dollar coins',
    revid: 1386046416,
    articleTitle: 'Presidential dollar coins',
  },
  {
    label: 'Sacagawea and Native American',
    file: 'us-dollars-sacagawea-and-native-american.json',
    template: 'sacagawea-and-native-american-dollars.v1.json',
    name: 'Sacagawea and Native American Dollars',
    range: [2000, 2026],
    count: 54,
    designs: DESIGNS_SACAGAWEA,
    mints: PD,
    specs: SPECS_GOLDEN,
    needles: ['26.49', '8.100', '2.00', '88.5%'],
    rawResponse: /^sources\/Sacagawea_dollar\.(\d{4}-\d{2}-\d{2})\.json$/,
    fileTitle: 'Sacagawea_dollar',
    title: 'Sacagawea dollar',
    revid: 1385999246,
    articleTitle: 'Sacagawea dollar',
  },
  {
    label: 'American Innovation',
    file: 'us-dollars-american-innovation.json',
    template: 'american-innovation-dollars.v1.json',
    name: 'American Innovation Dollars',
    range: [2018, 2026],
    count: 66,
    designs: DESIGNS_INNOVATION,
    mints: PD,
    specs: SPECS_GOLDEN,
    needles: ['26.49', '8.100', '2.00', '88.5%'],
    rawResponse: /^sources\/American_Innovation_dollars\.(\d{4}-\d{2}-\d{2})\.json$/,
    fileTitle: 'American_Innovation_dollars',
    title: 'American Innovation dollars',
    revid: 1384552479,
    articleTitle: 'American Innovation dollars',
  },
  {
    label: 'Eisenhower',
    file: EISENHOWER_FILE,
    template: 'eisenhower-dollars.v1.json',
    name: 'Eisenhower Dollars',
    range: [1971, 1978],
    count: 16,
    designs: DESIGNS_EISENHOWER,
    mints: () => [null, 'D'],
    specs: SPECS_EISENHOWER,
    needles: ['38.1', '22.68', '2.58', '91.67%'],
    rawResponse: /^sources\/Eisenhower_dollar\.(\d{4}-\d{2}-\d{2})\.json$/,
    fileTitle: 'Eisenhower_dollar',
    title: 'Eisenhower dollar',
    revid: 1384170327,
    articleTitle: 'Eisenhower dollar',
  },
  {
    label: 'Susan B. Anthony',
    file: ANTHONY_FILE,
    template: 'susan-b-anthony-dollars.v1.json',
    name: 'Susan B. Anthony Dollars',
    range: [1979, 1999],
    count: 11,
    designs: DESIGNS_ANTHONY,
    mints: (year) => (year === 1999 ? ['P', 'D'] : ['P', 'D', 'S']),
    specs: SPECS_ANTHONY,
    needles: ['26.5', '8.1', '2.00', '.75 copper, .25 nickel'],
    rawResponse: /^sources\/Susan_B\._Anthony_dollar\.(\d{4}-\d{2}-\d{2})\.json$/,
    fileTitle: 'Susan_B._Anthony_dollar',
    title: 'Susan B. Anthony dollar',
    revid: 1385912112,
    articleTitle: 'Susan B. Anthony dollar',
  },
];

const OTHER_PROGRAMS = PROGRAMS.filter((p) => p.file !== EISENHOWER_FILE);

const TOTAL_NEW_COINS = 227;

const TEMPLATE_NAMES: Record<string, string> = {
  'us-dollars-presidential.json': 'Presidential Dollars 2007-2020',
  'us-dollars-sacagawea-and-native-american.json': 'Sacagawea and Native American Dollars',
  'us-dollars-american-innovation.json': 'American Innovation Dollars',
  'us-dollars-eisenhower.json': 'Eisenhower Dollars',
  'us-dollars-susan-b-anthony.json': 'Susan B. Anthony Dollars',
};

// The nine 1979-1981 Susan B. Anthony business-strike mintages, from the committed manual source file.
const ANTHONY_EARLY: Array<[year: number, mintMark: string, mintage: number]> = [
  [1979, 'P', 360222000],
  [1979, 'D', 288015744],
  [1979, 'S', 109576000],
  [1980, 'P', 27610000],
  [1980, 'D', 41628708],
  [1980, 'S', 20422000],
  [1981, 'P', 3000000],
  [1981, 'D', 3250000],
  [1981, 'S', 3492000],
];

function expectedCoins(p: Program): Expected[] {
  const out: Expected[] = [];
  for (const [year, variety] of p.designs) {
    for (const mintMark of p.mints(year)) out.push({ year, mintMark, variety });
  }
  return out;
}

const fixtures = new Map(PROGRAMS.map((p) => [p.file, loadFixture(p.file)]));
function fx(p: Program): Fixture {
  const f = fixtures.get(p.file);
  if (!f) throw new Error(`missing fixture ${p.file}`);
  return f;
}
const NEW_FIXTURES = PROGRAMS.map(fx);

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function loadWikitext(rel: string): string {
  const raw = readJson<{ parse: { wikitext: string | { '*': string } } }>(path.join(IMPORT_CATALOG_DIR, rel));
  return typeof raw.parse.wikitext === 'string' ? raw.parse.wikitext : raw.parse.wikitext['*'];
}

function mintageOf(file: string, year: number, mint: string | null, variety: string | null): number | null | undefined {
  const f = fixtures.get(file);
  return f?.coins.find((c) => c.year === year && c.mintMark === mint && c.variety === variety)?.mintage;
}

interface ManualAnthony {
  licence: string;
  source: { title: string; url: string; accessed: string };
  mintages: Array<{ year: number; mintMark: string; mintage: number }>;
}
function loadManualAnthony(): ManualAnthony {
  return readJson<ManualAnthony>(path.join(IMPORT_CATALOG_DIR, ANTHONY_MANUAL));
}

describe('every template coin resolves to exactly one fixture row (criteria 14, 15)', () => {
  const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

  it('finds the five new templates and the existing ones', () => {
    expect(templateFiles).toEqual(
      expect.arrayContaining([...PROGRAMS.map((p) => p.template), 'lincoln-wheat-cents.v1.json']),
    );
  });

  it.each(templateFiles)('%s: each coin matches exactly one fixture row and none is listed twice', (file) => {
    const template = loadTemplate(file);
    expect(template.coins.length).toBeGreaterThan(0);
    const unresolved: string[] = [];
    for (const coin of template.coins) {
      const key = templateKey(coin);
      const matches = allFixtureKeys.filter((k) => k === key).length;
      if (matches !== 1) unresolved.push(`${key} x${matches}`);
    }
    expect(unresolved).toEqual([]);
    expect(duplicates(template.coins.map(templateKey))).toEqual([]);
  });

  it('would flag a coin that is not in any fixture (the check is falsifiable)', () => {
    const fake = templateKey({
      country: 'USA',
      denomination: 'Dollar',
      year: 2017,
      mintMark: 'P',
      variety: 'Not a president',
    });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('the five canonical set templates (criterion 14)', () => {
  it.each(PROGRAMS)('$label: exact name, description, count and fixture-ordered coins', (p) => {
    const template = loadTemplate(p.template);
    expect(template.name).toBe(TEMPLATE_NAMES[p.file]);
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
    expect(template.coins).toHaveLength(p.count);
    expect(template.coins).toEqual(asTemplateCoins(fx(p)));
    for (const c of template.coins) {
      expect(c.country).toBe('USA');
      expect(c.denomination).toBe('Dollar');
    }
  });

  it('the Eisenhower template has the Philadelphia coins as empty mint marks, never "P"', () => {
    const template = loadTemplate('eisenhower-dollars.v1.json');
    expect(template.coins.filter((c) => c.mintMark === '')).toHaveLength(8);
    expect(template.coins.filter((c) => c.mintMark === 'D')).toHaveLength(8);
    expect(template.coins.some((c) => c.mintMark === 'P')).toBe(false);
  });

  it('no template coin appears in another program fixture', () => {
    for (const p of PROGRAMS) {
      const template = loadTemplate(p.template);
      const others = new Set(
        PROGRAMS.filter((o) => o.file !== p.file).flatMap((o) => fx(o).coins.map((c) => fixtureKey(fx(o), c))),
      );
      const leaked = template.coins.map(templateKey).filter((k) => others.has(k));
      expect(leaked).toEqual([]);
    }
  });

  it('template names are different from each other and from every other template', () => {
    const names = PROGRAMS.map((p) => loadTemplate(p.template).name);
    expect(new Set(names).size).toBe(5);
    const own = new Set(PROGRAMS.map((p) => p.template));
    const otherNames = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => f.endsWith('.json') && !own.has(f))
      .map((f) => loadTemplate(f).name);
    for (const n of names) expect(otherNames).not.toContain(n);
  });
});

describe('no duplicate natural keys (criterion 15)', () => {
  it.each(PROGRAMS)('$label file has none', (p) => {
    const f = fx(p);
    expect(f.coins.length).toBeGreaterThan(0);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('the five new files together have none and hold 227 coins', () => {
    expect(duplicates(NEW_FIXTURES.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
    expect(NEW_FIXTURES.reduce((n, f) => n + f.coins.length, 0)).toBe(TOTAL_NEW_COINS);
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles.length).toBeGreaterThanOrEqual(19);
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('identity and year range (criteria 2, 4)', () => {
  it.each(PROGRAMS)('$label: USA, Dollar, exact name, yearRange and years within it', (p) => {
    const f = fx(p);
    expect(f.country).toBe('USA');
    expect(f.denomination).toBe('Dollar');
    expect(f.name).toBe(p.name);
    expect(f.yearRange).toEqual(p.range);
    expect(f.coins).toHaveLength(p.count);
    const ys = f.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(p.range[0]);
    expect(Math.max(...ys)).toBe(p.range[1]);
  });
});

describe('selection and release order (criteria 2, 5, 6, 7, 8, 9, 10)', () => {
  it.each(PROGRAMS)('$label: coins are exactly the design list x mints, in release order', (p) => {
    const actual = fx(p).coins.map((c) => ({ year: c.year, mintMark: c.mintMark, variety: c.variety }));
    expect(actual).toEqual(expectedCoins(p));
  });

  it('the four programs other than Eisenhower have no null mint mark and only P, D or S', () => {
    for (const p of OTHER_PROGRAMS) {
      for (const c of fx(p).coins) {
        expect(['P', 'D', 'S']).toContain(c.mintMark);
      }
    }
  });

  it('Eisenhower mint marks are null or D only, with exactly 8 null and no P', () => {
    const coins = loadFixture(EISENHOWER_FILE).coins;
    for (const c of coins) expect([null, 'D']).toContain(c.mintMark);
    expect(coins.filter((c) => c.mintMark === null)).toHaveLength(8);
    expect(coins.filter((c) => c.mintMark === 'D')).toHaveLength(8);
    expect(coins.some((c) => c.mintMark === 'P')).toBe(false);
  });

  it('S appears only in the Anthony file: exactly 1979, 1980 and 1981', () => {
    for (const p of PROGRAMS) {
      const s = fx(p).coins.filter((c) => c.mintMark === 'S');
      if (p.file === ANTHONY_FILE) expect(s.map((c) => c.year)).toEqual([1979, 1980, 1981]);
      else expect(s).toEqual([]);
    }
  });

  it('the Eisenhower file has no S coin and has 1976 Type I and Type II for null and D', () => {
    const f = loadFixture(EISENHOWER_FILE);
    expect(f.coins.filter((c) => c.mintMark === 'S')).toHaveLength(0);
    const t = f.coins.filter((c) => c.year === 1976).map((c) => `${c.mintMark}|${c.variety}`);
    expect(t).toEqual(['null|Type I', 'D|Type I', 'null|Type II', 'D|Type II']);
  });

  it('variety is null exactly where the contract says', () => {
    const nullVariety = (file: string) =>
      loadFixture(file).coins.filter((c) => c.variety === null).map((c) => c.year);
    const sacNull = nullVariety('us-dollars-sacagawea-and-native-american.json');
    expect(sacNull).toHaveLength(18);
    expect(Math.max(...sacNull)).toBe(2008);
    expect(nullVariety('us-dollars-presidential.json')).toEqual([]);
    expect(nullVariety('us-dollars-american-innovation.json')).toEqual([]);
    expect(nullVariety(ANTHONY_FILE)).toHaveLength(11);
    expect(nullVariety('us-dollars-eisenhower.json')).toHaveLength(12);
  });

  it('no variety looks like a proof, set-only, bullion, silver or error strike', () => {
    for (const f of NEW_FIXTURES) {
      for (const c of f.coins) {
        expect(c.variety ?? '').not.toMatch(/proof|uncirculated|enhanced|burnished|bullion|silver|privy|error|lettering/i);
      }
    }
  });

  it('Presidential has both Cleveland terms as separate varieties', () => {
    const varieties = new Set(loadFixture('us-dollars-presidential.json').coins.map((c) => c.variety));
    expect(varieties.has('Grover Cleveland (1st term)')).toBe(true);
    expect(varieties.has('Grover Cleveland (2nd term)')).toBe(true);
    expect(varieties.has('Grover Cleveland')).toBe(false);
  });

  it('every design has a Philadelphia coin (P, or null for Eisenhower) and a D coin', () => {
    for (const p of PROGRAMS) {
      const keys = new Set(fx(p).coins.map((c) => `${c.year}|${c.mintMark}|${c.variety}`));
      const philadelphia = p.file === EISENHOWER_FILE ? 'null' : 'P';
      for (const [year, v] of p.designs) {
        expect(keys.has(`${year}|${philadelphia}|${v}`)).toBe(true);
        expect(keys.has(`${year}|D|${v}`)).toBe(true);
      }
    }
  });
});

describe('specs and fields (criteria 11, 9)', () => {
  it.each(PROGRAMS)('$label: file-level specs are exact and no coin overrides them', (p) => {
    const f = fx(p);
    expect(f.specs).toEqual(p.specs);
    for (const c of f.coins) expect(c.specs).toBeUndefined();
  });

  it('the Eisenhower, Anthony and golden-dollar specs differ from each other', () => {
    expect(SPECS_EISENHOWER.diameterMm).not.toBe(SPECS_GOLDEN.diameterMm);
    expect(SPECS_ANTHONY.diameterMm).not.toBe(SPECS_GOLDEN.diameterMm);
    expect(SPECS_ANTHONY.material).not.toBe(SPECS_GOLDEN.material);
  });

  it.each(PROGRAMS)('$label: resolves the four spec values for every coin', (p) => {
    const f = fx(p);
    for (const c of f.coins) {
      const s = toSpecFields(f, c);
      expect(s.diameterMm).toBe(p.specs.diameterMm);
      expect(s.weightG).toBe(p.specs.weightG);
      expect(s.thicknessMm).toBe(p.specs.thicknessMm);
      expect(s.material).toBe(p.specs.material);
      expect(s.isKeyDate).toBe(false);
    }
  });

  it('has no image field on any coin and isKeyDate false', () => {
    for (const f of NEW_FIXTURES) {
      for (const c of f.coins) {
        const keys = Object.keys(c);
        expect(c.image ?? null).toBeNull();
        expect(keys).not.toContain('image');
        expect(keys).not.toContain('imageUrl');
        expect(keys).not.toContain('imageSource');
        expect(keys).not.toContain('imageLicense');
        expect(c.isKeyDate).toBe(false);
      }
    }
  });
});

describe('provenance: every mintage traces to a saved source (criteria 3, 12)', () => {
  it.each(PROGRAMS)('$label: sources[0] cites its saved response, revision and fetch date', (p) => {
    const f = fx(p);
    const src = f.sources?.[0];
    const rawResponse = src?.rawResponse ?? '';
    const m = p.rawResponse.exec(rawResponse);
    expect(m).not.toBeNull();
    expect(src?.fetchedAt).toBe(m?.[1]);
    const abs = path.join(IMPORT_CATALOG_DIR, rawResponse);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe(p.title);
    expect(src?.revisionId).toBe(raw.parse.revid);
    expect(typeof src?.note).toBe('string');
    expect((src?.note ?? '').trim().length).toBeGreaterThan(0);
  });

  it('the saved file name carries the File_title from the contract (falsifiable)', () => {
    for (const p of PROGRAMS) {
      expect(p.rawResponse.test(`sources/${p.fileTitle}.2026-11-24.json`)).toBe(true);
      expect(p.rawResponse.test(`sources/Other_article.2026-11-24.json`)).toBe(false);
    }
  });

  it.each(PROGRAMS)('$label: every non-null mintage appears in the saved wikitext (Anthony 1979-1981 excepted)', (p) => {
    const f = fx(p);
    const rawResponse = f.sources?.[0]?.rawResponse ?? '';
    const wikitext = loadWikitext(rawResponse);
    expect(wikitext.length).toBeGreaterThan(1000);
    const missing: string[] = [];
    let checked = 0;
    for (const c of f.coins) {
      if (c.mintage === null || c.mintage === undefined) continue;
      // The Anthony 1979-1981 rows are traced to the manual source file in the next describe block.
      if (p.file === ANTHONY_FILE && c.year <= 1981) continue;
      checked += 1;
      if (!mintageFigureAppears(wikitext, c.mintage)) missing.push(`${c.year} ${c.mintMark} ${c.variety} ${c.mintage}`);
    }
    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('the figure matcher respects digit and comma boundaries (falsifiable)', () => {
    expect(mintageFigureAppears('| 1,234,567 |', 1234567)).toBe(true);
    expect(mintageFigureAppears('| 11,234,567 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 1,234,567,890 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 9,999 |', 1234567)).toBe(false);
  });
});

describe('Susan B. Anthony 1979-1981 mintages from the manual source (criteria 1 to 5 of run_20261126_230345)', () => {
  const anthony = loadFixture(ANTHONY_FILE);

  it('has 11 rows and the nine 1979-1981 rows carry exactly the nine contract figures', () => {
    expect(anthony.coins).toHaveLength(11);
    for (const [year, mark, mintage] of ANTHONY_EARLY) {
      const hits = anthony.coins.filter((c) => c.year === year && c.mintMark === mark);
      expect(hits).toHaveLength(1);
      expect(hits[0].mintage).toBe(mintage);
    }
  });

  it('no Anthony row has a null mintage and the 1999 rows keep their Wikipedia figures', () => {
    expect(anthony.coins.filter((c) => (c.mintage ?? null) === null)).toEqual([]);
    expect(mintageOf(ANTHONY_FILE, 1999, 'P', null)).toBe(29592000);
    expect(mintageOf(ANTHONY_FILE, 1999, 'D', null)).toBe(11776000);
  });

  it('the figures are different per mint and year (no value copied across rows)', () => {
    const early = anthony.coins.filter((c) => c.year <= 1981).map((c) => c.mintage);
    expect(new Set(early).size).toBe(9);
    expect(mintageOf(ANTHONY_FILE, 1981, 'P', null)).not.toBe(mintageOf(ANTHONY_FILE, 1981, 'D', null));
  });

  it('every 1979-1981 row equals the same-year, same-mint entry in the manual file; a missing entry fails', () => {
    const manual = loadManualAnthony();
    expect(anthony.sources?.[1]?.rawResponse).toBe(ANTHONY_MANUAL);
    expect(fs.existsSync(path.join(IMPORT_CATALOG_DIR, ANTHONY_MANUAL))).toBe(true);
    const early = anthony.coins.filter((c) => c.year <= 1981);
    expect(early).toHaveLength(9);
    const bad: string[] = [];
    for (const c of early) {
      const entries = manual.mintages.filter((e) => e.year === c.year && e.mintMark === c.mintMark);
      if (entries.length !== 1 || entries[0].mintage !== c.mintage) bad.push(`${c.year} ${c.mintMark} ${c.mintage}`);
    }
    expect(bad).toEqual([]);
  });

  it('every 1999 row appears in the saved Wikipedia wikitext', () => {
    const wikitext = loadWikitext(anthony.sources?.[0]?.rawResponse ?? '');
    const late = anthony.coins.filter((c) => c.year === 1999);
    expect(late).toHaveLength(2);
    for (const c of late) expect(mintageFigureAppears(wikitext, c.mintage as number)).toBe(true);
  });

  it('sources[1]: exactly the contract keys in order and the exact type, url, fetchedAt, rawResponse', () => {
    const src = anthony.sources?.[1];
    expect(src).toBeDefined();
    expect(Object.keys(src ?? {})).toEqual(['type', 'origin', 'url', 'fetchedAt', 'rawResponse', 'license', 'note']);
    expect(src?.type).toBe('year / mint mark / variety / mintage');
    expect(src?.url).toBe('https://coinmintages.com/susan-b-anthony-dollars-mintage/');
    expect(src?.fetchedAt).toBe('2026-11-26');
    expect(src?.rawResponse).toBe(ANTHONY_MANUAL);
  });

  it('sources[1]: license equals the manual file licence verbatim, origin names the title and URL', () => {
    const manual = loadManualAnthony();
    const src = anthony.sources?.[1];
    expect(src?.license).toBe(manual.licence);
    expect(src?.origin).toContain(manual.source.title);
    expect(src?.origin).toContain(manual.source.url);
    expect(src?.url).toBe(manual.source.url);
    expect(src?.fetchedAt).toBe(manual.source.accessed);
  });

  it('sources[1]: the note records the PCGS disagreement and that it is not a Mint publication', () => {
    const note = anthony.sources?.[1]?.note ?? '';
    expect(note).toContain('2,908,145');
    expect(note).toContain('PCGS');
    expect(note).toContain('date on the coin');
  });

  it('sources[0] is the unchanged Wikipedia entry and the physical specs entry moved to sources[2]', () => {
    const src0 = anthony.sources?.[0];
    expect(src0?.rawResponse).toMatch(/^sources\/Susan_B\._Anthony_dollar\.2026-11-24\.json$/);
    expect(src0?.revisionId).toBe(1385912112);
    expect(src0?.fetchedAt).toBe('2026-11-24');
    expect(anthony.sources?.[2]?.type).toBe('physical specs');
    expect(anthony.sources).toHaveLength(3);
  });

  it('$schema-note and rules-note cite the manual file; rules-note keeps isKeyDate false and drops the null claim', () => {
    expect(anthony['$schema-note'] ?? '').toContain('manual-susan-b-anthony-mintages.2026-11-26.json');
    const rules = anthony['rules-note'] ?? '';
    expect(rules).toContain('manual-susan-b-anthony-mintages.2026-11-26.json');
    expect(rules).toContain('isKeyDate is false throughout');
    expect(rules).not.toContain('have null mintage');
  });
});

describe('null mintages exactly where the source has none (criterion 3)', () => {
  const nullsOf = (file: string) => loadFixture(file).coins.filter((c) => (c.mintage ?? null) === null);

  it('Presidential and Eisenhower have no null mintage', () => {
    expect(nullsOf('us-dollars-presidential.json')).toEqual([]);
    expect(nullsOf('us-dollars-eisenhower.json')).toEqual([]);
  });

  it('Sacagawea and Native American: 2000-2022 all have figures, only 2023-2026 may be null', () => {
    const f = loadFixture('us-dollars-sacagawea-and-native-american.json');
    for (const c of f.coins.filter((x) => x.year <= 2022)) expect(c.mintage ?? null).not.toBeNull();
    for (const c of nullsOf('us-dollars-sacagawea-and-native-american.json')) {
      expect(c.year).toBeGreaterThanOrEqual(2023);
    }
  });

  it('American Innovation: 2018-2025 all have figures, only 2026 may be null', () => {
    const f = loadFixture('us-dollars-american-innovation.json');
    for (const c of f.coins.filter((x) => x.year <= 2025)) expect(c.mintage ?? null).not.toBeNull();
    for (const c of nullsOf('us-dollars-american-innovation.json')) expect(c.year).toBe(2026);
  });

  it('Susan B. Anthony: no row is null any more (the nine 1979-1981 rows come from the manual source)', () => {
    const f = loadFixture(ANTHONY_FILE);
    expect(f.coins).toHaveLength(11);
    const early = f.coins.filter((c) => c.year <= 1981);
    expect(early).toHaveLength(9);
    for (const c of early) expect(c.mintage ?? null).not.toBeNull();
    const late = f.coins.filter((c) => c.year === 1999);
    expect(late).toHaveLength(2);
    for (const c of late) expect(c.mintage ?? null).not.toBeNull();
    expect(nullsOf(ANTHONY_FILE)).toEqual([]);
  });
});

describe('column orientation (criterion 3)', () => {
  const cases: Array<[string, number, string | null, number, number]> = [
    ['us-dollars-presidential.json', 2007, 'George Washington', 176680000, 163680000],
    ['us-dollars-presidential.json', 2012, 'Grover Cleveland (2nd term)', 10680001, 3920000],
    ['us-dollars-presidential.json', 2020, 'George H. W. Bush', 1242275, 1502425],
    ['us-dollars-sacagawea-and-native-american.json', 2000, null, 767150500, 518916000],
    ['us-dollars-sacagawea-and-native-american.json', 2010, 'Great Law of Peace', 32060000, 48720000],
    ['us-dollars-american-innovation.json', 2018, 'Introductory', 2143925, 2148525],
    ['us-dollars-american-innovation.json', 2025, 'Texas', 591125, 545600],
    ['us-dollars-eisenhower.json', 1971, null, 47799000, 68587424],
    ['us-dollars-eisenhower.json', 1976, 'Type II', 113318000, 82179564],
    ['us-dollars-susan-b-anthony.json', 1999, null, 29592000, 11776000],
    ['us-dollars-susan-b-anthony.json', 1979, null, 360222000, 288015744],
    ['us-dollars-susan-b-anthony.json', 1980, null, 27610000, 41628708],
    ['us-dollars-susan-b-anthony.json', 1981, null, 3000000, 3250000],
  ];

  it.each(cases)('%s %i %s: Philadelphia and D mintages are not swapped', (file, year, variety, p, d) => {
    const philadelphia = file === EISENHOWER_FILE ? null : 'P';
    expect(mintageOf(file, year, philadelphia, variety)).toBe(p);
    expect(mintageOf(file, year, 'D', variety)).toBe(d);
    expect(p).not.toBe(d);
  });
});

describe('specs traceable to each saved infobox (criterion 11)', () => {
  it.each(PROGRAMS)('$label: the saved wikitext contains the infobox needles', (p) => {
    const rawResponse = fx(p).sources?.[0]?.rawResponse ?? '';
    const wikitext = loadWikitext(rawResponse);
    for (const needle of p.needles) expect(wikitext).toContain(needle);
  });
});

describe('fixtures README dollars section (criteria 7, 13, 15)', () => {
  const HEADING = '## us-dollars-*.json (five files: Presidential through Susan B. Anthony)';

  function section(): string {
    const lines = fs.readFileSync(README_PATH, 'utf8').split('\n');
    const start = lines.indexOf(HEADING);
    if (start === -1) return '';
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((l) => l.startsWith('## '));
    return [HEADING, ...(end === -1 ? rest : rest.slice(0, end))].join('\n');
  }

  it('has the section heading', () => {
    expect(section().length).toBeGreaterThan(HEADING.length);
  });

  it('names each fixture file, each article title and 2.9', () => {
    const text = section();
    for (const p of PROGRAMS) {
      expect(text).toContain(p.file);
      expect(text).toContain(p.articleTitle);
    }
    expect(text).toContain('2.9');
  });

  it('links the single mint-mark rule ADR and no longer says the Eisenhower coins are "P" here', () => {
    const text = section();
    expect(text).toContain(NEW_ADR_FILE);
    expect(text).not.toContain('`"P"` here');
  });

  it('cites the manual Anthony source, coinmintages.com, the PCGS 2,908,145 disagreement and the Wide Rim gap', () => {
    const text = section();
    for (const needle of ['manual-susan-b-anthony-mintages.2026-11-26.json', 'coinmintages.com', '2,908,145', 'Wide Rim']) {
      expect(text).toContain(needle);
    }
  });

  it('the null mintage count reads 16, not 25', () => {
    const text = section();
    expect(text).toContain('16');
    expect(text).not.toContain('25 coins');
  });
});

describe('existing data unchanged (sanity)', () => {
  it('50 State still has 100 coins and Wheat 142', () => {
    expect(loadTemplate('50-state-quarters.v1.json').coins).toHaveLength(100);
    expect(loadTemplate('lincoln-wheat-cents.v1.json').coins).toHaveLength(142);
  });
});
