import type { OwnershipItem, SetOwnershipResponse } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export interface CollectionFilters {
  country?: string;
  year?: number;
}

export async function getCollection(filters: CollectionFilters = {}): Promise<OwnershipItem[]> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return apiFetch<OwnershipItem[]>(`/collection${query ? `?${query}` : ''}`);
}

export async function setOwnership(coinId: string, owned: boolean): Promise<SetOwnershipResponse> {
  return apiFetch<SetOwnershipResponse>(`/collection/${coinId}`, {
    method: 'PATCH',
    body: JSON.stringify({ owned }),
  });
}
