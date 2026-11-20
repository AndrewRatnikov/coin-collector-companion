import { compareGrades, meetsMinGrade } from '@coin-collector/shared';
import type { CatalogCoin, CoinGrade, UpgradeWant, WantCoin, WantListResponse } from '@coin-collector/shared';

/** One UserSetCoin row of the caller, as getWantList selects it. */
export interface WantListSlotSource {
  coin: CatalogCoin;
  userSet: { id: string; name: string; minGrade: CoinGrade | null };
}

/** One Ownership row of the caller. */
export interface WantListOwnershipSource {
  coinId: string;
  grade: CoinGrade | null;
}

type SetRef = WantListSlotSource['userSet'];

function compareSetRefs(a: { id: string; name: string }, b: { id: string; name: string }): number {
  const byName = a.name.localeCompare(b.name, 'en');
  if (byName !== 0) return byName;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function toRefs(sets: SetRef[]): { id: string; name: string }[] {
  return sets.map(({ id, name }) => ({ id, name })).sort(compareSetRefs);
}

/** Catalog order: country, denomination (numeric), year, mint mark, variety, then id. */
function compareCoins(a: CatalogCoin, b: CatalogCoin): number {
  return (
    a.country.localeCompare(b.country, 'en') ||
    a.denomination.localeCompare(b.denomination, 'en', { numeric: true }) ||
    a.year - b.year ||
    a.mintMark.localeCompare(b.mintMark, 'en') ||
    a.variety.localeCompare(b.variety, 'en') ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Combined want list across the caller's sets: each coin once. Unowned coins are `missing`
 * (with every set containing them); owned coins that fail at least one set's minimum grade
 * are `upgrades` (with only the failing sets and the highest failed minimum). Pure; never
 * mutates its inputs.
 */
export function buildWantList(
  setCount: number,
  slots: WantListSlotSource[],
  ownerships: WantListOwnershipSource[],
): WantListResponse {
  const byCoin = new Map<string, { coin: CatalogCoin; sets: SetRef[] }>();
  for (const { coin, userSet } of slots) {
    const entry = byCoin.get(coin.id);
    if (!entry) {
      byCoin.set(coin.id, { coin, sets: [userSet] });
    } else if (!entry.sets.some((s) => s.id === userSet.id)) {
      entry.sets.push(userSet);
    }
  }

  const owned = new Map<string, CoinGrade | null>();
  for (const { coinId, grade } of ownerships) owned.set(coinId, grade);

  const missing: WantCoin[] = [];
  const upgrades: UpgradeWant[] = [];
  for (const { coin, sets } of byCoin.values()) {
    if (!owned.has(coin.id)) {
      missing.push({ coin, sets: toRefs(sets) });
      continue;
    }
    const grade = owned.get(coin.id) ?? null;
    let targetGrade: CoinGrade | null = null;
    const failing: SetRef[] = [];
    for (const set of sets) {
      if (set.minGrade === null || meetsMinGrade(grade, set.minGrade)) continue;
      failing.push(set);
      if (targetGrade === null || compareGrades(set.minGrade, targetGrade) > 0) targetGrade = set.minGrade;
    }
    if (targetGrade !== null) {
      upgrades.push({ coin, sets: toRefs(failing), grade, targetGrade });
    }
  }

  missing.sort((a, b) => compareCoins(a.coin, b.coin));
  upgrades.sort((a, b) => compareCoins(a.coin, b.coin));
  return { setCount, missing, upgrades };
}
