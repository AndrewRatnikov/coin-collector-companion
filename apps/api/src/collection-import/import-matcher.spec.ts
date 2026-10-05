/**
 * Tests for: import-matcher (normalizeText, normalizeCountry, normalizeMintMark, parseCombinedCoin,
 *            denominationMatches, matchRows, summarizeRows)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Module: import-matcher.ts),
 *                   § Matching algorithm (binding), § Normalisation rules (binding)
 * Covers criteria: #14, #15, #16, #17, #18, #19, #20, #21, #22 (catalog snapshot only) from prd.md
 *
 * CONTRACT_GAP: none.
 *
 * Pure module: hand-built catalog snapshots, no mocks, no DB, no network. import-aliases is not
 * imported here (plan: behaviour is tested through the matcher).
 */

import type { ImportColumnMapping } from '@coin-collector/shared';
import type { ParsedCsvRow } from './csv-parser';
import {
  type CatalogSnapshotCoin,
  denominationMatches,
  matchRows,
  normalizeCountry,
  normalizeMintMark,
  normalizeText,
  parseCombinedCoin,
  summarizeRows,
} from './import-matcher';

function coin(
  country: string,
  denomination: string,
  year: number,
  mintMark = '',
  variety = '',
): CatalogSnapshotCoin {
  const id = `${country}|${denomination}|${year}|${mintMark}|${variety}`;
  return { id, country, denomination, year, mintMark, variety, name: id };
}

const id =(...args: Parameters<typeof coin>): string => coin(...args).id;

const CATALOG: CatalogSnapshotCoin[] = [
  coin('USA', 'Cent', 1909, '', 'VDB'),
  coin('USA', 'Cent', 1909, '', ''),
  coin('USA', 'Cent', 1909, 'S', 'VDB'),
  coin('USA', 'Cent', 1909, 'S', ''),
  coin('USA', 'Cent', 1922, 'D', ''),
  coin('USA', 'Cent', 1922, '', 'No D'),
  coin('USA', 'Cent', 1943, '', 'Steel'),
  coin('USA', 'Cent', 1950, '', ''),
  coin('USA', 'Cent', 1950, 'D', ''),
  coin('USA', 'Cent', 1950, 'S', ''),
  coin('USA', 'Cent', 1955, '', ''),
  coin('USA', 'Cent', 1955, '', 'Doubled Die'),
  coin('USA', 'Cent', 1955, 'D', ''),
  coin('Ukraine', '10 Hryvnias', 2022, '', 'Defenders of Mariupol'),
  coin('Ukraine', '10 Hryvnias', 2022, '', 'Kyiv Cathedral'),
  coin('Ukraine', '2 Kopiyky', 2008, '', ''),
  coin('Ukraine', '10 Kopiyok', 2010, '', ''),
  coin('Ukraine', '50 Kopiyok', 2010, '', ''),
  coin('Ukraine', '1 Hryvnia', 2006, '', ''),
];

function rowsOf(...cells: string[][]): ParsedCsvRow[] {
  return cells.map((values, i) => ({ line: i + 2, values }));
}

const YCD: ImportColumnMapping = { year: 0, country: 1, denomination: 2 };
const YCDM: ImportColumnMapping = { year: 0, country: 1, denomination: 2, mintMark: 3 };
const YCDMV: ImportColumnMapping = { year: 0, country: 1, denomination: 2, mintMark: 3, variety: 4 };
const COMBINED: ImportColumnMapping = { combined: 0, country: 1, denomination: 2 };

function matchOne(
  mapping: ImportColumnMapping,
  values: string[],
  options: { catalog?: CatalogSnapshotCoin[]; owned?: string[] } = {},
) {
  const [row] = matchRows({
    rows: rowsOf(values),
    mapping,
    catalog: options.catalog ?? CATALOG,
    ownedCoinIds: new Set(options.owned ?? []),
  });
  return row;
}

describe('normalizeText', () => {
  it.each([
    ['U.S.A.', 'usa'],
    ['No-D', 'no d'],
    ['-', ''],
    ['  Hello   World  ', 'hello world'],
    ['Café', 'cafe'],
    ["Don't", 'dont'],
    ['Ratnikov’s', 'ratnikovs'],
    ['N/A', 'n a'],
    ['1c', '1c'],
    ['10 HRYVNIAS', '10 hryvnias'],
    ['V.D.B.', 'vdb'],
    ['', ''],
  ])('normalizeText(%j) === %j', (input, expected) => {
    expect(normalizeText(input)).toBe(expected);
  });
});

