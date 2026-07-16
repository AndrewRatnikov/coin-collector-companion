import { useQuery } from '@tanstack/react-query';
import { getUserSets } from '@/lib/user-sets-api';

export function useUserSets() {
  return useQuery({
    queryKey: ['user-sets'],
    queryFn: getUserSets,
  });
}
