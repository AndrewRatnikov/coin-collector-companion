/**
 * Tests for: the single US mint-mark rule (mintMark is what is struck on the coin, null when unmarked),
 * across every US fixture, the three corrected templates, the new ADR, the superseded ADR status lines,
 * the seed-script comment, the fixtures README, the backlog and the history paragraph.
 * Contract source: runs/run_20261126_061240/plan.md § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6, #7, #9, #11, #12, #13, #14, #15 (from runs/run_20261126_061240/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Reads checked-in files only with fs.readFileSync; no network, no database, no mocks.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { sanitizeIdentityField } from '@coin-collector/shared';
import type { RawCoinEntry, RawFixtureFile } from '../../../scripts/import-catalog/lib/types';
import type { SeedTemplate } from './seed-canonical-sets';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'scripts/import-catalog/fixtures');
const TEMPLATES_DIR = path.join(REPO_ROOT, 'seed/templates');
const ADR_DIR = path.join(REPO_ROOT, 'docs/adr');

type Fixture = RawFixtureFile & { 'rules-note'?: string };

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}
function readText(file: string): string {
  return fs.readFileSync(file, 'utf8');
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
function statusLine(markdown: string): string {
  return markdown.split('\n').find((l) => l.startsWith('- **Status:** ')) ?? '';
}

/** Rows dated before 1980 that carry a "P" mint mark, as file|year|variety. */
function earlyPRows(files: Array<{ name: string; coins: RawCoinEntry[] }>): string[] {
  return files.flatMap((f) =>
    f.coins.filter((c) => c.year < 1980 && c.mintMark === 'P').map((c) => `${f.name}|${c.year}|${c.variety ?? ''}`),
  );
}

const NEW_ADR_SLUG = '2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked';
const NEW_ADR_FILE = `${NEW_ADR_SLUG}.md`;
const ADR_1124 = '2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md';
const ADR_1125 = '2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark.md';
const ADR_1121 = '2026-11-21-canonical-template-changes-ship-as-a-new-version-file.md';

const SILVER_FILE = 'us-dimes-roosevelt-silver.json';
const EISENHOWER_FILE = 'us-dollars-eisenhower.json';
const CLAD_FILE = 'us-dimes-roosevelt-clad.json';
const WARTIME_FILE = 'us-nickels-jefferson-wartime-silver.json';
const ANTHONY_FILE = 'us-dollars-susan-b-anthony.json';
const CENT_FILE = 'us-cents-lincoln-shield.json';

const DIME_TEMPLATE = 'roosevelt-dimes-1946-2025.v1.json';
const NICKEL_TEMPLATE = 'jefferson-nickels-1938-2025.v1.json';
const EISENHOWER_TEMPLATE = 'eisenhower-dollars.v1.json';

const allFixtureFiles = fs.readdirSync(FIXTURES_DIR).filter((f) => f.endsWith('.json'));
const allFixtures = allFixtureFiles.map((name) => ({ name, ...loadFixture(name) }));
const usFixtures = allFixtures.filter((f) => f.country === 'USA');
const allFixtureKeys = allFixtures.flatMap((f) => f.coins.map((c) => fixtureKey(f, c)));
const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.json'));

describe('cross-series rule: no pre-1980 "P" mint mark except the two named exceptions (criteria 3, 9)', () => {
  const ALLOWED = [
    `${WARTIME_FILE}|1942|`,
    `${WARTIME_FILE}|1943|`,
    `${WARTIME_FILE}|1944|`,
    `${WARTIME_FILE}|1945|`,
    `${ANTHONY_FILE}|1979|`,
  ];

  it('covers at least 23 US fixture files', () => {
    expect(usFixtures.length).toBeGreaterThanOrEqual(23);
  });

  it('the only pre-1980 P rows are the 1942-1945 wartime nickels and the 1979 Anthony dollar', () => {
    expect(earlyPRows(usFixtures).sort()).toEqual([...ALLOWED].sort());
  });

  it('the exceptions really exist in the fixtures (a stale exception list fails)', () => {
    const present = earlyPRows(usFixtures);
    for (const a of ALLOWED) expect(present).toContain(a);
  });

  it('the checker reports a 1950 "P" row in an in-memory fixture (falsifiable)', () => {
    const bad = [
      {
        name: 'fake.json',
        coins: [
          { year: 1950, mintMark: 'P', variety: null, isKeyDate: false, mintage: 1 },
          { year: 1950, mintMark: null, variety: null, isKeyDate: false, mintage: 1 },
          { year: 1980, mintMark: 'P', variety: null, isKeyDate: false, mintage: 1 },
        ],
      },
    ] as Array<{ name: string; coins: RawCoinEntry[] }>;
    expect(earlyPRows(bad)).toEqual(['fake.json|1950|']);
    expect(earlyPRows([{ name: 'ok.json', coins: [bad[0].coins[1], bad[0].coins[2]] }])).toEqual([]);
  });
});

