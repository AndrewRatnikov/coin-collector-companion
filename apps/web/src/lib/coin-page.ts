import type { CatalogCoin, GapViewResponse, UserSetSummary } from '@coin-collector/shared';
import type { Locale } from '@/lib/i18n/types';

/** The coin page's specs table rows, in display order. */
export const COIN_SPEC_KEYS = ['diameter', 'weight', 'thickness', 'material', 'mintage', 'mintMark'] as const;

export type CoinSpecKey = (typeof COIN_SPEC_KEYS)[number];

export interface CoinSpecRow {
  key: CoinSpecKey;
  /** Formatted value, or null when the catalog has nothing recorded. */
  value: string | null;
}

type SpecCoin = Pick<CatalogCoin, 'diameterMm' | 'weightG' | 'thicknessMm' | 'material' | 'mintage' | 'mintMark'>;

function textOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Always all six spec rows, in COIN_SPEC_KEYS order; numbers are formatted for the locale. */
export function getCoinSpecRows(coin: SpecCoin, locale: Locale): CoinSpecRow[] {
  const numberFormat = new Intl.NumberFormat(locale);
  const withUnit = (value: number | null, unit: string): string | null =>
    value === null ? null : `${numberFormat.format(value)}${unit}`;

  const values: Record<CoinSpecKey, string | null> = {
    diameter: withUnit(coin.diameterMm, ' mm'),
    weight: withUnit(coin.weightG, ' g'),
    thickness: withUnit(coin.thicknessMm, ' mm'),
    material: textOrNull(coin.material),
    mintage: withUnit(coin.mintage, ''),
    mintMark: textOrNull(coin.mintMark),
  };

  return COIN_SPEC_KEYS.map((key) => ({ key, value: values[key] }));
}

export interface CoinSetRow {
  id: string;
  name: string;
  loaded: boolean;
  containsCoin: boolean;
  ownedCount: number;
  totalCount: number;
  percent: number;
}

/**
 * One row per user set. `gaps` is index-aligned with `sets` (the gaps queries' data);
 * a set whose gaps haven't loaded yet is `loaded: false` with zero counts.
 */
export function getCoinSetRows(
  sets: ReadonlyArray<Pick<UserSetSummary, 'id' | 'name'>>,
  gaps: ReadonlyArray<GapViewResponse | undefined>,
  coinId: string,
): CoinSetRow[] {
  return sets.map((set, index) => {
    const view = gaps[index];
    if (view === undefined) {
      return {
        id: set.id,
        name: set.name,
        loaded: false,
        containsCoin: false,
        ownedCount: 0,
        totalCount: 0,
        percent: 0,
      };
    }
    return {
      id: set.id,
      name: set.name,
      loaded: true,
      containsCoin: view.slots.some((slot) => slot.coin.id === coinId),
      ownedCount: view.ownedCount,
      totalCount: view.totalCount,
      percent: view.completionPercent,
    };
  });
}

/** The catalog filtered to one country: `/catalog?country=United+States`. */
export function catalogCountryHref(country: string): string {
  return `/catalog?${new URLSearchParams({ country }).toString()}`;
}

export type OwnershipPanelState = 'not-owned' | 'owned' | 'pending' | 'failed';

/** Pending wins over failed, and failed over the owned value. */
export function getOwnershipPanelState({
  owned,
  pending,
  failed,
}: {
  owned: boolean;
  pending: boolean;
  failed: boolean;
}): OwnershipPanelState {
  if (pending) return 'pending';
  if (failed) return 'failed';
  return owned ? 'owned' : 'not-owned';
}
