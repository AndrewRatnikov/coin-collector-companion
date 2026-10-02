import type {
  AdminCoin,
  AdminCoinListItem,
  CoinStatus,
  PaginatedResponse,
  ReviewCoinRequest,
} from '@coin-collector/shared';
import { apiFetch } from './api-client';

export interface AdminCoinsParams {
  status?: CoinStatus;
  page?: number;
  limit?: number;
}

// GET /admin/coins. A non-admin gets an ApiError with status 403 (apiFetch only
// special-cases 401), which the review page renders as its "not authorized" state.
export async function getAdminCoins(params: AdminCoinsParams = {}): Promise<PaginatedResponse<AdminCoinListItem>> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return apiFetch<PaginatedResponse<AdminCoinListItem>>(`/admin/coins${query ? `?${query}` : ''}`);
}

// PATCH /admin/coins/:id: approve or reject a pending coin, optionally with edits.
export async function reviewCoin(id: string, body: ReviewCoinRequest): Promise<AdminCoin> {
  return apiFetch<AdminCoin>(`/admin/coins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
