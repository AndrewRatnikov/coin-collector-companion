/**
 * Tests for: Lincoln Memorial, Bicentennial and Shield cent fixtures (growth backlog 2.1, cents part),
 * the two canonical set templates built from them, and their provenance in the saved source.
 * Contract source: runs/run_20261121_195917/plan.md § Step E and § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6, #8, #9, #10 (from runs/run_20261121_195917/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only (fixtures, templates, the saved MediaWiki response) with fs.readFileSync;
 * no network, no database, no mocks. Data-driven: no hard-coded mintage figures.
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

type Fixture = RawFixtureFile & {
  yearRange?: [number, number];
  mintageSums?: Record<string, number[]>;
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

const NEW_FILES = {
  bronze: 'us-cents-lincoln-memorial-bronze.json',
  zinc: 'us-cents-lincoln-memorial-zinc.json',
  bicentennial: 'us-cents-lincoln-bicentennial.json',
  shield: 'us-cents-lincoln-shield.json',
} as const;
const WHEAT_FILE = 'us-cents-lincoln-wheat.json';
const MEMORIAL_TEMPLATE = 'lincoln-memorial-and-shield-cents.v1.json';
const ALL_TEMPLATE = 'lincoln-cents-1909-2025.v1.json';

const MATERIAL_BRONZE_EARLY = 'Bronze (95% copper, 5% tin and zinc)';
const MATERIAL_BRONZE = 'Bronze (95% copper, 5% zinc)';
const MATERIAL_ZINC = 'Copper-plated zinc (97.5% zinc, 2.5% copper)';

const bronze = loadFixture(NEW_FILES.bronze);
const zinc = loadFixture(NEW_FILES.zinc);
const bicentennial = loadFixture(NEW_FILES.bicentennial);
const shield = loadFixture(NEW_FILES.shield);
const wheat = loadFixture(WHEAT_FILE);
const NEW_ORDERED: Fixture[] = [bronze, zinc, bicentennial, shield];

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

function mintageFigureAppears(wikitext: string, n: number): boolean {
  const formatted = n.toLocaleString('en-US');
  const escaped = formatted.replace(/[.*+?^${}()|[\]\\,]/g, '\\$&');
  return new RegExp(`(?<![\\d,])${escaped}(?![\\d,])`).test(wikitext);
}

describe('every template coin resolves to exactly one fixture row (criterion 9)', () => {
  const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

  it('finds the existing and the two new templates', () => {
    expect(templateFiles).toEqual(expect.arrayContaining([MEMORIAL_TEMPLATE, ALL_TEMPLATE, 'lincoln-wheat-cents.v1.json']));
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
    const fake = templateKey({ country: 'USA', denomination: 'Cent', year: 2026, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fake)).toHaveLength(0);
  });
});

describe('Lincoln Memorial and Shield Cents 1959-2025 template (criterion 8)', () => {
  const template = loadTemplate(MEMORIAL_TEMPLATE);

  it('has the exact name and a description', () => {
    expect(template.name).toBe('Lincoln Memorial and Shield Cents 1959-2025');
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
  });

  it('lists the four new fixtures in file order bronze, zinc, bicentennial, shield, in fixture order', () => {
    const expected = NEW_ORDERED.flatMap(asTemplateCoins);
    expect(expected.length).toBeGreaterThan(100);
    expect(template.coins).toEqual(expected);
  });

  it('uses empty strings, not null, for a missing mint mark and variety', () => {
    for (const c of template.coins) {
      expect(typeof c.mintMark).toBe('string');
      expect(typeof c.variety).toBe('string');
    }
  });
});

describe('Lincoln Cents 1909-2025 template (criterion 8)', () => {
  const template = loadTemplate(ALL_TEMPLATE);

  it('has the exact name and a description', () => {
    expect(template.name).toBe('Lincoln Cents 1909-2025');
    expect((template.description ?? '').trim().length).toBeGreaterThan(0);
  });

  it('is the Wheat fixture coins followed by the Memorial and Shield list', () => {
    const expected = [...asTemplateCoins(wheat), ...NEW_ORDERED.flatMap(asTemplateCoins)];
    expect(template.coins).toEqual(expected);
    expect(template.coins.length).toBe(wheat.coins.length + loadTemplate(MEMORIAL_TEMPLATE).coins.length);
  });

  it('resolves every coin against the Wheat fixture plus the new fixtures', () => {
    const keys = [wheat, ...NEW_ORDERED].flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));
    for (const coin of template.coins) {
      expect(keys.filter((k) => k === templateKey(coin))).toHaveLength(1);
    }
  });
});

describe('Wheat template is untouched (sanity)', () => {
  it('still has its name and 142 coins', () => {
    const t = loadTemplate('lincoln-wheat-cents.v1.json');
    expect(t.name).toBe('Lincoln Wheat Cents');
    expect(t.coins).toHaveLength(142);
  });
});

describe('no duplicate natural keys (criterion 10)', () => {
  it.each(Object.entries(NEW_FILES))('%s file has none', (_label, file) => {
    const f = loadFixture(file);
    expect(f.coins.length).toBeGreaterThan(0);
    expect(duplicates(f.coins.map((c) => fixtureKey(f, c)))).toEqual([]);
  });

  it('the four new files together have none', () => {
    expect(duplicates(NEW_ORDERED.flatMap((f) => f.coins.map((c) => fixtureKey(f, c))))).toEqual([]);
  });

  it('every fixture file in the directory together has none', () => {
    expect(allFixtureFiles.length).toBeGreaterThanOrEqual(8);
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the duplicate detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('identity and year range (criteria 2, 3)', () => {
  const cases: Array<{ label: string; file: Fixture; name: string; range: [number, number] }> = [
    { label: 'bronze', file: bronze, name: 'Lincoln Memorial Cent', range: [1959, 1982] },
    { label: 'zinc', file: zinc, name: 'Lincoln Memorial Cent', range: [1982, 2008] },
    { label: 'bicentennial', file: bicentennial, name: 'Lincoln Bicentennial Cent', range: [2009, 2009] },
    { label: 'shield', file: shield, name: 'Lincoln Shield Cent', range: [2010, 2025] },
  ];

  it.each(cases)('$label: USA, Cent, name and years within its range', ({ file, name, range }) => {
    expect(file.country).toBe('USA');
    expect(file.denomination).toBe('Cent');
    expect(file.name).toBe(name);
    expect(file.yearRange).toEqual(range);
    for (const c of file.coins) {
      expect(c.year).toBeGreaterThanOrEqual(range[0]);
      expect(c.year).toBeLessThanOrEqual(range[1]);
    }
  });

  it('covers 1959 through 2025 overall and never 2026', () => {
    const years = NEW_ORDERED.flatMap((f) => f.coins.map((c) => c.year));
    expect(Math.min(...years)).toBe(1959);
    expect(Math.max(...years)).toBe(2025);
    expect(years).not.toContain(2026);
    const yearSet = new Set(years);
    for (let y = 1959; y <= 2025; y++) expect(yearSet.has(y)).toBe(true);
  });

  it('every file starts and ends on its range limits', () => {
    for (const { file, range } of cases) {
      const ys = file.coins.map((c) => c.year);
      expect(Math.min(...ys)).toBe(range[0]);
      expect(Math.max(...ys)).toBe(range[1]);
    }
  });

  it('1982 rows sit in bronze as Copper and in zinc as Zinc', () => {
    const b = bronze.coins.filter((c) => c.year === 1982);
    const z = zinc.coins.filter((c) => c.year === 1982);
    expect(b.length).toBeGreaterThan(0);
    expect(z.length).toBeGreaterThan(0);
    expect(b.every((c) => c.variety === 'Copper')).toBe(true);
    expect(z.every((c) => c.variety === 'Zinc')).toBe(true);
  });

  it('is business strikes only: no key date flag and no collector-only varieties', () => {
    for (const f of NEW_ORDERED) {
      for (const c of f.coins) {
        expect(c.isKeyDate ?? false).toBe(false);
        expect(c.variety ?? '').not.toMatch(/proof|satin|special mint|uncirculated|enhanced/i);
      }
    }
  });
});

describe('2009 Bicentennial designs (criterion 4)', () => {
  const DESIGNS = ['Birthplace', 'Formative Years', 'Professional Life', 'Presidency'];

  it('is exactly the four designs for the no-mark and D coins', () => {
    const keys = bicentennial.coins.map((c) => `${sanitizeIdentityField(c.mintMark)}|${sanitizeIdentityField(c.variety)}`);
    const expected = ['', 'D'].flatMap((m) => DESIGNS.map((d) => `${m}|${d}`));
    expect([...keys].sort()).toEqual([...expected].sort());
    expect(keys).toHaveLength(8);
  });

  it('has no 2009 cent in the other new files', () => {
    for (const f of [bronze, zinc, shield]) {
      expect(f.coins.some((c) => c.year === 2009)).toBe(false);
    }
  });
});

describe('1982 Copper and Zinc (criterion 5)', () => {
  const rows = [...bronze.coins, ...zinc.coins].filter((c) => c.year === 1982);

  it('is exactly Copper and Zinc for the no-mark and D coins', () => {
    const keys = rows.map((c) => `${sanitizeIdentityField(c.mintMark)}|${sanitizeIdentityField(c.variety)}`);
    expect([...keys].sort()).toEqual(['D|Copper', 'D|Zinc', '|Copper', '|Zinc'].sort());
  });

  it('leaves all four mintages null (the source gives one combined figure per mint)', () => {
    expect(rows).toHaveLength(4);
    for (const c of rows) expect(c.mintage ?? null).toBeNull();
  });

  it('resolves to 3.11 g for Copper and 2.5 g for Zinc', () => {
    const copper = bronze.coins.filter((c) => c.year === 1982);
    const zincRows = zinc.coins.filter((c) => c.year === 1982);
    for (const c of copper) expect(toSpecFields(bronze, c).weightG).toBe(3.11);
    for (const c of zincRows) expect(toSpecFields(zinc, c).weightG).toBe(2.5);
  });

  it('is the only place a mintage is null', () => {
    const nulls = NEW_ORDERED.flatMap((f) => f.coins.filter((c) => (c.mintage ?? null) === null).map((c) => c.year));
    expect(nulls).toEqual([1982, 1982, 1982, 1982]);
  });
});

describe('specs (criterion 5)', () => {
  it('every new coin is 19.05 mm and has one of the three exact materials', () => {
    for (const f of NEW_ORDERED) {
      for (const c of f.coins) {
        const s = toSpecFields(f, c);
        expect(s.diameterMm).toBe(19.05);
        expect([MATERIAL_BRONZE_EARLY, MATERIAL_BRONZE, MATERIAL_ZINC]).toContain(s.material);
        expect(s.thicknessMm).toBeNull();
      }
    }
  });

  it('uses "5% tin and zinc" bronze for exactly 1959-1961', () => {
    for (const c of bronze.coins) {
      const s = toSpecFields(bronze, c);
      expect(s.material).toBe(c.year <= 1961 ? MATERIAL_BRONZE_EARLY : MATERIAL_BRONZE);
      expect(s.weightG).toBe(3.11);
    }
    expect(bronze.coins.filter((c) => c.year <= 1961).length).toBeGreaterThan(0);
  });

  it('uses copper-plated zinc at 2.5 g for the zinc, bicentennial and shield files', () => {
    for (const f of [zinc, bicentennial, shield]) {
      for (const c of f.coins) {
        const s = toSpecFields(f, c);
        expect(s.material).toBe(MATERIAL_ZINC);
        expect(s.weightG).toBe(2.5);
      }
    }
  });

  it('has no image on any coin', () => {
    for (const f of NEW_ORDERED) {
      for (const c of f.coins) expect(c.image ?? null).toBeNull();
    }
  });
});

describe('provenance: every mintage traces to the saved source (criteria 1, 6)', () => {
  const rawPaths = new Set(NEW_ORDERED.map((f) => f.sources?.[0]?.rawResponse));

  it('all four files cite the same saved raw response', () => {
    expect(rawPaths.size).toBe(1);
    const [rel] = [...rawPaths];
    expect(rel).toBe('sources/Lincoln_cent_mintage_figures.2026-11-21.json');
  });

  it('the saved response is the "Lincoln cent mintage figures" revision named in sources[0]', () => {
    const rel = bronze.sources?.[0]?.rawResponse as string;
    const abs = path.join(IMPORT_CATALOG_DIR, rel);
    expect(fs.existsSync(abs)).toBe(true);
    const raw = readJson<{ parse: { title: string; revid: number } }>(abs);
    expect(raw.parse.title).toBe('Lincoln cent mintage figures');
    for (const f of NEW_ORDERED) {
      expect(f.sources?.[0]?.revisionId).toBe(raw.parse.revid);
    }
  });

  it('every non-null mintage appears in the wikitext, summed years as the sum of their listed parts', () => {
    const rel = bronze.sources?.[0]?.rawResponse as string;
    const raw = readJson<{ parse: { wikitext: string | { '*': string } } }>(path.join(IMPORT_CATALOG_DIR, rel));
    const wikitext = typeof raw.parse.wikitext === 'string' ? raw.parse.wikitext : raw.parse.wikitext['*'];
    expect(wikitext.length).toBeGreaterThan(1000);

    const sums = bronze.mintageSums ?? {};
    const summedYearsUsed = new Set<string>();
    let checked = 0;

    for (const f of NEW_ORDERED) {
      for (const c of f.coins) {
        if (c.mintage === null || c.mintage === undefined) continue;
        checked += 1;
        const parts = f === bronze && !c.mintMark && !c.variety ? sums[String(c.year)] : undefined;
        if (parts) {
          summedYearsUsed.add(String(c.year));
          expect(parts.length).toBeGreaterThan(1);
          expect(c.mintage).toBe(parts.reduce((a, b) => a + b, 0));
          for (const p of parts) {
            expect({ year: c.year, part: p, found: mintageFigureAppears(wikitext, p) }).toEqual({
              year: c.year,
              part: p,
              found: true,
            });
          }
        } else {
          expect({ year: c.year, mark: c.mintMark, variety: c.variety, found: mintageFigureAppears(wikitext, c.mintage) }).toEqual({
            year: c.year,
            mark: c.mintMark,
            variety: c.variety,
            found: true,
          });
        }
      }
    }

    expect(checked).toBeGreaterThan(100);
    expect(Object.keys(sums).sort()).toEqual([...summedYearsUsed].sort());
  });

  it('the figure matcher respects digit and comma boundaries (falsifiable)', () => {
    expect(mintageFigureAppears('| 1,234,567 |', 1234567)).toBe(true);
    expect(mintageFigureAppears('| 11,234,567 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 1,234,567,890 |', 1234567)).toBe(false);
    expect(mintageFigureAppears('| 9,999 |', 1234567)).toBe(false);
  });
});
