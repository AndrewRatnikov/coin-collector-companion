'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface SetCardProps {
  href: string;
  name: string;
  source?: string;
  ownedCount: number;
  totalCount: number;
  nextMissingTitle?: string | null;
  loading?: boolean;
}

const MONO_NUMBER = 'font-mono font-medium lining-nums tabular-nums';

/** A set's progress card: name link, progress bar, owned count, and what's left to find. */
export function SetCard({
  href,
  name,
  source,
  ownedCount,
  totalCount,
  nextMissingTitle,
  loading = false,
}: SetCardProps) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div
        data-testid="set-card-skeleton"
        aria-busy="true"
        className="flex flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-[18px]"
      >
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    );
  }

  // Same rounding as the API's gap view.
  const pct = totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
  const complete = totalCount > 0 && ownedCount === totalCount;
  const missing = totalCount - ownedCount;

  const progressLabel = complete
    ? t('ui.setCard.complete')
    : t('ui.setCard.percentComplete').split('{pct}').join(String(pct));

  return (
    <div
      data-testid="set-card"
      data-complete={complete ? 'true' : 'false'}
      className="group relative flex flex-col gap-3 rounded-lg border border-neutral-300 bg-white p-[18px] motion-safe:transition motion-safe:duration-150 motion-safe:hover:-translate-y-0.5 motion-safe:focus-within:-translate-y-0.5 hover:border-accent hover:shadow-md focus-within:border-accent focus-within:shadow-md"
    >
      {source && (
        <span data-testid="set-card-source" className="text-xs text-neutral-700">
          {source}
        </span>
      )}

      <Link
        data-testid="set-card-link"
        href={href}
        className="font-heading text-2xl leading-tight font-semibold text-text after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-700 group-hover:text-accent-700"
      >
        {name}
      </Link>

      <div
        data-testid="set-card-progress"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={progressLabel}
        className="h-2 overflow-hidden rounded bg-neutral-300"
      >
        <div className={`h-full ${complete ? 'bg-accent-700' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
      </div>

      <div className="flex items-baseline justify-between gap-2 text-[13px] text-neutral-800">
        <span data-testid="set-card-owned">
          <b className={MONO_NUMBER}>{ownedCount}</b> {t('ui.setCard.of')} <b className={MONO_NUMBER}>{totalCount}</b>{' '}
          {t('ui.setCard.owned')}
        </span>
        <span data-testid="set-card-percent" className={MONO_NUMBER}>
          {pct}%
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 text-[13px] text-neutral-700">
        {complete ? (
          <>
            <span data-testid="set-card-every-found">{t('ui.setCard.everyCoinFound')}</span>
            <Badge variant="complete" />
          </>
        ) : (
          <>
            {nextMissingTitle ? (
              <span data-testid="set-card-next" className="min-w-0 truncate">
                {t('ui.setCard.next')} <b className="font-medium text-neutral-900">{nextMissingTitle}</b>
              </span>
            ) : (
              <span data-testid="set-card-to-find">
                {t('ui.setCard.toFind').split('{n}').join(String(missing))}
              </span>
            )}
            <Badge variant="missing" count={missing} />
          </>
        )}
      </div>
    </div>
  );
}
