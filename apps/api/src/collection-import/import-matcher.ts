import type {
  ImportCoinSummary,
  ImportColumnMapping,
  ImportField,
  ImportPreviewRow,
  ImportPreviewSummary,
  ImportReasonCode,
} from '@coin-collector/shared';
import {
  COUNTRY_ALIASES,
  DENOMINATION_IGNORED_WORDS,
  DENOMINATION_NUMBER_WORDS,
  DENOMINATION_UNIT_ALIASES,
  MINT_MARK_NAMES,
  MINT_MARK_NONE_PLACEHOLDERS,
  VARIETY_ALIASES,
  VARIETY_NONE_PLACEHOLDERS,
} from './import-aliases';
import type { ParsedCsvRow } from './csv-parser';

// Pure normalisation and matching of parsed CSV rows against a catalog snapshot. No I/O: the
// caller loads the catalog and the user's owned coin ids and passes them in.

export interface CatalogSnapshotCoin {
  id: string;
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
  name: string;
}

export interface MatchRowsInput {
  rows: ParsedCsvRow[];
  mapping: ImportColumnMapping;
  catalog: CatalogSnapshotCoin[];
  ownedCoinIds: ReadonlySet<string>;
}

// ---------------------------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------------------------

export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[.'’]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(normalized: string): string[] {
  return normalized === '' ? [] : normalized.split(' ');
}

const COUNTRY_ALIAS_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(COUNTRY_ALIASES).flatMap(([target, spellings]) =>
    spellings.map((spelling) => [normalizeText(spelling), target] as const),
  ),
);

const UNIT_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(DENOMINATION_UNIT_ALIASES).flatMap(([unit, words]) =>
    words.map((word) => [normalizeText(word), unit] as const),
  ),
);

// Longest phrases first, so "twenty five" is tried before any single word.
const NUMBER_WORDS: ReadonlyArray<{ words: string[]; amount: number }> = Object.entries(
  DENOMINATION_NUMBER_WORDS,
)
  .map(([phrase, amount]) => ({ words: tokens(normalizeText(phrase)), amount }))
  .sort((a, b) => b.words.length - a.words.length);

const IGNORED_WORDS: ReadonlySet<string> = new Set(DENOMINATION_IGNORED_WORDS.map(normalizeText));

const MINT_NONE: ReadonlySet<string> = new Set(MINT_MARK_NONE_PLACEHOLDERS.map(normalizeText));

const MINT_NAMES: ReadonlyMap<string, string> = new Map(
  Object.entries(MINT_MARK_NAMES).map(([name, mark]) => [normalizeText(name), mark] as const),
);

const VARIETY_NONE: ReadonlySet<string> = new Set([
  '',
  ...VARIETY_NONE_PLACEHOLDERS.map(normalizeText),
]);

const VARIETY_ALIAS_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(VARIETY_ALIASES).map(
    ([spelling, target]) => [normalizeText(spelling), normalizeText(target)] as const,
  ),
);

function resolveCountry(raw: string, catalogCountries: readonly string[]): string | null {
  const normalized = normalizeText(raw);
  if (normalized === '') return null;
  const direct = catalogCountries.find((country) => normalizeText(country) === normalized);
  if (direct !== undefined) return direct;
  const target = COUNTRY_ALIAS_MAP.get(normalized);
  if (target === undefined) return null;
  const lowerTarget = target.toLowerCase();
  return catalogCountries.find((country) => country.toLowerCase() === lowerTarget) ?? null;
}

export function normalizeCountry(raw: string, catalogCountries: readonly string[]): string | null {
  return resolveCountry(raw, catalogCountries);
}

export function normalizeMintMark(raw: string): string | null {
  const normalized = normalizeText(raw);
  if (MINT_NONE.has(normalized)) return '';
  const named = MINT_NAMES.get(normalized);
  if (named !== undefined) return named;
  if (/^[a-z]{1,2}$/.test(normalized)) return normalized.toUpperCase();
  return null;
}

const YEAR_PATTERN = /(?<!\d)\d{4}(?!\d)/;
const MINT_AFTER_YEAR = /^\s*[-–/]?\s*(CC|P|D|S|W|O)\b/i;
const EDGE_SEPARATORS = /^[\s\-–/,;:]+|[\s\-–/,;:]+$/g;

function cleanRest(text: string): string {
  return text.replace(/\s+/g, ' ').replace(EDGE_SEPARATORS, '').trim();
}

export function parseCombinedCoin(raw: string): {
  year: number | null;
  mintMark: string | null;
  rest: string;
} {
  const match = YEAR_PATTERN.exec(raw);
  if (match === null) {
    return { year: null, mintMark: null, rest: cleanRest(raw) };
  }
  const before = raw.slice(0, match.index);
  let after = raw.slice(match.index + match[0].length);
  let mintMark: string | null = null;
  const mint = MINT_AFTER_YEAR.exec(after);
  if (mint !== null) {
    mintMark = mint[1].toUpperCase();
    after = after.slice(mint[0].length);
  }
  return { year: Number(match[0]), mintMark, rest: cleanRest(`${before} ${after}`) };
}