describe('real P marks are kept (criterion 3)', () => {
  it('a 1980 "P" row exists in the clad dimes and the Anthony file', () => {
    for (const file of [CLAD_FILE, ANTHONY_FILE]) {
      expect(loadFixture(file).coins.some((c) => c.year === 1980 && c.mintMark === 'P')).toBe(true);
    }
  });

  it('the 2017 "P" cent exists in the Lincoln shield file', () => {
    expect(loadFixture(CENT_FILE).coins.some((c) => c.year === 2017 && c.mintMark === 'P')).toBe(true);
  });

  it('the four wartime nickels keep "P"', () => {
    const years = loadFixture(WARTIME_FILE)
      .coins.filter((c) => c.mintMark === 'P')
      .map((c) => c.year)
      .sort();
    expect(years).toEqual([1942, 1943, 1944, 1945]);
  });
});

describe('null counts (criteria 1, 2)', () => {
  it('the silver dime file has exactly 19 null rows, one per year 1946-1964, and no "P"', () => {
    const f = loadFixture(SILVER_FILE);
    const nulls = f.coins.filter((c) => c.mintMark === null).map((c) => c.year);
    expect(nulls).toHaveLength(19);
    expect(nulls).toEqual(Array.from({ length: 19 }, (_, i) => 1946 + i));
    expect(f.coins.some((c) => c.mintMark === 'P')).toBe(false);
  });

  it('the Eisenhower file has exactly 8 null rows and 8 D rows, no "P"', () => {
    const f = loadFixture(EISENHOWER_FILE);
    expect(f.coins.filter((c) => c.mintMark === null)).toHaveLength(8);
    expect(f.coins.filter((c) => c.mintMark === 'D')).toHaveLength(8);
    expect(f.coins.some((c) => c.mintMark === 'P')).toBe(false);
  });
});

