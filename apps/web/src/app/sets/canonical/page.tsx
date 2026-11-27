import type { Metadata } from 'next';
import { ChecklistsCollectionJsonLd, SetBreadcrumbJsonLd } from '@/components/seo/set-page-json-ld';
import { CanonicalSetsListView } from '@/components/sets/canonical-sets-list-view';
import { loadCanonicalSets } from '@/lib/server-sets';
import { canonicalListBreadcrumb, canonicalListMetadata } from '@/lib/set-page-seo';
import { siteOrigin } from '@/lib/site-url';

export async function generateMetadata(): Promise<Metadata> {
  return canonicalListMetadata(siteOrigin());
}

/**
 * Server-rendered checklist list. On a cold or failing API the view falls back to the browser
 * query (loading state and "waking the server" notice), as before.
 */
export default async function CanonicalSetsPage() {
  const result = await loadCanonicalSets();

  return (
    <>
      <SetBreadcrumbJsonLd items={canonicalListBreadcrumb()} />
      <ChecklistsCollectionJsonLd />
      <CanonicalSetsListView initialSets={result.status === 'ok' ? result.data : undefined} />
    </>
  );
}
