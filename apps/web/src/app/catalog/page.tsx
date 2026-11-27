import type { Metadata } from 'next';
import { CatalogPageView } from '@/components/catalog/catalog-page-view';
import { catalogPageMetadata } from '@/lib/catalog-seo';
import {
  catalogSearchParamsFromRecord,
  catalogViewStateToFilters,
  parseCatalogSearchParams,
} from '@/lib/catalog-view';
import { loadCatalogPage } from '@/lib/server-catalog';
import { siteOrigin } from '@/lib/site-url';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const view = parseCatalogSearchParams(catalogSearchParamsFromRecord(await searchParams));
  return catalogPageMetadata(view, siteOrigin());
}

/**
 * Server-rendered catalog: the results page the URL asks for is in the HTML as real coin links.
 * The server page is anonymous (hideOwned is never sent); filtering, paging and search keep
 * working in the browser. Any API failure renders the view without data (client fallback).
 */
export default async function CatalogPage({ searchParams }: PageProps) {
  const view = parseCatalogSearchParams(catalogSearchParamsFromRecord(await searchParams));
  const filters = catalogViewStateToFilters(view, false);
  const result = await loadCatalogPage(filters);

  return (
    <CatalogPageView initialCatalog={result.status === 'ok' ? { filters, data: result.data } : undefined} />
  );
}
