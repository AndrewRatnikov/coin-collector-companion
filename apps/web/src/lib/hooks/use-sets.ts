import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activateSet, getSets } from '@/lib/sets-api';

export function useTemplateSets() {
  return useQuery({
    queryKey: ['sets', { isTemplate: true }],
    queryFn: () => getSets(true),
  });
}

export function useActivateSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activateSet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sets'] });
    },
  });
}
