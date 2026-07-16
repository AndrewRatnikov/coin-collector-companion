import type { CoinDto, CoinMutationResponse, Denomination, Grade } from '@coin-collector/shared';
import { apiFetch } from './api-client';

// Mirrors apps/api's CreateCoinDto/UpdateCoinDto (both forms send every field, so one
// shape covers create and update — PATCH's undefined-vs-null distinction only matters
// when a caller omits a field, which this form never does).
export interface CoinInput {
  denomination: Denomination;
  year: number;
  mintMark: string | null;
  country: string;
  grade: Grade | null;
  purchasePrice: string | null;
  notes: string | null;
  acquiredDate: string | null;
}

export function getCoins(): Promise<CoinDto[]> {
  return apiFetch<CoinDto[]>('/coins');
}

export function createCoin(input: CoinInput): Promise<CoinMutationResponse> {
  return apiFetch<CoinMutationResponse>('/coins', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// PATCH /coins/:id returns the bare coin, or a CoinMutationResponse when the match key
// changed (SD §4) — the 5.9 suggestion panel is what will branch on that, not this form.
export function updateCoin(id: string, input: CoinInput): Promise<CoinDto | CoinMutationResponse> {
  return apiFetch<CoinDto | CoinMutationResponse>(`/coins/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCoin(id: string): Promise<void> {
  return apiFetch<void>(`/coins/${id}`, { method: 'DELETE' });
}
