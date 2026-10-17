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

// GET /catalog?sort=. The default keeps the historical order (year, then id).
export type CatalogSort = 'year_asc' | 'year_desc' | 'name_asc';
export const CATALOG_SORTS: readonly CatalogSort[] = ['year_asc', 'year_desc', 'name_asc'];
export const DEFAULT_CATALOG_SORT: CatalogSort = 'year_asc';

// GET /catalog/facets?country= — the option lists for the catalog filter sidebar.
export interface CatalogFacets {
  countries: string[]; // distinct country of approved coins, A–Z
  denominations: string[]; // distinct denomination of approved coins, scoped to ?country= when given
}

/** The number shown in a coin placeholder: "10 Hryvnias" -> "10", "Cent" -> "1". */
export function getDenominationNumeral(denomination: string): string {
  const leading = /^\s*(\d+(?:[.,]\d+)?)/.exec(denomination);
  if (leading) return leading[1];
  const anywhere = /(\d+(?:[.,]\d+)?)/.exec(denomination);
  if (anywhere) return anywhere[1];
  return '1';
}

function denominationValue(denomination: string): number {
  const value = parseFloat(getDenominationNumeral(denomination).replace(',', '.'));
  return Number.isNaN(value) ? 0 : value;
}

/** Facet order: numeral numerically (',' read as '.'), then by name. */
export function compareDenominations(a: string, b: string): number {
  const diff = denominationValue(a) - denominationValue(b);
  if (diff !== 0) return diff;
  return a.localeCompare(b, 'en');
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
  // GET /sets/canonical list only: the number of coins in the checklist (Prisma _count).
  coinCount: number;
}

export interface CanonicalSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

// The detail endpoint carries no coinCount; clients count `coins`.
export interface CanonicalSetDetail extends Omit<CanonicalSetSummary, 'coinCount'> {
  coins: CanonicalSetCoinItem[];
}

// GET /sets/public list item. UserSetSummary itself stays count-free (own-sets list,
// create and rename responses don't carry it).
export interface PublicSetSummary extends UserSetSummary {
  coinCount: number;
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

/** Body of `PATCH /collection`: set the same owned state for many coins in one request. */
export interface BulkSetOwnershipRequest {
  coinIds: string[];
  owned: boolean;
}

/** Response of `PATCH /collection`: the de-duplicated ids, in first-seen order. */
export interface BulkSetOwnershipResponse {
  coinIds: string[];
  owned: boolean;
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

// The redesign's naming rule: one eyebrow / title / subtitle block for every place a coin
// is named (cards, rows, headings). Pure; every text input is trimmed first.
export interface CoinName {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export type CoinNameInput = Pick<CatalogCoin, 'country' | 'denomination' | 'year' | 'mintMark' | 'variety' | 'name'> & {
  isKeyDate?: boolean;
};

const COIN_NAME_VARIETY_SEPARATOR = ': ';
const COIN_NAME_SUBTITLE_SEPARATOR = ' · ';

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Whole word: bounded by the string edge or a character that is not a letter or digit.
function wholeWordPattern(part: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(part)}(?![\\p{L}\\p{N}])`, 'giu');
}

function containsWholeWord(text: string, part: string): boolean {
  if (part === '') return false;
  return wholeWordPattern(part).test(text);
}

function removeWholeWord(text: string, part: string): string {
  if (part === '') return text;
  return text.replace(wholeWordPattern(part), ' ');
}

// Trims; a missing value (loosely typed callers, partial API data) counts as ''.
function cleanText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function splitCoinVariety(variety: string): { series: string; design: string } {
  const index = variety.indexOf(COIN_NAME_VARIETY_SEPARATOR);
  if (index === -1) return { series: '', design: variety };
  const left = variety.slice(0, index).trim();
  const right = variety.slice(index + COIN_NAME_VARIETY_SEPARATOR.length).trim();
  if (left === '' || right === '') return { series: '', design: left || right };
  return { series: left, design: right };
}

/**
 * Eyebrow, title and subtitle for a coin, e.g. Donetsk Oblast:
 * { eyebrow: "We Are Strong. We Are Together", title: "Donetsk Oblast", subtitle: "Ukraine · 10 Hryvnias · 2025" }.
 */
export function getCoinName(coin: CoinNameInput): CoinName {
  const country = cleanText(coin.country);
  const denomination = cleanText(coin.denomination);
  const mintMark = cleanText(coin.mintMark);
  const name = cleanText(coin.name);
  const year = String(coin.year);

  const { series, design } = splitCoinVariety(cleanText(coin.variety));
  const notation = mintMark ? `${year}-${mintMark}` : year;

  const remainder = removeWholeWord(removeWholeWord(name, country), denomination);
  const typeName = /[\p{L}\p{N}]/u.test(remainder) ? name : '';

  let title: string;
  if (coin.isKeyDate === true && series === '') {
    if (design === '') title = notation;
    else if (containsWholeWord(design, year)) title = design;
    else title = `${notation} ${design}`;
  } else if (design !== '') {
    title = design;
  } else if (typeName !== '') {
    title = typeName;
  } else {
    title = denomination;
  }

  let eyebrow = '';
  if (series !== '') eyebrow = series;
  else if (typeName !== '' && title !== typeName) eyebrow = typeName;

  const subtitleParts: string[] = [];
  if (country !== '' && !containsWholeWord(title, country)) subtitleParts.push(country);
  if (denomination !== '' && !containsWholeWord(title, denomination)) subtitleParts.push(denomination);
  if (!containsWholeWord(title, year)) subtitleParts.push(notation);

  return { eyebrow, title, subtitle: subtitleParts.join(COIN_NAME_SUBTITLE_SEPARATOR) };
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
