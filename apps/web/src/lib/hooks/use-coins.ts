import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteCoin, getCoins } from '@/lib/coins-api';

export function useCoins() {
  return useQuery({
    queryKey: ['coins'],
    queryFn: getCoins,
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