describe('template files (criteria 4, 11, 12)', () => {
  it('the old 1946-2026 and 1938-2026 files are gone', () => {
    expect(templateFiles).not.toContain('roosevelt-dimes-1946-2026.v1.json');
    expect(templateFiles).not.toContain('jefferson-nickels-1938-2026.v1.json');
  });

  it('the renamed files exist', () => {
    expect(templateFiles).toEqual(expect.arrayContaining([DIME_TEMPLATE, NICKEL_TEMPLATE, EISENHOWER_TEMPLATE]));
  });

  it('there is no v2 file for the dime, Eisenhower or 1938 nickel templates', () => {
    const v2 = templateFiles.filter((f) =>
      /^(roosevelt-dimes-.*|eisenhower-dollars|jefferson-nickels-1938-.*)\.v[2-9][0-9]*\.json$/.test(f),
    );
    expect(v2).toEqual([]);
  });

  it('the only dime template file is the renamed one', () => {
    expect(templateFiles.filter((f) => /dime/i.test(f))).toEqual([DIME_TEMPLATE]);
  });

  it('the dime and nickel names occur exactly once, the old names never', () => {
    const names = templateFiles.map((f) => loadTemplate(f).name);
    expect(names.filter((n) => n === 'Roosevelt Dimes 1946-2025')).toHaveLength(1);
    expect(names.filter((n) => n === 'Jefferson Nickels 1938-2025')).toHaveLength(1);
    expect(names.filter((n) => n === 'Roosevelt Dimes 1946-2026')).toHaveLength(0);
    expect(names.filter((n) => n === 'Jefferson Nickels 1938-2026')).toHaveLength(0);
  });

  it('the dime template: name, description, 168 coins equal to silver then clad', () => {
    const t = loadTemplate(DIME_TEMPLATE);
    expect(t.name).toBe('Roosevelt Dimes 1946-2025');
    expect(t.description).toBe(
      'Every Roosevelt dime business strike from 1946 to 2025: the 90% silver dimes to 1964, then the copper-nickel clad dimes, including the 1982 No P dime.',
    );
    expect(t.coins).toHaveLength(168);
    expect(t.coins).toEqual([
      ...asTemplateCoins(loadFixture(SILVER_FILE)),
      ...asTemplateCoins(loadFixture(CLAD_FILE)),
    ]);
    const withVariety = t.coins.filter((c) => c.variety !== '');
    expect(withVariety).toEqual([
      { country: 'USA', denomination: 'Dime', year: 1982, mintMark: '', variety: 'No P' },
    ]);
    expect(t.coins.filter((c) => c.year <= 1964 && c.mintMark === '')).toHaveLength(19);
  });

  it('the nickel template: name, unchanged description, 194 coins, no 2026', () => {
    const t = loadTemplate(NICKEL_TEMPLATE);
    expect(t.name).toBe('Jefferson Nickels 1938-2025');
    expect(t.description).toBe(
      'Every Jefferson nickel business strike from 1938 to 2025, including the 1942-1945 wartime silver nickels and the 2004-2005 Westward Journey designs.',
    );
    expect(t.coins).toHaveLength(194);
    expect(t.coins.some((c) => c.year === 2026)).toBe(false);
  });

  it('the Eisenhower template equals the fixture, with 8 empty mint marks', () => {
    const t = loadTemplate(EISENHOWER_TEMPLATE);
    expect(t.name).toBe('Eisenhower Dollars');
    expect(t.coins).toHaveLength(16);
    expect(t.coins).toEqual(asTemplateCoins(loadFixture(EISENHOWER_FILE)));
    expect(t.coins.filter((c) => c.mintMark === '')).toHaveLength(8);
    expect(t.coins.some((c) => c.mintMark === 'P')).toBe(false);
  });

  it.each([DIME_TEMPLATE, NICKEL_TEMPLATE, EISENHOWER_TEMPLATE])(
    '%s: every coin resolves to exactly one fixture row',
    (file) => {
      const unresolved: string[] = [];
      for (const coin of loadTemplate(file).coins) {
        const matches = allFixtureKeys.filter((k) => k === templateKey(coin)).length;
        if (matches !== 1) unresolved.push(`${templateKey(coin)} x${matches}`);
      }
      expect(unresolved).toEqual([]);
    },
  );

  it('a stale key "P" dime would be flagged (falsifiable)', () => {
    const stale = templateKey({ country: 'USA', denomination: 'Dime', year: 1950, mintMark: 'P', variety: '' });
    expect(allFixtureKeys.filter((k) => k === stale)).toHaveLength(0);
    const fresh = templateKey({ country: 'USA', denomination: 'Dime', year: 1950, mintMark: '', variety: '' });
    expect(allFixtureKeys.filter((k) => k === fresh)).toHaveLength(1);
  });
});

describe('no duplicate natural keys across all fixtures (criterion 15)', () => {
  it('has none', () => {
    expect(allFixtureKeys.length).toBeGreaterThan(1000);
    expect(duplicates(allFixtureKeys)).toEqual([]);
  });

  it('the detector reports a repeated key', () => {
    expect(duplicates(['a', 'b', 'a'])).toEqual(['a']);
  });
});

describe('the new ADR (criteria 5, 6)', () => {
  const adr = readText(path.join(ADR_DIR, NEW_ADR_FILE));
  const lines = adr.split('\n');

  it('starts with a heading and has the metadata lines', () => {
    expect(lines[0].startsWith('# ')).toBe(true);
    expect(lines).toContain('- **Status:** Accepted');
    expect(lines).toContain('- **Date:** 2026-11-26');
    expect(lines.some((l) => l.startsWith('- **Source:**') && l.includes('run_20261126_061240'))).toBe(true);
    expect(lines.some((l) => l.startsWith('- **Code:**'))).toBe(true);
  });

  it('supersedes the 2026-11-24 ADR and the 2026-11-25 nickels ADR', () => {
    const sup = lines.find((l) => l.startsWith('- **Supersedes:**')) ?? '';
    expect(sup).toContain(`(${ADR_1124})`);
    expect(sup).toContain(`(${ADR_1125})`);
  });

  it('has the four sections', () => {
    for (const h of ['## Context', '## Decision', '## Alternatives considered', '## Consequences']) {
      expect(lines).toContain(h);
    }
  });

  it('states the in-place exception to the versioning ADR and the real P exceptions', () => {
    for (const n of ['never seeded', 'v1', 'v2', ADR_1121, '1979', '1942']) expect(adr).toContain(n);
  });
});

