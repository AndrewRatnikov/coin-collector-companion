'use client';

import Link from 'next/link';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { Skeleton } from '@/components/ui/skeleton';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { getPopularChecklists } from '@/lib/my-sets';

const POPULAR_LIMIT = 3;
const EYEBROW_CLASS = 'text-xs font-semibold uppercase tracking-[0.06em] text-neutral-800';
const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

function newSetFromChecklistHref(id: string): string {
  return `/sets/new?cloneFrom=canonical&cloneFromId=${encodeURIComponent(id)}`;
}

/** My sets with zero sets: one primary path (a curated checklist), popular checklists, an empty-set link. */
export function MySetsEmpty() {
  const { t } = useTranslation();
  // Only the empty state needs the public checklist list, so it is fetched here.
  const { data: checklists, isLoading, isError } = useCanonicalSets();
  const popular = checklists && !isError ? getPopularChecklists(checklists, POPULAR_LIMIT) : [];
  const showLoading = isLoading && !isError;

  return (
    <section
      aria-labelledby="dashboard-empty-title"
      className="flex flex-col gap-[22px] rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-[clamp(20px,4vw,36px)]"
    >
      <div className="flex flex-wrap items-center gap-7">
        <div aria-hidden="true" className="flex flex-none">
          <PlaceholderCoin denomination="10 Hryvnias" material="Brass" size={72} />
          <PlaceholderCoin
            denomination="1 Cent"
            material="Copper"
            size={72}
            missing
            className="-ml-[18px]"
          />
          <PlaceholderCoin
            denomination="5 Kopiyok"
            material="Steel"
            size={72}
            className="-ml-[18px]"
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          <h2
            id="dashboard-empty-title"
            className="font-heading text-[32px] leading-[1.1] font-semibold text-text"
          >
            {t('dashboard.emptyTitle')}
          </h2>
          <p className="max-w-[560px] text-[15px] text-neutral-800">{t('dashboard.emptyBody')}</p>
        </div>
        <Link
          data-testid="dashboard-empty-curated-cta"
          href="/sets/new"
          className={`inline-flex min-h-12 items-center justify-center rounded-[var(--radius-md)] bg-accent-700 px-[18px] text-[15px] font-medium text-white hover:bg-accent-800 ${FOCUS_RING}`}
        >
          {t('dashboard.emptyCuratedCta')}
        </Link>
      </div>

      {(showLoading || popular.length > 0) && (
        <div className="flex flex-col gap-[10px]">
          <span className={EYEBROW_CLASS}>{t('dashboard.popularChecklists')}</span>
          {showLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3">
              {Array.from({ length: POPULAR_LIMIT }, (_, index) => (
                <Skeleton key={index} className="h-[62px] w-full rounded-[var(--radius-lg)]" />
              ))}
            </div>
          ) : (
            <ul
              data-testid="dashboard-popular-list"
              className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-3 p-0"
            >
              {popular.map((checklist) => (
                <li key={checklist.id} className="min-w-0">
                  <Link
                    data-testid="dashboard-popular-item"
                    href={newSetFromChecklistHref(checklist.id)}
                    className={`flex flex-col gap-1 rounded-[var(--radius-lg)] border border-neutral-300 bg-neutral-100 px-4 py-[14px] text-text hover:border-accent ${FOCUS_RING}`}
                  >
                    <span className="font-semibold [overflow-wrap:anywhere]">{checklist.name}</span>
                    <span className="font-mono text-xs text-neutral-700 lining-nums tabular-nums">
                      {t('dashboard.popularCoinCount')
                        .split('{n}')
                        .join(String(checklist.coinCount))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-[13px] text-neutral-700">
        {t('dashboard.emptyPickYourself')}{' '}
        <Link
          data-testid="dashboard-empty-blank-link"
          href="/sets/new"
          className={`text-accent-700 underline underline-offset-2 hover:text-accent-800 ${FOCUS_RING}`}
        >
          {t('dashboard.emptyStartBlank')}
        </Link>
      </p>
    </section>
  );
}
