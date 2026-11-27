import { useQuery } from '@tanstack/react-query';
import type { UserSetDetail } from '@coin-collector/shared';
import { getPublicSet, getPublicSets, type PublicSetsFilters } from '@/lib/public-sets-api';

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

export function usePublicSets(filters: PublicSetsFilters = {}) {
  return useQuery({
    queryKey: ['public-sets', filters],
    queryFn: () => getPublicSets(filters),
  });
}

export function usePublicSet(id: string, options?: { initialData?: UserSetDetail }) {
  return useQuery({
    queryKey: ['public-sets', id],
    queryFn: () => getPublicSet(id),
    enabled: Boolean(id),
    ...serverInitialDataOptions(options?.initialData),
  });
}