describe('normalizeCountry (criterion #15)', () => {
  const catalogCountries = ['USA', 'Ukraine'];

  it.each([
    'USA',
    'usa',
    'US',
    'U.S.',
    'U.S.A.',
    'United States',
    'united states of america',
    'The United States',
    'America',
    'сша',
    'Estados Unidos',
    'EEUU',
    '  usa  ',
  ])('maps %j to USA', (raw) => {
    expect(normalizeCountry(raw, catalogCountries)).toBe('USA');
  });

  it.each(['Ukraine', 'the ukraine', 'Ukraina', 'Ukrayina', 'Україна', 'Украина', 'Ucrania', 'UKRAINE'])(
    'maps %j to Ukraine',
    (raw) => {
      expect(normalizeCountry(raw, catalogCountries)).toBe('Ukraine');
    },
  );

  it('returns null for an unknown country, an empty string and a country not in the catalog', () => {
    expect(normalizeCountry('Canada', catalogCountries)).toBeNull();
    expect(normalizeCountry('', catalogCountries)).toBeNull();
    expect(normalizeCountry('USA', ['Ukraine'])).toBeNull();
    expect(normalizeCountry('Ukraine', ['USA'])).toBeNull();
  });

  it('matches a catalog country directly by normalised text, even without an alias', () => {
    expect(normalizeCountry('  spain ', ['Spain', 'USA'])).toBe('Spain');
    expect(normalizeCountry('S.P.A.I.N', ['Spain'])).toBe('Spain');
  });

  it("returns the catalog's own spelling for an alias target", () => {
    expect(normalizeCountry('america', ['usa'])).toBe('usa');
    expect(normalizeCountry('america', ['United States', 'USA'])).toBe('USA');
  });
});

describe('normalizeMintMark (criterion #17)', () => {
  it.each(['', '-', 'none', 'None', 'No mint mark', 'no mintmark', 'no mint', 'N/A', 'na', 'nil', 'blank', '  '])(
    'maps the placeholder %j to the empty mint mark',
    (raw) => {
      expect(normalizeMintMark(raw)).toBe('');
    },
  );

  it('uppercases one- and two-letter marks', () => {
    expect(normalizeMintMark('d')).toBe('D');
    expect(normalizeMintMark('S')).toBe('S');
    expect(normalizeMintMark(' s ')).toBe('S');
    expect(normalizeMintMark('p')).toBe('P');
    expect(normalizeMintMark('cc')).toBe('CC');
  });

  it.each([
    ['Philadelphia', 'P'],
    ['denver', 'D'],
    ['San Francisco', 'S'],
    ['West Point', 'W'],
    ['New Orleans', 'O'],
    ['Carson City', 'CC'],
  ])('maps the mint name %j to %j', (raw, expected) => {
    expect(normalizeMintMark(raw)).toBe(expected);
  });

  it('returns null for anything else', () => {
    expect(normalizeMintMark('xyzzy')).toBeNull();
    expect(normalizeMintMark('Foo Bar')).toBeNull();
    expect(normalizeMintMark('123')).toBeNull();
    expect(normalizeMintMark('DDS')).toBeNull();
  });
});

describe('parseCombinedCoin (criterion #18)', () => {
  it('splits the documented examples', () => {
    expect(parseCombinedCoin('1909-S VDB')).toEqual({ year: 1909, mintMark: 'S', rest: 'VDB' });
    expect(parseCombinedCoin('1922 No D')).toEqual({ year: 1922, mintMark: null, rest: 'No D' });
    expect(parseCombinedCoin('1955 DDO')).toEqual({ year: 1955, mintMark: null, rest: 'DDO' });
    expect(parseCombinedCoin('VDB')).toEqual({ year: null, mintMark: null, rest: 'VDB' });
  });

  it('accepts a space, slash, or dash between year and mint mark, and none at all', () => {
    expect(parseCombinedCoin('1909 S VDB')).toEqual({ year: 1909, mintMark: 'S', rest: 'VDB' });
    expect(parseCombinedCoin('1909/S')).toEqual({ year: 1909, mintMark: 'S', rest: '' });
    expect(parseCombinedCoin('1909–S')).toEqual({ year: 1909, mintMark: 'S', rest: '' });
    expect(parseCombinedCoin('1909S')).toEqual({ year: 1909, mintMark: 'S', rest: '' });
  });

  it('uppercases the mint mark and supports CC', () => {
    expect(parseCombinedCoin('1914 d')).toEqual({ year: 1914, mintMark: 'D', rest: '' });
    expect(parseCombinedCoin('1893-cc')).toEqual({ year: 1893, mintMark: 'CC', rest: '' });
  });

  it('handles a bare year', () => {
    expect(parseCombinedCoin('1914')).toEqual({ year: 1914, mintMark: null, rest: '' });
  });

  it('does not read a mint mark out of a longer word', () => {
    expect(parseCombinedCoin('1909 Dime')).toEqual({ year: 1909, mintMark: null, rest: 'Dime' });
    expect(parseCombinedCoin('1909 Steel')).toEqual({ year: 1909, mintMark: null, rest: 'Steel' });
  });

  it('returns year null when there is no standalone 4-digit number', () => {
    expect(parseCombinedCoin('12345').year).toBeNull();
    expect(parseCombinedCoin('abc 123').year).toBeNull();
    expect(parseCombinedCoin('').year).toBeNull();
  });

  it('finds the year anywhere and removes it from the rest', () => {
    const parsed = parseCombinedCoin('VDB 1909');
    expect(parsed.year).toBe(1909);
    expect(parsed.rest).toBe('VDB');
  });
});

