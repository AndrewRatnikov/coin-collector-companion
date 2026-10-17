// Pure patchers behind the optimistic ownership toggle (useSetOwnership). Each one returns a
// new value when something changes and the same reference when nothing does; none mutates
// its input. The settle-time invalidation still refetches the real server state.

import type { CatalogCoin, GapViewResponse, OwnershipItem, PaginatedResponse } from '@coin-collector/shared';
import type { CatalogFilters } from '@/lib/catalog-api';
import type { CollectionFilters } from '@/lib/collection-api';

/** Same rounding as the API's gap view (sets.service.ts). */
function completionPercent(ownedCount: number, totalCount: number): number {
  return totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
}

/** Sets `owned` on every slot holding the coin and recounts the set's progress. */
export function applyOwnershipToGaps(gaps: GapViewResponse, coinId: string, owned: boolean): GapViewResponse {
  let changed = false;
  const slots = gaps.slots.map((slot) => {
    if (slot.coin.id !== coinId || slot.owned === owned) return slot;
    changed = true;
    return { ...slot, owned };
  });
  if (!changed) return gaps;

  const ownedCount = slots.filter((slot) => slot.owned).length;
  return {
    ...gaps,
    slots,
    ownedCount,
    completionPercent: completionPercent(ownedCount, gaps.totalCount),
  };
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
  return [{ coinId, coin, ownedAt }, ...items];
}

/** A hideOwned catalog list drops a coin that just became owned. Every other list is unchanged. */
export function applyOwnershipToCatalogPage(
  page: PaginatedResponse<CatalogCoin>,
  coinId: string,
  owned: boolean,
  filters: CatalogFilters,
): PaginatedResponse<CatalogCoin> {
  if (filters.hideOwned !== true || !owned) return page;
  if (!page.items.some((coin) => coin.id === coinId)) return page;
  return {
    ...page,
    items: page.items.filter((coin) => coin.id !== coinId),
    total: Math.max(0, page.total - 1),
  };
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
