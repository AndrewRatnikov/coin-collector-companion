// Pure helpers behind the set page (/sets/[id]): year groups, the subtitle's shared parts,
// the set's kind label, and the optimistic remove-from-set patch. No React.

import type { GapSlot, GapViewResponse, UserSetSummary } from '@coin-collector/shared';

export interface YearGroup {
  year: number;
  /** Owned slots of the year (all of them, not only the visible ones). */
  ownedCount: number;
  /** Every slot of the year. */
  totalCount: number;
  /** Visible slots, position ascending. */
  slots: GapSlot[];
  /** Missing coins of the year that are not busy, position ascending. */
  markableCoinIds: string[];
}

export interface BuildYearGroupsOptions {
  missingOnly?: boolean;
  /** Coins with a pending or failed save. */
  busyCoinIds?: ReadonlySet<string>;
}

const NO_BUSY: ReadonlySet<string> = new Set();

/**
 * Groups slots by the coin's year (ascending), slots by position inside each group. Under
 * `missingOnly` only missing slots stay visible, plus busy ones so a coin doesn't vanish
 * mid-save; groups left with nothing visible are dropped.
 */
export function buildYearGroups(slots: GapSlot[], options: BuildYearGroupsOptions = {}): YearGroup[] {
  const { missingOnly = false, busyCoinIds = NO_BUSY } = options;

  const byYear = new Map<number, GapSlot[]>();
  for (const slot of slots) {
    const list = byYear.get(slot.coin.year);
    if (list) list.push(slot);
    else byYear.set(slot.coin.year, [slot]);
  }

  const groups: YearGroup[] = [];
  for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
    const yearSlots = [...(byYear.get(year) ?? [])].sort((a, b) => a.position - b.position);
    const visible = missingOnly
      ? yearSlots.filter((slot) => !slot.owned || busyCoinIds.has(slot.coin.id))
      : yearSlots;
    if (visible.length === 0) continue;

    groups.push({
      year,
      ownedCount: yearSlots.filter((slot) => slot.owned).length,
      totalCount: yearSlots.length,
      slots: visible,
      markableCoinIds: yearSlots
        .filter((slot) => !slot.owned && !busyCoinIds.has(slot.coin.id))
        .map((slot) => slot.coin.id),
    });
  }
  return groups;
}

export type SetKind = 'curated' | 'copied' | 'own';

export function getSetKind(
  set: Pick<UserSetSummary, 'clonedFromCanonicalId' | 'clonedFromUserSetId'>,
): SetKind {
  if (set.clonedFromCanonicalId) return 'curated';
  if (set.clonedFromUserSetId) return 'copied';
  return 'own';
}

export interface SetSharedParts {
  country: string | null;
  denomination: string | null;
  /** `"2025"`, `"2025–2026"` (en dash), or null when there are no slots. */
  years: string | null;
}

function shared(values: string[]): string | null {
  if (values.length === 0) return null;
  const [first] = values;
  return values.every((value) => value === first) ? first : null;
}

export function getSetSharedParts(slots: GapSlot[]): SetSharedParts {
  if (slots.length === 0) return { country: null, denomination: null, years: null };

  const years = slots.map((slot) => slot.coin.year);
  const min = Math.min(...years);
  const max = Math.max(...years);

  return {
    country: shared(slots.map((slot) => slot.coin.country)),
    denomination: shared(slots.map((slot) => slot.coin.denomination)),
    years: min === max ? String(min) : `${min}–${max}`,
  };
}

/** Same rounding as the API's gap view (sets.service.ts). */
function completionPercent(ownedCount: number, totalCount: number): number {
  return totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
}

/** Drops the coins' slots and recounts. Same reference when nothing matched; never mutates. */
export function removeCoinsFromGaps(gaps: GapViewResponse, coinIds: readonly string[]): GapViewResponse {
  if (coinIds.length === 0) return gaps;
  const remove = new Set(coinIds);
  const slots = gaps.slots.filter((slot) => !remove.has(slot.coin.id));
  if (slots.length === gaps.slots.length) return gaps;

  const ownedCount = slots.filter((slot) => slot.owned).length;
  const totalCount = slots.length;
  return {
    ...gaps,
    slots,
    ownedCount,
    totalCount,
    completionPercent: completionPercent(ownedCount, totalCount),
  };
}
