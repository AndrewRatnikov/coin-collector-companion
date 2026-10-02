import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminCoin, AdminCoinListItem, PaginatedResponse, ReviewCoinRequest } from '@coin-collector/shared';
import { getAdminCoins, reviewCoin } from '@/lib/admin-api';
import { ApiError } from '@/lib/api-client';

// The review page shows one page of this size with no pager: reviewed coins drop out of
// the pending list and it refetches, so a backlog drains page by page.
export const PENDING_SUBMISSIONS_LIMIT = 50;

export function usePendingSubmissions() {
  return useQuery<PaginatedResponse<AdminCoinListItem>, ApiError>({
    queryKey: ['admin', 'coins', 'pending'],
    queryFn: () => getAdminCoins({ status: 'pending', limit: PENDING_SUBMISSIONS_LIMIT }),
  });
}

export function useReviewCoin() {
  const queryClient = useQueryClient();
  return useMutation<AdminCoin, ApiError, { id: string; body: ReviewCoinRequest }>({
    mutationFn: ({ id, body }) => reviewCoin(id, body),
    onSuccess: () => {
      // The reviewed coin leaves the pending list; an approval also changes what the
      // public catalog (and the submitter's "My submissions") returns.
      queryClient.invalidateQueries({ queryKey: ['admin', 'coins'] });
      queryClient.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
}
