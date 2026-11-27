import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type {
  CatalogCoin,
  CatalogListItem,
  CreateCoinRequest,
  PaginatedResponse,
  SubmittedCoin,
} from '@coin-collector/shared';
import { getCatalog, getCatalogFacets, getCoin, submitCoin, type CatalogFilters } from '@/lib/catalog-api';
import { ApiError } from '@/lib/api-client';

/** Facets change only when the catalog import runs, so cache them for 5 minutes. */
export const CATALOG_FACETS_STALE_TIME = 300_000;

/**
 * Server-rendered data: use it as the cache entry and never refetch it in the browser. Without
 * it the query options stay exactly as before (the client fallback path).
 */
function serverInitialDataOptions<T>(initialData: T | undefined) {
  if (initialData === undefined) return {};
  return {
    initialData,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  } as const;
}

// keepPreviousData: while the next filters load, the previous total and list stay on screen
// instead of flickering back to a skeleton.
export function useCatalog(
  filters: CatalogFilters,
  options?: { initialData?: PaginatedResponse<CatalogListItem> },
) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => getCatalog(filters),
    placeholderData: keepPreviousData,
    ...serverInitialDataOptions(options?.initialData),
  });
}

export function useCatalogFacets(country?: string) {
  return useQuery({
    queryKey: ['catalog', 'facets', country ?? ''],
    queryFn: () => getCatalogFacets(country),
    staleTime: CATALOG_FACETS_STALE_TIME,
    placeholderData: keepPreviousData,
  });
}

export function useCoin(id: string, options?: { initialData?: CatalogCoin }) {
  return useQuery({
    queryKey: ['catalog', 'coin', id],
    queryFn: () => getCoin(id),
    enabled: Boolean(id),
    ...serverInitialDataOptions(options?.initialData),
  });
}

// No onSuccess query invalidation — a pending coin is never returned by GET /catalog
// (it's filtered to status: approved), so invalidating that query would be misleading.
export function useSubmitCoin() {
  return useMutation<CatalogCoin, ApiError, CreateCoinRequest>({
    mutationFn: (payload) => submitCoin(payload),
  });
}

// Own query key (not ['catalog', filters]) so it never collides with the plain browse cache —
// this is a distinct "my submissions, whatever their status" list, not a filtered browse view.
// The API adds `rejectionReason` to each item on this branch only, hence SubmittedCoin.
export function useMySubmissions() {
  return useQuery({
    queryKey: ['catalog', 'mine'],
    queryFn: () => getCatalog({ submittedByMe: true }) as Promise<PaginatedResponse<SubmittedCoin>>,
  });
}
