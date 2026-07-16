import type { CoinDto } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export function getCoins(): Promise<CoinDto[]> {
  return apiFetch<CoinDto[]>('/coins');
}

export function deleteCoin(id: string): Promise<void> {
  return apiFetch<void>(`/coins/${id}`, { method: 'DELETE' });
}
