'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCoinName } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { isNotFoundError } from '@/lib/not-found-error';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { SetProgress, SetProgressSkeleton } from '@/components/sets/set-progress';
import { GradeChip } from '@/components/ui/grade-chip';
import { OwnershipMark } from '@/components/ui/ownership-mark';
import { Skeleton } from '@/components/ui/skeleton';
import { NotFoundContent } from '@/components/ui/not-found-content';
import { formatOwnedOfTotal } from '@/lib/album-layout';
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

  const { data: set, isLoading, isError, error } = usePublicSet(id ?? '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  const gapsQuery = useSetGaps(isLoggedIn ? (id ?? '') : '');

  if (id === null) {
    return <main data-testid="public-set-detail-page" />;
  }

  // The viewer's own ownership from GET /sets/:id/gaps. That response also carries the set
  // owner's minGrade, upgradeCount and needsUpgrade: never read them here.
  const gaps = isLoggedIn && gapsQuery.isSuccess && gapsQuery.data ? gapsQuery.data : null;
  const slotByCoinId = new Map(gaps ? gaps.slots.map((slot) => [slot.coin.id, slot]) : []);
  const showProgressArea = isLoggedIn && set !== undefined && set.coins.length > 0;
  const cloneLabel =
    gaps && gaps.ownedCount > 0
      ? formatOwnedOfTotal(t('setProgress.cloneCtaWithOwned'), gaps.ownedCount, gaps.totalCount)
      : t('publicSetDetail.cloneCta');

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

      {isError && isNotFoundError(error) && <NotFoundContent variant="set" />}

      {isError && !isNotFoundError(error) && (
        <p data-testid="public-set-detail-error" className="text-sm text-red-700">
          {t('publicSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] items-end gap-x-6 gap-y-3 max-[899px]:grid-cols-1">
            <h1 data-testid="public-set-detail-name" className="text-[32px] font-normal [font-family:var(--font-heading)]">
              {resolveLocalizedText(set.name, locale)}
            </h1>
            {showProgressArea && gapsQuery.isLoading && (
              <SetProgressSkeleton testId="public-set-detail-progress-loading" />
            )}
            {showProgressArea && gaps && gaps.totalCount > 0 && (
              <SetProgress
                testIdPrefix="public-set-detail"
                className="self-end"
                ownedTemplate={t('setProgress.youOwnOfTotal')}
                owned={gaps.ownedCount}
                total={gaps.totalCount}
                percent={gaps.completionPercent}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {isLoggedIn && (
              <Link
                href={`/sets/new?cloneFrom=user&cloneFromId=${id}`}
                data-testid="public-set-clone-cta"
                className="w-fit rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
              >
                {cloneLabel}
              </Link>
            )}
          </div>

          <ul data-testid="public-set-detail-coin-list" className="flex flex-col border-t border-[var(--color-divider)]">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => {
                const name = getCoinName(item.coin);
                const slot = slotByCoinId.get(item.coin.id);
                return (
                  <li
                    key={item.id}
                    data-testid="public-set-detail-coin-item"
                    className="flex items-center justify-between gap-2 border-b border-[var(--color-divider)] px-1 py-3"
                  >
                    <Link
                      href={`/catalog/${item.coin.id}`}
                      data-testid="public-set-detail-coin-link"
                      className="flex flex-col hover:underline"
                    >
                      {name.eyebrow !== '' && (
                        <span data-testid="public-set-detail-coin-eyebrow" className="text-[11px] font-medium text-neutral-700">
                          {name.eyebrow}
                        </span>
                      )}
                      <span data-testid="public-set-detail-coin-title">{name.title}</span>
                      <span data-testid="public-set-detail-coin-subtitle" className="text-xs text-neutral-700">
                        {name.subtitle}
                      </span>
                    </Link>
                    {slot && (
                      <span className="ml-auto flex items-center gap-2">
                        {slot.owned && slot.grade != null && (
                          <GradeChip grade={slot.grade} testId="public-set-detail-coin-grade" />
                        )}
                        <OwnershipMark owned={slot.owned} testId="public-set-detail-coin-mark" />
                      </span>
                    )}
                  </li>
                );
              })}
          </ul>
        </>
      )}
    </main>
  );
}
