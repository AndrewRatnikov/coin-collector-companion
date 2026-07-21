import type { CatalogCoin, PaginatedResponse } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export interface CatalogFilters {
  country?: string;
  denomination?: string;
  name?: string;
  yearMin?: number;
  yearMax?: number;
  page?: number;
  limit?: number;
}

export async function getCatalog(filters: CatalogFilters = {}): Promise<PaginatedResponse<CatalogCoin>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return apiFetch<PaginatedResponse<CatalogCoin>>(`/catalog${query ? `?${query}` : ''}`);
}

export async function getCoin(id: string): Promise<CatalogCoin> {
  return apiFetch<CatalogCoin>(`/catalog/${id}`);
}
