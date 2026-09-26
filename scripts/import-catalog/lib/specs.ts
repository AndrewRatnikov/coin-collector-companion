import type { RawCoinEntry, RawFixtureFile } from './types';

export interface CoinSpecFields {
  diameterMm: number | null;
  weightG: number | null;
  thicknessMm: number | null;
  material: string | null;
  mintage: number | null;
  isKeyDate: boolean;
}

// Per-coin specs win over file-level ones field by field, so a coin only needs to
// list what actually differs. `undefined` falls through to the file default; an
// explicit `null` on the coin means "unknown for this coin" and does not.
export function toSpecFields(file: Pick<RawFixtureFile, 'specs'>, entry: RawCoinEntry): CoinSpecFields {
  const merged = { ...file.specs, ...entry.specs };
  return {
    diameterMm: merged.diameterMm ?? null,
    weightG: merged.weightG ?? null,
    thicknessMm: merged.thicknessMm ?? null,
    material: merged.material?.trim() || null,
    mintage: entry.mintage ?? null,
    isKeyDate: entry.isKeyDate ?? false,
  };
}
