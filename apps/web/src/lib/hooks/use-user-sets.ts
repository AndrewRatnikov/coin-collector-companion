import { useQuery } from '@tanstack/react-query';
import { getGapView, getUserSets } from '@/lib/user-sets-api';

export function useUserSets() {
  return useQuery({
    queryKey: ['user-sets'],
    queryFn: getUserSets,
  });
}

// ['gap', userSetId] — the 5.9 suggestion panel invalidates the bare ['gap'] prefix,
// which matches this key too (SD §3).
export function useGapView(userSetId: string) {
  return useQuery({
    queryKey: ['gap', userSetId],
    queryFn: () => getGapView(userSetId),
  });
}
