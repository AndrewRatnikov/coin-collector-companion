import type { UserSetSummary } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export function getUserSets(): Promise<UserSetSummary[]> {
  return apiFetch<UserSetSummary[]>('/user-sets');
}