describe('denominationMatches (criterion #16)', () => {
  it.each(['1 cent', 'one cent', 'penny', 'Wheat penny', '1c', '1¢', 'Cent', 'CENT', ' cent ', 'Lincoln cent', '1 Cent.'])(
    'matches %j to Cent',
    (raw) => {
      expect(denominationMatches(raw, 'Cent')).toBe(true);
    },
  );

  it.each(['10 cents', '5 cents', 'dime', 'nickel', '', 'hryvnia', '10 hryvnias'])(
    'does not match %j to Cent',
    (raw) => {
      expect(denominationMatches(raw, 'Cent')).toBe(false);
    },
  );

  it.each(['10 hryvnias', '10 Hryvnias', '10 гривень', '10 грн', 'ten hryvnias', '10 UAH'])(
    'matches %j to 10 Hryvnias',
    (raw) => {
      expect(denominationMatches(raw, '10 Hryvnias')).toBe(true);
    },
  );

  it('requires equal amounts when the user supplies one', () => {
    expect(denominationMatches('5 hryvnias', '10 Hryvnias')).toBe(false);
    expect(denominationMatches('10 hryvnias', '5 Hryvnias')).toBe(false);
    expect(denominationMatches('2 hryvni', '2 Hryvni')).toBe(true);
  });

  it('matches any catalog amount when the user gives only the unit', () => {
    expect(denominationMatches('hryvnia', '1 Hryvnia')).toBe(true);
    expect(denominationMatches('hryvnias', '10 Hryvnias')).toBe(true);
    expect(denominationMatches('kopecks', '2 Kopiyky')).toBe(true);
    expect(denominationMatches('kopecks', '5 Kopiyok')).toBe(true);
    expect(denominationMatches('kopecks', '50 Kopiyok')).toBe(true);
  });

  it('keeps kopiyka and hryvnia apart', () => {
    expect(denominationMatches('kopecks', '10 Hryvnias')).toBe(false);
    expect(denominationMatches('hryvnia', '10 Kopiyok')).toBe(false);
  });

  it('matches kopiyka amounts and spellings', () => {
    expect(denominationMatches('2 kopecks', '2 Kopiyky')).toBe(true);
    expect(denominationMatches('2 kopecks', '5 Kopiyok')).toBe(false);
    expect(denominationMatches('2 копійки', '2 Kopiyky')).toBe(true);
    expect(denominationMatches('25 копеек', '25 Kopiyok')).toBe(true);
    expect(denominationMatches('twenty five kopiyok', '25 Kopiyok')).toBe(true);
    expect(denominationMatches('10k', '10 Kopiyok')).toBe(true);
    expect(denominationMatches('10k', '50 Kopiyok')).toBe(false);
  });

  it('matches when the normalised text is identical, even for unknown words', () => {
    expect(denominationMatches('Gold Sovereign', 'gold  sovereign')).toBe(true);
    expect(denominationMatches('Gold Sovereign', 'Silver Sovereign')).toBe(false);
  });
});

