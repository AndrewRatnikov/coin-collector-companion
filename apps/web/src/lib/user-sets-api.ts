import type { GapViewResponse, UserSetSummary } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export function getUserSets(): Promise<UserSetSummary[]> {
  return apiFetch<UserSetSummary[]>('/user-sets');
}

export function getGapView(userSetId: string): Promise<GapViewResponse> {
  return apiFetch<GapViewResponse>(`/user-sets/${userSetId}/gap`);
}