describe('superseded ADR status lines (criteria 5, 6)', () => {
  const superseded = `Superseded by [${NEW_ADR_SLUG}](${NEW_ADR_FILE})`;

  it.each([ADR_1124, ADR_1125])('%s is superseded by the new ADR and keeps its Decision section', (file) => {
    const text = readText(path.join(ADR_DIR, file));
    expect(statusLine(text).startsWith(`- **Status:** ${superseded}`)).toBe(true);
    expect(text).toContain('## Decision');
  });

  it('the versioning ADR stays Accepted and cross-references the exception', () => {
    const text = readText(path.join(ADR_DIR, ADR_1121));
    const status = statusLine(text);
    expect(status.startsWith('- **Status:** Accepted.')).toBe(true);
    expect(status).toContain(`(${NEW_ADR_FILE})`);
    expect(status).toContain('never seeded');
    expect(status).not.toContain('Superseded');
    expect(text).toContain('## Decision');
  });
});

describe('docs/adr/README.md (criterion 5)', () => {
  const readmeLines = readText(path.join(ADR_DIR, 'README.md')).split('\n');
  const rowFor = (file: string) => readmeLines.find((l) => l.includes(`](${file})`)) ?? '';

  it('has a row for the new ADR', () => {
    expect(rowFor(NEW_ADR_FILE)).not.toBe('');
    expect(rowFor(NEW_ADR_FILE)).toContain('Accepted');
  });

  it('the three older rows point at the new ADR, two of them as Superseded', () => {
    for (const f of [ADR_1124, ADR_1125, ADR_1121]) {
      expect(rowFor(f)).toContain(NEW_ADR_SLUG);
    }
    expect(rowFor(ADR_1124)).toContain('Superseded by');
    expect(rowFor(ADR_1125)).toContain('Superseded by');
    expect(rowFor(ADR_1121)).not.toContain('Superseded by');
  });
});

describe('seed-canonical-sets.ts comment (criterion 6)', () => {
  const src = readText(path.join(REPO_ROOT, 'apps/api/scripts/seed-canonical-sets.ts'));

  it('names the never-seeded exception and the new ADR', () => {
    expect(src).toContain('never seeded');
    expect(src).toContain(NEW_ADR_SLUG);
  });

  it('still exports the SeedTemplate type', () => {
    expect(src).toMatch(/export\s+(type|interface)\s+SeedTemplate/);
  });
});

describe('fixtures README (criteria 7, 13)', () => {
  const readme = readText(path.join(FIXTURES_DIR, 'README.md'));

  it('the dime section states the fixes and no longer the old exception', () => {
    const section = readSection(readme, '## `us-dimes-roosevelt-*.json` (two files: silver and clad)');
    expect(section.length).toBeGreaterThan(200);
    for (const n of [
      SILVER_FILE,
      CLAD_FILE,
      'Roosevelt dime mintage figures',
      '2.9',
      '2026',
      'No P',
      'Roosevelt Dimes 1946-2025',
      NEW_ADR_FILE,
    ]) {
      expect(section).toContain(n);
    }
    expect(section).not.toContain('plain P');
    expect(section).not.toContain('provisional');
  });

  it('the nickel section names the 2025 title and that 2026 waits for the source', () => {
    const section = readSection(readme, '## `us-nickels-jefferson-*.json` (two files: copper-nickel and wartime silver)');
    expect(section.length).toBeGreaterThan(200);
    expect(section).toContain('Jefferson Nickels 1938-2025');
    expect(section).toContain('waits for');
    expect(section).toContain('2026');
  });

  it('the modern dollars section links the new ADR and drops the "P" here wording', () => {
    const section = readSection(readme, '## us-dollars-*.json (five files: Presidential through Susan B. Anthony)');
    expect(section.length).toBeGreaterThan(200);
    expect(section).toContain(NEW_ADR_FILE);
    expect(section).not.toContain('`"P"` here');
  });

  it('the Morgan and Peace section keeps null and 2.9', () => {
    const section = readSection(
      readme,
      '## `us-dollars-morgan.json` / `us-dollars-peace.json` (Morgan and Peace silver dollars)',
    );
    expect(section).toContain('null');
    expect(section).toContain('2.9');
  });

  it('has neither old title anywhere', () => {
    expect(readme).not.toContain('1946-2026');
    expect(readme).not.toContain('1938-2026');
  });
});

