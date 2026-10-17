import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type {
  CreateSetRequestBody,
  GapViewResponse,
  PatchSetCoinsRequest,
  UserSetCoinSummary,
  UserSetSummary,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { removeCoinsFromGaps } from '@/lib/set-page';
import { createSet, deleteSet, getSetGaps, getUserSets, patchSetCoins, renameSet } from '@/lib/user-sets-api';

// `enabled` lets a public page skip this authenticated call for an anonymous visitor
// (see useCollection).
export function useUserSets({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['user-sets'],
    queryFn: getUserSets,
    enabled,
  });
}

export function useSetGaps(id: string) {
  return useQuery<GapViewResponse>({
    queryKey: ['user-sets', id, 'gaps'],
    queryFn: () => getSetGaps(id),
    enabled: Boolean(id),
  });
}

export function useCreateSet() {
  const queryClient = useQueryClient();
  return useMutation<UserSetSummary, ApiError, CreateSetRequestBody>({
    mutationFn: (body) => createSet(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
    },
  });
}

export function useRenameSet() {
  const queryClient = useQueryClient();
  return useMutation<UserSetSummary, ApiError, { id: string; name: string }>({
    mutationFn: ({ id, name }) => renameSet(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
    },
  });
}

export function useDeleteSet() {
  const queryClient = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => deleteSet(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
    },
  });
}

interface PatchSetCoinsContext {
  previousGaps?: GapViewResponse;
}

/**
 * Adds or removes coins in a set. `remove` is optimistic: the slots leave the cached gap view
 * at once and come back if the request fails. `add` waits for the server (the new slot's
 * position and coin detail come from the refetch).
 */
export function usePatchSetCoins(setId: string) {
  const queryClient = useQueryClient();
  const gapsKey = ['user-sets', setId, 'gaps'];
  return useMutation<UserSetCoinSummary[], ApiError, PatchSetCoinsRequest, PatchSetCoinsContext>({
    mutationFn: (body) => patchSetCoins(setId, body),
    onMutate: async (body) => {
      if (!body.remove || body.remove.length === 0) return {};
      await queryClient.cancelQueries({ queryKey: gapsKey });
      const previousGaps = queryClient.getQueryData<GapViewResponse>(gapsKey);
      if (previousGaps !== undefined) {
        const next = removeCoinsFromGaps(previousGaps, body.remove);
        if (next !== previousGaps) queryClient.setQueryData(gapsKey, next);
      }
      return { previousGaps };
    },
    onError: (_error, _body, context) => {
      if (context?.previousGaps !== undefined) {
        queryClient.setQueryData(gapsKey, context.previousGaps);
      }
    },
    // On settle, not only on success, so a failed remove also refetches the real state.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sets', setId, 'gaps'] });
      queryClient.invalidateQueries({ queryKey: ['public-sets', setId] });
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
    },
  });
}

/** Adds coins to any of the user's sets (the row menu's "Add to another set…"). */
export function useAddCoinsToSet(): UseMutationResult<
  UserSetCoinSummary[],
  ApiError,
  { setId: string; coinIds: string[] }
> {
  const queryClient = useQueryClient();
  return useMutation<UserSetCoinSummary[], ApiError, { setId: string; coinIds: string[] }>({
    mutationFn: ({ setId, coinIds }) => patchSetCoins(setId, { add: coinIds }),
    onSuccess: (_data, { setId }) => {
      queryClient.invalidateQueries({ queryKey: ['user-sets', setId, 'gaps'] });
      queryClient.invalidateQueries({ queryKey: ['public-sets', setId] });
    },
  });
}
