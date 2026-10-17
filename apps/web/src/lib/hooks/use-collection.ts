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
  BulkSetOwnershipResponse,
  CatalogCoin,
  GapViewResponse,
  OwnershipItem,
  PaginatedResponse,
  SetOwnershipResponse,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import type { CatalogFilters } from '@/lib/catalog-api';
import {
  getCollection,
  setOwnership,
  setOwnershipBulk,
  type CollectionFilters,
} from '@/lib/collection-api';
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

// Bulk variables carry no `coin`: newly owned coins are looked up in the cached gap views
// (or coin detail) so they can still be inserted into cached collection lists.
export type BulkSetOwnershipVariables = { coinIds: string[]; owned: boolean };

export interface UseBulkSetOwnershipOptions {
  // Hook-level, like UseSetOwnershipOptions.onSettled.
  onSettled?: (error: ApiError | null, variables: BulkSetOwnershipVariables) => void;
}

export type UseBulkSetOwnershipResult = UseMutationResult<
  BulkSetOwnershipResponse,
  ApiError,
  BulkSetOwnershipVariables,
  SetOwnershipContext
> & { failedCoinIds: ReadonlySet<string> };

interface OwnershipChange {
  coinId: string;
  owned: boolean;
  coin?: CatalogCoin | null;
}

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
 * The optimistic step shared by useSetOwnership and useBulkSetOwnership: cancels in-flight
 * refetches, snapshots every affected cache, then applies the ownership-cache patchers once per
 * change. Returns the snapshots for rollback.
 */
async function applyOptimisticOwnership(
  queryClient: QueryClient,
  changes: readonly OwnershipChange[],
): Promise<SetOwnershipContext> {
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

  // Resolve coins before patching anything, while the gap views still hold every slot.
  const resolved = changes.map((change) => ({
    ...change,
    coin: change.coin ?? findCachedCoin(queryClient, change.coinId),
  }));
  const ownedAt = new Date();

  for (const [key, initial] of collections) {
    if (initial === undefined) continue;
    const filters = (key[1] ?? {}) as CollectionFilters;
    let items = initial;
    for (const { coinId, owned, coin } of resolved) {
      items = applyOwnershipToCollection(items, coinId, owned, coin, filters, ownedAt);
    }
    if (items !== initial) queryClient.setQueryData(key, items);
  }
  for (const [key, initial] of gapViews) {
    if (initial === undefined) continue;
    let gaps = initial;
    for (const { coinId, owned } of resolved) {
      gaps = applyOwnershipToGaps(gaps, coinId, owned);
    }
    if (gaps !== initial) queryClient.setQueryData(key, gaps);
  }
  for (const [key, initial] of catalogLists) {
    if (initial === undefined) continue;
    let page = initial;
    for (const { coinId, owned } of resolved) {
      page = applyOwnershipToCatalogPage(page, coinId, owned, key[1] as CatalogFilters);
    }
    if (page !== initial) queryClient.setQueryData(key, page);
  }

  return { snapshots };
}

function restoreSnapshots(queryClient: QueryClient, context: SetOwnershipContext | undefined) {
  for (const [key, data] of context?.snapshots ?? []) {
    queryClient.setQueryData(key, data);
  }
}

// Broad prefix invalidation, not scoped to one set: a coin's ownership is
// global (PRD requirement 13), so every currently-mounted set's gap-view
// query needs to refetch, not just the one the toggle happened in.
function invalidateOwnershipQueries(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
    queryClient.invalidateQueries({ queryKey: ['collection'] }),
    queryClient.invalidateQueries({
      queryKey: ['catalog'],
      predicate: (query) => isHideOwnedCatalogListKey(query.queryKey),
    }),
  ]);
}

function useFailedCoinIds() {
  const [failedCoinIds, setFailedCoinIds] = useState<ReadonlySet<string>>(() => new Set());

  function markFailed(coinIds: readonly string[], failed: boolean) {
    setFailedCoinIds((current) => {
      if (coinIds.every((id) => current.has(id) === failed)) return current;
      const next = new Set(current);
      for (const id of coinIds) {
        if (failed) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  return { failedCoinIds, markFailed };
}

/**
 * Marks a coin owned or missing. Optimistic: the collection lists, every cached set gap view and
 * hideOwned catalog lists are patched before the request, restored from snapshots if it fails
 * (the coin then appears in `failedCoinIds`), and refetched on settle either way.
 */
export function useSetOwnership({ onSettled }: UseSetOwnershipOptions = {}): UseSetOwnershipResult {
  const queryClient = useQueryClient();
  const { failedCoinIds, markFailed } = useFailedCoinIds();

  const mutation = useMutation<SetOwnershipResponse, ApiError, SetOwnershipVariables, SetOwnershipContext>({
    mutationFn: ({ coinId, owned }) => setOwnership(coinId, owned),

    onMutate: async ({ coinId, owned, coin }) => {
      markFailed([coinId], false);
      return applyOptimisticOwnership(queryClient, [{ coinId, owned, coin }]);
    },

    onError: (_error, { coinId }, context) => {
      restoreSnapshots(queryClient, context);
      markFailed([coinId], true);
    },

    // Returning the promise makes the mutation (and onSettled) wait for the refetch,
    // so a caller that re-enables a control on settle shows the server's real state.
    onSettled: async (_data, error, variables) => {
      await invalidateOwnershipQueries(queryClient);
      onSettled?.(error ?? null, variables);
    },
  });

  return { ...mutation, failedCoinIds };
}

/**
 * Marks many coins owned or missing in one `PATCH /collection` request. Same optimistic patch,
 * rollback and invalidation as useSetOwnership, applied to every id; a failure marks every id
 * in `failedCoinIds`.
 */
export function useBulkSetOwnership({ onSettled }: UseBulkSetOwnershipOptions = {}): UseBulkSetOwnershipResult {
  const queryClient = useQueryClient();
  const { failedCoinIds, markFailed } = useFailedCoinIds();

  const mutation = useMutation<
    BulkSetOwnershipResponse,
    ApiError,
    BulkSetOwnershipVariables,
    SetOwnershipContext
  >({
    mutationFn: ({ coinIds, owned }) => setOwnershipBulk(coinIds, owned),

    onMutate: async ({ coinIds, owned }) => {
      markFailed(coinIds, false);
      return applyOptimisticOwnership(
        queryClient,
        coinIds.map((coinId) => ({ coinId, owned })),
      );
    },

    onError: (_error, { coinIds }, context) => {
      restoreSnapshots(queryClient, context);
      markFailed(coinIds, true);
    },

    onSettled: async (_data, error, variables) => {
      await invalidateOwnershipQueries(queryClient);
      onSettled?.(error ?? null, variables);
    },
  });

  return { ...mutation, failedCoinIds };
}