describe('matchRows: contract examples (criteria #18, #20)', () => {
  it('resolves "1909-S VDB" in a combined column to the 1909 S VDB cent', () => {
    const row = matchOne(COMBINED, ['1909-S VDB', 'United States', 'Wheat penny']);
    expect(row.status).toBe('matched');
    expect(row.reason).toBeNull();
    expect(row.coin).toEqual({
      id: id('USA', 'Cent', 1909, 'S', 'VDB'),
      country: 'USA',
      denomination: 'Cent',
      year: 1909,
      mintMark: 'S',
      variety: 'VDB',
      name: id('USA', 'Cent', 1909, 'S', 'VDB'),
      owned: false,
    });
    expect(row.candidates).toEqual([]);
    expect(row.alreadyOwned).toBe(false);
    expect(row.duplicateOfLine).toBeNull();
  });

  it('resolves "1909-S VDB" placed in the Year column to the same coin', () => {
    const row = matchOne(YCD, ['1909-S VDB', 'USA', '1 cent']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, 'S', 'VDB'));
  });

  it('matches a different combined value to a different coin', () => {
    const row = matchOne(COMBINED, ['1909 VDB', 'USA', 'Cent']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, '', 'VDB'));
  });

  it('with a blank mint mark column, 1909 resolves to the plain coin (exactly one with variety "")', () => {
    const row = matchOne(YCDM, ['1909', 'USA', 'Cent', '']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, '', ''));
  });

  it('with no mint column and blank variety, 1950 is ambiguous and lists the three coins in order', () => {
    const row = matchOne(YCD, ['1950', 'USA', 'Cent']);
    expect(row.status).toBe('ambiguous');
    expect(row.reason).toBe('multiple_matches');
    expect(row.coin).toBeNull();
    expect(row.alreadyOwned).toBe(false);
    expect(row.duplicateOfLine).toBeNull();
    expect(row.candidates.map((c) => c.id)).toEqual([
      id('USA', 'Cent', 1950, '', ''),
      id('USA', 'Cent', 1950, 'D', ''),
      id('USA', 'Cent', 1950, 'S', ''),
    ]);
  });

  it('1943 with mint "P" matches the single steel cent (P -> "")', () => {
    const row = matchOne(YCDM, ['1943', 'USA', 'Cent', 'P']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1943, '', 'Steel'));
  });

  it('2022 Ukraine 10 Hryvnias with no variety is ambiguous when none is plain', () => {
    const row = matchOne(YCD, ['2022', 'Ukraine', '10 Hryvnias']);
    expect(row.status).toBe('ambiguous');
    expect(row.reason).toBe('multiple_matches');
    expect(row.candidates.map((c) => c.variety)).toEqual(['Defenders of Mariupol', 'Kyiv Cathedral']);
  });
});

describe('matchRows: reason codes (criterion #19)', () => {
  it.each([
    ['year_missing', ['', 'USA', 'Cent']],
    ['year_invalid', ['abcd', 'USA', 'Cent']],
    ['year_invalid', ['950', 'USA', 'Cent']],
    ['year_invalid', ['19999', 'USA', 'Cent']],
    ['country_missing', ['1950', '', 'Cent']],
    ['denomination_missing', ['1950', 'USA', '']],
  ])('invalid rows get reason %s (%j)', (reason, values) => {
    const row = matchOne(YCD, values);
    expect(row.status).toBe('invalid');
    expect(row.reason).toBe(reason);
    expect(row.coin).toBeNull();
    expect(row.candidates).toEqual([]);
    expect(row.alreadyOwned).toBe(false);
    expect(row.duplicateOfLine).toBeNull();
  });

  it('checks year before country before denomination', () => {
    expect(matchOne(YCD, ['', '', '']).reason).toBe('year_missing');
    expect(matchOne(YCD, ['1950', '', '']).reason).toBe('country_missing');
  });

  it('treats a short row as having blank trailing fields', () => {
    expect(matchOne(YCD, ['1950']).reason).toBe('country_missing');
    expect(matchOne(YCD, ['1950', 'USA']).reason).toBe('denomination_missing');
    expect(matchOne(YCD, []).reason).toBe('year_missing');
  });

  it('treats an unmapped required field as blank', () => {
    expect(matchOne({ country: 0, denomination: 1 }, ['USA', 'Cent']).reason).toBe('year_missing');
    expect(matchOne({ year: 0, denomination: 1 }, ['1950', 'Cent']).reason).toBe('country_missing');
    expect(matchOne({ year: 0, country: 1 }, ['1950', 'USA']).reason).toBe('denomination_missing');
    expect(matchOne({}, ['1950', 'USA', 'Cent']).reason).toBe('year_missing');
  });

  it('reports year_invalid for a combined column without a year', () => {
    const row = matchOne(COMBINED, ['VDB', 'USA', 'Cent']);
    expect(row.status).toBe('invalid');
    expect(row.reason).toBe('year_invalid');
  });

  it('reports year_missing for an empty combined column', () => {
    const row = matchOne(COMBINED, ['', 'USA', 'Cent']);
    expect(row.status).toBe('invalid');
    expect(row.reason).toBe('year_missing');
  });

  it.each([
    ['country_not_recognised', ['1950', 'Canada', 'Cent']],
    ['denomination_not_recognised', ['1950', 'USA', 'Dime']],
    ['denomination_not_recognised', ['1950', 'USA', '5 cents']],
    ['denomination_not_recognised', ['1950', 'Ukraine', 'Cent']],
    ['no_such_coin', ['1960', 'USA', 'Cent']],
  ])('unmatched rows get reason %s (%j)', (reason, values) => {
    const row = matchOne(YCD, values);
    expect(row.status).toBe('unmatched');
    expect(row.reason).toBe(reason);
    expect(row.coin).toBeNull();
    expect(row.candidates).toEqual([]);
    expect(row.alreadyOwned).toBe(false);
    expect(row.duplicateOfLine).toBeNull();
  });

  it('reports mint_mark_not_recognised for an unparseable mint mark', () => {
    const row = matchOne(YCDM, ['1950', 'USA', 'Cent', 'Xyzzy']);
    expect(row.status).toBe('unmatched');
    expect(row.reason).toBe('mint_mark_not_recognised');
  });

  it('reports no_such_coin when the year exists but the mint mark does not', () => {
    const row = matchOne(YCDM, ['1909', 'USA', 'Cent', 'D']);
    expect(row.status).toBe('unmatched');
    expect(row.reason).toBe('no_such_coin');
    expect(matchOne(YCDM, ['1909', 'USA', 'Cent', 'Z']).reason).toBe('no_such_coin');
  });

  it('reports variety_not_recognised with the mint-filtered pool as candidates', () => {
    const row = matchOne(YCDMV, ['1909', 'USA', 'Cent', 'S', 'Zebra']);
    expect(row.status).toBe('ambiguous');
    expect(row.reason).toBe('variety_not_recognised');
    expect(row.coin).toBeNull();
    expect(row.candidates.map((c) => c.id)).toEqual([
      id('USA', 'Cent', 1909, 'S', ''),
      id('USA', 'Cent', 1909, 'S', 'VDB'),
    ]);
  });

  it('maps matched rows to reason null and no candidates', () => {
    const row = matchOne(YCDM, ['1950', 'USA', 'Cent', 'D']);
    expect(row.status).toBe('matched');
    expect(row.reason).toBeNull();
    expect(row.candidates).toEqual([]);
  });
});

