// v2 catalog contracts (docs/system-design_v2.md §3–§4.1). Populated as real v2 DTOs/enums
// are authored — keep this the single source of truth shared by both apps (CLAUDE.md).

export type CoinStatus = 'approved' | 'pending' | 'rejected';

// Any of these (case-insensitive, whitespace-trimmed) means "no value" — they all
// must collapse to the same '' before reaching Prisma, or the Coin natural-key
// unique constraint silently stops deduping (system-design_v2.md §4.1/§4.3).
const NONE_PLACEHOLDERS = new Set(['', 'none', 'n/a', 'na']);

export function sanitizeIdentityField(value: string | null | undefined): string {
  if (value == null) return '';
  const trimmed = value.trim();
  return NONE_PLACEHOLDERS.has(trimmed.toLowerCase()) ? '' : trimmed;
}

export interface CatalogCoin {
  id: string;
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
  name: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageLicense: string | null;
  diameterMm: number | null;
  weightG: number | null;
  thicknessMm: number | null;
  material: string | null;
  mintage: number | null;
  isKeyDate: boolean;
  status: CoinStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type Role = 'user' | 'admin';

// GET /catalog?submittedByMe=true items (the caller's own coins only). The rejection reason
// is never part of CatalogCoin, so it can't leak through public reads.
export interface SubmittedCoin extends CatalogCoin {
  rejectionReason: string | null;
}

// GET /admin/coins item minus duplicate info; also the PATCH /admin/coins/:id response.
export interface AdminCoin extends CatalogCoin {
  rejectionReason: string | null;
  // null when the submitter account was deleted (FK SetNull)
  submitterEmail: string | null;
}

export interface AdminCoinDuplicate {
  id: string;
  name: string;
}

export interface AdminCoinListItem extends AdminCoin {
  possibleDuplicate: AdminCoinDuplicate | null;
}

export interface ReviewCoinRequest {
  status: 'approved' | 'rejected';
  rejectionReason?: string;
  country?: string;
  denomination?: string;
  name?: string;
  year?: number;
  mintMark?: string;
  variety?: string;
}

export interface CreateCoinRequest {
  country: string;
  denomination: string;
  name: string;
  year: number;
  mintMark?: string;
  variety?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface UserSetSummary {
  id: string;
  userId: string;
  name: string;
  clonedFromCanonicalId: string | null;
  clonedFromUserSetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneFromRequest {
  type: 'canonical' | 'user';
  id: string;
}

export interface CreateSetRequestBody {
  name: string;
  cloneFrom?: CloneFromRequest;
}

export interface CanonicalSetSummary {
  id: string;
  name: string;
  description: string | null;
  source: string;
  templateVersion: string;
}

export interface CanonicalSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface CanonicalSetDetail extends CanonicalSetSummary {
  coins: CanonicalSetCoinItem[];
}

export interface UserSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface UserSetDetail extends UserSetSummary {
  coins: UserSetCoinItem[];
}

export interface UserSetCoinSummary {
  id: string;
  userSetId: string;
  coinId: string;
  position: number;
}

export interface PatchSetCoinsRequest {
  add?: string[];
  remove?: string[];
}

export interface OwnershipItem {
  coinId: string;
  coin: CatalogCoin;
  ownedAt: Date;
}

export interface SetOwnershipRequest {
  owned: boolean;
}

export interface SetOwnershipResponse {
  coinId: string;
  owned: boolean;
  ownedAt: Date | null;
}

export interface GapSlot {
  id: string;
  position: number;
  coin: CatalogCoin;
  owned: boolean;
}

export interface GapViewResponse {
  setId: string;
  ownedCount: number;
  totalCount: number;
  completionPercent: number;
  slots: GapSlot[];
}

export interface SubmitFeedbackRequest {
  text: string;
}

export interface FeedbackResponse {
  id: string;
  userId: string;
  text: string;
  createdAt: Date;
}

// Compact coin label, SD §3.1: "{country} {denomination} ({year} {mintMark})" — drops the
// mint mark from the parenthetical when it's empty. One formatter so both apps render a
// coin's display label identically wherever it appears (catalog rows, coin detail header,
// set editor picker, gap-view slot cards).
export function formatCoinLabel(coin: CatalogCoin): string {
  return coin.mintMark
    ? `${coin.country} ${coin.denomination} (${coin.year} ${coin.mintMark})`
    : `${coin.country} ${coin.denomination} (${coin.year})`;
}

// CSV collection import (POST /collection/import/preview and /confirm). The preview parses and
// matches an uploaded CSV in memory and writes nothing; only confirm creates Ownership rows.
export const IMPORT_MAX_FILE_BYTES = 1_048_576;
export const IMPORT_MAX_ROWS = 2000;

export type ImportField = 'year' | 'country' | 'denomination' | 'mintMark' | 'variety' | 'combined';
export const IMPORT_FIELDS: readonly ImportField[] = [
  'year',
  'country',
  'denomination',
  'mintMark',
  'variety',
  'combined',
];
// Field -> 0-based column index. Unmapped fields are absent.
export type ImportColumnMapping = Partial<Record<ImportField, number>>;

// Country and Denomination are required, plus either Year or the combined "Coin" column.
export function isImportMappingComplete(mapping: ImportColumnMapping): boolean {
  return (
    mapping.country !== undefined &&
    mapping.denomination !== undefined &&
    (mapping.year !== undefined || mapping.combined !== undefined)
  );
}

export type ImportDelimiter = ',' | ';' | '\t';
export type ImportRowStatus = 'matched' | 'ambiguous' | 'unmatched' | 'invalid';
export type ImportReasonCode =
  | 'year_missing'
  | 'year_invalid'
  | 'country_missing'
  | 'denomination_missing'
  | 'country_not_recognised'
  | 'denomination_not_recognised'
  | 'mint_mark_not_recognised'
  | 'no_such_coin'
  | 'multiple_matches'
  | 'variety_not_recognised';
export type ImportErrorCode =
  | 'IMPORT_FILE_REQUIRED'
  | 'IMPORT_FILE_TOO_LARGE'
  | 'IMPORT_TOO_MANY_ROWS'
  | 'IMPORT_NOT_UTF8'
  | 'IMPORT_NOT_CSV'
  | 'IMPORT_EMPTY'
  | 'IMPORT_NO_DATA_ROWS'
  | 'IMPORT_INVALID_MAPPING'
  | 'IMPORT_UNKNOWN_COIN';

export interface ImportCoinSummary {
  id: string;
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
  name: string;
  owned: boolean; // the user already owns it
}

export interface ImportPreviewRow {
  line: number; // 1-based physical line where the record starts
  values: string[]; // trimmed original cells, all columns
  status: ImportRowStatus;
  reason: ImportReasonCode | null; // null iff status === 'matched'
  coin: ImportCoinSummary | null; // non-null iff status === 'matched'
  candidates: ImportCoinSummary[]; // non-empty only for 'ambiguous'
  alreadyOwned: boolean; // matched && coin.owned
  duplicateOfLine: number | null; // matched rows only: line of the first row with the same coin
}

export interface ImportPreviewSummary {
  total: number;
  matched: number;
  alreadyOwned: number;
  duplicateInFile: number;
  ambiguous: number;
  unmatched: number;
  invalid: number;
  toImport: number;
}

export interface ImportPreviewResponse {
  headers: string[];
  delimiter: ImportDelimiter;
  mapping: ImportColumnMapping; // the mapping actually used
  rows: ImportPreviewRow[];
  summary: ImportPreviewSummary;
}

export interface ImportConfirmRequest {
  coinIds: string[];
}

export interface ImportConfirmResponse {
  requested: number; // unique ids received
  created: number; // new Ownership rows
  alreadyOwned: number; // requested - created
}
