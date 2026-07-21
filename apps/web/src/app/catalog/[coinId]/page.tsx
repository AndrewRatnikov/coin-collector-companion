'use client';

import { useEffect, useState } from 'react';
import { formatCoinLabel } from '@coin-collector/shared';
import { useCoin } from '@/lib/hooks/use-catalog';

export default function CoinDetailPage({ params }: { params: Promise<{ coinId: string }> }) {
  const [coinId, setCoinId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setCoinId(resolved.coinId);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const { data: coin, isLoading, isError } = useCoin(coinId ?? '');

  if (coinId === null) {
    return <main data-testid="coin-detail-page" />;
  }

  return (
    <main data-testid="coin-detail-page" className="flex flex-1 flex-col gap-4 p-8">
      {isLoading && <div data-testid="coin-detail-loading">Loading…</div>}

      {isError && (
        <p data-testid="coin-detail-error" className="text-sm text-red-600">
          Something went wrong loading this coin. Please try again.
        </p>
      )}

      {coin && (
        <>
          <h1 data-testid="coin-detail-label" className="text-lg font-semibold">
            {formatCoinLabel(coin)}
          </h1>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium">Country</dt>
            <dd data-testid="coin-detail-country">{coin.country}</dd>
            <dt className="font-medium">Denomination</dt>
            <dd data-testid="coin-detail-denomination">{coin.denomination}</dd>
            <dt className="font-medium">Year</dt>
            <dd data-testid="coin-detail-year">{coin.year}</dd>
            <dt className="font-medium">Mint mark</dt>
            <dd data-testid="coin-detail-mint-mark">{coin.mintMark}</dd>
            <dt className="font-medium">Variety</dt>
            <dd data-testid="coin-detail-variety">{coin.variety}</dd>
          </dl>

          {coin.imageUrl && (
            <figure className="flex flex-col gap-1">
              <img
                data-testid="coin-detail-image"
                src={coin.imageUrl}
                alt={formatCoinLabel(coin)}
                className="max-w-xs rounded"
              />
              <figcaption data-testid="coin-detail-attribution" className="text-xs text-gray-500">
                Image: {coin.imageSource ?? 'Unknown source'}
                {coin.imageLicense ? `, ${coin.imageLicense}` : ''}
              </figcaption>
            </figure>
          )}
        </>
      )}
    </main>
  );
}