describe('matchRows: normalisation inside rows (criteria #15, #16, #17)', () => {
  it.each(['USA', 'United States', 'U.S.A.', 'us', 'сша'])('country spelling %j matches', (country) => {
    const row = matchOne(YCDM, ['1950', country, 'Cent', 'D']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, 'D', ''));
  });

  it.each(['Cent', '1 cent', 'one cent', 'penny', 'Wheat penny', '1c'])('denomination spelling %j matches', (denom) => {
    const row = matchOne(YCDM, ['1950', 'USA', denom, 'S']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, 'S', ''));
  });

  it.each(['', '-', 'none', 'No mint mark', 'Philadelphia', 'P'])('mint mark %j resolves to the "" coin', (mint) => {
    const row = matchOne(YCDM, ['1950', 'USA', 'Cent', mint]);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, '', ''));
  });

  it.each([
    ['D', 'D'],
    ['d', 'D'],
    ['s', 'S'],
    ['Denver', 'D'],
    ['San Francisco', 'S'],
  ])('mint mark %j resolves to %s', (mint, expected) => {
    const row = matchOne(YCDM, ['1950', 'USA', 'Cent', mint]);
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, expected, ''));
  });

  it('keeps "P" as P when the candidate pool has a P coin, and maps it to "" otherwise', () => {
    const withP = [coin('USA', 'Cent', 2000, ''), coin('USA', 'Cent', 2000, 'P'), coin('USA', 'Cent', 2000, 'D')];
    const asP = matchOne(YCDM, ['2000', 'USA', 'Cent', 'P'], { catalog: withP });
    expect(asP.status).toBe('matched');
    expect(asP.coin?.id).toBe(id('USA', 'Cent', 2000, 'P', ''));

    const withoutP = matchOne(YCDM, ['1950', 'USA', 'Cent', 'P']);
    expect(withoutP.coin?.id).toBe(id('USA', 'Cent', 1950, '', ''));
  });

  it('matches Ukrainian Cyrillic country and denomination', () => {
    const row = matchOne(YCD, ['2008', 'Україна', '2 копійки']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('Ukraine', '2 Kopiyky', 2008, '', ''));
  });

  it('matches "2 kopecks" to the 2 Kopiyky coin only', () => {
    const row = matchOne(YCD, ['2008', 'Ukraine', '2 kopecks']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('Ukraine', '2 Kopiyky', 2008, '', ''));
  });

  it('lists every kopiyka denomination for a unit-only denomination, sorted by denomination', () => {
    const row = matchOne(YCD, ['2010', 'Ukraine', 'kopecks']);
    expect(row.status).toBe('ambiguous');
    expect(row.reason).toBe('multiple_matches');
    expect(row.candidates.map((c) => c.denomination)).toEqual(['10 Kopiyok', '50 Kopiyok']);
  });

  it('trims cells and tolerates extra columns', () => {
    const row = matchOne(YCDM, ['  1950 ', ' usa ', ' cent ', ' d ', 'ignored', 'also ignored']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, 'D', ''));
  });
});

