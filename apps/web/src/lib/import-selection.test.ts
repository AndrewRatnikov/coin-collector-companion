/**
 * Tests for: import-selection (effectiveCoin, selectedCoinIds, countToImport, countSkipped,
 *            toImportCoinSummary, formatImportCoinLabel, importErrorKey)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Web: import-selection.ts)
 * Covers criteria: #3, #21, #25, #26, #9 (error keys) (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Pure functions, no mocks.
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin, ImportCoinSummary, ImportPreviewRow } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import {
  countSkipped,
  countToImport,
  effectiveCoin,
  formatImportCoinLabel,
  importErrorKey,
  selectedCoinIds,
  toImportCoinSummary,
  type ImportDecisions,
} from '@/lib/import-selection';

function summary(id: string, overrides: Partial<ImportCoinSummary> = {}): ImportCoinSummary {
  return {
    id,
    country: 'USA',
    denomination: 'Cent',
    year: 1950,
    mintMark: 'D',
    variety: '',
    name: `Coin ${id}`,
    owned: false,
    ...overrides,
  };
}

function matchedRow(line: number, coin: ImportCoinSummary, duplicateOfLine: number | null = null): ImportPreviewRow {
  return {
    line,
    values: ['1950', 'USA', 'Cent'],
    status: 'matched',
    reason: null,
    coin,
    candidates: [],
    alreadyOwned: coin.owned,
    duplicateOfLine,
  };
}

function ambiguousRow(line: number, candidates: ImportCoinSummary[]): ImportPreviewRow {
  return {
    line,
    values: ['1950', 'USA', 'Cent'],
    status: 'ambiguous',
    reason: 'multiple_matches',
    coin: null,
    candidates,
    alreadyOwned: false,
    duplicateOfLine: null,
  };
}

function unmatchedRow(line: number): ImportPreviewRow {
  return {
    line,
    values: ['1960', 'USA', 'Cent'],
    status: 'unmatched',
    reason: 'no_such_coin',
    coin: null,
    candidates: [],
    alreadyOwned: false,
    duplicateOfLine: null,
  };
}

function invalidRow(line: number): ImportPreviewRow {
  return {
    line,
    values: ['', 'USA', 'Cent'],
    status: 'invalid',
    reason: 'year_missing',
    coin: null,
    candidates: [],
    alreadyOwned: false,
    duplicateOfLine: null,
  };
}

const A = summary('coin-a');
const B = summary('coin-b', { year: 1951, mintMark: 'S' });
const OWNED = summary('coin-owned', { year: 1952, mintMark: '', owned: true });

describe('effectiveCoin', () => {
  it('returns the matched coin for an auto decision and when the decision is missing', () => {
    const row = matchedRow(2, A);
    expect(effectiveCoin(row)).toBe(A);
    expect(effectiveCoin(row, { kind: 'auto' })).toBe(A);
    expect(effectiveCoin(matchedRow(3, B), { kind: 'auto' })).toBe(B);
  });

  it('returns null for unmatched, invalid and unresolved ambiguous rows on auto', () => {
    expect(effectiveCoin(unmatchedRow(2))).toBeNull();
    expect(effectiveCoin(invalidRow(2), { kind: 'auto' })).toBeNull();
    expect(effectiveCoin(ambiguousRow(2, [A, B]), { kind: 'auto' })).toBeNull();
  });

  it('returns null when the decision is skip, even for a matched row', () => {
    expect(effectiveCoin(matchedRow(2, A), { kind: 'skip' })).toBeNull();
  });

  it('returns the picked coin, for ambiguous, unmatched and matched rows alike', () => {
    expect(effectiveCoin(ambiguousRow(2, [A, B]), { kind: 'pick', coin: B })).toBe(B);
    expect(effectiveCoin(unmatchedRow(3), { kind: 'pick', coin: A })).toBe(A);
    expect(effectiveCoin(matchedRow(4, A), { kind: 'pick', coin: B })).toBe(B);
  });
});

describe('selectedCoinIds', () => {
  it('returns unique effective coin ids in row order, including already owned ones', () => {
    const rows = [matchedRow(2, A), matchedRow(3, OWNED), matchedRow(4, B)];
    expect(selectedCoinIds(rows, {})).toEqual(['coin-a', 'coin-owned', 'coin-b']);
  });

  it('keeps one id for a coin that appears in several rows (duplicate in file or picked twice)', () => {
    const rows = [matchedRow(2, A), matchedRow(3, B), matchedRow(4, A, 2), unmatchedRow(5)];
    const decisions: ImportDecisions = { 5: { kind: 'pick', coin: B } };
    expect(selectedCoinIds(rows, decisions)).toEqual(['coin-a', 'coin-b']);
  });

  it('excludes skipped, unmatched, invalid and unresolved ambiguous rows', () => {
    const rows = [
      matchedRow(2, A),
      matchedRow(3, B),
      unmatchedRow(4),
      invalidRow(5),
      ambiguousRow(6, [A, B]),
    ];
    expect(selectedCoinIds(rows, { 3: { kind: 'skip' } })).toEqual(['coin-a']);
    expect(selectedCoinIds(rows, {})).toEqual(['coin-a', 'coin-b']);
  });

  it('includes resolved rows (picked candidate, picked search result) at their row position', () => {
    const rows = [ambiguousRow(2, [A, B]), matchedRow(3, OWNED), unmatchedRow(4)];
    const decisions: ImportDecisions = { 2: { kind: 'pick', coin: B }, 4: { kind: 'pick', coin: A } };
    expect(selectedCoinIds(rows, decisions)).toEqual(['coin-b', 'coin-owned', 'coin-a']);
  });

  it('returns an empty list for no rows', () => {
    expect(selectedCoinIds([], {})).toEqual([]);
  });
});

describe('countToImport', () => {
  it('counts unique effective coins that are not owned', () => {
    const rows = [matchedRow(2, A), matchedRow(3, OWNED), matchedRow(4, B)];
    expect(countToImport(rows, {})).toBe(2);
  });

  it('does not double-count duplicates', () => {
    const rows = [matchedRow(2, A), matchedRow(3, A, 2), matchedRow(4, B)];
    expect(countToImport(rows, {})).toBe(2);
  });

  it('drops skipped rows and adds picked ones, updating live', () => {
    const rows = [matchedRow(2, A), matchedRow(3, B), ambiguousRow(4, [A, B]), unmatchedRow(5)];
    expect(countToImport(rows, {})).toBe(2);
    expect(countToImport(rows, { 2: { kind: 'skip' } })).toBe(1);
    expect(countToImport(rows, { 2: { kind: 'skip' }, 3: { kind: 'skip' } })).toBe(0);
    expect(countToImport(rows, { 5: { kind: 'pick', coin: summary('coin-new', { year: 1953 }) } })).toBe(3);
  });

  it('does not count a picked coin that is already owned', () => {
    const rows = [unmatchedRow(2)];
    expect(countToImport(rows, { 2: { kind: 'pick', coin: OWNED } })).toBe(0);
    expect(countToImport(rows, { 2: { kind: 'pick', coin: A } })).toBe(1);
  });

  it('is zero when nothing is importable', () => {
    expect(countToImport([unmatchedRow(2), invalidRow(3)], {})).toBe(0);
    expect(countToImport([], {})).toBe(0);
  });
});

describe('countSkipped', () => {
  it('counts rows whose effective coin is null', () => {
    const rows = [matchedRow(2, A), unmatchedRow(3), invalidRow(4), ambiguousRow(5, [A, B]), matchedRow(6, B)];
    expect(countSkipped(rows, {})).toBe(3);
  });

  it('counts user-skipped matched rows and stops counting rows that were resolved by a pick', () => {
    const rows = [matchedRow(2, A), unmatchedRow(3), ambiguousRow(4, [A, B])];
    expect(countSkipped(rows, { 2: { kind: 'skip' } })).toBe(3);
    expect(countSkipped(rows, { 3: { kind: 'pick', coin: B }, 4: { kind: 'pick', coin: A } })).toBe(0);
  });

  it('counts duplicate rows as not skipped (they still have an effective coin)', () => {
    const rows = [matchedRow(2, A), matchedRow(3, A, 2)];
    expect(countSkipped(rows, {})).toBe(0);
  });
});

describe('toImportCoinSummary', () => {
  it('maps a CatalogCoin to an ImportCoinSummary with owned false', () => {
    const coin: CatalogCoin = {
      id: 'c-1',
      country: 'USA',
      denomination: 'Cent',
      year: 1909,
      mintMark: 'S',
      variety: 'VDB',
      name: 'Lincoln Wheat Cent',
      imageUrl: 'https://example.com/x.jpg',
      imageSource: 'src',
      imageLicense: 'lic',
      diameterMm: 19.05,
      weightG: 3.11,
      thicknessMm: null,
      material: 'Bronze',
      mintage: 484000,
      isKeyDate: true,
      status: 'approved',
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    expect(toImportCoinSummary(coin)).toEqual({
      id: 'c-1',
      country: 'USA',
      denomination: 'Cent',
      year: 1909,
      mintMark: 'S',
      variety: 'VDB',
      name: 'Lincoln Wheat Cent',
      owned: false,
    });
    expect(toImportCoinSummary({ ...coin, id: 'c-2', year: 1950, mintMark: '' }).id).toBe('c-2');
    expect(toImportCoinSummary({ ...coin, id: 'c-2', year: 1950, mintMark: '' }).year).toBe(1950);
  });
});

describe('formatImportCoinLabel', () => {
  it('formats country, denomination, year, mint mark and variety', () => {
    expect(formatImportCoinLabel(summary('x', { year: 1909, mintMark: 'S', variety: 'VDB' }))).toBe(
      'USA Cent (1909 S), VDB',
    );
  });

  it('omits the mint mark when empty', () => {
    expect(formatImportCoinLabel(summary('x', { year: 1950, mintMark: '', variety: '' }))).toBe('USA Cent (1950)');
    expect(formatImportCoinLabel(summary('x', { year: 1943, mintMark: '', variety: 'Steel' }))).toBe(
      'USA Cent (1943), Steel',
    );
  });

  it('omits the variety when empty', () => {
    expect(formatImportCoinLabel(summary('x', { year: 1950, mintMark: 'D', variety: '' }))).toBe('USA Cent (1950 D)');
  });

  it('works for other countries and denominations', () => {
    expect(
      formatImportCoinLabel(
        summary('x', { country: 'Ukraine', denomination: '10 Hryvnias', year: 2022, mintMark: '', variety: '' }),
      ),
    ).toBe('Ukraine 10 Hryvnias (2022)');
  });
});

describe('importErrorKey', () => {
  it('maps HTTP 413 to import.error.fileTooLarge and 429 to import.error.rateLimited', () => {
    expect(importErrorKey(new ApiError(413, 'Payload Too Large'))).toBe('import.error.fileTooLarge');
    expect(importErrorKey(new ApiError(429, 'ThrottlerException: Too Many Requests'))).toBe('import.error.rateLimited');
  });

  it.each([
    ['IMPORT_FILE_REQUIRED', 'import.error.fileRequired'],
    ['IMPORT_FILE_TOO_LARGE', 'import.error.fileTooLarge'],
    ['IMPORT_TOO_MANY_ROWS', 'import.error.tooManyRows'],
    ['IMPORT_NOT_UTF8', 'import.error.notUtf8'],
    ['IMPORT_NOT_CSV', 'import.error.notCsv'],
    ['IMPORT_EMPTY', 'import.error.empty'],
    ['IMPORT_NO_DATA_ROWS', 'import.error.noDataRows'],
    ['IMPORT_INVALID_MAPPING', 'import.error.invalidMapping'],
    ['IMPORT_UNKNOWN_COIN', 'import.error.unknownCoin'],
  ])('maps the ApiError message %s to %s', (code, key) => {
    expect(importErrorKey(new ApiError(400, code))).toBe(key);
  });

  it('falls back to common.somethingWentWrong for anything else', () => {
    expect(importErrorKey(new ApiError(400, 'something else'))).toBe('common.somethingWentWrong');
    expect(importErrorKey(new ApiError(500, 'Internal server error'))).toBe('common.somethingWentWrong');
    expect(importErrorKey(new Error('IMPORT_EMPTY'))).toBe('common.somethingWentWrong');
    expect(importErrorKey(null)).toBe('common.somethingWentWrong');
    expect(importErrorKey('IMPORT_EMPTY')).toBe('common.somethingWentWrong');
    expect(importErrorKey(undefined)).toBe('common.somethingWentWrong');
  });
});
