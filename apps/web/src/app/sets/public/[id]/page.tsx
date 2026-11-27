import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SetBreadcrumbJsonLd, SetCoinListJsonLd } from '@/components/seo/set-page-json-ld';
import { PublicSetDetailView } from '@/components/sets/public-set-detail-view';
import { loadPublicSet } from '@/lib/server-sets';
import { publicSetBreadcrumb, publicSetMetadata } from '@/lib/set-page-seo';
import { siteOrigin } from '@/lib/site-url';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const result = await loadPublicSet(id);
  return publicSetMetadata(id, result.status === 'ok' ? result.data : null, siteOrigin());
}

/**
 * Server-rendered public set. An API 404/400 (missing, deleted or malformed id) is a real 404
 * (not-found.tsx); any other failure renders the view without data, so the browser query loads
 * it as before.
 */
export default async function PublicSetDetailPage({ params }: PageProps) {
  const { id } = await params;
  const result = await loadPublicSet(id);

  if (result.status === 'not-found') {
    notFound();
  }

  const set = result.status === 'ok' ? result.data : undefined;

  return (
    <>
      {set && (
        <>
          <SetBreadcrumbJsonLd items={publicSetBreadcrumb(id, set.name)} />
          <SetCoinListJsonLd coins={set.coins} />
        </>
      )}
      <PublicSetDetailView id={id} initialSet={set} />
    </>
  );
}
