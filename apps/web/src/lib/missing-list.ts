import type { GapSlot, GapViewResponse } from '@coin-collector/shared';

export const MISSING_CSV_HEADER = 'Name,Country,Denomination,Year,Mint mark,Variety,Key date,Mintage';

const BOM = '﻿';
const FORMULA_PREFIX = /^[=+\-@]/;
const NEEDS_QUOTING = /[",\r\n]/;

/** Unowned slots, ascending by position. Never mutates the input. */
export function getMissingSlots(gaps: Pick<GapViewResponse, 'slots'>): GapSlot[] {
  return [...gaps.slots].filter((slot) => !slot.owned).sort((a, b) => a.position - b.position);
}

/** Formula-injection prefix first, then RFC 4180 quoting. */
function csvCell(value: string): string {
  let cell = String(value);
  if (FORMULA_PREFIX.test(cell)) {
    cell = `'${cell}`;
  }
  if (NEEDS_QUOTING.test(cell)) {
    cell = `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function buildMissingCsv(
  gaps: Pick<GapViewResponse, 'slots'>,
  // Kept in the signature per the PRD; the CSV body itself doesn't include the set name.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setName: string,
): string {
  const rows = getMissingSlots(gaps).map(({ coin }) =>
    [
      coin.name,
      coin.country,
      coin.denomination,
      String(coin.year),
      coin.mintMark,
      coin.variety,
      coin.isKeyDate ? 'yes' : 'no',
      coin.mintage === null ? '' : String(coin.mintage),
    ]
      .map(csvCell)
      .join(','),
  );
  return BOM + [MISSING_CSV_HEADER, ...rows].join('\r\n');
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

/** 'YYYY-MM-DD' in local time. */
export function formatLocalDate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