describe('matchRows: variety and combined parsing (criterion #18)', () => {
  it.each([
    ['VDB', 'VDB'],
    ['vdb', 'VDB'],
    ['V.D.B.', 'VDB'],
    ['v d b', 'VDB'],
  ])('explicit variety %j selects the VDB coin', (variety) => {
    const row = matchOne(YCDMV, ['1909', 'USA', 'Cent', 'S', variety]);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, 'S', 'VDB'));
  });

  it.each(['Doubled Die', 'doubled die', 'DDO', 'double die', 'Doubled Die Obverse'])(
    'explicit variety %j selects the 1955 doubled die',
    (variety) => {
      const row = matchOne(YCDMV, ['1955', 'USA', 'Cent', '', variety]);
      expect(row.status).toBe('matched');
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1955, '', 'Doubled Die'));
    },
  );

  it.each(['Steel', 'steel', 'zinc', 'Steel cent'])('explicit variety %j selects the steel cent', (variety) => {
    const row = matchOne(YCDMV, ['1943', 'USA', 'Cent', '', variety]);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1943, '', 'Steel'));
  });

  it('matches "No D" with whitespace and punctuation tolerated', () => {
    for (const variety of ['No D', 'no d', 'No-D', 'NO  D']) {
      const row = matchOne(YCDMV, ['1922', 'USA', 'Cent', '', variety]);
      expect(row.status).toBe('matched');
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1922, '', 'No D'));
    }
  });

  it.each(['none', 'Normal', 'regular', 'plain', 'Standard', 'n/a', 'na', 'no variety', '-', ''])(
    'variety placeholder %j is treated as blank (plain coin chosen)',
    (variety) => {
      const row = matchOne(YCDMV, ['1909', 'USA', 'Cent', 'S', variety]);
      expect(row.status).toBe('matched');
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, 'S', ''));
    },
  );

  it('chooses the plain coin for a blank variety when exactly one pool coin has variety ""', () => {
    expect(matchOne(YCDMV, ['1955', 'USA', 'Cent', '', '']).coin?.id).toBe(id('USA', 'Cent', 1955, '', ''));
    // different input, different output
    expect(matchOne(YCDMV, ['1955', 'USA', 'Cent', 'D', '']).coin?.id).toBe(id('USA', 'Cent', 1955, 'D', ''));
  });

  it('matches a single-coin pool even when the variety is not plain and not given', () => {
    const row = matchOne(YCD, ['1943', 'USA', 'Cent']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1943, '', 'Steel'));
  });

  it('without a mint column and a pool with exactly one plain coin, picks that plain coin', () => {
    const row = matchOne(YCD, ['1922', 'USA', 'Cent']);
    expect(row.status).toBe('matched');
    expect(row.coin?.id).toBe(id('USA', 'Cent', 1922, 'D', ''));
  });

  describe('combined column', () => {
    it('year with mint mark only picks the plain coin', () => {
      const row = matchOne(COMBINED, ['1909-S', 'USA', 'Cent']);
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, 'S', ''));
    });

    it('bare year means mint mark "" and plain coin', () => {
      const row = matchOne(COMBINED, ['1909', 'USA', 'Cent']);
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, '', ''));
    });

    it('uses the leftover text as the variety when it hits a catalog variety', () => {
      expect(matchOne(COMBINED, ['1922 No D', 'USA', 'Cent']).coin?.id).toBe(id('USA', 'Cent', 1922, '', 'No D'));
      expect(matchOne(COMBINED, ['1955 DDO', 'USA', 'Cent']).coin?.id).toBe(
        id('USA', 'Cent', 1955, '', 'Doubled Die'),
      );
      const steelCatalog = [coin('USA', 'Cent', 1943, 'D', 'Steel'), coin('USA', 'Cent', 1943, '', 'Steel')];
      expect(matchOne(COMBINED, ['1943-D Steel', 'USA', 'Cent'], { catalog: steelCatalog }).coin?.id).toBe(
        id('USA', 'Cent', 1943, 'D', 'Steel'),
      );
    });

    it('falls through to the plain coin when the leftover text hits no variety', () => {
      const row = matchOne(COMBINED, ['1909-S Lincoln', 'USA', 'Cent']);
      expect(row.status).toBe('matched');
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1909, 'S', ''));
    });

    it('uses the letter from the combined value when the mint mark column is blank', () => {
      const mapping: ImportColumnMapping = { combined: 0, country: 1, denomination: 2, mintMark: 3 };
      const row = matchOne(mapping, ['1950-D', 'USA', 'Cent', '']);
      expect(row.status).toBe('matched');
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, 'D', ''));
    });

    it('prefers the explicit mint mark column when it is not blank', () => {
      const mapping: ImportColumnMapping = { combined: 0, country: 1, denomination: 2, mintMark: 3 };
      const row = matchOne(mapping, ['1950', 'USA', 'Cent', 'S']);
      expect(row.coin?.id).toBe(id('USA', 'Cent', 1950, 'S', ''));
    });

    it('prefers the Year column when it holds a bare year, ignoring the combined column', () => {
      const mapping: ImportColumnMapping = { year: 0, combined: 1, country: 2, denomination: 3 };
      const row = matchOne(mapping, ['1950', '1909-S VDB', 'USA', 'Cent']);
      // year 1950 from the Year column, no mint column and no combined parsing: ambiguous 1950 pool,
      // but exactly one coin per mint with variety '' -> three coins -> ambiguous
      expect(row.status).toBe('ambiguous');
      expect(row.candidates.every((c) => c.year === 1950)).toBe(true);
    });
  });

  it('is ambiguous when the leftover text hits several catalog varieties, listing only the hits', () => {
    const catalog = [
      coin('USA', 'Cent', 1960, '', 'Small Date'),
      coin('USA', 'Cent', 1960, '', 'Small Date Doubled'),
      coin('USA', 'Cent', 1960, '', 'Large Date'),
    ];
    const row = matchOne(COMBINED, ['1960 Small Date', 'USA', 'Cent'], { catalog });
    expect(row.status).toBe('ambiguous');
    expect(row.reason).toBe('multiple_matches');
    expect(row.candidates.map((c) => c.variety)).toEqual(['Small Date', 'Small Date Doubled']);
  });

  it('is matched when the leftover text hits exactly one catalog variety', () => {
    const catalog = [coin('USA', 'Cent', 1960, '', 'Small Date'), coin('USA', 'Cent', 1960, '', 'Large Date')];
    const row = matchOne(COMBINED, ['1960 Large Date', 'USA', 'Cent'], { catalog });
    expect(row.status).toBe('matched');
    expect(row.coin?.variety).toBe('Large Date');
  });
});

