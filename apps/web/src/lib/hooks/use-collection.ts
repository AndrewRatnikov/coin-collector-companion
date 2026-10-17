import { useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';
import type {
  CatalogCoin,
  GapViewResponse,
  OwnershipItem,
  PaginatedResponse,
  SetOwnershipResponse,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import type { CatalogFilters } from '@/lib/catalog-api';
import { getCollection, setOwnership, type CollectionFilters } from '@/lib/collection-api';
import {
  applyOwnershipToCatalogPage,
  applyOwnershipToCollection,
  applyOwnershipToGaps,
  isCatalogListKey,
} from '@/lib/ownership-cache';

// `enabled` lets a public page (e.g. /catalog/[coinId]) skip this authenticated call for
// an anonymous visitor instead of firing a request that can only come back 401.
export function useCollection(filters: CollectionFilters = {}, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['collection', filters],
    queryFn: () => getCollection(filters),
    enabled,
  });
}

// `coin` is optional: when given, a newly owned coin can be inserted into cached collection
// lists right away. Without it the coin is looked up in the cached set gaps or coin detail.
export type SetOwnershipVariables = { coinId: string; owned: boolean; coin?: CatalogCoin };

export interface UseSetOwnershipOptions {
  // Hook-level, so it fires for every mutate() call with that call's variables.
  // (Callbacks passed to mutate() itself only fire for the most recent call.)
  onSettled?: (error: ApiError | null, variables: SetOwnershipVariables) => void;
}

interface SetOwnershipContext {
  snapshots: Array<[QueryKey, unknown]>;
}

export type UseSetOwnershipResult = UseMutationResult<
  SetOwnershipResponse,
  ApiError,
  SetOwnershipVariables,
  SetOwnershipContext
> & { failedCoinIds: ReadonlySet<string> };

/** `['user-sets', setId, 'gaps']`: the gap view shared by the set page, dashboard, coin page and public sets. */
function isGapsKey(key: QueryKey): boolean {
  return key.length === 3 && key[0] === 'user-sets' && key[2] === 'gaps';
}

function isHideOwnedCatalogListKey(key: QueryKey): boolean {
  return isCatalogListKey(key) && (key[1] as CatalogFilters).hideOwned === true;
}

function findCachedCoin(queryClient: QueryClient, coinId: string): CatalogCoin | null {
  for (const [, gaps] of queryClient.getQueriesData<GapViewResponse>({
    queryKey: ['user-sets'],
    predicate: (query) => isGapsKey(query.queryKey),
  })) {
    const slot = gaps?.slots.find((s) => s.coin.id === coinId);
    if (slot) return slot.coin;
  }
  return queryClient.getQueryData<CatalogCoin>(['catalog', 'coin', coinId]) ?? null;
}

/**
 * Marks a coin owned or missing. Optimistic: the collection lists, every cached set gap view and
 * hideOwned catalog lists are patched before the request, restored from snapshots if it fails
 * (the coin then appears in `failedCoinIds`), and refetched on settle either way.
 */
export function useSetOwnership({ onSettled }: UseSetOwnershipOptions = {}): UseSetOwnershipResult {
  const queryClient = useQueryClient();
  const [failedCoinIds, setFailedCoinIds] = useState<ReadonlySet<string>>(() => new Set());

  function markFailed(coinId: string, failed: boolean) {
    setFailedCoinIds((current) => {
      if (current.has(coinId) === failed) return current;
      const next = new Set(current);
      if (failed) next.add(coinId);
      else next.delete(coinId);
      return next;
    });
  }

  const mutation = useMutation<SetOwnershipResponse, ApiError, SetOwnershipVariables, SetOwnershipContext>({
    mutationFn: ({ coinId, owned }) => setOwnership(coinId, owned),

    onMutate: async ({ coinId, owned, coin }) => {
      markFailed(coinId, false);

      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['collection'] }),
        queryClient.cancelQueries({ queryKey: ['user-sets'] }),
        queryClient.cancelQueries({ queryKey: ['catalog'] }),
      ]);

      const collections = queryClient.getQueriesData<OwnershipItem[]>({ queryKey: ['collection'] });
      const gapViews = queryClient.getQueriesData<GapViewResponse>({
        queryKey: ['user-sets'],
        predicate: (query) => isGapsKey(query.queryKey),
      });
      const catalogLists = queryClient.getQueriesData<PaginatedResponse<CatalogCoin>>({
        queryKey: ['catalog'],
        predicate: (query) => isCatalogListKey(query.queryKey),
      });

      const snapshots: Array<[QueryKey, unknown]> = [...collections, ...gapViews, ...catalogLists].filter(
        ([, data]) => data !== undefined,
      );

      const knownCoin = coin ?? findCachedCoin(queryClient, coinId);
      const ownedAt = new Date();

      for (const [key, items] of collections) {
        if (items === undefined) continue;
        const filters = (key[1] ?? {}) as CollectionFilters;
        const next = applyOwnershipToCollection(items, coinId, owned, knownCoin, filters, ownedAt);
        if (next !== items) queryClient.setQueryData(key, next);
      }
      for (const [key, gaps] of gapViews) {
        if (gaps === undefined) continue;
        const next = applyOwnershipToGaps(gaps, coinId, owned);
        if (next !== gaps) queryClient.setQueryData(key, next);
      }
      for (const [key, page] of catalogLists) {
        if (page === undefined) continue;
        const next = applyOwnershipToCatalogPage(page, coinId, owned, key[1] as CatalogFilters);
        if (next !== page) queryClient.setQueryData(key, next);
      }

      return { snapshots };
    },

    onError: (_error, { coinId }, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data);
      }
      markFailed(coinId, true);
    },

    // Returning the promise makes the mutation (and onSettled) wait for the refetch,
    // so a caller that re-enables a control on settle shows the server's real state.
    onSettled: async (_data, error, variables) => {
      // Broad prefix invalidation, not scoped to one set: a coin's ownership is
      // global (PRD requirement 13), so every currently-mounted set's gap-view
      // query needs to refetch, not just the one the toggle happened in.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
        queryClient.invalidateQueries({ queryKey: ['collection'] }),
        queryClient.invalidateQueries({
          queryKey: ['catalog'],
          predicate: (query) => isHideOwnedCatalogListKey(query.queryKey),
        }),
      ]);
      onSettled?.(error ?? null, variables);
    },
  });

  return { ...mutation, failedCoinIds };
}
