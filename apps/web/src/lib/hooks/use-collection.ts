import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SetOwnershipResponse } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { getCollection, setOwnership, type CollectionFilters } from '@/lib/collection-api';

// `enabled` lets a public page (e.g. /catalog/[coinId]) skip this authenticated call for
// an anonymous visitor instead of firing a request that can only come back 401.
export function useCollection(filters: CollectionFilters = {}, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['collection', filters],
    queryFn: () => getCollection(filters),
    enabled,
  });
}

export function useSetOwnership() {
  const queryClient = useQueryClient();
  return useMutation<SetOwnershipResponse, ApiError, { coinId: string; owned: boolean }>({
    mutationFn: ({ coinId, owned }) => setOwnership(coinId, owned),
    onSuccess: () => {
      // Broad prefix invalidation, not scoped to one set: a coin's ownership is
      // global (PRD requirement 13), so every currently-mounted set's gap-view
      // query needs to refetch, not just the one the toggle happened in.
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
      queryClient.invalidateQueries({ queryKey: ['collection'] });
    },
  });
}
