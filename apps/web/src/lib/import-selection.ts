import type {
  CatalogCoin,
  ImportCoinSummary,
  ImportErrorCode,
  ImportPreviewRow,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import type { MessageKey } from '@/lib/i18n/locales/en';

// Pure helpers for the import page: per-row user decisions, live counts, labels and error keys.

export type RowDecision =
  { kind: 'auto' } | { kind: 'skip' } | { kind: 'pick'; coin: ImportCoinSummary };
// Keyed by row.line; a missing entry means 'auto'.
export type ImportDecisions = Record<number, RowDecision>;

export function effectiveCoin(
  row: ImportPreviewRow,
  decision?: RowDecision,
): ImportCoinSummary | null {
  if (decision?.kind === 'skip') return null;
  if (decision?.kind === 'pick') return decision.coin;
  return row.status === 'matched' ? row.coin : null;
}

function uniqueEffectiveCoins(
  rows: ImportPreviewRow[],
  decisions: ImportDecisions,
): ImportCoinSummary[] {
  const seen = new Set<string>();
  const coins: ImportCoinSummary[] = [];
  for (const row of rows) {
    const coin = effectiveCoin(row, decisions[row.line]);
    if (coin && !seen.has(coin.id)) {
      seen.add(coin.id);
      coins.push(coin);
    }
  }
  return coins;
}

export function selectedCoinIds(rows: ImportPreviewRow[], decisions: ImportDecisions): string[] {
  return uniqueEffectiveCoins(rows, decisions).map((coin) => coin.id);
}

export function countToImport(rows: ImportPreviewRow[], decisions: ImportDecisions): number {
  return uniqueEffectiveCoins(rows, decisions).filter((coin) => !coin.owned).length;
}

export function countSkipped(rows: ImportPreviewRow[], decisions: ImportDecisions): number {
  return rows.filter((row) => effectiveCoin(row, decisions[row.line]) === null).length;
}

export function toImportCoinSummary(coin: CatalogCoin): ImportCoinSummary {
  return {
    id: coin.id,
    country: coin.country,
    denomination: coin.denomination,
    year: coin.year,
    mintMark: coin.mintMark,
    variety: coin.variety,
    name: coin.name,
    owned: false,
  };
}

export function formatImportCoinLabel(coin: ImportCoinSummary): string {
  const base = coin.mintMark
    ? `${coin.country} ${coin.denomination} (${coin.year} ${coin.mintMark})`
    : `${coin.country} ${coin.denomination} (${coin.year})`;
  return coin.variety ? `${base}, ${coin.variety}` : base;
}

const ERROR_KEYS: Record<ImportErrorCode, MessageKey> = {
  IMPORT_FILE_REQUIRED: 'import.error.fileRequired',
  IMPORT_FILE_TOO_LARGE: 'import.error.fileTooLarge',
  IMPORT_TOO_MANY_ROWS: 'import.error.tooManyRows',
  IMPORT_NOT_UTF8: 'import.error.notUtf8',
  IMPORT_NOT_CSV: 'import.error.notCsv',
  IMPORT_EMPTY: 'import.error.empty',
  IMPORT_NO_DATA_ROWS: 'import.error.noDataRows',
  IMPORT_INVALID_MAPPING: 'import.error.invalidMapping',
  IMPORT_UNKNOWN_COIN: 'import.error.unknownCoin',
};

function isImportErrorCode(message: string): message is ImportErrorCode {
  return Object.prototype.hasOwnProperty.call(ERROR_KEYS, message);
}

export function importErrorKey(error: unknown): MessageKey {
  if (!(error instanceof ApiError)) return 'common.somethingWentWrong';
  if (error.status === 413) return 'import.error.fileTooLarge';
  if (error.status === 429) return 'import.error.rateLimited';
  if (isImportErrorCode(error.message)) return ERROR_KEYS[error.message];
  return 'common.somethingWentWrong';
}
