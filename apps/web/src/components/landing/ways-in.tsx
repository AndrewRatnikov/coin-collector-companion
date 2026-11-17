'use client';

import Link from 'next/link';
import { ServerWakingNotice } from '@/components/ui/server-waking-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { fill } from '@/lib/fill-template';

export interface WaysInProps {
  /** null: still loading. */
  catalogCount: number | null;
  checklistCount: number | null;
  publicSetCount: number | null;
  /** Any of the three queries failed: no counts at all, the error line and Retry instead. */
  isError: boolean;
  /** useSlowLoading result: the API is taking long (Render cold start). */
  showWaking: boolean;
  onRetry: () => void;
  /** Under 900px: zero public sets reads the short "None yet". */
  compact?: boolean;
}

const CARD_CLASSES =
  'group flex flex-col gap-1.5 rounded-[7px] border border-neutral-300 bg-white p-5 text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 ' +
  'max-[899px]:min-h-14 max-[899px]:flex-row max-[899px]:items-center max-[899px]:justify-between max-[899px]:gap-3 max-[899px]:px-4 max-[899px]:py-3';

interface WayCard {
  testId: string;
  href: string;
  title: MessageKey;
  body: MessageKey;
  count: string | null;
}

/** "Start browsing": three link cards with live counts, loading skeletons, waking line and error. */
export function WaysIn({
  catalogCount,
  checklistCount,
  publicSetCount,
  isError,
  showWaking,
  onRetry,
  compact = false,
}: WaysInProps) {
  const { t } = useTranslation();

  function publicSetsText(count: number): string {
    if (count === 0) return t(compact ? 'landing.wayCollectorsCountNoneShort' : 'landing.wayCollectorsCountNone');
    if (count === 1) return t('landing.wayCollectorsCountOne');
    return fill(t('landing.wayCollectorsCountOther'), { count });
  }

  const cards: WayCard[] = [
    {
      testId: 'home-catalog-link',
      href: '/catalog',
      title: 'landing.wayCatalogTitle',
      body: 'landing.wayCatalogBody',
      count: catalogCount === null ? null : fill(t('landing.wayCatalogCount'), { count: catalogCount }),
    },
    {
      testId: 'home-canonical-link',
      href: '/sets/canonical',
      title: 'landing.wayChecklistsTitle',
      body: 'landing.wayChecklistsBody',
      count:
        checklistCount === null
          ? null
          : checklistCount === 1
            ? t('landing.wayChecklistsCountOne')
            : fill(t('landing.wayChecklistsCountOther'), { count: checklistCount }),
    },
    {
      testId: 'home-public-link',
      href: '/sets/public',
      title: 'landing.wayCollectorsTitle',
      body: 'landing.wayCollectorsBody',
      count: publicSetCount === null ? null : publicSetsText(publicSetCount),
    },
  ];

  return (
    <section
      data-testid="landing-ways-in"
      aria-labelledby="landing-ways-heading"
      className="mx-auto w-full max-w-[1320px] px-5 py-10 min-[900px]:px-10 min-[900px]:py-14"
    >
      <div className="mb-5 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        <h2 id="landing-ways-heading" className="text-[32px] leading-[1.1] text-text">
          {t('landing.waysHeading')}
        </h2>
        <ServerWakingNotice show={showWaking && !isError} />
        {isError && (
          <p data-testid="landing-counts-error" role="status" aria-live="polite" className="text-[13px] text-neutral-800">
            {t('landing.countsError')}{' '}
            <button
              type="button"
              data-testid="landing-counts-retry"
              onClick={onRetry}
              className="cursor-pointer rounded-[var(--radius-md)] px-1 font-medium text-accent-700 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
            >
              {t('landing.retry')}
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 min-[900px]:grid-cols-3 min-[900px]:gap-5">
        {cards.map((card) => (
          <Link key={card.testId} href={card.href} data-testid={card.testId} className={CARD_CLASSES}>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-[17px] font-semibold group-hover:text-accent-700">{t(card.title)}</span>
              <span className="text-sm text-neutral-700 max-[899px]:hidden">{t(card.body)}</span>
            </span>
            {!isError &&
              (card.count === null ? (
                <span
                  role="img"
                  aria-label={t('landing.loadingCount')}
                  data-testid="landing-way-count-loading"
                  className="inline-flex"
                >
                  <Skeleton className="h-[14px] w-[84px]" />
                </span>
              ) : (
                <span
                  data-testid="landing-way-count"
                  className="font-mono text-[13px] text-neutral-700 max-[899px]:text-right"
                >
                  {card.count}
                </span>
              ))}
          </Link>
        ))}
      </div>
    </section>
  );
}
