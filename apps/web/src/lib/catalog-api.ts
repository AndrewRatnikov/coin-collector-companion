import type {
  CatalogCoin,
  CatalogFacets,
  CatalogListItem,
  CatalogSort,
  CreateCoinRequest,
  PaginatedResponse,
} from '@coin-collector/shared';
import { apiFetch } from './api-client';
import { catalogFiltersToQueryString } from './catalog-view';

export interface CatalogFilters {
  country?: string;
  // An array is sent as a repeated param (?denomination=a&denomination=b), OR-ed by the API.
  denomination?: string | string[];
  name?: string;
  yearMin?: number;
  yearMax?: number;
  page?: number;
  limit?: number;
  submittedByMe?: boolean;
  keyDateOnly?: boolean;
  hideOwned?: boolean;
  sort?: CatalogSort;
}

export async function getCatalog(filters: CatalogFilters = {}): Promise<PaginatedResponse<CatalogListItem>> {
  const query = catalogFiltersToQueryString(filters);
  return apiFetch<PaginatedResponse<CatalogListItem>>(`/catalog${query ? `?${query}` : ''}`);
}

export async function getCatalogFacets(country?: string): Promise<CatalogFacets> {
  const query = country ? `?${new URLSearchParams({ country }).toString()}` : '';
  return apiFetch<CatalogFacets>(`/catalog/facets${query}`);
}

export async function getCoin(id: string): Promise<CatalogCoin> {
  return apiFetch<CatalogCoin>(`/catalog/${id}`);
}

export async function submitCoin(payload: CreateCoinRequest): Promise<CatalogCoin> {
  return apiFetch<CatalogCoin>('/catalog', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
