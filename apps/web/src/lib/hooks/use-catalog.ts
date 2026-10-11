import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type { CatalogCoin, CreateCoinRequest, PaginatedResponse, SubmittedCoin } from '@coin-collector/shared';
import { getCatalog, getCatalogFacets, getCoin, submitCoin, type CatalogFilters } from '@/lib/catalog-api';
import { ApiError } from '@/lib/api-client';

/** Facets change only when the catalog import runs, so cache them for 5 minutes. */
export const CATALOG_FACETS_STALE_TIME = 300_000;

// keepPreviousData: while the next filters load, the previous total and list stay on screen
// instead of flickering back to a skeleton.
export function useCatalog(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => getCatalog(filters),
    placeholderData: keepPreviousData,
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

export function useCoin(id: string) {
  return useQuery({
    queryKey: ['catalog', 'coin', id],
    queryFn: () => getCoin(id),
    enabled: Boolean(id),
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
