// The /sets/new entry URL (cloneFrom, cloneFromId) and the step/option types.

export type Step = 1 | 2;
export type StartOption = 'canonical' | 'public' | 'blank';

export interface EntryParams {
  cloneFrom: 'canonical' | 'user' | null;
  cloneFromId: string;
}

export function readEntry(searchParams: { get(name: string): string | null }): EntryParams {
  const raw = searchParams.get('cloneFrom');
  const cloneFrom = raw === 'canonical' || raw === 'user' ? raw : null;
  return { cloneFrom, cloneFromId: cloneFrom ? (searchParams.get('cloneFromId') ?? '') : '' };
}
