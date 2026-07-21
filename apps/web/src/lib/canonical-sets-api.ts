import type { CanonicalSetDetail, CanonicalSetSummary } from '@coin-collector/shared';
import { apiFetch } from './api-client';

export async function getCanonicalSets(): Promise<CanonicalSetSummary[]> {
  return apiFetch<CanonicalSetSummary[]>('/sets/canonical');
}

export async function getCanonicalSet(id: string): Promise<CanonicalSetDetail> {
  return apiFetch<CanonicalSetDetail>(`/sets/canonical/${id}`);
}
