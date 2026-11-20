import {
  csvDocument,
  csvRow,
  formatLocalDate,
  splitCoinVariety,
  type CatalogCoin,
  type CoinGrade,
  type GapSlot,
  type GapViewResponse,
  type WantCoin,
  type WantListResponse,
} from '@coin-collector/shared';

export { formatLocalDate } from '@coin-collector/shared';

export const MISSING_CSV_HEADER =
  'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage,Want,Grade,Target grade';

/** The gaps a want-list CSV needs: the slots, plus the set's minimum grade when known. */
export type MissingCsvGaps = Pick<GapViewResponse, 'slots'> & Partial<Pick<GapViewResponse, 'minGrade'>>;

/** Unowned slots, ascending by position. Never mutates the input. */
export function getMissingSlots(gaps: Pick<GapViewResponse, 'slots'>): GapSlot[] {
  return [...gaps.slots].filter((slot) => !slot.owned).sort((a, b) => a.position - b.position);
}

/** Owned slots below the set's minimum grade (`needsUpgrade`), ascending by position. Never mutates the input. */
export function getUpgradeSlots(gaps: Pick<GapViewResponse, 'slots'>): GapSlot[] {
  return [...gaps.slots]
    .filter((slot) => slot.owned && slot.needsUpgrade === true)
    .sort((a, b) => a.position - b.position);
}

export interface WantListMint {
  label: string;
  isKeyDate: boolean;
  grade?: CoinGrade | null; // upgrade rows: the owned grade (null = ungraded)
  targetGrade?: CoinGrade | null; // upgrade rows: the set's minGrade
}

export interface WantListYear {
  year: number;
  mints: WantListMint[];
}

/**
 * Unowned slots grouped by year (years in order of first appearance after sorting by position).
 * A mint's label is "mintMark variety" ('' for a plain coin); key dates come from `keyDateIds`.
 * Never mutates the input.
 */
export function groupWantList(
  slots: readonly Pick<GapSlot, 'coin' | 'owned' | 'position'>[],
  keyDateIds: ReadonlySet<string>,
): WantListYear[] {
  const rows: WantListYear[] = [];
  const byYear = new Map<number, WantListYear>();
  const missing = slots.filter((slot) => !slot.owned).sort((a, b) => a.position - b.position);
  for (const { coin } of missing) {
    let row = byYear.get(coin.year);
    if (!row) {
      row = { year: coin.year, mints: [] };
      byYear.set(coin.year, row);
      rows.push(row);
    }
    row.mints.push({
      label: [coin.mintMark, coin.variety].filter(Boolean).join(' '),
      isKeyDate: keyDateIds.has(coin.id),
    });
  }
  return rows;
}

export interface WantGroup {
  key: string; // `${country}|${denomination}`
  country: string;
  denomination: string;
  years: WantListYear[];
}

export interface WantItem {
  coin: CatalogCoin;
  grade?: CoinGrade | null;
  targetGrade?: CoinGrade | null;
}

function wantGroupKey(coin: Pick<CatalogCoin, 'country' | 'denomination'>): string {
  return `${coin.country}|${coin.denomination}`;
}

/**
 * Groups items by (country, denomination), then by year, keeping the caller's order: groups and years
 * in order of first appearance, mints in input order. Never sorts and never mutates the input.
 * A mint's label is "mintMark design" (the variety without its series prefix; '' for a plain coin).
 */
export function buildWantGroups(items: readonly WantItem[]): WantGroup[] {
  const groups: WantGroup[] = [];
  const byKey = new Map<string, { group: WantGroup; byYear: Map<number, WantListYear> }>();
  for (const item of items) {
    const { coin } = item;
    const key = wantGroupKey(coin);
    let entry = byKey.get(key);
    if (!entry) {
      entry = {
        group: { key, country: coin.country, denomination: coin.denomination, years: [] },
        byYear: new Map(),
      };
      byKey.set(key, entry);
      groups.push(entry.group);
    }
    let row = entry.byYear.get(coin.year);
    if (!row) {
      row = { year: coin.year, mints: [] };
      entry.byYear.set(coin.year, row);
      entry.group.years.push(row);
    }
    const mint: WantListMint = {
      label: [(coin.mintMark ?? '').trim(), splitCoinVariety((coin.variety ?? '').trim()).design]
        .filter(Boolean)
        .join(' '),
      isKeyDate: coin.isKeyDate,
    };
    if (item.grade !== undefined) mint.grade = item.grade;
    if (item.targetGrade !== undefined) mint.targetGrade = item.targetGrade;
    row.mints.push(mint);
  }
  return groups;
}

