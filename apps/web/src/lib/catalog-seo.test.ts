/**
 * Tests for: coin and catalog metadata and JSON-LD builders (apps/web/src/lib/catalog-seo.ts)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Module: catalog-seo (CREATE),
 *                  Module: set-page-seo (MODIFY)
 * Covers criteria: #6, #7, #8, #9, #10, #13, #14 (from prd.md)
 *
 * The expected titles follow the template in plan.md § Approach §2. Fixtures were checked against the
 * real getCoinName: a key date with variety VDB is titled "1909-S VDB", a 1984-D coin with variety
 * "Type 2" is titled "Type 2".
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import type { CatalogCoin } from '@coin-collector/shared';
import { getCoinName } from '@coin-collector/shared';
import {
  CATALOG_CRUMB_NAME,
  CATALOG_DESCRIPTION,
  CATALOG_TITLE,
  COIN_FALLBACK_DESCRIPTION,
  COIN_FALLBACK_TITLE,
  buildCoinThingJsonLd,
  catalogPageMetadata,
  coinBreadcrumb,
  coinNotation,
  coinPageDescription,
  coinPageHeading,
  coinPageMetadata,
  coinPageTitle,
  hasLicensedImage,
} from '@/lib/catalog-seo';
import { EMPTY_CATALOG_VIEW_STATE, parseCatalogSearchParams } from '@/lib/catalog-view';
import {
  buildBreadcrumbJsonLd,
  coinJsonLdName,
  defaultOpenGraphImage,
  defaultTwitterImage,
  SOCIAL_IMAGE_ALT,
} from '@/lib/set-page-seo';

const ORIGIN = 'https://site.example';
const ID = '7e57c011-0000-4000-8000-000000000001';
const IMAGE = 'https://upload.wikimedia.org/vdb.jpg';

function makeCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: ID,
    country: 'United States',
    denomination: '1 Cent',
    year: 1909,
    mintMark: 'S',
    variety: 'VDB',
    name: 'Lincoln Wheat Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: true,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

const FULL = makeCoin({
  imageUrl: IMAGE,
  imageSource: 'Wikimedia Commons',
  imageLicense: 'CC BY-SA 4.0',
  diameterMm: 19.05,
  weightG: 3.11,
  thicknessMm: 1.55,
  material: 'Bronze',
  mintage: 484000,
});

const PLAIN = makeCoin({
  year: 1984,
  mintMark: 'D',
  variety: 'Type 2',
  name: 'Lincoln Memorial Cent',
  isKeyDate: false,
});

describe('constants', () => {
  it('has the fixed strings', () => {
    expect(CATALOG_TITLE).toBe('Coin catalog · Coin Companion');
    expect(CATALOG_DESCRIPTION).toBe(
      'Browse the Coin Companion coin catalog by country, denomination and year, with mintages, specs and key dates.',
    );
    expect(COIN_FALLBACK_TITLE).toBe('Catalog coin · Coin Companion');
    expect(COIN_FALLBACK_DESCRIPTION).toBe('A coin in the Coin Companion catalog.');
    expect(CATALOG_CRUMB_NAME).toBe('Catalog');
  });
});

describe('coinNotation', () => {
  it('is year-mintMark with a mint mark', () => {
    expect(coinNotation(FULL)).toBe('1909-S');
    expect(coinNotation(PLAIN)).toBe('1984-D');
  });

  it.each([[''], ['   ']])('is the bare year for the mint mark %j', (mintMark) => {
    expect(coinNotation(makeCoin({ mintMark }))).toBe('1909');
    expect(coinNotation(makeCoin({ mintMark, year: 1958 }))).toBe('1958');
  });
});

describe('coinPageHeading', () => {
  it('prefixes the collector notation to the getCoinName title', () => {
    expect(getCoinName(PLAIN).title).toBe('Type 2');
    expect(coinPageHeading(PLAIN)).toBe('1984-D Type 2');
  });

  it('does not repeat the notation when the title already starts with it (key date)', () => {
    expect(getCoinName(FULL).title).toBe('1909-S VDB');
    expect(coinPageHeading(FULL)).toBe('1909-S VDB');
  });

  it('returns the title when it equals the notation', () => {
    const coin = makeCoin({ variety: '', name: 'Lincoln Wheat Cent' });
    expect(getCoinName(coin).title).toBe('1909-S');
    expect(coinPageHeading(coin)).toBe('1909-S');
  });

  it('keeps a title that starts with the year-only notation followed by a space', () => {
    const coin = makeCoin({ mintMark: '', variety: '1955 Doubled Die Obverse', year: 1955 });
    expect(getCoinName(coin).title).toBe('1955 Doubled Die Obverse');
    expect(coinPageHeading(coin)).toBe('1955 Doubled Die Obverse');
  });

  it('returns the notation alone when there is no title', () => {
    const coin = makeCoin({ year: 1984, mintMark: '', variety: '', name: '', denomination: '', isKeyDate: false });
    expect(getCoinName(coin).title).toBe('');
    expect(coinPageHeading(coin)).toBe('1984');
  });

  it('does not use the eyebrow or the subtitle', () => {
    const { eyebrow, subtitle } = getCoinName(PLAIN);
    expect(eyebrow).not.toBe('');
    expect(coinPageHeading(PLAIN)).not.toContain(eyebrow);
    expect(coinPageHeading(PLAIN)).not.toContain(subtitle);
  });
});

describe('coinPageTitle', () => {
  it('is heading · country · denomination · brand (key date)', () => {
    expect(coinPageTitle(FULL)).toBe('1909-S VDB · United States · 1 Cent · Coin Companion');
  });

  it('follows the coin (non-key date)', () => {
    expect(coinPageTitle(PLAIN)).toBe('1984-D Type 2 · United States · 1 Cent · Coin Companion');
    expect(coinPageTitle(PLAIN)).not.toBe(coinPageTitle(FULL));
  });

  it('drops an unknown country or denomination with its separator', () => {
    expect(coinPageTitle(makeCoin({ ...PLAIN, country: '' }))).toBe('1984-D Type 2 · 1 Cent · Coin Companion');
    expect(coinPageTitle(makeCoin({ ...PLAIN, denomination: '' }))).toBe(
      '1984-D Type 2 · United States · Coin Companion',
    );
    expect(coinPageTitle(makeCoin({ ...PLAIN, country: '  ', denomination: '' }))).toBe(
      '1984-D Type 2 · Coin Companion',
    );
  });

  it('trims the country and the denomination', () => {
    expect(coinPageTitle(makeCoin({ ...PLAIN, country: ' United States ', denomination: ' 1 Cent ' }))).toBe(
      '1984-D Type 2 · United States · 1 Cent · Coin Companion',
    );
  });
});

describe('coinPageDescription', () => {
  it('lists mintage, composition and diameter when known', () => {
    expect(coinPageDescription(FULL)).toBe(
      '1909-S VDB, United States, 1 Cent. Mintage: 484,000. Composition: Bronze. Diameter: 19.05 mm.',
    );
  });

  it('has only the first sentence when nothing else is known, with no null or undefined text', () => {
    const text = coinPageDescription(PLAIN);
    expect(text).toBe('1984-D Type 2, United States, 1 Cent.');
    expect(text).not.toMatch(/null|undefined|Mintage|Composition|Diameter/);
  });

  it.each([
    ['mintage', { mintage: 1234567 }, '1984-D Type 2, United States, 1 Cent. Mintage: 1,234,567.'],
    ['composition', { material: 'Copper-nickel' }, '1984-D Type 2, United States, 1 Cent. Composition: Copper-nickel.'],
    ['diameter', { diameterMm: 24.26 }, '1984-D Type 2, United States, 1 Cent. Diameter: 24.26 mm.'],
  ])('adds only the %s sentence when only that is known', (_label, extra, expected) => {
    expect(coinPageDescription({ ...PLAIN, ...extra })).toBe(expected);
  });

  it('omits a blank composition and the weight and thickness', () => {
    const text = coinPageDescription({ ...PLAIN, material: '   ', weightG: 3.11, thicknessMm: 1.55 });
    expect(text).toBe('1984-D Type 2, United States, 1 Cent.');
  });

  it('drops an unknown country from the first sentence', () => {
    expect(coinPageDescription({ ...PLAIN, country: '' })).toBe('1984-D Type 2, 1 Cent.');
  });
});

describe('hasLicensedImage', () => {
  it('needs both a non-empty image URL and a non-empty license', () => {
    expect(hasLicensedImage(FULL)).toBe(true);
    expect(hasLicensedImage(makeCoin({ imageUrl: IMAGE, imageLicense: null }))).toBe(false);
    expect(hasLicensedImage(makeCoin({ imageUrl: null, imageLicense: 'CC BY-SA 4.0' }))).toBe(false);
    expect(hasLicensedImage(makeCoin({ imageUrl: IMAGE, imageLicense: '   ' }))).toBe(false);
    expect(hasLicensedImage(makeCoin({ imageUrl: '  ', imageLicense: 'CC BY-SA 4.0' }))).toBe(false);
    expect(hasLicensedImage(PLAIN)).toBe(false);
  });
});

describe('default social images', () => {
  it('are built from the origin', () => {
    expect(defaultOpenGraphImage(ORIGIN)).toEqual({
      url: `${ORIGIN}/opengraph-image.png`,
      width: 1200,
      height: 630,
      alt: SOCIAL_IMAGE_ALT,
    });
    expect(defaultTwitterImage(ORIGIN)).toEqual({ url: `${ORIGIN}/twitter-image.png`, alt: SOCIAL_IMAGE_ALT });
    expect(defaultOpenGraphImage('https://other.example').url).toBe('https://other.example/opengraph-image.png');
  });
});

describe('coinPageMetadata with a coin', () => {
  it('has the title, description and the absolute canonical URL', () => {
    const meta = coinPageMetadata(ID, FULL, ORIGIN);

    expect(meta.title).toBe(coinPageTitle(FULL));
    expect(meta.description).toBe(coinPageDescription(FULL));
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog/${ID}`);
  });

  it('uses the coin image and a summary card when the image is licensed', () => {
    const meta = coinPageMetadata(ID, FULL, ORIGIN);

    expect(meta.openGraph).toEqual({
      title: coinPageTitle(FULL),
      description: coinPageDescription(FULL),
      url: `${ORIGIN}/catalog/${ID}`,
      type: 'website',
      images: [{ url: IMAGE, alt: '1909-S VDB' }],
    });
    expect(meta.twitter).toEqual({
      card: 'summary',
      title: coinPageTitle(FULL),
      description: coinPageDescription(FULL),
      images: [{ url: IMAGE, alt: '1909-S VDB' }],
    });
  });

  it('trims the image URL', () => {
    const meta = coinPageMetadata(ID, { ...FULL, imageUrl: `  ${IMAGE} ` }, ORIGIN);

    expect(meta.openGraph).toMatchObject({ images: [{ url: IMAGE }] });
  });

  it.each([
    ['no image', makeCoin()],
    ['an image without a license', makeCoin({ imageUrl: IMAGE, imageSource: 'Somewhere', imageLicense: null })],
  ])('uses the site default images and a large card with %s', (_label, coin) => {
    const meta = coinPageMetadata(ID, coin, ORIGIN);

    expect(meta.openGraph).toMatchObject({ images: [defaultOpenGraphImage(ORIGIN)] });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: coinPageTitle(coin),
      description: coinPageDescription(coin),
      images: [defaultTwitterImage(ORIGIN)],
    });
    expect(JSON.stringify(meta)).not.toContain(IMAGE);
  });

  it('has no robots key unless asked', () => {
    expect(coinPageMetadata(ID, FULL, ORIGIN)).not.toHaveProperty('robots');
    expect(coinPageMetadata(ID, FULL, ORIGIN, {})).not.toHaveProperty('robots');
    expect(coinPageMetadata(ID, FULL, ORIGIN, { noindex: false })).not.toHaveProperty('robots');
  });

  it('adds noindex,nofollow when asked', () => {
    expect(coinPageMetadata(ID, FULL, ORIGIN, { noindex: true }).robots).toEqual({ index: false, follow: false });
  });

  it('follows the id and the origin, and encodes the id', () => {
    expect(coinPageMetadata('a b', FULL, 'https://other.example').alternates?.canonical).toBe(
      'https://other.example/catalog/a%20b',
    );
  });
});

describe('coinPageMetadata without a coin (fallback)', () => {
  it('has the fixed title and description, the canonical URL and the default images', () => {
    const meta = coinPageMetadata(ID, null, ORIGIN);

    expect(meta.title).toBe(COIN_FALLBACK_TITLE);
    expect(meta.description).toBe(COIN_FALLBACK_DESCRIPTION);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog/${ID}`);
    expect(meta.openGraph).toEqual({
      title: COIN_FALLBACK_TITLE,
      description: COIN_FALLBACK_DESCRIPTION,
      url: `${ORIGIN}/catalog/${ID}`,
      type: 'website',
      images: [defaultOpenGraphImage(ORIGIN)],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: COIN_FALLBACK_TITLE,
      description: COIN_FALLBACK_DESCRIPTION,
      images: [defaultTwitterImage(ORIGIN)],
    });
    expect(meta).not.toHaveProperty('robots');
  });

  it('adds noindex,nofollow when asked', () => {
    expect(coinPageMetadata(ID, null, ORIGIN, { noindex: true }).robots).toEqual({ index: false, follow: false });
  });
});

describe('catalogPageMetadata', () => {
  const plain = catalogPageMetadata(EMPTY_CATALOG_VIEW_STATE, ORIGIN);

  it('is indexable with a self canonical for the plain catalog', () => {
    expect(plain.title).toBe(CATALOG_TITLE);
    expect(plain.description).toBe(CATALOG_DESCRIPTION);
    expect(plain.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
    expect(plain).not.toHaveProperty('robots');
  });

  it('repeats the title, description, URL and the default images in Open Graph and Twitter', () => {
    expect(plain.openGraph).toEqual({
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      url: `${ORIGIN}/catalog`,
      type: 'website',
      images: [defaultOpenGraphImage(ORIGIN)],
    });
    expect(plain.twitter).toEqual({
      card: 'summary_large_image',
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      images: [defaultTwitterImage(ORIGIN)],
    });
  });

  it.each([
    ['a country', { country: 'USA' }],
    ['a denomination', { denominations: ['1 Cent'] }],
    ['a search term', { name: 'wheat' }],
    ['a year', { yearMin: 1900 }],
    ['key dates only', { keyDateOnly: true }],
    ['a non-default sort', { sort: 'year_desc' as const }],
    ['page 2', { page: 2 }],
  ])('is noindex,follow with the plain canonical for %s', (_label, change) => {
    const meta = catalogPageMetadata({ ...EMPTY_CATALOG_VIEW_STATE, ...change }, ORIGIN);

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
    expect(meta.openGraph).toMatchObject({ url: `${ORIGIN}/catalog` });
    expect(meta.title).toBe(CATALOG_TITLE);
  });

  it.each([['utm_source=x'], ['sort=bogus'], ['page=1'], ['sort=year_asc'], ['country=']])(
    'stays indexable for ?%s',
    (query) => {
      const meta = catalogPageMetadata(parseCatalogSearchParams(new URLSearchParams(query)), ORIGIN);

      expect(meta).not.toHaveProperty('robots');
    },
  );

  it('uses the origin it is given', () => {
    expect(catalogPageMetadata(EMPTY_CATALOG_VIEW_STATE, 'https://other.example').alternates?.canonical).toBe(
      'https://other.example/catalog',
    );
  });
});

describe('coinBreadcrumb', () => {
  it('is Catalog > country > denomination > coin with site-relative paths', () => {
    expect(coinBreadcrumb(FULL)).toEqual([
      { name: 'Catalog', path: '/catalog' },
      { name: 'United States', path: '/catalog?country=United+States' },
      { name: '1 Cent', path: '/catalog?country=United+States&denomination=1+Cent' },
      { name: '1909-S VDB', path: `/catalog/${ID}` },
    ]);
  });

  it('omits the country and denomination crumbs without a country', () => {
    expect(coinBreadcrumb(makeCoin({ country: '' }))).toEqual([
      { name: 'Catalog', path: '/catalog' },
      { name: '1909-S VDB', path: `/catalog/${ID}` },
    ]);
    expect(coinBreadcrumb(makeCoin({ country: '   ' }))).toHaveLength(2);
  });

  it('omits only the denomination crumb without a denomination', () => {
    const crumbs = coinBreadcrumb(makeCoin({ denomination: '  ' }));

    expect(crumbs.map((c) => c.name)).toEqual(['Catalog', 'United States', coinPageHeading(makeCoin({ denomination: '  ' }))]);
  });

  it('trims the country and denomination values', () => {
    const crumbs = coinBreadcrumb(makeCoin({ country: ' United States ', denomination: ' 1 Cent ' }));

    expect(crumbs[1]).toEqual({ name: 'United States', path: '/catalog?country=United+States' });
    expect(crumbs[2]).toEqual({ name: '1 Cent', path: '/catalog?country=United+States&denomination=1+Cent' });
  });

  it('encodes the coin id in the last path', () => {
    expect(coinBreadcrumb(makeCoin({ id: 'a b' })).at(-1)?.path).toBe('/catalog/a%20b');
  });

  it('turns into absolute, gap-free positions through buildBreadcrumbJsonLd', () => {
    const json = buildBreadcrumbJsonLd(coinBreadcrumb(makeCoin({ country: '' })), ORIGIN) as {
      itemListElement: { position: number; name: string; item: string }[];
    };

    expect(json.itemListElement.map((e) => e.position)).toEqual([1, 2]);
    expect(json.itemListElement.map((e) => e.item)).toEqual([`${ORIGIN}/catalog`, `${ORIGIN}/catalog/${ID}`]);
  });
});

describe('buildCoinThingJsonLd', () => {
  it('is a Thing with name, url, image and every known property in order', () => {
    expect(buildCoinThingJsonLd(FULL, ORIGIN)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: coinJsonLdName(FULL),
      url: `${ORIGIN}/catalog/${ID}`,
      image: IMAGE,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Year', value: 1909 },
        { '@type': 'PropertyValue', name: 'Mint mark', value: 'S' },
        { '@type': 'PropertyValue', name: 'Variety', value: 'VDB' },
        { '@type': 'PropertyValue', name: 'Mintage', value: 484000 },
        { '@type': 'PropertyValue', name: 'Composition', value: 'Bronze' },
        { '@type': 'PropertyValue', name: 'Diameter', value: 19.05, unitCode: 'MMT', unitText: 'mm' },
        { '@type': 'PropertyValue', name: 'Weight', value: 3.11, unitCode: 'GRM', unitText: 'g' },
      ],
    });
  });

  it('names the coin with the shared JSON-LD name', () => {
    const json = buildCoinThingJsonLd(FULL, ORIGIN) as { name: string };

    expect(json.name).toBe(coinJsonLdName(FULL));
    expect(json.name).toContain('VDB');
  });

  it('keeps only the year for a coin with nothing else known, and has no image key', () => {
    const json = buildCoinThingJsonLd(makeCoin({ year: 1984, mintMark: '', variety: '' }), ORIGIN) as {
      additionalProperty: unknown[];
    };

    expect(json.additionalProperty).toEqual([{ '@type': 'PropertyValue', name: 'Year', value: 1984 }]);
    expect(json).not.toHaveProperty('image');
  });

  it('has no image key when the image is not licensed', () => {
    expect(buildCoinThingJsonLd(makeCoin({ imageUrl: IMAGE }), ORIGIN)).not.toHaveProperty('image');
  });

  it('leaves out blank text values and the thickness', () => {
    const json = buildCoinThingJsonLd(makeCoin({ mintMark: ' ', variety: '  ', material: ' ', thicknessMm: 1.55 }), ORIGIN) as {
      additionalProperty: { name: string }[];
    };

    expect(json.additionalProperty.map((p) => p.name)).toEqual(['Year']);
  });

  it('includes a property only when it is known (different coins, different lists)', () => {
    const names = (coin: CatalogCoin) =>
      (buildCoinThingJsonLd(coin, ORIGIN) as { additionalProperty: { name: string }[] }).additionalProperty.map(
        (p) => p.name,
      );

    expect(names(makeCoin({ mintage: 5 }))).toEqual(['Year', 'Mint mark', 'Variety', 'Mintage']);
    expect(names(makeCoin({ weightG: 2.5, material: 'Silver' }))).toEqual([
      'Year',
      'Mint mark',
      'Variety',
      'Composition',
      'Weight',
    ]);
  });

  it('builds the URL from the origin', () => {
    expect(buildCoinThingJsonLd(FULL, 'https://other.example')).toMatchObject({
      url: `https://other.example/catalog/${ID}`,
    });
  });

  it('carries no offers, ratings, reviews or Product type', () => {
    const text = JSON.stringify([buildCoinThingJsonLd(FULL, ORIGIN), buildBreadcrumbJsonLd(coinBreadcrumb(FULL), ORIGIN)]);

    expect(text).not.toMatch(/Product|offers|aggregateRating|review/i);
  });
});
