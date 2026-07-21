import type { PaginatedResponse, UserSetDetail, UserSetSummary } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export interface PublicSetsFilters {
  page?: number;
  limit?: number;
}

export async function getPublicSets(filters: PublicSetsFilters = {}): Promise<PaginatedResponse<UserSetSummary>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return apiFetch<PaginatedResponse<UserSetSummary>>(`/sets/public${query ? `?${query}` : ''}`);
}

export async function getPublicSet(id: string): Promise<UserSetDetail> {
  return apiFetch<UserSetDetail>(`/sets/public/${id}`);
}
