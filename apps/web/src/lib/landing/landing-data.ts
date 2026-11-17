import type { CanonicalSetSummary } from '@coin-collector/shared';

export interface CoverageCounts {
  coins: number;
  keyDates: number;
  circulation: number;
  commemoratives: number;
}

/** Shown while the canonical sets are loading, failed, or a template is missing. */
export const COVERAGE_FALLBACKS: CoverageCounts = {
  coins: 142,
  keyDates: 7,
  circulation: 187,
  commemoratives: 31,
};

const LINCOLN_SET_NAME = 'Lincoln Wheat Cents';

const TEMPLATE_NAMES: Record<keyof CoverageCounts, string> = {
  coins: LINCOLN_SET_NAME,
  keyDates: 'Lincoln Wheat Cent Key Dates',
  circulation: 'Ukraine Circulation Coins',
  commemoratives: 'Ukrainian Circulating Commemoratives',
};

export function getCoverageCounts(
  sets: readonly Pick<CanonicalSetSummary, 'name' | 'coinCount'>[] | undefined,
): CoverageCounts {
  const countFor = (field: keyof CoverageCounts): number =>
    sets?.find((set) => set.name === TEMPLATE_NAMES[field])?.coinCount ?? COVERAGE_FALLBACKS[field];
  return {
    coins: countFor('coins'),
    keyDates: countFor('keyDates'),
    circulation: countFor('circulation'),
    commemoratives: countFor('commemoratives'),
  };
}

/** The Lincoln Wheat Cents checklist when it's known, else the checklist list. */
export function getFullChecklistHref(sets: readonly Pick<CanonicalSetSummary, 'id' | 'name'>[] | undefined): string {
  const lincoln = sets?.find((set) => set.name === LINCOLN_SET_NAME);
  return lincoln ? `/sets/canonical/${lincoln.id}` : '/sets/canonical';
}