interface ParsedDenomination {
  amount: number | null;
  unit: string;
}

function parseDenomination(raw: string): ParsedDenomination | null {
  const words = tokens(normalizeText(raw.replace(/¢/g, ' cent')));
  let amount: number | null = null;

  if (words.length > 0 && /^\d+$/.test(words[0])) {
    amount = Number(words[0]);
    words.shift();
  } else if (words.length > 0 && /^\d+\D+$/.test(words[0])) {
    const split = /^(\d+)(\D+)$/.exec(words[0]);
    if (split !== null) {
      amount = Number(split[1]);
      words[0] = split[2];
    }
  } else {
    for (const numberWord of NUMBER_WORDS) {
      if (numberWord.words.every((word, i) => words[i] === word)) {
        amount = numberWord.amount;
        words.splice(0, numberWord.words.length);
        break;
      }
    }
  }

  const remaining = words.filter((word) => !IGNORED_WORDS.has(word));
  if (remaining.length === 0) return null;
  const unit = UNIT_MAP.get(remaining.join(' '));
  if (unit === undefined) return null;
  return { amount, unit };
}

export function denominationMatches(raw: string, catalogDenomination: string): boolean {
  const user = normalizeText(raw);
  if (user !== '' && user === normalizeText(catalogDenomination)) return true;
  const parsedUser = parseDenomination(raw);
  const parsedCatalog = parseDenomination(catalogDenomination);
  if (parsedUser === null || parsedCatalog === null) return false;
  if (parsedUser.unit !== parsedCatalog.unit) return false;
  if (parsedUser.amount === null) return true;
  return parsedUser.amount === (parsedCatalog.amount ?? 1);
}

function varietyMatches(user: string, catalog: string): boolean {
  const u = normalizeText(user);
  const c = normalizeText(catalog);
  if (u === c) return true;
  if (VARIETY_ALIAS_MAP.get(u) === c) return true;
  if (c === '') return false;
  const userTokens = tokens(u);
  const catalogTokens = tokens(c);
  if (catalogTokens.every((t) => userTokens.includes(t))) return true;
  return (
    userTokens.length > 0 &&
    userTokens.every((t) => catalogTokens.includes(t)) &&
    userTokens.some((t) => t.length >= 3)
  );
}

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareCoins(a: CatalogSnapshotCoin, b: CatalogSnapshotCoin): number {
  return (
    compareText(a.denomination, b.denomination) ||
    compareText(a.mintMark, b.mintMark) ||
    compareText(a.variety, b.variety) ||
    compareText(a.id, b.id)
  );
}

function summarize(
  coin: CatalogSnapshotCoin,
  ownedCoinIds: ReadonlySet<string>,
): ImportCoinSummary {
  return {
    id: coin.id,
    country: coin.country,
    denomination: coin.denomination,
    year: coin.year,
    mintMark: coin.mintMark,
    variety: coin.variety,
    name: coin.name,
    owned: ownedCoinIds.has(coin.id),
  };
}

type Outcome =
  | { status: 'matched'; coin: CatalogSnapshotCoin }
  | { status: 'ambiguous'; reason: ImportReasonCode; candidates: CatalogSnapshotCoin[] }
  | { status: 'unmatched' | 'invalid'; reason: ImportReasonCode };

interface CatalogIndex {
  countries: string[];
  byCountry: Map<string, CatalogSnapshotCoin[]>;
  denominationsByCountry: Map<string, string[]>;
}

function indexCatalog(catalog: readonly CatalogSnapshotCoin[]): CatalogIndex {
  const byCountry = new Map<string, CatalogSnapshotCoin[]>();
  const denominationsByCountry = new Map<string, string[]>();
  for (const coin of catalog) {
    const coins = byCountry.get(coin.country);
    if (coins === undefined) {
      byCountry.set(coin.country, [coin]);
      denominationsByCountry.set(coin.country, [coin.denomination]);
    } else {
      coins.push(coin);
      const denominations = denominationsByCountry.get(coin.country) ?? [];
      if (!denominations.includes(coin.denomination)) denominations.push(coin.denomination);
    }
  }
  return { countries: [...byCountry.keys()], byCountry, denominationsByCountry };
}

function chooseVariety(pool: CatalogSnapshotCoin[], explicit: string, leftover: string): Outcome {
  if (!VARIETY_NONE.has(normalizeText(explicit))) {
    const hits = pool.filter((coin) => varietyMatches(explicit, coin.variety));
    if (hits.length === 1) return { status: 'matched', coin: hits[0] };
    if (hits.length > 1)
      return { status: 'ambiguous', reason: 'multiple_matches', candidates: hits };
    return { status: 'ambiguous', reason: 'variety_not_recognised', candidates: pool };
  }

  if (normalizeText(leftover) !== '') {
    const hits = pool.filter(
      (coin) => coin.variety !== '' && varietyMatches(leftover, coin.variety),
    );
    if (hits.length === 1) return { status: 'matched', coin: hits[0] };
    if (hits.length > 1)
      return { status: 'ambiguous', reason: 'multiple_matches', candidates: hits };
  }

  if (pool.length === 1) return { status: 'matched', coin: pool[0] };
  const plain = pool.filter((coin) => coin.variety === '');
  if (plain.length === 1) return { status: 'matched', coin: plain[0] };
  return { status: 'ambiguous', reason: 'multiple_matches', candidates: pool };
}

