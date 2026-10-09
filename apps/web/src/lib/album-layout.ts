import type { CatalogCoin, GapSlot } from '@coin-collector/shared';

export interface AlbumColumn {
  mintMark: string;
  ownedCount: number;
  totalCount: number;
}

/** `slots.length === 0` means a blank cell (no coin of that year/mint mark in the set). */
export interface AlbumCell {
  year: number;
  mintMark: string;
  slots: GapSlot[];
}

/** `cells[i]` belongs to `page.columns[i]`. */
export interface AlbumRow {
  year: number;
  cells: AlbumCell[];
}

export interface AlbumPage {
  key: string;
  country: string;
  denomination: string;
  name: string;
  columns: AlbumColumn[];
  rows: AlbumRow[];
  ownedCount: number;
  totalCount: number;
}

export interface AlbumSlotLabelWords {
  owned: string;
  missing: string;
  keyDate: string;
}

function compareOrdinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function compareMintMarks(a: string, b: string): number {
  if (a === b) return 0;
  if (a === '') return -1;
  if (b === '') return 1;
  return compareOrdinal(a, b);
}

function pageKey(coin: Pick<CatalogCoin, 'country' | 'denomination' | 'name'>): string {
  return `${coin.country}|${coin.denomination}|${coin.name}`;
}

function cellKey(year: number, mintMark: string): string {
  return `${year}|${mintMark}`;
}

/**
 * Groups gap slots into album pages (one per country + denomination + series name),
 * each a year × mint-mark grid. Pure: never mutates `slots` and never trusts array
 * order (stable sort by `position`, ties by input index).
 */
export function buildAlbumLayout(slots: GapSlot[]): AlbumPage[] {
  const sorted = slots
    .map((slot, index) => ({ slot, index }))
    .sort((a, b) => a.slot.position - b.slot.position || a.index - b.index)
    .map((entry) => entry.slot);

  const pageOrder: string[] = [];
  const pageSlots = new Map<string, GapSlot[]>();
  for (const slot of sorted) {
    const key = pageKey(slot.coin);
    const bucket = pageSlots.get(key);
    if (bucket) {
      bucket.push(slot);
    } else {
      pageOrder.push(key);
      pageSlots.set(key, [slot]);
    }
  }

  return pageOrder.map((key) => {
    const members = pageSlots.get(key) ?? [];
    const first = members[0].coin;

    const years = [...new Set(members.map((slot) => slot.coin.year))].sort((a, b) => a - b);
    const mintMarks = [...new Set(members.map((slot) => slot.coin.mintMark))].sort(compareMintMarks);

    const byCell = new Map<string, GapSlot[]>();
    for (const slot of members) {
      const k = cellKey(slot.coin.year, slot.coin.mintMark);
      const bucket = byCell.get(k);
      if (bucket) {
        bucket.push(slot);
      } else {
        byCell.set(k, [slot]);
      }
    }

    const columns: AlbumColumn[] = mintMarks.map((mintMark) => {
      const inColumn = members.filter((slot) => slot.coin.mintMark === mintMark);
      return {
        mintMark,
        ownedCount: inColumn.filter((slot) => slot.owned).length,
        totalCount: inColumn.length,
      };
    });

    const rows: AlbumRow[] = years.map((year) => ({
      year,
      cells: mintMarks.map((mintMark) => ({
        year,
        mintMark,
        slots: byCell.get(cellKey(year, mintMark)) ?? [],
      })),
    }));

    return {
      key,
      country: first.country,
      denomination: first.denomination,
      name: first.name,
      columns,
      rows,
      ownedCount: members.filter((slot) => slot.owned).length,
      totalCount: members.length,
    };
  });
}

/** E.g. "1931 S Lincoln Wheat Cent", "1909 VDB Lincoln Wheat Cent". */
export function formatAlbumCoinName(coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety' | 'name'>): string {
  return [String(coin.year), coin.mintMark, coin.variety, coin.name].filter((part) => part !== '').join(' ');
}

/** E.g. "1931 S Lincoln Wheat Cent, missing, key date". */
export function formatAlbumSlotLabel(slot: Pick<GapSlot, 'coin' | 'owned'>, words: AlbumSlotLabelWords): string {
  const status = slot.owned ? words.owned : words.missing;
  const base = `${formatAlbumCoinName(slot.coin)}, ${status}`;
  return slot.coin.isKeyDate ? `${base}, ${words.keyDate}` : base;
}

/** Fills `{owned}` and `{total}` in a translated template. */
export function formatOwnedOfTotal(template: string, owned: number, total: number): string {
  return template.split('{owned}').join(String(owned)).split('{total}').join(String(total));
}
