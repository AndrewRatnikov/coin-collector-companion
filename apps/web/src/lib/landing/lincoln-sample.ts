import type { CatalogCoin, GapSlot } from '@coin-collector/shared';

/**
 * Static Lincoln Wheat Cents sample for the signed-out landing page: 24 coins, 1909-1916,
 * 16 owned. Pure data, no network.
 */
export const LINCOLN_SAMPLE_SET_NAME = 'Lincoln Wheat Cents';
export const LINCOLN_SAMPLE_CSV_NAME = 'Lincoln Wheat Cents sample';

const SAMPLE_DATE = '2026-11-16T00:00:00Z';

interface SampleEntry {
  year: number;
  mintMark: string;
  variety: string;
}

const ENTRIES: SampleEntry[] = [
  { year: 1909, mintMark: '', variety: '' },
  { year: 1909, mintMark: '', variety: 'VDB' },
  { year: 1909, mintMark: 'S', variety: '' },
  { year: 1909, mintMark: 'S', variety: 'VDB' },
  { year: 1910, mintMark: '', variety: '' },
  { year: 1910, mintMark: 'S', variety: '' },
  ...[1911, 1912, 1913, 1914, 1915, 1916].flatMap((year) =>
    ['', 'D', 'S'].map((mintMark) => ({ year, mintMark, variety: '' })),
  ),
];

function sampleId({ year, mintMark, variety }: SampleEntry): string {
  return `sample-${[String(year), mintMark, variety].filter(Boolean).join('-')}`;
}

export const LINCOLN_SAMPLE_KEY_DATE_IDS: ReadonlySet<string> = new Set([
  'sample-1909-S-VDB',
  'sample-1909-S',
  'sample-1914-D',
]);

const MISSING_IDS: ReadonlySet<string> = new Set([
  'sample-1909-S-VDB',
  'sample-1909-S',
  'sample-1910-S',
  'sample-1912-S',
  'sample-1914-D',
  'sample-1914-S',
  'sample-1915-S',
  'sample-1916-S',
]);

function sampleCoin(entry: SampleEntry): CatalogCoin {
  const id = sampleId(entry);
  return {
    id,
    country: 'United States',
    denomination: '1 Cent',
    year: entry.year,
    mintMark: entry.mintMark,
    variety: entry.variety,
    name: 'Lincoln Wheat Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: 'Bronze',
    mintage: null,
    isKeyDate: LINCOLN_SAMPLE_KEY_DATE_IDS.has(id),
    status: 'approved',
    submittedAt: null,
    createdAt: new Date(SAMPLE_DATE),
    updatedAt: new Date(SAMPLE_DATE),
  };
}

export const LINCOLN_SAMPLE_SLOTS: GapSlot[] = ENTRIES.map((entry, index) => {
  const coin = sampleCoin(entry);
  return { id: coin.id, position: index + 1, coin, owned: !MISSING_IDS.has(coin.id), grade: null };
});

/** The 1909-1912 slice shown on narrow screens: 8 of 12 owned. */
export const LINCOLN_SAMPLE_MOBILE_SLOTS: GapSlot[] = LINCOLN_SAMPLE_SLOTS.slice(0, 12);

/** "1909", "1909 VDB", "1909-S", "1909-S VDB". */
export function collectorLabel(coin: Pick<CatalogCoin, 'year' | 'mintMark' | 'variety'>): string {
  return `${coin.year}${coin.mintMark ? `-${coin.mintMark}` : ''}${coin.variety ? ` ${coin.variety}` : ''}`;
}
