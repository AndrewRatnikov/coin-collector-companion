/**
 * Tests for: set page SEO builders (apps/web/src/lib/set-page-seo.ts)
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Module: set-page-seo (pure)
 * Covers criteria: #5, #6, #8 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SET_FALLBACK_DESCRIPTION,
  CANONICAL_SET_FALLBACK_TITLE,
  CHECKLISTS_DESCRIPTION,
  CHECKLISTS_TITLE,
  PUBLIC_SET_DESCRIPTION_SUFFIX,
  PUBLIC_SET_FALLBACK_DESCRIPTION,
  PUBLIC_SET_FALLBACK_TITLE,
  SITE_BRAND,
  SOCIAL_IMAGE_ALT,
  buildBreadcrumbJsonLd,
  buildChecklistsCollectionPageJsonLd,
  buildCoinItemListJsonLd,
  canonicalListBreadcrumb,
  canonicalListMetadata,
  canonicalSetBreadcrumb,
  canonicalSetDescription,
  canonicalSetMetadata,
  coinCountAndYears,
  coinJsonLdName,
  publicSetBreadcrumb,
  publicSetDescription,
  publicSetMetadata,
  setPageTitle,
} from '@/lib/set-page-seo';

const ORIGIN = 'https://site.example';

function coin(id: string, year: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    isKeyDate: false,
    ...extra,
  };
}

function slot(position: number, c: ReturnType<typeof coin>) {
  return { id: `usc-${c.id}`, position, coin: c };
}

function canonicalSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    name: 'Lincoln Wheat Cents',
    description: 'Every wheat cent year',
    source: 'seed-template',
    templateVersion: 'v1',
    coins: [slot(0, coin('coin-1', 1909, { mintMark: 'S' })), slot(1, coin('coin-2', 1958))],
    ...overrides,
  };
}

function publicSet(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    userId: 'u-1',
    name: "Alice's Wheat Cents",
    coins: [slot(0, coin('coin-1', 1909)), slot(1, coin('coin-2', 1958))],
    ...overrides,
  };
}

describe('constants', () => {
  it('use the exact strings from the contract (separator is U+00B7 with spaces)', () => {
    expect(SITE_BRAND).toBe('Coin Companion');
    expect(CHECKLISTS_TITLE).toBe('Coin checklists · Coin Companion');
    expect(CHECKLISTS_DESCRIPTION).toBe(
      'Browse curated coin checklists on Coin Companion and track which coins you own and which are missing.',
    );
    expect(CANONICAL_SET_FALLBACK_TITLE).toBe('Coin checklist · Coin Companion');
    expect(CANONICAL_SET_FALLBACK_DESCRIPTION).toBe('Coin checklist on Coin Companion.');
    expect(PUBLIC_SET_FALLBACK_TITLE).toBe('Public coin set · Coin Companion');
    expect(PUBLIC_SET_FALLBACK_DESCRIPTION).toBe('Public coin set on Coin Companion.');
    expect(PUBLIC_SET_DESCRIPTION_SUFFIX).toBe('Public coin set shared on Coin Companion.');
    expect(SOCIAL_IMAGE_ALT).toBe("See what you're still missing. Free checklists for coin collectors.");
  });
});

describe('setPageTitle', () => {
  it('is "{name} checklist · Coin Companion" with the name trimmed', () => {
    expect(setPageTitle('Lincoln Wheat Cents')).toBe('Lincoln Wheat Cents checklist · Coin Companion');
    expect(setPageTitle('  Morgan Dollars ')).toBe('Morgan Dollars checklist · Coin Companion');
  });
});

describe('coinCountAndYears', () => {
  it('handles zero, one, many and same-year sets', () => {
    expect(coinCountAndYears([])).toBe('0 coins.');
    expect(coinCountAndYears([{ coin: { year: 1909 } }])).toBe('1 coin, 1909.');
    expect(coinCountAndYears([{ coin: { year: 1958 } }, { coin: { year: 1909 } }])).toBe('2 coins, 1909-1958.');
    expect(coinCountAndYears([{ coin: { year: 1943 } }, { coin: { year: 1943 } }, { coin: { year: 1943 } }])).toBe(
      '3 coins, 1943.',
    );
  });

  it('computes min-max from the data, not from the order', () => {
    const years = [1950, 1909, 1958, 1920];
    expect(coinCountAndYears(years.map((year) => ({ coin: { year } })))).toBe('4 coins, 1909-1958.');
    expect(coinCountAndYears([1960, 1971].map((year) => ({ coin: { year } })))).toBe('2 coins, 1960-1971.');
  });

  it('counts 142 coins from 1909 to 1958 as in the contract example', () => {
    const coins = Array.from({ length: 142 }, (_, i) => ({ coin: { year: i === 0 ? 1909 : i === 1 ? 1958 : 1930 } }));
    expect(coinCountAndYears(coins)).toBe('142 coins, 1909-1958.');
  });
});

describe('descriptions', () => {
  it('canonical: count and years, then the set description', () => {
    expect(canonicalSetDescription(canonicalSet() as never)).toBe('2 coins, 1909-1958. Every wheat cent year');
  });

  it('canonical: a trimmed description is used, a blank or null one is dropped', () => {
    expect(canonicalSetDescription(canonicalSet({ description: '  Spaced  ' }) as never)).toBe(
      '2 coins, 1909-1958. Spaced',
    );
    expect(canonicalSetDescription(canonicalSet({ description: '   ' }) as never)).toBe('2 coins, 1909-1958.');
    expect(canonicalSetDescription(canonicalSet({ description: null }) as never)).toBe('2 coins, 1909-1958.');
  });

  it('canonical: an empty set gives "0 coins."', () => {
    expect(canonicalSetDescription(canonicalSet({ coins: [], description: null }) as never)).toBe('0 coins.');
  });

  it('public: count and years plus the fixed suffix', () => {
    expect(publicSetDescription(publicSet() as never)).toBe(
      '2 coins, 1909-1958. Public coin set shared on Coin Companion.',
    );
    expect(publicSetDescription(publicSet({ coins: [slot(0, coin('c', 1943))] }) as never)).toBe(
      '1 coin, 1943. Public coin set shared on Coin Companion.',
    );
  });
});

function expectedMetadata(title: string, description: string, url: string) {
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: `${ORIGIN}/opengraph-image.png`, width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: `${ORIGIN}/twitter-image.png`, alt: SOCIAL_IMAGE_ALT }],
    },
  };
}

describe('canonicalListMetadata', () => {
  it('returns the exact metadata object', () => {
    expect(canonicalListMetadata(ORIGIN)).toEqual(
      expectedMetadata(CHECKLISTS_TITLE, CHECKLISTS_DESCRIPTION, `${ORIGIN}/sets/canonical`),
    );
  });

  it('follows the origin it is given', () => {
    const meta = canonicalListMetadata('https://other.example');
    expect(meta.alternates?.canonical).toBe('https://other.example/sets/canonical');
    expect(JSON.stringify(meta)).not.toContain('site.example');
  });
});

describe('canonicalSetMetadata', () => {
  it('uses the set name, the count-and-years description and a canonical URL with the id', () => {
    expect(canonicalSetMetadata('c-1', canonicalSet() as never, ORIGIN)).toEqual(
      expectedMetadata(
        'Lincoln Wheat Cents checklist · Coin Companion',
        '2 coins, 1909-1958. Every wheat cent year',
        `${ORIGIN}/sets/canonical/c-1`,
      ),
    );
  });

  it('differs for another set (derived, not hard-coded)', () => {
    const other = canonicalSet({ name: 'Morgan Dollars', description: null, coins: [slot(0, coin('m', 1921))] });
    const meta = canonicalSetMetadata('c-2', other as never, ORIGIN);
    expect(meta.title).toBe('Morgan Dollars checklist · Coin Companion');
    expect(meta.description).toBe('1 coin, 1921.');
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/canonical/c-2`);
  });

  it('encodes the id in the URL', () => {
    const meta = canonicalSetMetadata('a b/c', canonicalSet() as never, ORIGIN);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/canonical/a%20b%2Fc`);
  });

  it('falls back to the generic pair, keeping the URL, when the set is null', () => {
    expect(canonicalSetMetadata('c-1', null, ORIGIN)).toEqual(
      expectedMetadata(
        CANONICAL_SET_FALLBACK_TITLE,
        CANONICAL_SET_FALLBACK_DESCRIPTION,
        `${ORIGIN}/sets/canonical/c-1`,
      ),
    );
  });
});

describe('publicSetMetadata', () => {
  it('uses the set name and the public description', () => {
    expect(publicSetMetadata('p-1', publicSet() as never, ORIGIN)).toEqual(
      expectedMetadata(
        "Alice's Wheat Cents checklist · Coin Companion",
        '2 coins, 1909-1958. Public coin set shared on Coin Companion.',
        `${ORIGIN}/sets/public/p-1`,
      ),
    );
  });

  it('encodes the id in the URL', () => {
    const meta = publicSetMetadata('x y', publicSet() as never, ORIGIN);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/public/x%20y`);
  });

  it('falls back to the generic pair, keeping the URL, when the set is null', () => {
    expect(publicSetMetadata('p-1', null, ORIGIN)).toEqual(
      expectedMetadata(PUBLIC_SET_FALLBACK_TITLE, PUBLIC_SET_FALLBACK_DESCRIPTION, `${ORIGIN}/sets/public/p-1`),
    );
  });
});

describe('breadcrumb items', () => {
  it('list page: Home then Coin checklists', () => {
    expect(canonicalListBreadcrumb()).toEqual([
      { name: 'Home', path: '/' },
      { name: 'Coin checklists', path: '/sets/canonical' },
    ]);
  });

  it('canonical detail: Home, Coin checklists, the set', () => {
    expect(canonicalSetBreadcrumb('c 1', 'Lincoln')).toEqual([
      { name: 'Home', path: '/' },
      { name: 'Coin checklists', path: '/sets/canonical' },
      { name: 'Lincoln', path: '/sets/canonical/c%201' },
    ]);
  });

  it('public detail: Home, Public sets, the set', () => {
    expect(publicSetBreadcrumb('p1', 'Alice')).toEqual([
      { name: 'Home', path: '/' },
      { name: 'Public sets', path: '/sets/public' },
      { name: 'Alice', path: '/sets/public/p1' },
    ]);
  });
});

describe('coinJsonLdName', () => {
  it('joins eyebrow, title and subtitle with " · ", variety included', () => {
    expect(coinJsonLdName(coin('c', 1909, { mintMark: 'S', variety: 'VDB' }) as never)).toBe(
      'Lincoln Wheat Cent · VDB · USA · 1 Cent · 1909-S',
    );
  });

  it('skips the empty eyebrow', () => {
    expect(coinJsonLdName(coin('c', 1958) as never)).toBe('Lincoln Wheat Cent · USA · 1 Cent · 1958');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds a BreadcrumbList with positions from 1 and absolute URLs', () => {
    expect(buildBreadcrumbJsonLd(canonicalSetBreadcrumb('c-1', 'Lincoln'), ORIGIN)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Coin checklists', item: `${ORIGIN}/sets/canonical` },
        { '@type': 'ListItem', position: 3, name: 'Lincoln', item: `${ORIGIN}/sets/canonical/c-1` },
      ],
    });
  });

  it('has two items for the list page breadcrumb', () => {
    const data = buildBreadcrumbJsonLd(canonicalListBreadcrumb(), ORIGIN) as { itemListElement: unknown[] };
    expect(data.itemListElement).toHaveLength(2);
  });
});

describe('buildCoinItemListJsonLd', () => {
  it('lists the coins in position order with their catalog URLs, whatever the input order', () => {
    const coins = [
      { position: 2, coin: coin('coin-3', 1955, { variety: 'Doubled Die Obverse' }) },
      { position: 0, coin: coin('coin-1', 1909, { mintMark: 'S', variety: 'VDB' }) },
      { position: 1, coin: coin('coin-2', 1958) },
    ];
    expect(buildCoinItemListJsonLd(coins as never, ORIGIN)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      numberOfItems: 3,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Lincoln Wheat Cent · VDB · USA · 1 Cent · 1909-S',
          url: `${ORIGIN}/catalog/coin-1`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Lincoln Wheat Cent · USA · 1 Cent · 1958',
          url: `${ORIGIN}/catalog/coin-2`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Lincoln Wheat Cent · Doubled Die Obverse · USA · 1 Cent · 1955',
          url: `${ORIGIN}/catalog/coin-3`,
        },
      ],
    });
  });

  it('does not mutate the input array', () => {
    const coins = [
      { position: 1, coin: coin('b', 1950) },
      { position: 0, coin: coin('a', 1940) },
    ];
    buildCoinItemListJsonLd(coins as never, ORIGIN);
    expect(coins.map((c) => c.coin.id)).toEqual(['b', 'a']);
  });

  it('gives numberOfItems 0 and an empty list for a set with no coins', () => {
    expect(buildCoinItemListJsonLd([], ORIGIN)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      numberOfItems: 0,
      itemListElement: [],
    });
  });
});

describe('buildChecklistsCollectionPageJsonLd', () => {
  it('has exactly name, url and description, and no ItemList', () => {
    const data = buildChecklistsCollectionPageJsonLd(ORIGIN);
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Coin checklists',
      url: `${ORIGIN}/sets/canonical`,
      description: CHECKLISTS_DESCRIPTION,
    });
    expect(JSON.stringify(data)).not.toContain('ItemList');
  });

  it('follows the origin it is given', () => {
    expect(buildChecklistsCollectionPageJsonLd('https://two.example')).toMatchObject({
      url: 'https://two.example/sets/canonical',
    });
  });
});
