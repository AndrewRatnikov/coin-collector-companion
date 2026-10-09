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

export type SetOwnershipVariables = { coinId: string; owned: boolean };

export interface UseSetOwnershipOptions {
  // Hook-level, so it fires for every mutate() call with that call's variables.
  // (Callbacks passed to mutate() itself only fire for the most recent call.)
  onSettled?: (error: ApiError | null, variables: SetOwnershipVariables) => void;
}

export function useSetOwnership({ onSettled }: UseSetOwnershipOptions = {}) {
  const queryClient = useQueryClient();
  return useMutation<SetOwnershipResponse, ApiError, SetOwnershipVariables>({
    mutationFn: ({ coinId, owned }) => setOwnership(coinId, owned),
    // Returning the promise makes the mutation (and onSettled) wait for the refetch,
    // so a caller that re-enables a control on settle shows the server's new state.
    onSuccess: () =>
      // Broad prefix invalidation, not scoped to one set: a coin's ownership is
      // global (PRD requirement 13), so every currently-mounted set's gap-view
      // query needs to refetch, not just the one the toggle happened in.
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['user-sets'] }),
        queryClient.invalidateQueries({ queryKey: ['collection'] }),
      ]),
    onSettled: (_data, error, variables) => onSettled?.(error, variables),
  });
}
