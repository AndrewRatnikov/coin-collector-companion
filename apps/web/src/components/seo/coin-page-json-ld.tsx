import type { CatalogCoin } from '@coin-collector/shared';
import { serializeJsonLd } from '@/components/seo/website-json-ld';
import { buildCoinThingJsonLd, coinBreadcrumb } from '@/lib/catalog-seo';
import { buildBreadcrumbJsonLd } from '@/lib/set-page-seo';
import { siteOrigin } from '@/lib/site-url';

/**
 * schema.org structured data for a coin page: a BreadcrumbList (Catalog > country > denomination
 * > coin) and a Thing with the coin's specs as PropertyValues. No hooks and no 'use client', so it
 * renders on the server with the page.
 */
export function CoinPageJsonLd({ coin }: { coin: CatalogCoin }) {
  const origin = siteOrigin();
  return (
    <>
      <script
        type="application/ld+json"
        data-testid="coin-breadcrumb-json-ld"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBreadcrumbJsonLd(coinBreadcrumb(coin), origin)) }}
      />
      <script
        type="application/ld+json"
        data-testid="coin-thing-json-ld"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildCoinThingJsonLd(coin, origin)) }}
      />
    </>
  );
}
