// Pure patchers behind the optimistic ownership toggle (useSetOwnership). Each one returns a
// new value when something changes and the same reference when nothing does; none mutates
// its input. The settle-time invalidation still refetches the real server state.

import {
  meetsMinGrade,
  type CatalogCoin,
  type CatalogListItem,
  type CoinGrade,
  type GapSlot,
  type GapViewResponse,
  type OwnershipItem,
  type PaginatedResponse,
} from '@coin-collector/shared';
import type { CatalogFilters } from '@/lib/catalog-api';
import type { CollectionFilters } from '@/lib/collection-api';

/** Same rounding as the API's gap view (sets.service.ts). */
function completionPercent(ownedCount: number, totalCount: number): number {
  return totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
}

/**
 * A changed slot's `needsUpgrade`, only when the set has a minGrade (the API adds the key only
 * then): owned && !meetsMinGrade(grade, minGrade). With no minGrade the slot is returned as is.
 */
function withNeedsUpgrade(slot: GapSlot, minGrade: CoinGrade | null): GapSlot {
  if (minGrade === null) return slot;
  return { ...slot, needsUpgrade: slot.owned && !meetsMinGrade(slot.grade, minGrade) };
}

/** `upgradeCount` (slots with needsUpgrade === true), present only when the set has a minGrade. */
function withUpgradeCount(gaps: GapViewResponse): GapViewResponse {
  if (gaps.minGrade === null) return gaps;
  return { ...gaps, upgradeCount: gaps.slots.filter((slot) => slot.needsUpgrade === true).length };
}

/**
 * Sets `owned` on every slot holding the coin and recounts the set's progress. A slot that
 * becomes un-owned also loses its grade (the API deletes the row and its grade).
 */
export function applyOwnershipToGaps(gaps: GapViewResponse, coinId: string, owned: boolean): GapViewResponse {
  let changed = false;
  const slots = gaps.slots.map((slot) => {
    if (slot.coin.id !== coinId || slot.owned === owned) return slot;
    changed = true;
    return withNeedsUpgrade(owned ? { ...slot, owned } : { ...slot, owned, grade: null }, gaps.minGrade);
  });
  if (!changed) return gaps;

  const ownedCount = slots.filter((slot) => slot.owned).length;
  return withUpgradeCount({
    ...gaps,
    slots,
    ownedCount,
    completionPercent: completionPercent(ownedCount, gaps.totalCount),
  });
}

/**
 * Sets `grade` on every owned slot holding the coin. Counts and completion never change;
 * `needsUpgrade` / `upgradeCount` are recomputed only when the set has a minGrade.
 */
export function applyGradeToGaps(gaps: GapViewResponse, coinId: string, grade: CoinGrade | null): GapViewResponse {
  let changed = false;
  const slots = gaps.slots.map((slot) => {
    if (slot.coin.id !== coinId || !slot.owned || slot.grade === grade) return slot;
    changed = true;
    return withNeedsUpgrade({ ...slot, grade }, gaps.minGrade);
  });
  if (!changed) return gaps;
  return withUpgradeCount({ ...gaps, slots });
}

/** Sets `grade` on the coin's collection item; same reference when unlisted or unchanged. */
export function applyGradeToCollection(
  items: OwnershipItem[],
  coinId: string,
  grade: CoinGrade | null,
): OwnershipItem[] {
  const index = items.findIndex((item) => item.coinId === coinId);
  if (index === -1 || items[index].grade === grade) return items;
  const next = items.slice();
  next[index] = { ...items[index], grade };
  return next;
}

function matchesCollectionFilters(coin: CatalogCoin, filters: CollectionFilters): boolean {
  if (filters.country !== undefined && filters.country !== '' && coin.country !== filters.country) return false;
  if (filters.year !== undefined && coin.year !== filters.year) return false;
  return true;
}

/**
 * Removes the coin when it became missing; prepends it (the API orders by ownedAt desc) when it
 * became owned, isn't listed yet and matches the list's filters. Otherwise unchanged.
 */
export function applyOwnershipToCollection(
  items: OwnershipItem[],
  coinId: string,
  owned: boolean,
  coin: CatalogCoin | null,
  filters: CollectionFilters,
  ownedAt: Date,
): OwnershipItem[] {
  if (!owned) {
    if (!items.some((item) => item.coinId === coinId)) return items;
    return items.filter((item) => item.coinId !== coinId);
  }
  if (coin === null) return items;
  if (items.some((item) => item.coinId === coinId)) return items;
  if (!matchesCollectionFilters(coin, filters)) return items;
  // Prepended only for a coin with no Ownership row, so it starts ungraded.
  return [{ coinId, coin, ownedAt, grade: null }, ...items];
}

/**
 * A hideOwned catalog list drops a coin that just became owned. Otherwise, a signed-in page
 * whose item carries a boolean `owned` gets that one item's `owned` updated (`inSetsCount` is
 * left to the refetch). Items without an `owned` key (signed-out pages) are left alone.
 */
export function applyOwnershipToCatalogPage<T extends CatalogListItem>(
  page: PaginatedResponse<T>,
  coinId: string,
  owned: boolean,
  filters: CatalogFilters,
): PaginatedResponse<T> {
  if (filters.hideOwned === true && owned) {
    if (!page.items.some((coin) => coin.id === coinId)) return page;
    return {
      ...page,
      items: page.items.filter((coin) => coin.id !== coinId),
      total: Math.max(0, page.total - 1),
    };
  }

  const index = page.items.findIndex((coin) => coin.id === coinId);
  if (index === -1) return page;
  const item = page.items[index];
  if (typeof item.owned !== 'boolean' || item.owned === owned) return page;

  const items = page.items.slice();
  items[index] = { ...item, owned };
  return { ...page, items };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** True for useCatalog's `['catalog', filters]` list keys, not the coin, facets or "mine" keys. */
export function isCatalogListKey(key: readonly unknown[]): boolean {
  return key.length === 2 && key[0] === 'catalog' && isPlainObject(key[1]);
}
