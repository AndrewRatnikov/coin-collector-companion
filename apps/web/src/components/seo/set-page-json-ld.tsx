import type { CatalogCoin } from '@coin-collector/shared';
import { serializeJsonLd } from '@/components/seo/website-json-ld';
import { siteOrigin } from '@/lib/site-url';
import {
  buildBreadcrumbJsonLd,
  buildChecklistsCollectionPageJsonLd,
  buildCoinItemListJsonLd,
  type BreadcrumbItem,
} from '@/lib/set-page-seo';

/**
 * schema.org structured data for the checklist and public set pages. No hooks and no
 * 'use client', so they render on the server with the page.
 */
export function SetBreadcrumbJsonLd({ items }: { items: ReadonlyArray<BreadcrumbItem> }) {
  return (
    <script
      type="application/ld+json"
      data-testid="set-breadcrumb-json-ld"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildBreadcrumbJsonLd(items, siteOrigin())) }}
    />
  );
}

export function SetCoinListJsonLd({
  coins,
}: {
  coins: ReadonlyArray<{ position: number; coin: CatalogCoin }>;
}) {
  return (
    <script
      type="application/ld+json"
      data-testid="set-coin-list-json-ld"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildCoinItemListJsonLd(coins, siteOrigin())) }}
    />
  );
}

export function ChecklistsCollectionJsonLd() {
  return (
    <script
      type="application/ld+json"
      data-testid="checklists-collection-json-ld"
      dangerouslySetInnerHTML={{
        __html: serializeJsonLd(buildChecklistsCollectionPageJsonLd(siteOrigin())),
      }}
    />
  );
}
