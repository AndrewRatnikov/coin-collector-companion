import type { Metadata } from 'next';
import { getCoinName, type CatalogCoin } from '@coin-collector/shared';
import { isPlainCatalogView, type CatalogViewState } from '@/lib/catalog-view';
import { catalogCountryHref, catalogDenominationHref } from '@/lib/coin-page';
import {
  SITE_BRAND,
  coinJsonLdName,
  defaultOpenGraphImage,
  defaultTwitterImage,
  type BreadcrumbItem,
} from '@/lib/set-page-seo';

/**
 * Titles, descriptions, metadata and JSON-LD for the catalog and coin pages. Pure: every absolute
 * URL is built from the `origin` argument (pages pass siteOrigin()). The structured data is a
 * BreadcrumbList and a schema.org Thing with PropertyValues: the site sells nothing and has no
 * ratings, so it claims neither.
 */

const SEPARATOR = ' · ';

export const CATALOG_TITLE = `Coin catalog${SEPARATOR}${SITE_BRAND}`;
export const CATALOG_DESCRIPTION =
  'Browse the Coin Companion coin catalog by country, denomination and year, with mintages, specs and key dates.';
export const COIN_FALLBACK_TITLE = `Catalog coin${SEPARATOR}${SITE_BRAND}`;
export const COIN_FALLBACK_DESCRIPTION = 'A coin in the Coin Companion catalog.';
export const CATALOG_CRUMB_NAME = 'Catalog';

const CATALOG_PATH = '/catalog';

const numberFormat = new Intl.NumberFormat('en-US');

function coinPath(id: string): string {
  return `${CATALOG_PATH}/${encodeURIComponent(id)}`;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? '').trim();
}

/** Collector notation: `1909-S`, or the bare year without a mint mark. */
export function coinNotation(coin: Pick<CatalogCoin, 'year' | 'mintMark'>): string {
  const mintMark = cleanText(coin.mintMark);
  return mintMark === '' ? String(coin.year) : `${coin.year}-${mintMark}`;
}

/** The notation followed by the shared coin title, without repeating the notation. */
export function coinPageHeading(coin: CatalogCoin): string {
  const title = getCoinName(coin).title.trim();
  const notation = coinNotation(coin);
  if (title === '') return notation;
  if (title === notation || title.startsWith(`${notation} `)) return title;
  return `${notation} ${title}`;
}

function headingParts(coin: CatalogCoin): string[] {
  return [coinPageHeading(coin), cleanText(coin.country), cleanText(coin.denomination)].filter(
    (part) => part !== '',
  );
}

/** `1909-S VDB · United States · 1 Cent · Coin Companion`; unknown parts are dropped. */
export function coinPageTitle(coin: CatalogCoin): string {
  return `${headingParts(coin).join(SEPARATOR)}${SEPARATOR}${SITE_BRAND}`;
}

/** One sentence for the coin, then one per known spec: mintage, composition, diameter. */
export function coinPageDescription(coin: CatalogCoin): string {
  const sentences = [`${headingParts(coin).join(', ')}.`];
  if (coin.mintage != null) sentences.push(`Mintage: ${numberFormat.format(coin.mintage)}.`);
  const material = cleanText(coin.material);
  if (material !== '') sentences.push(`Composition: ${material}.`);
  if (coin.diameterMm != null) sentences.push(`Diameter: ${numberFormat.format(coin.diameterMm)} mm.`);
  return sentences.join(' ');
}

/** The coin has an image URL and a recorded license for it. */
export function hasLicensedImage(coin: Pick<CatalogCoin, 'imageUrl' | 'imageLicense'>): boolean {
  return Boolean(coin.imageUrl?.trim() && coin.imageLicense?.trim());
}

