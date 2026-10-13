import type { CatalogCoin } from '@coin-collector/shared';

// Pure helpers for the /sets/new step-2 source card and read-only coin preview.

export const PREVIEW_LIMIT = 60;

export interface SourceCoinItem {
  position: number;
  coin: CatalogCoin;
}

export interface CoinPreviewGroup {
  year: number;
  coins: CatalogCoin[];
}

export interface CoinPreview {
  groups: CoinPreviewGroup[];
  rest: number;
}

export interface SourceCoinSummary {
  count: number;
  minYear: number | null;
  maxYear: number | null;
  countries: string[];
}

/**
 * The first `limit` coins by position, grouped by year (groups in ascending year order,
 * coins inside a group in position order), plus how many coins were left out.
 */
export function buildCoinPreview(
  items: SourceCoinItem[],
  limit: number = PREVIEW_LIMIT,
): CoinPreview {
  const shown = [...items].sort((a, b) => a.position - b.position).slice(0, Math.max(0, limit));

  const byYear = new Map<number, CatalogCoin[]>();
  for (const item of shown) {
    const group = byYear.get(item.coin.year);
    if (group) group.push(item.coin);
    else byYear.set(item.coin.year, [item.coin]);
  }

  const groups = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, coins]) => ({ year, coins }));

  return { groups, rest: Math.max(0, items.length - shown.length) };
}

/** Count, year span and distinct countries over every coin of a source. */
export function summarizeSourceCoins(items: SourceCoinItem[]): SourceCoinSummary {
  if (items.length === 0) {
    return { count: 0, minYear: null, maxYear: null, countries: [] };
  }

  let minYear = items[0].coin.year;
  let maxYear = items[0].coin.year;
  const countries = new Set<string>();
  for (const { coin } of items) {
    if (coin.year < minYear) minYear = coin.year;
    if (coin.year > maxYear) maxYear = coin.year;
    countries.add(coin.country);
  }

  return {
    count: items.length,
    minYear,
    maxYear,
    countries: [...countries].sort((a, b) => a.localeCompare(b)),
  };
}

/** "1909–1958" (en dash), "1943" for a single year, '' when unknown. */
export function formatYearRange(minYear: number | null, maxYear: number | null): string {
  if (minYear === null || maxYear === null) return '';
  if (minYear === maxYear) return String(minYear);
  return `${minYear}–${maxYear}`;
}
