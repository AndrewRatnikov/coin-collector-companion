import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CoinInput, createCoin, deleteCoin, getCoins, linkCoin, updateCoin } from '@/lib/coins-api';

export function useCoins() {
  return useQuery({
    queryKey: ['coins'],
    queryFn: getCoins,
  });
}

export function useCreateCoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCoin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] });
    },
  });
}

export function useUpdateCoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CoinInput }) => updateCoin(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] });
    },
  });
}

export function useDeleteCoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCoin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coins'] });
    },
  });
}

export function useLinkCoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, slotId }: { id: string; slotId: string }) => linkCoin(id, slotId),
    onSuccess: () => {
      // ['gap'] with no second key segment invalidates every ['gap', userSetId] query
      // (TanStack Query matches invalidateQueries keys by prefix) — the confirmed slot's
      // userSetId isn't known here, only its slotId (SD §3).
      queryClient.invalidateQueries({ queryKey: ['coins'] });
      queryClient.invalidateQueries({ queryKey: ['user-sets'] });
      queryClient.invalidateQueries({ queryKey: ['gap'] });
    },
  });
}