export function coinPageMetadata(
  id: string,
  coin: CatalogCoin | null,
  origin: string,
  options?: { noindex?: boolean },
): Metadata {
  const url = `${origin}${coinPath(id)}`;
  const title = coin ? coinPageTitle(coin) : COIN_FALLBACK_TITLE;
  const description = coin ? coinPageDescription(coin) : COIN_FALLBACK_DESCRIPTION;

  const coinImage =
    coin && hasLicensedImage(coin) ? { url: (coin.imageUrl ?? '').trim(), alt: coinPageHeading(coin) } : null;

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      images: [coinImage ?? defaultOpenGraphImage(origin)],
    },
    twitter: {
      card: coinImage ? 'summary' : 'summary_large_image',
      title,
      description,
      images: [coinImage ?? defaultTwitterImage(origin)],
    },
  };
  if (options?.noindex) metadata.robots = { index: false, follow: false };
  return metadata;
}

/**
 * Only the plain catalog is indexable. Every filtered, sorted or paged view is noindex,follow
 * and points its canonical at /catalog.
 */
export function catalogPageMetadata(state: CatalogViewState, origin: string): Metadata {
  const url = `${origin}${CATALOG_PATH}`;
  const metadata: Metadata = {
    title: CATALOG_TITLE,
    description: CATALOG_DESCRIPTION,
    alternates: { canonical: url },
    openGraph: {
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      url,
      type: 'website',
      images: [defaultOpenGraphImage(origin)],
    },
    twitter: {
      card: 'summary_large_image',
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      images: [defaultTwitterImage(origin)],
    },
  };
  if (!isPlainCatalogView(state)) metadata.robots = { index: false, follow: true };
  return metadata;
}

/** Catalog > country > denomination > coin, with site-relative paths. */
export function coinBreadcrumb(coin: CatalogCoin): BreadcrumbItem[] {
  const country = cleanText(coin.country);
  const denomination = cleanText(coin.denomination);
  const items: BreadcrumbItem[] = [{ name: CATALOG_CRUMB_NAME, path: CATALOG_PATH }];
  if (country !== '') {
    items.push({ name: country, path: catalogCountryHref(country) });
    if (denomination !== '') {
      items.push({ name: denomination, path: catalogDenominationHref(country, denomination) });
    }
  }
  items.push({ name: coinPageHeading(coin), path: coinPath(coin.id) });
  return items;
}

type PropertyValue = {
  '@type': 'PropertyValue';
  name: string;
  value: string | number;
  unitCode?: string;
  unitText?: string;
};

function propertyValue(name: string, value: string | number, unit?: { code: string; text: string }): PropertyValue {
  const entry: PropertyValue = { '@type': 'PropertyValue', name, value };
  if (unit) {
    entry.unitCode = unit.code;
    entry.unitText = unit.text;
  }
  return entry;
}

/** A schema.org Thing for the coin, with one PropertyValue per known fact. */
export function buildCoinThingJsonLd(coin: CatalogCoin, origin: string): object {
  const properties: PropertyValue[] = [propertyValue('Year', coin.year)];
  const mintMark = cleanText(coin.mintMark);
  if (mintMark !== '') properties.push(propertyValue('Mint mark', mintMark));
  const variety = cleanText(coin.variety);
  if (variety !== '') properties.push(propertyValue('Variety', variety));
  if (coin.mintage != null) properties.push(propertyValue('Mintage', coin.mintage));
  const material = cleanText(coin.material);
  if (material !== '') properties.push(propertyValue('Composition', material));
  if (coin.diameterMm != null) {
    properties.push(propertyValue('Diameter', coin.diameterMm, { code: 'MMT', text: 'mm' }));
  }
  if (coin.weightG != null) properties.push(propertyValue('Weight', coin.weightG, { code: 'GRM', text: 'g' }));

  const json: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Thing',
    name: coinJsonLdName(coin),
    url: `${origin}${coinPath(coin.id)}`,
  };
  if (hasLicensedImage(coin)) json.image = (coin.imageUrl ?? '').trim();
  json.additionalProperty = properties;
  return json;
}
