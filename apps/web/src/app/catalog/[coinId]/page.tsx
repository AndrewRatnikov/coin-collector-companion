'use client';

import { useEffect, useState } from 'react';
import { formatCoinLabel } from '@coin-collector/shared';
import { useCoin } from '@/lib/hooks/use-catalog';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function CoinDetailPage({ params }: { params: Promise<{ coinId: string }> }) {
  const { t, locale } = useTranslation();
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
      {isLoading && (
        <div data-testid="coin-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="coin-detail-error" className="text-sm text-red-600">
          {t('coinDetail.errorLoading')}
        </p>
      )}

      {coin && (
        <>
          <h1 data-testid="coin-detail-label" className="text-lg font-semibold">
            {formatCoinLabel(coin)}
          </h1>
          {coin.status !== 'approved' && (
            <span
              data-testid="coin-detail-pending-badge"
              className="w-fit rounded bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
            >
              {t('coinDetail.pendingBadge')}
            </span>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="font-medium">{t('common.country')}</dt>
            <dd data-testid="coin-detail-country">{resolveLocalizedText(coin.country, locale)}</dd>
            <dt className="font-medium">{t('common.denomination')}</dt>
            <dd data-testid="coin-detail-denomination">{resolveLocalizedText(coin.denomination, locale)}</dd>
            <dt className="font-medium">{t('common.year')}</dt>
            <dd data-testid="coin-detail-year">{coin.year}</dd>
            <dt className="font-medium">{t('common.mintMark')}</dt>
            <dd data-testid="coin-detail-mint-mark">{coin.mintMark}</dd>
            <dt className="font-medium">{t('common.variety')}</dt>
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
                {t('coinDetail.imageAttributionPrefix')} {coin.imageSource ?? t('coinDetail.unknownSource')}
                {coin.imageLicense ? `, ${coin.imageLicense}` : ''}
              </figcaption>
            </figure>
          )}
        </>
      )}
    </main>
  );
}
