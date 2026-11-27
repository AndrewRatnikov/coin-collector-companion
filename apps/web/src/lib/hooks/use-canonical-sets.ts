import { useQuery } from '@tanstack/react-query';
import type { CanonicalSetDetail, CanonicalSetSummary } from '@coin-collector/shared';
import { getCanonicalSet, getCanonicalSets } from '@/lib/canonical-sets-api';

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

export function useCanonicalSets(options?: { initialData?: CanonicalSetSummary[] }) {
  return useQuery({
    queryKey: ['canonical-sets'],
    queryFn: getCanonicalSets,
    ...serverInitialDataOptions(options?.initialData),
  });
}

export function useCanonicalSet(id: string, options?: { initialData?: CanonicalSetDetail }) {
  return useQuery({
    queryKey: ['canonical-sets', id],
    queryFn: () => getCanonicalSet(id),
    enabled: Boolean(id),
    ...serverInitialDataOptions(options?.initialData),
  });
}