describe('fixture rules-notes (criteria 7, 10)', () => {
  it('the silver dime note states the rule and cites the ADR', () => {
    const note = loadFixture(SILVER_FILE)['rules-note'] ?? '';
    for (const n of ['parentheses', 'null', '2.9', NEW_ADR_SLUG]) expect(note).toContain(n);
    expect(note).not.toContain('plain P');
    expect(note).not.toContain('provisional');
  });

  it('the Eisenhower note and schema note drop the old "never null" and "P here" wording', () => {
    const f = readJson<Record<string, unknown>>(path.join(FIXTURES_DIR, EISENHOWER_FILE));
    const note = String(f['rules-note']);
    expect(note).toContain('null');
    expect(note).toContain(NEW_ADR_SLUG);
    for (const key of ['rules-note', '$schema-note']) {
      expect(String(f[key])).not.toContain('never null');
      expect(String(f[key])).not.toContain('"P" here');
    }
  });

  it('the clad dime note names the 1982 No P dime', () => {
    const note = loadFixture(CLAD_FILE)['rules-note'] ?? '';
    expect(note).toContain('No P');
    expect(note).toContain('1982');
  });
});

describe('backlog (criteria 11, 12, 13)', () => {
  const lines = readText(path.join(REPO_ROOT, 'docs/backlog_growth.md')).split('\n');

  it('line 2.2 uses the 2025 nickel title and still points to 2.9', () => {
    const line = lines.find((l) => l.startsWith('- [x] 2.2 ')) ?? '';
    expect(line).toContain('Jefferson Nickels 1938-2025');
    expect(line).toContain('2.9');
    expect(line).not.toContain('1938-2026');
  });

  it('line 2.3 uses the 2025 dime title, mentions No P and still points to 2.9', () => {
    const line = lines.find((l) => l.startsWith('- [x] 2.3 ')) ?? '';
    expect(line).toContain('Roosevelt Dimes 1946-2025');
    expect(line).toContain('No P');
    expect(line).toContain('2.9');
    expect(line).not.toContain('1946-2026');
    expect(line).not.toContain('plain P');
  });

  it('2.9 stays unticked', () => {
    expect(lines.some((l) => l.startsWith('- [ ] 2.9 '))).toBe(true);
  });
});

describe('history paragraph (criterion 14)', () => {
  const history = readText(path.join(REPO_ROOT, 'docs/history.md'));
  const HEADER =
    '**Catalog data fixes before the production import (2026-11-26), backlog_growth.md 2.2, 2.3, 2.9, 2.10:**';
  const para = history.split('\n').find((l) => l.includes(HEADER)) ?? '';

  it('exists as one line', () => {
    expect(para).not.toBe('');
  });

  it('warns about old-key rows on the Neon dev branch and keeps production out of it', () => {
    for (const n of [
      'Neon',
      'dev branch',
      'old keys',
      'Roosevelt Dimes 1946-2026',
      'Jefferson Nickels 1938-2026',
      'seed:canonical',
      'by name',
      'manual',
      'production',
      'unaffected',
      '2.9',
    ]) {
      expect(para).toContain(n);
    }
  });

  it('keeps the two earlier paragraphs', () => {
    expect(history).toContain(
      '**Jefferson nickels, Roosevelt dimes and Washington quarters 1932-1998 (2026-11-25), backlog_growth.md 2.2-2.4:**',
    );
    expect(history).toContain('**Morgan and Peace dollars (2026-11-25), backlog_growth.md 2.6:**');
  });
});
