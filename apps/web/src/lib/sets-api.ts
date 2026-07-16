import type { Denomination } from '@coin-collector/shared';
import { apiFetch } from './api-client';

// Mirrors apps/api's SetListItem/ActivatedUserSet (not in packages/shared's contracts.ts —
// those cover only the non-obvious payload shapes per SD §4).
export interface SetListItem {
  id: string;
  name: string;
  category: string;
  denomination: Denomination;
  isTemplate: boolean;
  createdAt: string;
}

export interface ActivatedUserSet {
  id: string;
  userId: string;
  setId: string;
  activatedAt: string;
}

export function getSets(isTemplate?: boolean): Promise<SetListItem[]> {
  const query = isTemplate === undefined ? '' : `?isTemplate=${isTemplate}`;
  return apiFetch<SetListItem[]>(`/sets${query}`);
}

export function activateSet(id: string): Promise<ActivatedUserSet> {
  return apiFetch<ActivatedUserSet>(`/sets/${id}/activate`, { method: 'POST' });
}
