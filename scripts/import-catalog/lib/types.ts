// Shape of the raw, pre-sanitization fixture JSON under ../fixtures/*.json
// (see fixtures/README.md) — mintMark/variety may still be null/placeholder
// strings here; import-coins.ts is what normalizes them before they reach Prisma.

export interface RawCoinImage {
  url: string;
  source?: string | null;
  license?: string | null;
  // Wikimedia Commons `imageinfo`/`extmetadata` fields (docs/catalog-data-licensing.md §2) —
  // an image only clears the import gate if it's untagged as copyrighted, or explicitly
  // marked as not requiring attribution (CC0 and similar).
  copyrighted?: boolean;
  attributionRequired?: boolean;
}

export interface RawCoinEntry {
  year: number;
  mintMark?: string | null;
  variety?: string | null;
  // Not stored: v2's `Coin` model has no key-date column (that was a v1 `SetSlot`
  // concept). Carried in fixtures for future canonical-set/seed-template authoring,
  // not for this task.
  isKeyDate?: boolean;
  image?: RawCoinImage | null;
}

export interface RawFixtureFile {
  country: string;
  denomination: string;
  name: string;
  coins: RawCoinEntry[];
}
