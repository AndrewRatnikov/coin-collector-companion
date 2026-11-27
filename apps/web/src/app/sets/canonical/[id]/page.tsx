import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SetBreadcrumbJsonLd, SetCoinListJsonLd } from '@/components/seo/set-page-json-ld';
import { CanonicalSetDetailView } from '@/components/sets/canonical-set-detail-view';
import { loadCanonicalSet } from '@/lib/server-sets';
import { canonicalSetBreadcrumb, canonicalSetMetadata } from '@/lib/set-page-seo';
import { siteOrigin } from '@/lib/site-url';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadCanonicalSet(id);
  return canonicalSetMetadata(id, result.status === 'ok' ? result.data : null, siteOrigin());
}

/**
 * Server-rendered checklist. An API 404/400 is a real 404 (not-found.tsx); any other failure
 * renders the view without data, so the browser query loads it as before.
 */
export default async function CanonicalSetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await loadCanonicalSet(id);

  if (result.status === 'not-found') {
    notFound();
  }

  const set = result.status === 'ok' ? result.data : undefined;

  return (
    <>
      {set && (
        <>
          <SetBreadcrumbJsonLd items={canonicalSetBreadcrumb(id, set.name)} />
          <SetCoinListJsonLd coins={set.coins} />
        </>
      )}
      <CanonicalSetDetailView id={id} initialSet={set} />
    </>
  );
}
