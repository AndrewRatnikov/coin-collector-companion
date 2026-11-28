import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CoinDetailView } from '@/components/catalog/coin-detail-view';
import { CoinPageJsonLd } from '@/components/seo/coin-page-json-ld';
import { coinPageMetadata } from '@/lib/catalog-seo';
import { isCoinId } from '@/lib/coin-page';
import { loadCoin, loadCoinChecklists } from '@/lib/server-catalog';
import { siteOrigin } from '@/lib/site-url';

type PageProps = { params: Promise<{ coinId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { coinId } = await params;
  const result = await loadCoin(coinId);
  return coinPageMetadata(coinId, result.status === 'ok' ? result.data : null, siteOrigin(), {
    noindex: result.status === 'not-found',
  });
}

/**
 * Server-rendered coin page. A malformed id (no API call), an API 404/400 and a coin that isn't
 * approved are real 404s (not-found.tsx); any other failure renders the view without data, so the
 * browser query loads it as before. Ownership, grade and "Add to set" attach after hydration.
 */
export default async function CoinDetailPage({ params }: PageProps) {
  const { coinId } = await params;

  if (!isCoinId(coinId)) {
    notFound();
  }

  const [result, checklists] = await Promise.all([loadCoin(coinId), loadCoinChecklists(coinId)]);

  if (result.status === 'not-found') {
    notFound();
  }

  const coin = result.status === 'ok' ? result.data : undefined;

  return (
    <>
      {coin && <CoinPageJsonLd coin={coin} />}
      <CoinDetailView coinId={coinId} initialCoin={coin} checklists={checklists} />
    </>
  );
}