/** Reorders slots (already in position order) into want-list order: by group, then year, stable inside a year. */
function orderByWantList(slots: readonly GapSlot[]): GapSlot[] {
  const byGroup = new Map<string, Map<number, GapSlot[]>>();
  for (const slot of slots) {
    const key = wantGroupKey(slot.coin);
    let byYear = byGroup.get(key);
    if (!byYear) {
      byYear = new Map();
      byGroup.set(key, byYear);
    }
    const bucket = byYear.get(slot.coin.year);
    if (bucket) bucket.push(slot);
    else byYear.set(slot.coin.year, [slot]);
  }
  return [...byGroup.values()].flatMap((byYear) => [...byYear.values()].flat());
}

function coinCells(coin: CatalogCoin): string[] {
  return [
    coin.name,
    coin.country,
    coin.denomination,
    String(coin.year),
    coin.mintMark,
    coin.variety,
    coin.isKeyDate ? 'yes' : 'no',
    coin.mintage === null ? '' : String(coin.mintage),
  ];
}

export function buildMissingCsv(
  gaps: MissingCsvGaps,
  // Kept in the signature per the PRD; the CSV body itself doesn't include the set name.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setName: string,
): string {
  const missingRows = orderByWantList(getMissingSlots(gaps)).map(({ coin }) =>
    csvRow([...coinCells(coin), 'missing', '', '']),
  );
  const upgradeRows = orderByWantList(getUpgradeSlots(gaps)).map((slot) =>
    csvRow([...coinCells(slot.coin), 'upgrade', slot.grade ?? '', gaps.minGrade ?? '']),
  );
  return csvDocument([MISSING_CSV_HEADER, ...missingRows, ...upgradeRows]);
}

export function slugifySetName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    // drop anything outside printable ASCII (letters with no ASCII equivalent, symbols)
    .replace(/[^ -~]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'set' : slug;
}

export function missingCsvFilename(setName: string, date: Date): string {
  return `${slugifySetName(setName)}-missing-${formatLocalDate(date)}.csv`;
}

export function downloadMissingCsv(
  gaps: MissingCsvGaps,
  setName: string,
  now: Date = new Date(),
): void {
  const blob = new Blob([buildMissingCsv(gaps, setName)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = missingCsvFilename(setName, now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const WANT_LIST_CSV_HEADER = `${MISSING_CSV_HEADER},Sets`;

function wantSetNames(entry: WantCoin): string {
  return entry.sets.map((set) => set.name).join('; ');
}

/**
 * The combined want list as CSV: missing rows, then upgrade rows, each in response order
 * (the server already returns want-list order, so nothing is re-sorted). The last cell lists
 * the names of the sets each coin is wanted for. Never mutates the input.
 */
export function buildWantListCsv(response: WantListResponse): string {
  const missingRows = response.missing.map((entry) =>
    csvRow([...coinCells(entry.coin), 'missing', '', '', wantSetNames(entry)]),
  );
  const upgradeRows = response.upgrades.map((entry) =>
    csvRow([...coinCells(entry.coin), 'upgrade', entry.grade ?? '', entry.targetGrade, wantSetNames(entry)]),
  );
  return csvDocument([WANT_LIST_CSV_HEADER, ...missingRows, ...upgradeRows]);
}

export function wantListCsvFilename(date: Date): string {
  return `want-list-${formatLocalDate(date)}.csv`;
}

export function downloadWantListCsv(response: WantListResponse, now: Date = new Date()): void {
  const blob = new Blob([buildWantListCsv(response)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = wantListCsvFilename(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** A coin's label in the "Which sets?" list, e.g. "USA · 1 Cent · 1914-D". Empty parts are dropped. */
export function wantCoinLabel(coin: CatalogCoin): string {
  const mintMark = (coin.mintMark ?? '').trim();
  const notation = mintMark ? `${coin.year}-${mintMark}` : `${coin.year}`;
  const design = splitCoinVariety((coin.variety ?? '').trim()).design;
  return [coin.country, coin.denomination, notation, design].filter(Boolean).join(' · ');
}
