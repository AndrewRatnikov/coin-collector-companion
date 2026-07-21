import type { CreateSetRequestBody, GapViewResponse, UserSetSummary } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export async function getUserSets(): Promise<UserSetSummary[]> {
  return apiFetch<UserSetSummary[]>('/sets');
}

export async function createSet(body: CreateSetRequestBody): Promise<UserSetSummary> {
  return apiFetch<UserSetSummary>('/sets', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function renameSet(id: string, name: string): Promise<UserSetSummary> {
  return apiFetch<UserSetSummary>(`/sets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function deleteSet(id: string): Promise<void> {
  return apiFetch<void>(`/sets/${id}`, { method: 'DELETE' });
}

export async function getSetGaps(id: string): Promise<GapViewResponse> {
  return apiFetch<GapViewResponse>(`/sets/${id}/gaps`);
}
