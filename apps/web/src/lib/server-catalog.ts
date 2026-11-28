import 'server-only';

import { cache } from 'react';
import type { CatalogCoin, CatalogListItem, PaginatedResponse } from '@coin-collector/shared';
import type { CatalogFilters } from '@/lib/catalog-api';
import { catalogFiltersToQueryString } from '@/lib/catalog-view';
import { isCoinId, type CoinChecklistLink } from '@/lib/coin-page';
import {
  COIN_REVALIDATE_SECONDS,
  LIST_REVALIDATE_SECONDS,
  ServerApiError,
  serverApiGet,
} from '@/lib/server-api';
import { loadCanonicalSet, loadCanonicalSets, type ServerLoad } from '@/lib/server-sets';

/**
 * Server-side loaders for the coin and catalog pages, built like lib/server-sets.ts. They never
 * throw: the page decides what a failure means. Anonymous reads only.
 */

/** A 404 (unknown coin) or 400 (id the API's ParseUUIDPipe rejects) means the coin doesn't exist. */
function isNotFound(error: unknown): boolean {
  return (
    error instanceof ServerApiError &&
    error.kind === 'http' &&
    (error.status === 404 || error.status === 400)
  );
}

/**
 * One approved coin. A malformed id is not-found without an API call; a coin that isn't approved
 * is not-found too, and its data is dropped.
 */
export const loadCoin = cache(async (id: string): Promise<ServerLoad<CatalogCoin>> => {
  if (!isCoinId(id)) return { status: 'not-found' };
  let data: CatalogCoin;
  try {
    data = await serverApiGet<CatalogCoin>(`/catalog/${encodeURIComponent(id)}`, {
      revalidate: COIN_REVALIDATE_SECONDS,
    });
  } catch (error) {
    return isNotFound(error) ? { status: 'not-found' } : { status: 'unavailable' };
  }
  if (data?.status !== 'approved') return { status: 'not-found' };
  return { status: 'ok', data };
});

/**
 * The curated checklists that contain the coin, in list order. Best effort: a failed list gives
 * [], and a checklist whose detail fails is left out.
 */
export const loadCoinChecklists = cache(async (coinId: string): Promise<CoinChecklistLink[]> => {
  const list = await loadCanonicalSets();
  if (list.status !== 'ok') return [];
  const details = await Promise.all(list.data.map((set) => loadCanonicalSet(set.id)));
  const links: CoinChecklistLink[] = [];
  for (const detail of details) {
    if (detail.status !== 'ok') continue;
    if (detail.data.coins.some((slot) => slot.coin.id === coinId)) {
      links.push({ id: detail.data.id, name: detail.data.name });
    }
  }
  return links;
});

/** One catalog results page for these filters. Any failure is unavailable (never not-found). */
export async function loadCatalogPage(
  filters: CatalogFilters,
): Promise<ServerLoad<PaginatedResponse<CatalogListItem>>> {
  const query = catalogFiltersToQueryString(filters);
  try {
    const data = await serverApiGet<PaginatedResponse<CatalogListItem>>(
      query ? `/catalog?${query}` : '/catalog',
      { revalidate: LIST_REVALIDATE_SECONDS },
    );
    return { status: 'ok', data };
  } catch {
    return { status: 'unavailable' };
  }
}
