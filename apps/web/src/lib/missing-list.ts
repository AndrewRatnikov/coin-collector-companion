import { csvDocument, csvRow, formatLocalDate, type GapSlot, type GapViewResponse } from '@coin-collector/shared';

export { formatLocalDate } from '@coin-collector/shared';

export const MISSING_CSV_HEADER = 'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage';

/** Unowned slots, ascending by position. Never mutates the input. */
export function getMissingSlots(gaps: Pick<GapViewResponse, 'slots'>): GapSlot[] {
  return [...gaps.slots].filter((slot) => !slot.owned).sort((a, b) => a.position - b.position);
}

export interface WantListMint {
  label: string;
  isKeyDate: boolean;
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

export function buildMissingCsv(
  gaps: Pick<GapViewResponse, 'slots'>,
  // Kept in the signature per the PRD; the CSV body itself doesn't include the set name.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setName: string,
): string {
  const rows = getMissingSlots(gaps).map(({ coin }) =>
    csvRow([
      coin.name,
      coin.country,
      coin.denomination,
      String(coin.year),
      coin.mintMark,
      coin.variety,
      coin.isKeyDate ? 'yes' : 'no',
      coin.mintage === null ? '' : String(coin.mintage),
    ]),
  );
  return csvDocument([MISSING_CSV_HEADER, ...rows]);
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
  gaps: Pick<GapViewResponse, 'slots'>,
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
