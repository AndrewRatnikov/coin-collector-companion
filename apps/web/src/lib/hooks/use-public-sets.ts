import { useQuery } from '@tanstack/react-query';
import { getPublicSet, getPublicSets, type PublicSetsFilters } from '@/lib/public-sets-api';

export function usePublicSets(filters: PublicSetsFilters = {}) {
  return useQuery({
    queryKey: ['public-sets', filters],
    queryFn: () => getPublicSets(filters),
  });
}

export function usePublicSet(id: string) {
  return useQuery({
    queryKey: ['public-sets', id],
    queryFn: () => getPublicSet(id),
    enabled: Boolean(id),
  });
}
