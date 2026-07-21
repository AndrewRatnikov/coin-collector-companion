import { useQuery } from '@tanstack/react-query';
import { getCanonicalSet, getCanonicalSets } from '@/lib/canonical-sets-api';

export function useCanonicalSets() {
  return useQuery({
    queryKey: ['canonical-sets'],
    queryFn: getCanonicalSets,
  });
}

export function useCanonicalSet(id: string) {
  return useQuery({
    queryKey: ['canonical-sets', id],
    queryFn: () => getCanonicalSet(id),
    enabled: Boolean(id),
  });
}
