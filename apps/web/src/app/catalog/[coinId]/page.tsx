'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQueries } from '@tanstack/react-query';
import { formatCoinLabel } from '@coin-collector/shared';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';
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
  const isLoggedIn = Boolean(getStoredToken());
  const { data: collection } = useCollection();
  const { mutate: setOwnership } = useSetOwnership();
  const { data: userSets } = useUserSets();

  const setsToCheck = isLoggedIn ? (userSets ?? []) : [];
  const gapQueries = useQueries({
    queries: setsToCheck.map((set) => ({
      queryKey: ['user-sets', set.id, 'gaps'],
      queryFn: () => getSetGaps(set.id),
      enabled: isLoggedIn,
    })),
  });

  if (coinId === null) {
    return <main data-testid="coin-detail-page" />;
  }

  const coinIsOwned = collection?.some((item) => item.coinId === coinId) ?? false;
  const coinAppearsIn = setsToCheck.filter((_set, index) => {
    const gaps = gapQueries[index]?.data;
    return gaps?.slots.some((slot) => slot.coin.id === coinId) ?? false;
  });

  return (
    <main
      data-testid="coin-detail-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <Link
        href="/catalog"
        className="w-fit text-sm text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-accent)]"
      >
        ← {t('catalog.title')}
      </Link>

      {isLoading && (
        <div data-testid="coin-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="coin-detail-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('coinDetail.errorLoading')}
        </p>
      )}

      {coin && (
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex flex-col gap-2">
            <div className="flex aspect-square w-full items-center justify-center rounded-[var(--radius-md)] border border-[color:var(--color-divider)] bg-[color:var(--color-surface)]">
              <span
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-bg)] font-[family-name:var(--font-heading)] text-2xl text-[color:var(--color-neutral-700)] outline outline-1 outline-[color:var(--color-divider)]"
              >
                {coin.denomination.charAt(0)}
              </span>
            </div>
            <p className="text-center text-xs text-[color:var(--color-neutral-600)]">Plate not yet photographed</p>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[color:var(--color-neutral-600)]">
              Catalogue entry
            </p>
            <h1
              data-testid="coin-detail-label"
              className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]"
            >
              {formatCoinLabel(coin)}
            </h1>
            {coin.variety && <p className="text-sm text-[color:var(--color-neutral-600)]">{coin.variety}</p>}

            {coin.status !== 'approved' && (
              <span
                data-testid="coin-detail-pending-badge"
                className="w-fit rounded-[2px] bg-[color:var(--color-accent-100)] px-2 py-1 text-xs font-medium text-[color:var(--color-accent-800)]"
              >
                {t('coinDetail.pendingBadge')}
              </span>
            )}

            <dl className="flex flex-col divide-y divide-[color:var(--color-divider)] border-y border-[color:var(--color-divider)] text-sm">
              <div className="flex items-center justify-between py-2">
                <dt className="text-[color:var(--color-neutral-600)]">{t('common.country')}</dt>
                <dd data-testid="coin-detail-country" className="font-mono tabular-nums text-[color:var(--color-text)]">
                  {resolveLocalizedText(coin.country, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[color:var(--color-neutral-600)]">{t('common.denomination')}</dt>
                <dd
                  data-testid="coin-detail-denomination"
                  className="font-mono tabular-nums text-[color:var(--color-text)]"
                >
                  {resolveLocalizedText(coin.denomination, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[color:var(--color-neutral-600)]">{t('common.year')}</dt>
                <dd data-testid="coin-detail-year" className="font-mono tabular-nums text-[color:var(--color-text)]">
                  {coin.year}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[color:var(--color-neutral-600)]">{t('common.mintMark')}</dt>
                <dd
                  data-testid="coin-detail-mint-mark"
                  className="font-mono tabular-nums text-[color:var(--color-text)]"
                >
                  {coin.mintMark || '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2">
                <dt className="text-[color:var(--color-neutral-600)]">{t('common.variety')}</dt>
                <dd data-testid="coin-detail-variety" className="font-mono tabular-nums text-[color:var(--color-text)]">
                  {coin.variety || '—'}
                </dd>
              </div>
            </dl>

            {coin.imageUrl && (
              <figure className="flex flex-col gap-1">
                <img
                  data-testid="coin-detail-image"
                  src={coin.imageUrl}
                  alt={formatCoinLabel(coin)}
                  className="max-w-xs rounded-[var(--radius-md)]"
                />
                <figcaption data-testid="coin-detail-attribution" className="text-xs text-[color:var(--color-neutral-600)]">
                  {t('coinDetail.imageAttributionPrefix')} {coin.imageSource ?? t('coinDetail.unknownSource')}
                  {coin.imageLicense ? `, ${coin.imageLicense}` : ''}
                </figcaption>
              </figure>
            )}

            {isLoggedIn ? (
              <div className="flex items-center gap-4 pt-2">
                {coinIsOwned && (
                  <span className="text-sm font-medium text-[color:var(--color-neutral-800)]">
                    {t('coinDetail.inCollection')}
                  </span>
                )}
                <button
                  type="button"
                  data-testid="coin-detail-owned-toggle"
                  onClick={() => setOwnership({ coinId, owned: !coinIsOwned })}
                  className={
                    coinIsOwned
                      ? 'w-fit text-sm text-[color:var(--color-neutral-600)] underline transition-colors hover:text-[color:var(--color-accent)]'
                      : 'inline-flex w-fit items-center justify-center rounded-[2px] bg-[color:var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[.1em] text-[color:var(--color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,black)]'
                  }
                >
                  {coinIsOwned ? t('coinDetail.removeOwned') : t('coinDetail.markOwned')}
                </button>
              </div>
            ) : (
              <p data-testid="coin-detail-login-prompt" className="pt-2 text-sm text-[color:var(--color-neutral-700)]">
                {t('coinDetail.loginPrompt')}
              </p>
            )}

            {isLoggedIn && coinAppearsIn.length > 0 && (
              <div className="flex flex-col gap-2 pt-4">
                <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[color:var(--color-neutral-600)]">
                  {t('coinDetail.appearsInSets')}
                </p>
                <ul data-testid="coin-detail-sets-list" className="flex flex-col">
                  {coinAppearsIn.map((set) => (
                    <li
                      key={set.id}
                      data-testid="coin-detail-set-item"
                      className="border-b border-[color:var(--color-divider)] py-2"
                    >
                      <Link
                        href={`/sets/${set.id}`}
                        className="text-sm text-[color:var(--color-text)] transition-colors hover:text-[color:var(--color-accent)]"
                      >
                        {resolveLocalizedText(set.name, locale)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
