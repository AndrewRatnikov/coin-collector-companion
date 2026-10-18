'use client';

import Link from 'next/link';
import type { UserSetListItem, UserSetsSummaryResponse } from '@coin-collector/shared';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';
import { getClosestToComplete } from '@/lib/my-sets';

export interface MySetsSummaryProps {
  sets: UserSetListItem[];
  summary: UserSetsSummaryResponse;
}

const TILE_CLASS =
  'flex min-w-0 flex-col gap-1 rounded-[var(--radius-lg)] bg-surface px-[18px] py-4';
const VALUE_CLASS =
  'font-mono text-[28px] font-medium leading-[1.1] lining-nums tabular-nums text-text';
const LABEL_CLASS = 'text-[13px] text-neutral-800';
const LINK_CLASS =
  'mt-1 w-fit text-[13px] text-accent-700 underline underline-offset-2 hover:text-accent-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/** The three My sets tiles: coins missing across sets, the set closest to complete, collection size. */
export function MySetsSummary({ sets, summary }: MySetsSummaryProps) {
  const { t, locale } = useTranslation();
  const closest = getClosestToComplete(sets);
  const anySetHasCoins = sets.some((set) => set.totalCount > 0);

  let closestBody;
  if (closest) {
    const toGo = closest.totalCount - closest.ownedCount;
    const toGoText =
      toGo === 1
        ? t('dashboard.tileClosestToGoOne')
        : t('dashboard.tileClosestToGoMany').split('{n}').join(String(toGo));
    closestBody = (
      <>
        <span
          data-testid="dashboard-tile-closest-name"
          className="text-[17px] font-semibold leading-[1.3] text-text [overflow-wrap:anywhere]"
        >
          {resolveLocalizedText(closest.name, locale)}
        </span>
        <span data-testid="dashboard-tile-closest-detail" className={LABEL_CLASS}>
          {toGoText}
          {closest.firstMissing ? ` · ${closest.firstMissing}` : ''}
        </span>
      </>
    );
  } else if (anySetHasCoins) {
    closestBody = (
      <span
        data-testid="dashboard-tile-closest-complete"
        className="flex flex-wrap items-center gap-2 text-[17px] font-semibold leading-[1.3] text-text"
      >
        {t('dashboard.tileClosestComplete')}
        <Badge variant="complete" />
      </span>
    );
  } else {
    closestBody = (
      <span data-testid="dashboard-tile-closest-no-coins" className={LABEL_CLASS}>
        {t('dashboard.tileClosestNoCoins')}
      </span>
    );
  }

  return (
    <section
      data-testid="dashboard-summary"
      aria-label={t('dashboard.summaryLabel')}
      className="grid grid-cols-2 gap-[10px] min-[900px]:grid-cols-3 min-[900px]:gap-4"
    >
      <div data-testid="dashboard-tile-missing" className={TILE_CLASS}>
        <span data-testid="dashboard-tile-missing-value" className={VALUE_CLASS}>
          {summary.uniqueMissingCount}
        </span>
        <span className={LABEL_CLASS}>{t('dashboard.tileMissingLabel')}</span>
        {closest && (
          <Link
            data-testid="dashboard-tile-missing-link"
            href={`/sets/${closest.id}/missing`}
            className={LINK_CLASS}
          >
            {t('dashboard.tileMissingLink')}
          </Link>
        )}
      </div>

      <div
        data-testid="dashboard-tile-closest"
        className={`${TILE_CLASS} order-last col-span-2 max-[899px]:bg-accent-100 min-[900px]:order-none min-[900px]:col-span-1`}
      >
        <span className={LABEL_CLASS}>{t('dashboard.tileClosestLabel')}</span>
        {closestBody}
      </div>

      <div data-testid="dashboard-tile-collection" className={TILE_CLASS}>
        <span data-testid="dashboard-tile-collection-value" className={VALUE_CLASS}>
          {summary.collectionCount}
        </span>
        <span className={LABEL_CLASS}>{t('dashboard.tileCollectionLabel')}</span>
        <Link
          data-testid="dashboard-tile-collection-link"
          href="/collection"
          className={LINK_CLASS}
        >
          {t('dashboard.tileCollectionLink')}
        </Link>
      </div>
    </section>
  );
}
