'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getCoinName } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { isNotFoundError } from '@/lib/not-found-error';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { useCanonicalSetGaps } from '@/lib/hooks/use-user-sets';
import { SetProgress, SetProgressSkeleton } from '@/components/sets/set-progress';
import { GradeChip } from '@/components/ui/grade-chip';
import { OwnershipMark } from '@/components/ui/ownership-mark';
import { Skeleton } from '@/components/ui/skeleton';
import { NotFoundContent } from '@/components/ui/not-found-content';
import { formatOwnedOfTotal } from '@/lib/album-layout';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function CanonicalSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: set, isLoading, isError, error } = useCanonicalSet(id ?? '');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  // The signed-in viewer's own progress; never fetched for visitors.
  const gapsQuery = useCanonicalSetGaps(id ?? '', { enabled: isLoggedIn });

  if (id === null) {
    return <main data-testid="canonical-set-detail-page" />;
  }

  const gaps = isLoggedIn && gapsQuery.isSuccess && gapsQuery.data ? gapsQuery.data : null;
  const slotByCoinId = new Map(gaps ? gaps.slots.map((slot) => [slot.coin.id, slot]) : []);
  const showProgressArea = isLoggedIn && set !== undefined && set.coins.length > 0;
  const cloneLabel =
    gaps && gaps.ownedCount > 0
      ? formatOwnedOfTotal(t('setProgress.cloneCtaWithOwned'), gaps.ownedCount, gaps.totalCount)
      : t('canonicalSetDetail.cloneCta');

  return (
    <main
      data-testid="canonical-set-detail-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <Link
        href="/sets/canonical"
        className="w-fit text-sm text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-accent)]"
      >
        ← {t('canonicalSets.title')}
      </Link>

      {isLoading && (
        <div data-testid="canonical-set-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && isNotFoundError(error) && <NotFoundContent variant="checklist" />}

      {isError && !isNotFoundError(error) && (
        <p data-testid="canonical-set-detail-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('canonicalSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[color:var(--color-neutral-600)]">
            Canonical set
          </p>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,300px)] items-end gap-x-6 gap-y-3 max-[899px]:grid-cols-1">
            <div className="flex min-w-0 flex-col gap-6">
              <h1
                data-testid="canonical-set-detail-name"
                className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]"
              >
                {resolveLocalizedText(set.name, locale)}
              </h1>
              {set.description && (
                <p
                  data-testid="canonical-set-detail-description"
                  className="max-w-[60ch] text-sm text-[color:var(--color-neutral-700)]"
                >
                  {resolveLocalizedText(set.description, locale)}
                </p>
              )}
            </div>
            {showProgressArea && gapsQuery.isLoading && (
              <SetProgressSkeleton testId="canonical-set-detail-progress-loading" />
            )}
            {showProgressArea && gaps && gaps.totalCount > 0 && (
              <SetProgress
                testIdPrefix="canonical-set-detail"
                className="self-end"
                ownedTemplate={t('setProgress.youOwnOfTotal')}
                owned={gaps.ownedCount}
                total={gaps.totalCount}
                percent={gaps.completionPercent}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-4 border-y border-[color:var(--color-divider)] py-4">
            {isLoggedIn ? (
              <Link
                href={`/sets/new?cloneFrom=canonical&cloneFromId=${id}`}
                data-testid="canonical-set-clone-cta"
                className="inline-flex w-fit items-center justify-center rounded-[2px] bg-[color:var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[.1em] text-[color:var(--color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,black)]"
              >
                {cloneLabel}
              </Link>
            ) : (
              <p className="text-sm text-[color:var(--color-neutral-700)]">Log in to clone this set into your own collection.</p>
            )}
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
              {set.coins.length}
            </span>
          </div>

          <ul data-testid="canonical-set-coin-list" className="flex flex-col">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => {
                const name = getCoinName(item.coin);
                const slot = slotByCoinId.get(item.coin.id);
                return (
                  <li
                    key={item.id}
                    data-testid="canonical-set-coin-item"
                    className="flex items-center gap-4 border-b border-[color:var(--color-divider)] py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface)] font-[family-name:var(--font-heading)] text-xs text-[color:var(--color-neutral-700)] outline outline-1 outline-[color:var(--color-divider)]"
                    >
                      {item.coin.denomination.charAt(0)}
                    </span>
                    <Link
                      href={`/catalog/${item.coin.id}`}
                      data-testid="canonical-set-coin-link"
                      className="flex flex-col hover:underline"
                    >
                      {name.eyebrow !== '' && (
                        <span data-testid="canonical-set-coin-eyebrow" className="text-[11px] font-medium text-neutral-700">
                          {name.eyebrow}
                        </span>
                      )}
                      <span data-testid="canonical-set-coin-title" className="text-[15px] text-[color:var(--color-text)]">
                        {name.title}
                      </span>
                      <span data-testid="canonical-set-coin-subtitle" className="text-xs text-neutral-700">
                        {name.subtitle}
                      </span>
                    </Link>
                    {slot && (
                      <span className="ml-auto flex items-center gap-2">
                        {slot.owned && slot.grade != null && (
                          <GradeChip grade={slot.grade} testId="canonical-set-coin-grade" />
                        )}
                        <OwnershipMark owned={slot.owned} testId="canonical-set-coin-mark" />
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
