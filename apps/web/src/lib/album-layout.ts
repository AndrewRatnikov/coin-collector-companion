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

// ---------------------------------------------------------------------------
// Coin-card naming rules (Album view)
// ---------------------------------------------------------------------------

export interface AlbumCardText {
  eyebrow: string;
  title: string;
  secondary: string;
}

const VARIETY_SEPARATOR = ': ';

/**
 * Splits a variety at the first ": " into a series eyebrow and a title,
 * e.g. "We Are Strong. We Are Together: Donetsk Oblast". Without a separator
 * (or with an empty side) the whole non-empty text is the title.
 */
export function splitVariety(variety: string): { eyebrow: string; title: string } {
  const index = variety.indexOf(VARIETY_SEPARATOR);
  if (index === -1) {
    return { eyebrow: '', title: variety.trim() };
  }
  const eyebrow = variety.slice(0, index).trim();
  const title = variety.slice(index + VARIETY_SEPARATOR.length).trim();
  if (eyebrow === '' || title === '') {
    return { eyebrow: '', title: eyebrow || title };
  }
  return { eyebrow, title };
}

/** Collector notation: "1909", "1931-S". */
export function formatCollectorNotation(coin: Pick<CatalogCoin, 'year' | 'mintMark'>): string {
  return coin.mintMark === '' ? String(coin.year) : `${coin.year}-${coin.mintMark}`;
}

function cardTitle(coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety'>): { eyebrow: string; title: string } {
  const { eyebrow, title } = splitVariety(coin.variety);
  return { eyebrow, title: title === '' ? formatCollectorNotation(coin) : title };
}

function titleHasYear(title: string, year: number): boolean {
  return title.includes(String(year));
}

/** Eyebrow, title and secondary line shown on an album coin card. */
export function getAlbumCardText(
  coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety' | 'denomination'>,
): AlbumCardText {
  const { eyebrow, title } = cardTitle(coin);
  const secondary = titleHasYear(title, coin.year)
    ? coin.denomination
    : `${formatCollectorNotation(coin)} · ${coin.denomination}`;
  return { eyebrow, title, secondary };
}

/** The number shown in a coin placeholder: "10 Hryvnias" -> "10", "Cent" -> "1". */
export function getDenominationNumeral(denomination: string): string {
  const leading = /^\s*(\d+(?:[.,]\d+)?)/.exec(denomination);
  if (leading) return leading[1];
  const anywhere = /(\d+(?:[.,]\d+)?)/.exec(denomination);
  if (anywhere) return anywhere[1];
  return '1';
}

/** The eyebrow shared by every coin on the page (at least two coins), else ''. */
export function getSharedEyebrow(page: AlbumPage): string {
  const eyebrows = page.rows.flatMap((row) =>
    row.cells.flatMap((cell) => cell.slots.map((slot) => getAlbumCardText(slot.coin).eyebrow)),
  );
  if (eyebrows.length < 2) return '';
  const first = eyebrows[0];
  if (first === '') return '';
  return eyebrows.every((eyebrow) => eyebrow === first) ? first : '';
}

/** True when no coin on the page has a mint mark. */
export function isNoMintMarkPage(page: AlbumPage): boolean {
  return page.columns.every((column) => column.mintMark === '');
}

/** True when some year × mint-mark cell on the page has no coin. */
export function hasBlankCells(page: AlbumPage): boolean {
  return page.rows.some((row) => row.cells.some((cell) => cell.slots.length === 0));
}

/** The page name, plus " · country" only when the name doesn't already mention it. */
export function formatAlbumPageHeading(page: Pick<AlbumPage, 'name' | 'country'>): string {
  const country = page.country.trim();
  if (country !== '' && page.name.toLowerCase().includes(country.toLowerCase())) {
    return page.name;
  }
  return `${page.name} · ${page.country}`;
}

/** Short coin name: "Donetsk Oblast 2025", "1931-S", "VDB 1909-S". */
export function formatAlbumCoinShortName(coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety'>): string {
  const { title } = cardTitle(coin);
  return titleHasYear(title, coin.year) ? title : `${title} ${formatCollectorNotation(coin)}`;
}

/** Fills every `{coin}` in a translated template with the coin's short name. */
export function formatAlbumCheckLabel(
  template: string,
  coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety'>,
): string {
  return template.split('{coin}').join(formatAlbumCoinShortName(coin));
}

/** Full accessible name of a card link, e.g. "VDB, 1909, Cent, owned". */
export function formatAlbumCardLabel(
  slot: { coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety' | 'denomination' | 'isKeyDate'>; owned: boolean },
  words: AlbumSlotLabelWords,
): string {
  const { coin } = slot;
  const { eyebrow, title } = cardTitle(coin);
  const parts = [
    eyebrow ? `${eyebrow}: ${title}` : title,
    titleHasYear(title, coin.year) ? '' : formatCollectorNotation(coin),
    coin.denomination,
    slot.owned ? words.owned : words.missing,
    coin.isKeyDate ? words.keyDate : '',
  ];
  return parts.filter((part) => part !== '').join(', ');
}
