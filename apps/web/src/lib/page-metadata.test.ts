/**
 * Tests for: metadata output per public page type (backlog item 3.8)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Root layout (MODIFY),
 *                  Module: catalog-seo, Module: set-page-seo
 * Covers criteria: #14, #16 (from prd.md)
 *
 * Uses the real builders for every page type: landing (the root layout's metadata), checklist list,
 * checklist detail, public set, catalog and coin.
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it, vi } from 'vitest';
import type { CatalogCoin } from '@coin-collector/shared';

vi.mock('next/font/google', () => ({
  Cormorant_Garamond: () => ({ variable: 'a' }),
  IBM_Plex_Sans: () => ({ variable: 'b' }),
  IBM_Plex_Mono: () => ({ variable: 'c' }),
}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { metadata as landingMetadata } from '@/app/layout';
import { catalogPageMetadata, coinPageMetadata } from '@/lib/catalog-seo';
import { EMPTY_CATALOG_VIEW_STATE } from '@/lib/catalog-view';
import enLanding from '@/lib/i18n/locales/en/landing';
import {
  canonicalListMetadata,
  canonicalSetMetadata,
  defaultOpenGraphImage,
  defaultTwitterImage,
  publicSetMetadata,
  SITE_BRAND,
} from '@/lib/set-page-seo';

const ORIGIN = 'https://site.example';
const COIN_ID = '7e57c011-0000-4000-8000-000000000001';

const COIN: CatalogCoin = {
  id: COIN_ID,
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: 19.05,
  weightG: null,
  thicknessMm: null,
  material: 'Bronze',
  mintage: 484000,
  isKeyDate: true,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const CHECKLIST = {
  id: 'c-1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [{ id: 'slot-1', position: 0, coin: COIN }],
} as never;

const PUBLIC_SET = {
  id: 'p-1',
  userId: 'u-1',
  name: 'My Wheat Cents',
  coins: [{ id: 'slot-1', position: 0, coin: COIN }],
} as never;

const PAGE_TYPES = [
  ['checklist list', canonicalListMetadata(ORIGIN), `${ORIGIN}/sets/canonical`],
  ['checklist detail', canonicalSetMetadata('c-1', CHECKLIST, ORIGIN), `${ORIGIN}/sets/canonical/c-1`],
  ['public set', publicSetMetadata('p-1', PUBLIC_SET, ORIGIN), `${ORIGIN}/sets/public/p-1`],
  ['catalog', catalogPageMetadata(EMPTY_CATALOG_VIEW_STATE, ORIGIN), `${ORIGIN}/catalog`],
  ['coin', coinPageMetadata(COIN_ID, COIN, ORIGIN), `${ORIGIN}/catalog/${COIN_ID}`],
] as const;

describe('metadata per page type', () => {
  it.each(PAGE_TYPES)('%s: has a branded title, a description and a self canonical', (_name, meta, canonical) => {
    expect(typeof meta.title).toBe('string');
    expect(meta.title as string).toMatch(new RegExp(` · ${SITE_BRAND}$`));
    expect(typeof meta.description).toBe('string');
    expect((meta.description as string).length).toBeGreaterThan(10);
    expect(meta.alternates?.canonical).toBe(canonical);
    expect(meta).not.toHaveProperty('robots');
  });

  it.each(PAGE_TYPES)('%s: Open Graph and Twitter repeat the title, description and URL', (_name, meta, canonical) => {
    expect(meta.openGraph).toMatchObject({
      title: meta.title,
      description: meta.description,
      url: canonical,
      type: 'website',
    });
    expect(meta.twitter).toMatchObject({ title: meta.title, description: meta.description });
  });

  it.each(PAGE_TYPES)('%s: carries a social image in Open Graph and in Twitter', (_name, meta) => {
    const og = meta.openGraph as { images?: { url: string }[] };
    const tw = meta.twitter as { images?: { url: string }[] };
    expect(og.images).toHaveLength(1);
    expect(tw.images).toHaveLength(1);
    expect(og.images?.[0].url.startsWith(`${ORIGIN}/`)).toBe(true);
    expect(tw.images?.[0].url.startsWith(`${ORIGIN}/`)).toBe(true);
  });

  it('gives every page type a different title, description and canonical', () => {
    expect(new Set(PAGE_TYPES.map(([, meta]) => meta.title)).size).toBe(PAGE_TYPES.length);
    expect(new Set(PAGE_TYPES.map(([, meta]) => meta.description)).size).toBe(PAGE_TYPES.length);
    expect(new Set(PAGE_TYPES.map(([, meta]) => meta.alternates?.canonical)).size).toBe(PAGE_TYPES.length);
  });

  it('uses the site default images for the checklist, public set and catalog pages', () => {
    for (const index of [0, 1, 2, 3]) {
      const meta = PAGE_TYPES[index][1];
      expect(meta.openGraph).toMatchObject({ images: [defaultOpenGraphImage(ORIGIN)] });
      expect(meta.twitter).toMatchObject({ images: [defaultTwitterImage(ORIGIN)] });
    }
  });

  it('uses the coin image for a coin with a licensed image, and the default for one without', () => {
    const licensed = coinPageMetadata(
      COIN_ID,
      { ...COIN, imageUrl: 'https://upload.wikimedia.org/vdb.jpg', imageLicense: 'CC BY-SA 4.0' },
      ORIGIN,
    );
    expect(licensed.openGraph).toMatchObject({ images: [{ url: 'https://upload.wikimedia.org/vdb.jpg' }] });
    expect(coinPageMetadata(COIN_ID, COIN, ORIGIN).openGraph).toMatchObject({
      images: [defaultOpenGraphImage(ORIGIN)],
    });
  });

  it('follows the origin on every page type', () => {
    const other = 'https://other.example';
    expect(canonicalListMetadata(other).alternates?.canonical).toBe(`${other}/sets/canonical`);
    expect(canonicalSetMetadata('c-1', CHECKLIST, other).alternates?.canonical).toBe(`${other}/sets/canonical/c-1`);
    expect(publicSetMetadata('p-1', PUBLIC_SET, other).alternates?.canonical).toBe(`${other}/sets/public/p-1`);
    expect(catalogPageMetadata(EMPTY_CATALOG_VIEW_STATE, other).alternates?.canonical).toBe(`${other}/catalog`);
    expect(coinPageMetadata(COIN_ID, COIN, other).alternates?.canonical).toBe(`${other}/catalog/${COIN_ID}`);
  });
});

describe('metadata for pages that are not indexable', () => {
  it('marks a filtered catalog noindex,follow with the plain canonical', () => {
    const meta = catalogPageMetadata({ ...EMPTY_CATALOG_VIEW_STATE, country: 'USA' }, ORIGIN);

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
  });

  it('marks the coin fallback noindex,nofollow when asked, with fixed text instead of coin data', () => {
    const meta = coinPageMetadata(COIN_ID, null, ORIGIN, { noindex: true });

    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(meta)).not.toContain('VDB');
    expect(JSON.stringify(meta)).not.toContain('484,000');
  });
});

describe('landing metadata (root layout)', () => {
  it('has the site title and description', () => {
    expect(landingMetadata.title).toBe('Coin Collector Companion');
    expect(landingMetadata.description).toBe(enLanding['landing.metaDescription']);
  });

  it('has Open Graph defaults: type, site name, title and description', () => {
    expect(landingMetadata.openGraph).toMatchObject({
      type: 'website',
      siteName: SITE_BRAND,
      title: 'Coin Collector Companion',
      description: enLanding['landing.metaDescription'],
    });
  });

  it('has Twitter defaults with a large card', () => {
    expect(landingMetadata.twitter).toMatchObject({
      card: 'summary_large_image',
      title: 'Coin Collector Companion',
      description: enLanding['landing.metaDescription'],
    });
  });

  it('sets no images, URL or canonical, so every page that does not override them inherits nothing wrong', () => {
    expect(landingMetadata.openGraph).not.toHaveProperty('images');
    expect(landingMetadata.openGraph).not.toHaveProperty('url');
    expect(landingMetadata.twitter).not.toHaveProperty('images');
    expect(landingMetadata.alternates).toBeUndefined();
  });
});