describe('matchRows: duplicates and ownership (criteria #5, #21)', () => {
  it('flags later rows for the same coin with duplicateOfLine of the first row', () => {
    const rows = matchRows({
      rows: rowsOf(
        ['1950', 'USA', 'Cent', 'D'],
        ['1950', 'USA', 'Cent', 'S'],
        ['1950', 'United States', 'penny', 'd'],
        ['1950', 'USA', 'Cent', 'D'],
      ),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set(),
    });
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
    expect(rows.map((r) => r.status)).toEqual(['matched', 'matched', 'matched', 'matched']);
    expect(rows.map((r) => r.duplicateOfLine)).toEqual([null, null, 2, 2]);
  });

  it('does not flag different coins as duplicates', () => {
    const rows = matchRows({
      rows: rowsOf(['1950', 'USA', 'Cent', 'D'], ['1950', 'USA', 'Cent', 'S']),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set(),
    });
    expect(rows.map((r) => r.duplicateOfLine)).toEqual([null, null]);
  });

  it('never sets duplicateOfLine on non-matched rows', () => {
    const rows = matchRows({
      rows: rowsOf(['1950', 'USA', 'Cent', 'D'], ['1960', 'USA', 'Cent', 'D'], ['', 'USA', 'Cent', 'D']),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set(),
    });
    expect(rows.map((r) => r.duplicateOfLine)).toEqual([null, null, null]);
  });

  it('marks matched rows for owned coins as alreadyOwned with coin.owned true', () => {
    const owned = id('USA', 'Cent', 1950, 'D', '');
    const rows = matchRows({
      rows: rowsOf(['1950', 'USA', 'Cent', 'D'], ['1950', 'USA', 'Cent', 'S']),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set([owned]),
    });
    expect(rows[0].alreadyOwned).toBe(true);
    expect(rows[0].coin?.owned).toBe(true);
    expect(rows[1].alreadyOwned).toBe(false);
    expect(rows[1].coin?.owned).toBe(false);
  });

  it('sets owned on ambiguous candidates according to ownedCoinIds', () => {
    const owned = id('USA', 'Cent', 1950, 'S', '');
    const row = matchOne(YCD, ['1950', 'USA', 'Cent'], { owned: [owned] });
    expect(row.status).toBe('ambiguous');
    expect(row.alreadyOwned).toBe(false);
    expect(row.candidates.map((c) => [c.mintMark, c.owned])).toEqual([
      ['', false],
      ['D', false],
      ['S', true],
    ]);
  });

  it('returns one result per input row, in order, keeping line and values', () => {
    const input = rowsOf(['1950', 'USA', 'Cent', 'D'], ['x'], ['1909-S VDB', 'USA', 'Cent', '']);
    const rows = matchRows({ rows: input, mapping: YCDM, catalog: CATALOG, ownedCoinIds: new Set() });
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4]);
    expect(rows.map((r) => r.values)).toEqual([['1950', 'USA', 'Cent', 'D'], ['x'], ['1909-S VDB', 'USA', 'Cent', '']]);
  });

  it('returns an empty array for no rows', () => {
    expect(matchRows({ rows: [], mapping: YCD, catalog: CATALOG, ownedCoinIds: new Set() })).toEqual([]);
  });
});

