import type { Metadata } from 'next';
import {
  getCoinName,
  type CanonicalSetDetail,
  type CatalogCoin,
  type UserSetDetail,
} from '@coin-collector/shared';

/**
 * Titles, descriptions, metadata and JSON-LD for the checklist list, checklist detail and public
 * set pages. Pure: every absolute URL is built from the `origin` argument (pages pass siteOrigin()).
 */

export const SITE_BRAND = 'Coin Companion';
export const CHECKLISTS_TITLE = `Coin checklists · ${SITE_BRAND}`;
export const CHECKLISTS_DESCRIPTION =
  'Browse curated coin checklists on Coin Companion and track which coins you own and which are missing.';
export const CANONICAL_SET_FALLBACK_TITLE = `Coin checklist · ${SITE_BRAND}`;
export const CANONICAL_SET_FALLBACK_DESCRIPTION = 'Coin checklist on Coin Companion.';
export const PUBLIC_SET_FALLBACK_TITLE = `Public coin set · ${SITE_BRAND}`;
export const PUBLIC_SET_FALLBACK_DESCRIPTION = 'Public coin set on Coin Companion.';
export const PUBLIC_SET_DESCRIPTION_SUFFIX = 'Public coin set shared on Coin Companion.';
/** Same text as app/opengraph-image.alt.txt. */
export const SOCIAL_IMAGE_ALT = "See what you're still missing. Free checklists for coin collectors.";

const CHECKLISTS_NAME = 'Coin checklists';
const CHECKLISTS_PATH = '/sets/canonical';
const PUBLIC_SETS_PATH = '/sets/public';

export interface BreadcrumbItem {
  name: string;
  /** Site-relative, starts with '/'. */
  path: string;
}

export function setPageTitle(name: string): string {
  return `${name.trim()} checklist · ${SITE_BRAND}`;
}

export function coinCountAndYears(coins: ReadonlyArray<{ coin: { year: number } }>): string {
  if (coins.length === 0) return '0 coins.';
  const count = coins.length === 1 ? '1 coin' : `${coins.length} coins`;
  let min = coins[0].coin.year;
  let max = min;
  for (const { coin } of coins) {
    if (coin.year < min) min = coin.year;
    if (coin.year > max) max = coin.year;
  }
  const years = min === max ? String(min) : `${min}-${max}`;
  return `${count}, ${years}.`;
}

export function canonicalSetDescription(set: CanonicalSetDetail): string {
  const counts = coinCountAndYears(set.coins);
  const description = set.description?.trim() ?? '';
  return description ? `${counts} ${description}` : counts;
}

export function publicSetDescription(set: UserSetDetail): string {
  return `${coinCountAndYears(set.coins)} ${PUBLIC_SET_DESCRIPTION_SUFFIX}`;
}

/**
 * Next replaces a parent's openGraph/twitter wholesale and merges the root file images only at
 * the root segment, so each page repeats the static social images explicitly.
 */
function pageMetadata(title: string, description: string, path: string, origin: string): Metadata {
  const url = `${origin}${path}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [{ url: `${origin}/opengraph-image.png`, width: 1200, height: 630, alt: SOCIAL_IMAGE_ALT }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: `${origin}/twitter-image.png`, alt: SOCIAL_IMAGE_ALT }],
    },
  };
}

function canonicalSetPath(id: string): string {
  return `${CHECKLISTS_PATH}/${encodeURIComponent(id)}`;
}

function publicSetPath(id: string): string {
  return `${PUBLIC_SETS_PATH}/${encodeURIComponent(id)}`;
}

export function canonicalListMetadata(origin: string): Metadata {
  return pageMetadata(CHECKLISTS_TITLE, CHECKLISTS_DESCRIPTION, CHECKLISTS_PATH, origin);
}

export function canonicalSetMetadata(id: string, set: CanonicalSetDetail | null, origin: string): Metadata {
  const path = canonicalSetPath(id);
  if (!set) {
    return pageMetadata(CANONICAL_SET_FALLBACK_TITLE, CANONICAL_SET_FALLBACK_DESCRIPTION, path, origin);
  }
  return pageMetadata(setPageTitle(set.name), canonicalSetDescription(set), path, origin);
}

export function publicSetMetadata(id: string, set: UserSetDetail | null, origin: string): Metadata {
  const path = publicSetPath(id);
  if (!set) {
    return pageMetadata(PUBLIC_SET_FALLBACK_TITLE, PUBLIC_SET_FALLBACK_DESCRIPTION, path, origin);
  }
  return pageMetadata(setPageTitle(set.name), publicSetDescription(set), path, origin);
}

const HOME_CRUMB: BreadcrumbItem = { name: 'Home', path: '/' };

export function canonicalListBreadcrumb(): BreadcrumbItem[] {
  return [{ ...HOME_CRUMB }, { name: CHECKLISTS_NAME, path: CHECKLISTS_PATH }];
}

export function canonicalSetBreadcrumb(id: string, name: string): BreadcrumbItem[] {
  return [...canonicalListBreadcrumb(), { name, path: canonicalSetPath(id) }];
}

export function publicSetBreadcrumb(id: string, name: string): BreadcrumbItem[] {
  return [{ ...HOME_CRUMB }, { name: 'Public sets', path: PUBLIC_SETS_PATH }, { name, path: publicSetPath(id) }];
}

export function coinJsonLdName(coin: CatalogCoin): string {
  const { eyebrow, title, subtitle } = getCoinName(coin);
  return [eyebrow, title, subtitle].filter((part) => part !== '').join(' · ');
}

export function buildBreadcrumbJsonLd(items: ReadonlyArray<BreadcrumbItem>, origin: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${origin}${it.path}`,
    })),
  };
}

export function buildCoinItemListJsonLd(
  coins: ReadonlyArray<{ position: number; coin: CatalogCoin }>,
  origin: string,
): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    numberOfItems: coins.length,
    itemListElement: [...coins]
      .sort((a, b) => a.position - b.position)
      .map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: coinJsonLdName(c.coin),
        url: `${origin}/catalog/${c.coin.id}`,
      })),
  };
}

export function buildChecklistsCollectionPageJsonLd(origin: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: CHECKLISTS_NAME,
    url: `${origin}${CHECKLISTS_PATH}`,
    description: CHECKLISTS_DESCRIPTION,
  };
}
