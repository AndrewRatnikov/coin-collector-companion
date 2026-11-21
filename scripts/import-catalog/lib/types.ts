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

// Physical specs. Set once at file level (the common case: a coin type shares one
// spec for most years) and overridden per coin where it differs (e.g. the 1943
// steel cent). A missing field means "unknown" and imports as null.
export interface RawCoinSpecs {
  diameterMm?: number | null;
  weightG?: number | null;
  thicknessMm?: number | null;
  material?: string | null;
}

export interface RawCoinEntry {
  year: number;
  mintMark?: string | null;
  variety?: string | null;
  isKeyDate?: boolean;
  // Coins struck for this exact year/mint/variety; null when unknown or not
  // separately recorded (e.g. error varieties counted inside their parent mintage).
  mintage?: number | null;
  specs?: RawCoinSpecs;
  image?: RawCoinImage | null;
}

// One entry of a fixture file's `sources` block: where the data came from and under
// which licence. Hand-written fixtures fill type/origin/license/note; files written by
// `pnpm run generate` also record the article URL, revision id, fetch date and the
// path of the saved raw API response. import-coins.ts ignores this block.
export interface FixtureSource {
  type: string;
  origin: string;
  license: string;
  note?: string;
  url?: string;
  revisionId?: number;
  fetchedAt?: string;
  rawResponse?: string;
}

export interface RawFixtureFile {
  country: string;
  denomination: string;
  name: string;
  sources?: FixtureSource[];
  specs?: RawCoinSpecs;
  coins: RawCoinEntry[];
}
