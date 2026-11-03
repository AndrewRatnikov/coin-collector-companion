import type {
  BulkSetOwnershipResponse,
  CoinGrade,
  OwnershipItem,
  SetOwnershipResponse,
} from '@coin-collector/shared';
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

/**
 * `grade` undefined sends exactly `{ owned }` (ownership toggles never send a grade key);
 * otherwise `{ owned, grade }`, with `null` kept to clear the grade.
 */
export async function setOwnership(
  coinId: string,
  owned: boolean,
  grade?: CoinGrade | null,
): Promise<SetOwnershipResponse> {
  return apiFetch<SetOwnershipResponse>(`/collection/${coinId}`, {
    method: 'PATCH',
    body: JSON.stringify(grade === undefined ? { owned } : { owned, grade }),
  });
}

/** One `PATCH /collection` for many coins: the same owned state for every id. */
export async function setOwnershipBulk(
  coinIds: string[],
  owned: boolean,
): Promise<BulkSetOwnershipResponse> {
  return apiFetch<BulkSetOwnershipResponse>('/collection', {
    method: 'PATCH',
    body: JSON.stringify({ coinIds, owned }),
  });
}
