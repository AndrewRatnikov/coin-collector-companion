/**
 * Tests for: modern US quarter fixtures 1999-2026 (growth backlog 2.5), the six canonical set templates
 * built from them, and their provenance in the five saved MediaWiki responses.
 * Contract source: runs/run_20261121_211337/plan.md § Step E and § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6, #7, #9, #10, #11, #12 (from runs/run_20261121_211337/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only (fixtures, templates, saved MediaWiki responses) with fs.readFileSync;
 * no network, no database, no mocks. Design lists, names, counts and the spot values are hard-coded
 * from the contract; everything else is data-driven.
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

type Fixture = RawFixtureFile & { yearRange?: [number, number] };

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

type Design = [year: number, names: string[]];

const DESIGNS_50_STATE: Design[] = [
  [1999, ['Delaware', 'Pennsylvania', 'New Jersey', 'Georgia', 'Connecticut']],
  [2000, ['Massachusetts', 'Maryland', 'South Carolina', 'New Hampshire', 'Virginia']],
  [2001, ['New York', 'North Carolina', 'Rhode Island', 'Vermont', 'Kentucky']],
  [2002, ['Tennessee', 'Ohio', 'Louisiana', 'Indiana', 'Mississippi']],
  [2003, ['Illinois', 'Alabama', 'Maine', 'Missouri', 'Arkansas']],
  [2004, ['Michigan', 'Florida', 'Texas', 'Iowa', 'Wisconsin']],
  [2005, ['California', 'Minnesota', 'Oregon', 'Kansas', 'West Virginia']],
  [2006, ['Nevada', 'Nebraska', 'Colorado', 'North Dakota', 'South Dakota']],
  [2007, ['Montana', 'Washington', 'Idaho', 'Wyoming', 'Utah']],
  [2008, ['Oklahoma', 'New Mexico', 'Arizona', 'Alaska', 'Hawaii']],
];
const DESIGNS_DC: Design[] = [
  [2009, ['District of Columbia', 'Puerto Rico', 'Guam', 'American Samoa', 'US Virgin Islands', 'Northern Mariana Islands']],
];
const DESIGNS_ATB: Design[] = [
  [2010, ['Hot Springs', 'Yellowstone', 'Yosemite', 'Grand Canyon', 'Mount Hood']],
  [2011, ['Gettysburg', 'Glacier', 'Olympic', 'Vicksburg', 'Chickasaw']],
  [2012, ['El Yunque', 'Chaco Culture', 'Acadia', "Hawai'i Volcanoes", 'Denali']],
  [2013, ['White Mountain', "Perry's Victory", 'Great Basin', 'Fort McHenry', 'Mount Rushmore']],
  [2014, ['Great Smoky Mountains', 'Shenandoah', 'Arches', 'Great Sand Dunes', 'Everglades']],
  [2015, ['Homestead', 'Kisatchie', 'Blue Ridge Parkway', 'Bombay Hook', 'Saratoga']],
  [2016, ['Shawnee', 'Cumberland Gap', 'Harpers Ferry', 'Theodore Roosevelt', 'Fort Moultrie']],
  [2017, ['Effigy Mounds', 'Frederick Douglass', 'Ozark Riverways', 'Ellis Island', 'George Rogers Clark']],
  [2018, ['Pictured Rocks', 'Apostle Islands', 'Voyageurs', 'Cumberland Island', 'Block Island']],
  [2019, ['Lowell', 'American Memorial Park', 'War In The Pacific', 'San Antonio Missions', 'River Of No Return']],
  [2020, ['National Park', 'Weir Farm', 'Salt River Bay', 'Marsh-Billings-Rockefeller', 'Tallgrass Prairie']],
  [2021, ['Tuskegee Airmen']],
];
const DESIGNS_CROSSING: Design[] = [[2021, ['Washington Crossing the Delaware']]];
const DESIGNS_AWQ: Design[] = [
  [2022, ['Maya Angelou', 'Dr. Sally Ride', 'Wilma Mankiller', 'Nina Otero-Warren', 'Anna May Wong']],
  [2023, ['Bessie Coleman', 'Edith Kanakaʻole', 'Eleanor Roosevelt', 'Jovita Idar', 'Maria Tallchief']],
  [2024, ['Dr. Pauli Murray', 'Patsy Mink', 'Dr. Mary Edwards Walker', 'Celia Cruz', 'Zitkala-Ša']],
  [2025, ['Ida B. Wells', 'Juliette Gordon Low', 'Dr. Vera Rubin', 'Stacey Milbern', 'Althea Gibson']],
];
const DESIGNS_SEMIQ: Design[] = [
  [2026, ['Mayflower Compact', 'Revolutionary War', 'Declaration of Independence', 'Constitution', 'Gettysburg Address']],
];

interface Program {
  label: string;
  file: string;
  template: string;
  name: string;
  range: [number, number];
  count: number;
  designs: Design[];
  rawResponse: string;
  title: string;
}

const PROGRAMS: Program[] = [
  {
    label: '50 State',
    file: 'us-quarters-50-state.json',
    template: '50-state-quarters.v1.json',
    name: '50 State Quarters',
    range: [1999, 2008],
    count: 100,
    designs: DESIGNS_50_STATE,
    rawResponse: 'sources/50_State_quarters.2026-11-21.json',
    title: '50 State quarters',
  },
  {
    label: 'DC and territories',
    file: 'us-quarters-dc-and-territories.json',
    template: 'dc-and-us-territories-quarters.v1.json',
    name: 'DC and US Territories Quarters',
    range: [2009, 2009],
    count: 12,
    designs: DESIGNS_DC,
    rawResponse: 'sources/Washington_quarter_mintage_figures.2026-11-21.json',
    title: 'Washington quarter mintage figures',
  },
  {
    label: 'America the Beautiful',
    file: 'us-quarters-america-the-beautiful.json',
    template: 'america-the-beautiful-quarters.v1.json',
    name: 'America the Beautiful Quarters',
    range: [2010, 2021],
    count: 122,
    designs: DESIGNS_ATB,
    rawResponse: 'sources/America_the_Beautiful_quarter_mintage_figures.2026-11-21.json',
    title: 'America the Beautiful quarter mintage figures',
  },
  {
    label: 'Crossing the Delaware',
    file: 'us-quarters-crossing-the-delaware.json',
    template: 'washington-crossing-the-delaware-quarter.v1.json',
    name: 'Washington Crossing the Delaware Quarter',
    range: [2021, 2021],
    count: 2,
    designs: DESIGNS_CROSSING,
    rawResponse: 'sources/Washington_quarter_mintage_figures.2026-11-21.json',
    title: 'Washington quarter mintage figures',
  },
  {
    label: 'American Women',
    file: 'us-quarters-american-women.json',
    template: 'american-women-quarters.v1.json',
    name: 'American Women Quarters',
    range: [2022, 2025],
    count: 40,
    designs: DESIGNS_AWQ,
    rawResponse: 'sources/American_Women_quarters.2026-11-21.json',
    title: 'American Women quarters',
  },
  {
    label: 'Semiquincentennial',
    file: 'us-quarters-semiquincentennial.json',
    template: 'semiquincentennial-quarters.v1.json',
    name: 'Semiquincentennial Quarters',
    range: [2026, 2026],
    count: 10,
    designs: DESIGNS_SEMIQ,
    rawResponse: 'sources/United_States_Semiquincentennial_coinage.2026-11-21.json',
    title: 'United States Semiquincentennial coinage',
  },
];

const SEMIQ_FILE = 'us-quarters-semiquincentennial.json';
const EXPECTED_SPECS = {
  diameterMm: 24.26,
  weightG: 5.67,
  thicknessMm: 1.75,
  material: 'Copper-nickel clad copper (91.67% copper, 8.33% nickel)',
};

function expectedCoins(p: Program): Array<{ year: number; mintMark: string; variety: string }> {
  const atb = p.file === 'us-quarters-america-the-beautiful.json';
  const out: Array<{ year: number; mintMark: string; variety: string }> = [];
  for (const [year, names] of p.designs) {
    for (const variety of names) {
      const mints = atb && (year === 2019 || year === 2020) ? ['P', 'D', 'W'] : ['P', 'D'];
      for (const mintMark of mints) out.push({ year, mintMark, variety });
    }
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

function mintageOf(file: string, year: number, mint: string, variety: string): number | null | undefined {
  const f = fixtures.get(file);
  return f?.coins.find((c) => c.year === year && c.mintMark === mint && c.variety === variety)?.mintage;
}

describe('every template coin resolves to exactly one fixture row (criteria 9, 10)', () => {
  const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

  it('finds the six new templates and the existing ones', () => {
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
    const fake = templateKey({ country: 'USA', denomination: 'Quarter', year: 2026, mintMark: 'P', variety: 'Not a design' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('the six canonical set templates (criterion 9)', () => {
  it.each(PROGRAMS)('$label: exact name, description, count and fixture-ordered coins', (p) => {
    const template = loadTemplate(p.template);
    expect(template.name).toBe(p.name);
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
    expect(template.coins).toHaveLength(p.count);
    expect(template.coins).toEqual(asTemplateCoins(fx(p)));
    for (const c of template.coins) {
      expect(c.country).toBe('USA');
      expect(c.denomination).toBe('Quarter');
    }
  });

  it('template names are all different', () => {
    const names = PROGRAMS.map((p) => loadTemplate(p.template).name);
    expect(new Set(names).size).toBe(6);
  });
});

describe('50 State set has exactly 100 coins (criterion 12)', () => {
  const template = loadTemplate('50-state-quarters.v1.json');

  it('has 100 coins', () => {
    expect(template.coins).toHaveLength(100);
  });

  it('is 50 states x P and D, ten coins per year 1999-2008', () => {
    const perYear = new Map<number, number>();
    for (const c of template.coins) perYear.set(c.year, (perYear.get(c.year) ?? 0) + 1);
    expect([...perYear.keys()].sort()).toEqual([1999, 2000, 2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008]);
    for (const n of perYear.values()) expect(n).toBe(10);
    expect(new Set(template.coins.map((c) => c.variety)).size).toBe(50);
    expect(template.coins.filter((c) => c.mintMark === 'P')).toHaveLength(50);
    expect(template.coins.filter((c) => c.mintMark === 'D')).toHaveLength(50);
  });
});

describe('no duplicate natural keys (criterion 11)', () => {
  it.each(PROGRAMS)('$label file has none', (p) => {
    const f = fx(p);
    expect(f.coins.length).toBeGreaterThan(0);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('the six new files together have none', () => {
    expect(duplicates(NEW_FIXTURES.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
    expect(NEW_FIXTURES.reduce((n, f) => n + f.coins.length, 0)).toBe(286);
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles.length).toBeGreaterThanOrEqual(14);
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('identity and year range (criteria 2, 3)', () => {
  it.each(PROGRAMS)('$label: USA, Quarter, exact name, yearRange and years within it', (p) => {
    const f = fx(p);
    expect(f.country).toBe('USA');
    expect(f.denomination).toBe('Quarter');
    expect(f.name).toBe(p.name);
    expect(f.yearRange).toEqual(p.range);
    expect(f.coins).toHaveLength(p.count);
    const ys = f.coins.map((c) => c.year);
    expect(Math.min(...ys)).toBe(p.range[0]);
    expect(Math.max(...ys)).toBe(p.range[1]);
  });

  it('covers every year 1999 through 2026', () => {
    const years = new Set(NEW_FIXTURES.flatMap((f) => f.coins.map((c) => c.year)));
    for (let y = 1999; y <= 2026; y++) expect(years.has(y)).toBe(true);
    expect(Math.min(...years)).toBe(1999);
    expect(Math.max(...years)).toBe(2026);
  });
});

describe('selection and release order (criteria 3, 4)', () => {
  it.each(PROGRAMS)('$label: coins are exactly the design list x mints, in release order', (p) => {
    const actual = fx(p).coins.map((c) => ({ year: c.year, mintMark: c.mintMark, variety: c.variety }));
    expect(actual).toEqual(expectedCoins(p));
  });

  it('has no S coin, no null mark and no null variety anywhere', () => {
    for (const f of NEW_FIXTURES) {
      for (const c of f.coins) {
        expect(['P', 'D', 'W']).toContain(c.mintMark);
        expect(typeof c.variety).toBe('string');
        expect((c.variety ?? '').length).toBeGreaterThan(0);
        expect(c.variety ?? '').not.toMatch(/proof|uncirculated|enhanced|bullion|privy|JULY/i);
      }
    }
  });

  it('has exactly 10 W coins, all America the Beautiful 2019-2020', () => {
    const w = NEW_FIXTURES.flatMap((f) => f.coins.filter((c) => c.mintMark === 'W').map((c) => ({ file: f.name, year: c.year })));
    expect(w).toHaveLength(10);
    for (const x of w) {
      expect(x.file).toBe('America the Beautiful Quarters');
      expect([2019, 2020]).toContain(x.year);
    }
  });

  it('every design has a P and a D coin', () => {
    for (const p of PROGRAMS) {
      const keys = new Set(fx(p).coins.map((c) => `${c.year}|${c.mintMark}|${c.variety}`));
      for (const [year, names] of p.designs) {
        for (const v of names) {
          expect(keys.has(`${year}|P|${v}`)).toBe(true);
          expect(keys.has(`${year}|D|${v}`)).toBe(true);
        }
      }
    }
  });
});

describe('specs and fields (criteria 6, 7)', () => {
  it.each(PROGRAMS)('$label: file-level specs are exact and no coin overrides them', (p) => {
    const f = fx(p);
    expect(f.specs).toEqual(EXPECTED_SPECS);
    for (const c of f.coins) expect(c.specs).toBeUndefined();
  });

  it('resolves 24.26 mm, 5.67 g, 1.75 mm and the material for every coin', () => {
    for (const f of NEW_FIXTURES) {
      for (const c of f.coins) {
        const s = toSpecFields(f, c);
        expect(s.diameterMm).toBe(24.26);
        expect(s.weightG).toBe(5.67);
        expect(s.thicknessMm).toBe(1.75);
        expect(s.material).toBe(EXPECTED_SPECS.material);
        expect(s.isKeyDate).toBe(false);
      }
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

describe('provenance: every mintage traces to the saved source (criteria 1, 5)', () => {
  it.each(PROGRAMS)('$label: sources[0] cites its saved response, revision and fetch date', (p) => {
    const f = fx(p);
    const src = f.sources?.[0];
    expect(src?.rawResponse).toBe(p.rawResponse);
    expect(src?.fetchedAt).toBe('2026-11-21');
    const abs = path.join(IMPORT_CATALOG_DIR, p.rawResponse);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe(p.title);
    expect(src?.revisionId).toBe(raw.parse.revid);
  });

  it.each(PROGRAMS)('$label: every non-null mintage appears in the saved wikitext', (p) => {
    const f = fx(p);
    const wikitext = loadWikitext(p.rawResponse);
    expect(wikitext.length).toBeGreaterThan(1000);
    const missing: string[] = [];
    let checked = 0;
    for (const c of f.coins) {
      if (c.mintage === null || c.mintage === undefined) continue;
      checked += 1;
      if (!mintageFigureAppears(wikitext, c.mintage)) missing.push(`${c.year} ${c.mintMark} ${c.variety} ${c.mintage}`);
    }
    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('null mintages occur only in the Semiquincentennial file', () => {
    for (const p of PROGRAMS) {
      const nulls = fx(p).coins.filter((c) => (c.mintage ?? null) === null);
      if (p.file === SEMIQ_FILE) expect(nulls.length).toBeLessThanOrEqual(4);
      else expect(nulls).toEqual([]);
    }
  });

  it('the figure matcher respects digit and comma boundaries (falsifiable)', () => {
    expect(mintageFigureAppears('| 1,234,567 |', 1234567)).toBe(true);
    expect(mintageFigureAppears('| 11,234,567 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 1,234,567,890 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 9,999 |', 1234567)).toBe(false);
  });
});

describe('column orientation (criterion 5)', () => {
  const cases: Array<[string, number, string, number, number]> = [
    ['us-quarters-50-state.json', 1999, 'Delaware', 373400000, 401424000],
    ['us-quarters-dc-and-territories.json', 2009, 'District of Columbia', 83600000, 88800000],
    ['us-quarters-america-the-beautiful.json', 2010, 'Hot Springs', 35600000, 34000000],
    ['us-quarters-american-women.json', 2022, 'Maya Angelou', 237600000, 258200000],
    ['us-quarters-semiquincentennial.json', 2026, 'Mayflower Compact', 115200000, 121400000],
  ];

  it.each(cases)('%s %i %s: P and D mintages are not swapped', (file, year, variety, p, d) => {
    expect(mintageOf(file, year, 'P', variety)).toBe(p);
    expect(mintageOf(file, year, 'D', variety)).toBe(d);
    expect(p).not.toBe(d);
  });

  it('2019 Lowell W is 2,000,000', () => {
    expect(mintageOf('us-quarters-america-the-beautiful.json', 2019, 'W', 'Lowell')).toBe(2000000);
  });
});

describe('specs traceable to the saved 50 State quarters infobox', () => {
  it('the wikitext contains 24.26, 1.75, 91.67% and 5.67', () => {
    const wikitext = loadWikitext('sources/50_State_quarters.2026-11-21.json');
    for (const needle of ['24.26', '1.75', '91.67%', '5.67']) expect(wikitext).toContain(needle);
  });
});

describe('existing templates are unchanged (sanity)', () => {
  it('Wheat still has 142 coins and Memorial and Shield 146', () => {
    expect(loadTemplate('lincoln-wheat-cents.v1.json').coins).toHaveLength(142);
    expect(loadTemplate('lincoln-memorial-and-shield-cents.v1.json').coins).toHaveLength(146);
  });
});
