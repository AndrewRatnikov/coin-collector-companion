'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function PublicSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = useTranslation();
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setId(resolved.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const { data: set, isLoading, isError } = usePublicSet(id ?? '');
  const isLoggedIn = Boolean(getStoredToken());
  const gapsQuery = useSetGaps(isLoggedIn ? (id ?? '') : '');

  if (id === null) {
    return <main data-testid="public-set-detail-page" />;
  }

  const ownedById = new Map<string, boolean>(
    gapsQuery.isSuccess && gapsQuery.data ? gapsQuery.data.slots.map((slot) => [slot.coin.id, slot.owned]) : [],
  );

  const showOverlap = isLoggedIn && gapsQuery.isSuccess && Boolean(gapsQuery.data);

  return (
    <main
      data-testid="public-set-detail-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-4 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <Link
        href="/sets/public"
        className="w-fit text-[13px] text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
      >
        &larr; {t('publicSets.title')}
      </Link>

      {isLoading && (
        <div data-testid="public-set-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="public-set-detail-error" className="text-sm text-red-700">
          {t('publicSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <h1 data-testid="public-set-detail-name" className="text-[32px] font-normal [font-family:var(--font-heading)]">
            {resolveLocalizedText(set.name, locale)}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            {isLoggedIn && (
              <Link
                href={`/sets/new?cloneFrom=user&cloneFromId=${id}`}
                data-testid="public-set-clone-cta"
                className="w-fit rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
              >
                {t('publicSetDetail.cloneCta')}
              </Link>
            )}
          </div>

          {showOverlap && (
            <p
              data-testid="public-set-detail-overlap"
              className="[font-family:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-neutral-600)]"
            >
              {t('publicSetDetail.overlap')} {gapsQuery.data!.ownedCount} {t('common.ofSeparator')} {gapsQuery.data!.slots.length}
            </p>
          )}

          <ul data-testid="public-set-detail-coin-list" className="flex flex-col border-t border-[var(--color-divider)]">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <li
                  key={item.id}
                  data-testid="public-set-detail-coin-item"
                  className="flex items-center justify-between gap-2 border-b border-[var(--color-divider)] px-1 py-3"
                >
                  <span>{formatCoinLabel(item.coin)}</span>
                  {gapsQuery.isSuccess && ownedById.has(item.coin.id) && (
                    <span
                      data-testid="public-set-detail-coin-status"
                      className="text-xs uppercase tracking-[0.08em] text-[var(--color-neutral-600)]"
                    >
                      {ownedById.get(item.coin.id) ? t('common.owned') : t('common.missing')}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </main>
  );
}
