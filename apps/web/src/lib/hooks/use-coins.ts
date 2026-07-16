import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CoinInput, createCoin, deleteCoin, getCoins, updateCoin } from '@/lib/coins-api';

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