describe('matchRows: purity (criterion #14)', () => {
  it('does not mutate its inputs and is deterministic', () => {
    const input = rowsOf(['1950', 'USA', 'Cent', 'D'], ['1950', 'USA', 'Cent']);
    const catalog = CATALOG.map((c) => ({ ...c }));
    const mapping: ImportColumnMapping = { ...YCDM };
    const owned = new Set([id('USA', 'Cent', 1950, 'D', '')]);
    const snapshot = JSON.stringify({ input, catalog, mapping, owned: [...owned] });

    const first = matchRows({ rows: input, mapping, catalog, ownedCoinIds: owned });
    const second = matchRows({ rows: input, mapping, catalog, ownedCoinIds: owned });

    expect(JSON.stringify({ input, catalog, mapping, owned: [...owned] })).toBe(snapshot);
    expect(second).toEqual(first);
  });

  it('works on frozen inputs', () => {
    const input = rowsOf(['1950', 'USA', 'Cent', 'D']).map((r) => Object.freeze({ ...r, values: Object.freeze([...r.values]) as string[] }));
    const catalog = CATALOG.map((c) => Object.freeze({ ...c }));
    const rows = matchRows({
      rows: input,
      mapping: Object.freeze({ ...YCDM }),
      catalog,
      ownedCoinIds: new Set(),
    });
    expect(rows[0].status).toBe('matched');
  });

  it('only considers the catalog snapshot it is given', () => {
    const onlyCents = CATALOG.filter((c) => c.country === 'USA');
    const row = matchOne(YCD, ['2008', 'Ukraine', '2 kopecks'], { catalog: onlyCents });
    expect(row.status).toBe('unmatched');
    expect(row.reason).toBe('country_not_recognised');
  });
});

describe('summarizeRows', () => {
  it('counts every status, duplicates, already-owned and toImport', () => {
    const owned = id('USA', 'Cent', 1950, 'S', '');
    const rows = matchRows({
      rows: rowsOf(
        ['1950', 'USA', 'Cent', 'D'], // 2 matched, new
        ['1950', 'USA', 'Cent', 'S'], // 3 matched, owned
        ['1950', 'USA', 'Cent', 'd'], // 4 matched, duplicate of 2
        ['1950', 'USA', 'Cent', ''], // 5 matched, new
        ['1955', 'USA', 'Cent', ''], // 6 matched (plain), new
        ['2022', 'Ukraine', '10 Hryvnias', ''], // 7 ambiguous
        ['1960', 'USA', 'Cent', 'D'], // 8 unmatched
        ['', 'USA', 'Cent', 'D'], // 9 invalid
        ['abc', 'USA', 'Cent', 'D'], // 10 invalid
      ),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set([owned]),
    });

    expect(summarizeRows(rows)).toEqual({
      total: 9,
      matched: 5,
      alreadyOwned: 1,
      duplicateInFile: 1,
      ambiguous: 1,
      unmatched: 1,
      invalid: 2,
      toImport: 3,
    });
  });

  it('does not count a duplicate of an owned coin as alreadyOwned or toImport, but as a duplicate', () => {
    const owned = id('USA', 'Cent', 1950, 'D', '');
    const rows = matchRows({
      rows: rowsOf(['1950', 'USA', 'Cent', 'D'], ['1950', 'USA', 'Cent', 'D']),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set([owned]),
    });
    expect(summarizeRows(rows)).toEqual({
      total: 2,
      matched: 2,
      alreadyOwned: 1,
      duplicateInFile: 1,
      ambiguous: 0,
      unmatched: 0,
      invalid: 0,
      toImport: 0,
    });
  });

  it('reports zeros for no rows and toImport equal to matched when nothing is owned or duplicated', () => {
    expect(summarizeRows([])).toEqual({
      total: 0,
      matched: 0,
      alreadyOwned: 0,
      duplicateInFile: 0,
      ambiguous: 0,
      unmatched: 0,
      invalid: 0,
      toImport: 0,
    });
    const rows = matchRows({
      rows: rowsOf(['1950', 'USA', 'Cent', 'D'], ['1950', 'USA', 'Cent', 'S']),
      mapping: YCDM,
      catalog: CATALOG,
      ownedCoinIds: new Set(),
    });
    const summary = summarizeRows(rows);
    expect(summary.matched).toBe(2);
    expect(summary.toImport).toBe(2);
  });
});
