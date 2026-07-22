import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateSetRequestBody,
  GapViewResponse,
  PatchSetCoinsRequest,
  UserSetCoinSummary,
  UserSetSummary,
} from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { createSet, deleteSet, getSetGaps, getUserSets, patchSetCoins, renameSet } from '@/lib/user-sets-api';

export function useUserSets() {
  return useQuery({
    queryKey: ['user-sets'],
    queryFn: getUserSets,
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

export function usePatchSetCoins(setId: string) {
  const queryClient = useQueryClient();
  return useMutation<UserSetCoinSummary[], ApiError, PatchSetCoinsRequest>({
    mutationFn: (body) => patchSetCoins(setId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-sets', setId, 'gaps'] });
      queryClient.invalidateQueries({ queryKey: ['public-sets', setId] });
    },
  });
}
