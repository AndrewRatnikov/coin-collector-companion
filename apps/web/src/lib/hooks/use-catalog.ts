import { useMutation, useQuery } from '@tanstack/react-query';
import type { CatalogCoin, CreateCoinRequest } from '@coin-collector/shared';
import { getCatalog, getCoin, submitCoin, type CatalogFilters } from '@/lib/catalog-api';
import { ApiError } from '@/lib/api-client';

export function useCatalog(filters: CatalogFilters) {
  return useQuery({
    queryKey: ['catalog', filters],
    queryFn: () => getCatalog(filters),
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
