import type { CanonicalSetSummary, UserSetListItem } from '@coin-collector/shared';

// Pure helpers for the My sets page (/dashboard): sorting, the closest-to-complete set,
// popular checklists for the empty state, and where a set was cloned from.

export type MySetsSort = 'closest' | 'recent' | 'name' | 'most-missing';

export const MY_SETS_SORTS: readonly MySetsSort[] = ['closest', 'recent', 'name', 'most-missing'];

export const DEFAULT_MY_SETS_SORT: MySetsSort = 'closest';

function compareIds(a: { id: string }, b: { id: string }): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

// Name, then id, so every sort is deterministic.
function compareNames(a: { id: string; name: string }, b: { id: string; name: string }): number {
  return a.name.localeCompare(b.name, 'en') || compareIds(a, b);
}

// 0: incomplete with coins, 1: complete, 2: no coins.
function closestGroup(set: UserSetListItem): 0 | 1 | 2 {
  if (set.totalCount === 0) return 2;
  return set.ownedCount === set.totalCount ? 1 : 0;
}

function compareClosest(a: UserSetListItem, b: UserSetListItem): number {
  const groupA = closestGroup(a);
  const groupB = closestGroup(b);
  if (groupA !== groupB) return groupA - groupB;
  if (groupA === 0) {
    // Ratio descending without division: a.owned / a.total vs b.owned / b.total.
    const byRatio = b.ownedCount * a.totalCount - a.ownedCount * b.totalCount;
    if (byRatio !== 0) return byRatio;
  }
  return compareNames(a, b);
}

// The JSON response carries updatedAt as an ISO string at runtime, so read it through Date.
function updatedTime(set: UserSetListItem): number {
  return new Date(set.updatedAt).getTime();
}

function compareRecent(a: UserSetListItem, b: UserSetListItem): number {
  return updatedTime(b) - updatedTime(a) || compareNames(a, b);
}

function compareMostMissing(a: UserSetListItem, b: UserSetListItem): number {
  const missingA = a.totalCount - a.ownedCount;
  const missingB = b.totalCount - b.ownedCount;
  return missingB - missingA || compareNames(a, b);
}

const COMPARATORS: Record<MySetsSort, (a: UserSetListItem, b: UserSetListItem) => number> = {
  closest: compareClosest,
  recent: compareRecent,
  name: compareNames,
  'most-missing': compareMostMissing,
};

/** A new array of the sets in the given order; the input is left untouched. */
export function sortMySets(sets: readonly UserSetListItem[], sort: MySetsSort): UserSetListItem[] {
  return [...sets].sort(COMPARATORS[sort]);
}

/** The incomplete set (with at least one coin) nearest to complete, or null when there is none. */
export function getClosestToComplete(sets: readonly UserSetListItem[]): UserSetListItem | null {
  const [first] = sortMySets(sets, 'closest');
  return first && closestGroup(first) === 0 ? first : null;
}

/** The checklists with the most coins (ties by name, then id), at most `limit`. */
export function getPopularChecklists(
  checklists: readonly CanonicalSetSummary[],
  limit = 3,
): CanonicalSetSummary[] {
  return [...checklists]
    .sort((a, b) => b.coinCount - a.coinCount || compareNames(a, b))
    .slice(0, limit);
}

/** Where a set came from: a curated checklist, another collector's set, or neither. */
export function getSetSourceKind(
  set: Pick<UserSetListItem, 'clonedFromCanonicalId' | 'clonedFromUserSetId'>,
): 'curated' | 'collector' | null {
  if (set.clonedFromCanonicalId) return 'curated';
  if (set.clonedFromUserSetId) return 'collector';
  return null;
}