function matchRow(
  values: readonly string[],
  mapping: ImportColumnMapping,
  index: CatalogIndex,
): Outcome {
  const cell = (field: ImportField): string => {
    const column = mapping[field];
    if (column === undefined) return '';
    return (values[column] ?? '').trim();
  };

  // 1. Year, possibly from a combined value like "1909-S VDB".
  let year: number;
  let combined: ReturnType<typeof parseCombinedCoin> | null = null;
  const yearCell = cell('year');
  const combinedCell = cell('combined');
  if (/^\d{4}$/.test(yearCell)) {
    year = Number(yearCell);
  } else if (yearCell !== '' || (mapping.combined !== undefined && combinedCell !== '')) {
    combined = parseCombinedCoin(yearCell !== '' ? yearCell : combinedCell);
    if (combined.year === null) return { status: 'invalid', reason: 'year_invalid' };
    year = combined.year;
  } else {
    return { status: 'invalid', reason: 'year_missing' };
  }

  // 2. Required fields.
  const countryCell = cell('country');
  if (countryCell === '') return { status: 'invalid', reason: 'country_missing' };
  const denominationCell = cell('denomination');
  if (denominationCell === '') return { status: 'invalid', reason: 'denomination_missing' };

  // 3. Country.
  const country = resolveCountry(countryCell, index.countries);
  if (country === null) return { status: 'unmatched', reason: 'country_not_recognised' };

  // 4. Denomination(s) of that country.
  const denominations = (index.denominationsByCountry.get(country) ?? []).filter((denomination) =>
    denominationMatches(denominationCell, denomination),
  );
  if (denominations.length === 0)
    return { status: 'unmatched', reason: 'denomination_not_recognised' };

  // 5. Mint mark: undefined means "unknown" (no filter).
  let mint: string | undefined;
  if (mapping.mintMark !== undefined) {
    const mintCell = cell('mintMark');
    if (mintCell !== '') {
      const normalized = normalizeMintMark(mintCell);
      if (normalized === null) return { status: 'unmatched', reason: 'mint_mark_not_recognised' };
      mint = normalized;
    } else {
      mint = combined?.mintMark ?? '';
    }
  } else if (combined !== null) {
    mint = combined.mintMark ?? '';
  }

  // 6. Candidate pool.
  const pool = (index.byCountry.get(country) ?? []).filter(
    (coin) => coin.year === year && denominations.includes(coin.denomination),
  );
  if (pool.length === 0) return { status: 'unmatched', reason: 'no_such_coin' };
  let mintPool = pool;
  if (mint !== undefined) {
    const wanted = mint === 'P' && !pool.some((coin) => coin.mintMark === 'P') ? '' : mint;
    mintPool = pool.filter((coin) => coin.mintMark === wanted);
    if (mintPool.length === 0) return { status: 'unmatched', reason: 'no_such_coin' };
  }

  // 7. Variety.
  return chooseVariety(mintPool, cell('variety'), combined?.rest ?? '');
}

export function matchRows(input: MatchRowsInput): ImportPreviewRow[] {
  const index = indexCatalog(input.catalog);
  const firstLineByCoin = new Map<string, number>();

  return input.rows.map((row): ImportPreviewRow => {
    const outcome = matchRow(row.values, input.mapping, index);
    const values = [...row.values];

    if (outcome.status === 'matched') {
      const coin = summarize(outcome.coin, input.ownedCoinIds);
      const firstLine = firstLineByCoin.get(coin.id);
      if (firstLine === undefined) firstLineByCoin.set(coin.id, row.line);
      return {
        line: row.line,
        values,
        status: 'matched',
        reason: null,
        coin,
        candidates: [],
        alreadyOwned: coin.owned,
        duplicateOfLine: firstLine ?? null,
      };
    }

    const candidates =
      outcome.status === 'ambiguous'
        ? [...outcome.candidates]
            .sort(compareCoins)
            .map((coin) => summarize(coin, input.ownedCoinIds))
        : [];
    return {
      line: row.line,
      values,
      status: outcome.status,
      reason: outcome.reason,
      coin: null,
      candidates,
      alreadyOwned: false,
      duplicateOfLine: null,
    };
  });
}

export function summarizeRows(rows: ImportPreviewRow[]): ImportPreviewSummary {
  const summary: ImportPreviewSummary = {
    total: rows.length,
    matched: 0,
    alreadyOwned: 0,
    duplicateInFile: 0,
    ambiguous: 0,
    unmatched: 0,
    invalid: 0,
    toImport: 0,
  };
  for (const row of rows) {
    if (row.status === 'matched') {
      summary.matched += 1;
      if (row.duplicateOfLine !== null) {
        summary.duplicateInFile += 1;
      } else if (row.alreadyOwned) {
        summary.alreadyOwned += 1;
      } else {
        summary.toImport += 1;
      }
    } else {
      summary[row.status] += 1;
    }
  }
  return summary;
}
