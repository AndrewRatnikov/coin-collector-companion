/**
 * Tests for: the Ukrainian commemorative fixtures closing the "Ukraine gaps"
 * (14 first-type 10-hryvnia coins, 2016 1 hryvnia), canonical template v2 and
 * the newest-version-only template resolution.
 * Contract source: runs/run_20261121_222133/plan.md § Step E and § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6 (from runs/run_20261121_222133/prd.md)
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
import { resolveTemplatePaths } from './seed-canonical-sets';
import type { SeedTemplate } from './seed-canonical-sets';

const FIXTURES_DIR = path.resolve(__dirname, '../../../scripts/import-catalog/fixtures');
const TEMPLATES_DIR = path.resolve(__dirname, '../../../seed/templates');

type Fixture = RawFixtureFile & { 'titles-note'?: string };
type TitledCoin = RawCoinEntry & { titleUk?: string };

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

const FILE_10 = 'ukraine-commemorative-10-hryvnias.json';
const FILE_1 = 'ukraine-commemorative-1-hryvnia.json';
const V1 = 'ukraine-circulating-commemoratives.v1.json';
const V2 = 'ukraine-circulating-commemoratives.v2.json';

const comm10 = loadFixture(FILE_10);
const comm1 = loadFixture(FILE_1);
const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((f) => loadFixture(f));
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));
const ukraineKeys = allFixtures
  .filter((f) => f.country === 'Ukraine')
  .flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));

const FIRST_TYPE: Array<{ year: number; variety: string; titleUk: string }> = [
  { year: 2018, variety: 'Defenders of Donetsk Airport', titleUk: 'Захисникам Донецького аеропорту' },
  { year: 2018, variety: 'Day of the Ukrainian Volunteer', titleUk: 'День українського добровольця' },
  {
    year: 2018,
    variety: '100th Anniversary of the Ukrainian Navy',
    titleUk: '100-річчя створення Українського військово-морського флоту',
  },
  {
    year: 2019,
    variety: 'Participants of Combat Operations in Other Countries',
    titleUk: 'Учасникам бойових дій на території інших держав',
  },
  {
    year: 2019,
    variety: 'On Guard of Life (Military Medics)',
    titleUk: 'На варті життя (присвячується військовим медикам)',
  },
  { year: 2019, variety: 'KrAZ-6322 "Soldier"', titleUk: 'КрАЗ-6322 «Солдат»' },
  {
    year: 2020,
    variety: 'Air Force of the Armed Forces of Ukraine',
    titleUk: 'Повітряні Сили Збройних Сил України',
  },
  {
    year: 2020,
    variety: 'Day of Remembrance of Fallen Defenders of Ukraine',
    titleUk: "День пам'яті полеглих захисників України",
  },
  {
    year: 2020,
    variety: 'State Border Guard Service of Ukraine',
    titleUk: 'Державна прикордонна служба України',
  },
  {
    year: 2021,
    variety: 'Air Assault Forces of the Armed Forces of Ukraine',
    titleUk: 'Десантно-штурмові війська Збройних Сил України',
  },
  { year: 2021, variety: 'Ukrainian Armed Forces', titleUk: 'Збройні сили України' },
  {
    year: 2021,
    variety: 'Ground Forces of the Armed Forces of Ukraine',
    titleUk: 'Сухопутні війська Збройних Сил України',
  },
  {
    year: 2022,
    variety: 'Navy of the Armed Forces of Ukraine',
    titleUk: 'Військово-морські Сили Збройних Сил України',
  },
  {
    year: 2022,
    variety: 'Special Operations Forces of the Armed Forces of Ukraine',
    titleUk: 'Сили спеціальних операцій Збройних Сил України',
  },
];

const NEW_1_VARIETY = '20 Years of Monetary Reform in Ukraine';

describe('natural keys (criteria 4, 5)', () => {
  it('no natural key repeats across every fixture file', () => {
    expect(allFixtureFiles.length).toBeGreaterThanOrEqual(8);
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('no natural key repeats among the Ukrainian fixtures', () => {
    expect(ukraineKeys.length).toBeGreaterThan(100);
    expect(duplicates(ukraineKeys)).toEqual([]);
  });

  it('finds an existing coin key exactly once (the check is falsifiable)', () => {
    const existing = comm10.coins[comm10.coins.length - 1];
    const key = fixtureKey(comm10, existing);
    expect(allFixtureKeys.filter((k) => k === key)).toHaveLength(1);
    expect(duplicates([...allFixtureKeys, key])).toEqual([key]);
  });
});

describe('the 14 first-type 10-hryvnia commemoratives (criteria 1, 2)', () => {
  it('keeps identity and the file-level second-type specs', () => {
    expect(comm10.country).toBe('Ukraine');
    expect(comm10.denomination).toBe('10 Hryvnias');
    expect(comm10.coins).toHaveLength(40);
    expect(comm10.specs).toMatchObject({
      diameterMm: 23.5,
      weightG: 6.4,
      thicknessMm: 2.3,
      material: 'Nickel-plated zinc alloy',
    });
  });

  it('has the 14 coins first, in the planned order, by year, variety and Ukrainian title', () => {
    const first = (comm10.coins as TitledCoin[]).slice(0, 14);
    expect(first.map((c) => ({ year: c.year, variety: c.variety, titleUk: c.titleUk }))).toEqual(FIRST_TYPE);
  });

  it.each(FIRST_TYPE.map((c, i) => [i, c.variety] as const))('coin %i (%s): null mint mark and mintage, own specs', (i) => {
    const coin = comm10.coins[i];
    expect(coin.mintMark).toBeNull();
    expect(coin.mintage).toBeNull();
    expect(coin.specs).toEqual({ diameterMm: 30, weightG: 12.4, thicknessMm: 2.8 });
    expect(toSpecFields(comm10, coin)).toMatchObject({
      diameterMm: 30,
      weightG: 12.4,
      thicknessMm: 2.8,
      material: 'Nickel-plated zinc alloy',
      mintage: null,
    });
  });

  it('leaves the 26 existing coins without a spec override or titleUk, still on the 23.5 mm specs', () => {
    const rest = comm10.coins.slice(14) as TitledCoin[];
    expect(rest).toHaveLength(26);
    for (const c of rest) {
      expect(c.specs).toBeUndefined();
      expect(c.titleUk).toBeUndefined();
      const s = toSpecFields(comm10, c);
      expect(s.diameterMm).toBe(23.5);
      expect(s.weightG).toBe(6.4);
    }
    expect(rest[0].year).toBe(2022);
    expect(rest[0].variety).toBe('Territorial Defense Forces of the Armed Forces of Ukraine');
  });

  it('gives first-type and second-type coins different specs (falsifiable)', () => {
    const a = toSpecFields(comm10, comm10.coins[0]);
    const b = toSpecFields(comm10, comm10.coins[14]);
    expect(a.diameterMm).not.toBe(b.diameterMm);
    expect(a.weightG).not.toBe(b.weightG);
  });

  it('puts no series separator in a new variety (no eyebrow)', () => {
    for (const c of comm10.coins.slice(0, 14)) expect(c.variety).not.toContain(': ');
  });
});

describe('the 2016 1 hryvnia (criterion 3)', () => {
  it('is the 6th and last coin with the planned subject, title and 60,000 mintage', () => {
    expect(comm1.denomination).toBe('1 Hryvnia');
    expect(comm1.coins).toHaveLength(6);
    const last = comm1.coins[5] as TitledCoin;
    expect(last.year).toBe(2016);
    expect(last.mintMark).toBeNull();
    expect(last.variety).toBe(NEW_1_VARIETY);
    expect(last.titleUk).toBe('20 років грошовій реформі в Україні');
    expect(last.mintage).toBe(60000);
    expect(last.specs).toBeUndefined();
  });

  it('inherits 26 mm, 6.8 g, 1.85 mm, aluminium bronze', () => {
    expect(toSpecFields(comm1, comm1.coins[5])).toMatchObject({
      diameterMm: 26,
      weightG: 6.8,
      thicknessMm: 1.85,
      material: 'Aluminium bronze',
      mintage: 60000,
    });
  });

  it('does not collide with the 2016 Volodymyr the Great coin or the circulation 1 hryvnia file', () => {
    const newKey = fixtureKey(comm1, comm1.coins[5]);
    const circulation = loadFixture('ukraine-1-hryvnia.json');
    const circulationKeys = circulation.coins.map((c) => fixtureKey(circulation, c));
    const volodymyr2016 = circulation.coins.find((c) => c.year === 2016 && c.variety === 'Volodymyr the Great');
    expect(volodymyr2016).toBeDefined();
    expect(circulationKeys).toContain(fixtureKey(circulation, volodymyr2016 as RawCoinEntry));
    expect(newKey).not.toBe(fixtureKey(circulation, volodymyr2016 as RawCoinEntry));
    expect(circulationKeys).not.toContain(newKey);
  });

  it('keeps the 1 kopiyka 2019 out of the catalog', () => {
    const kopiyka = loadFixture('ukraine-1-kopiyka.json');
    expect(kopiyka.coins.length).toBeGreaterThan(0);
    expect(kopiyka.coins.some((c) => c.year === 2019)).toBe(false);
  });
});

describe('Ukrainian Circulating Commemoratives template v2 (criterion 6)', () => {
  const v1 = loadTemplate(V1);
  const v2 = loadTemplate(V2);
  const newKeys = [
    ...(comm1.coins.slice(5).map((c) => fixtureKey(comm1, c))),
    ...(comm10.coins.slice(0, 14).map((c) => fixtureKey(comm10, c))),
  ];

  it('has the same name as v1 and a non-empty description', () => {
    expect(v2.name).toBe(v1.name);
    expect(v2.name).toBe('Ukrainian Circulating Commemoratives');
    expect((v2.description ?? '').trim().length).toBeGreaterThan(0);
  });

  it('is the 1 hryvnia fixture coins followed by the 10 hryvnias fixture coins, 46 in all', () => {
    expect(v2.coins).toEqual([...asTemplateCoins(comm1), ...asTemplateCoins(comm10)]);
    expect(v2.coins).toHaveLength(46);
  });

  it('resolves every coin to exactly one fixture row and lists none twice', () => {
    for (const coin of v2.coins) {
      expect(allFixtureKeys.filter((k) => k === templateKey(coin))).toHaveLength(1);
    }
    expect(duplicates(v2.coins.map(templateKey))).toEqual([]);
  });

  it('contains each of the 15 new coins', () => {
    expect(newKeys).toHaveLength(15);
    const keys = v2.coins.map(templateKey);
    for (const k of newKeys) expect(keys).toContain(k);
  });

  it('is a superset of v1', () => {
    const keys = new Set(v2.coins.map(templateKey));
    for (const c of v1.coins) expect(keys.has(templateKey(c))).toBe(true);
  });

  it('leaves v1 untouched: 31 coins and none of the new ones', () => {
    expect(v1.coins).toHaveLength(31);
    const keys = v1.coins.map(templateKey);
    for (const k of newKeys) expect(keys).not.toContain(k);
  });
});

describe('seeding only the newest template version (criterion 6)', () => {
  const resolved = resolveTemplatePaths([]);

  it('picks v2 and not v1 of the commemoratives template', () => {
    expect(resolved.some((p) => p.endsWith(V2))).toBe(true);
    expect(resolved.some((p) => p.endsWith(V1))).toBe(false);
  });

  it('keeps the other Ukrainian templates', () => {
    expect(resolved.some((p) => p.endsWith('ukraine-circulation-coins.v1.json'))).toBe(true);
    expect(resolved.some((p) => p.endsWith('ukraine-we-are-strong-we-are-together.v1.json'))).toBe(true);
  });

  it('returns exactly one path per template slug', () => {
    const slugs = resolved.map((p) => path.basename(p).replace(/\.v\d+\.json$/, ''));
    expect(duplicates(slugs)).toEqual([]);
  });

  it('seeds no two templates under the same set name', () => {
    const names = resolved.map((p) => readJson<SeedTemplate>(p).name);
    expect(duplicates(names)).toEqual([]);
  });
});
