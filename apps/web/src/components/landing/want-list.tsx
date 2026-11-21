'use client';

import type { GapSlot } from '@coin-collector/shared';
import { WantListTable } from '@/components/want-list/want-list-table';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import { track } from '@/lib/analytics';
import { downloadMissingCsv, groupWantList } from '@/lib/missing-list';
import { LINCOLN_SAMPLE_CSV_NAME, LINCOLN_SAMPLE_SET_NAME } from '@/lib/landing/lincoln-sample';

export interface WantListProps {
  slots: GapSlot[];
  keyDateIds: ReadonlySet<string>;
}

const ACTION_CLASSES =
  'inline-flex h-9 cursor-pointer items-center rounded-[var(--radius-md)] border border-neutral-300 bg-white px-3 text-[13px] font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/**
 * The sample's want list: one row per year with gaps, built with groupWantList so it reads like
 * a real set's printed list. Print prints only this card (data-print-region); Download CSV
 * exports the same rows as a real set's missing list.
 */
export function WantList({ slots, keyDateIds }: WantListProps) {
  const { t } = useTranslation();
  const rows = groupWantList(slots, keyDateIds);
  const missingCount = slots.filter((slot) => !slot.owned).length;
  const years = slots.map((slot) => slot.coin.year);
  const from = years.length > 0 ? Math.min(...years) : null;
  const to = years.length > 0 ? Math.max(...years) : null;

  const countText =
    missingCount === 1 ? t('landing.wantCountOne') : fill(t('landing.wantCountOther'), { count: missingCount });

  return (
    <section
      data-testid="want-list"
      data-print-region=""
      aria-labelledby="want-list-title"
      className="rounded-[7px] border border-neutral-300 bg-white px-[22px] py-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="want-list-title"
          className="font-[family-name:var(--font-heading)] text-[24px] font-semibold leading-tight text-text"
        >
          {t('landing.wantTitle')}
        </h2>
        <span data-testid="want-list-count" className="font-mono text-[13px] font-medium text-neutral-800">
          {countText}
        </span>
      </div>
      <p data-testid="want-list-range" className="mt-0.5 text-xs text-neutral-700">
        {from === null ? LINCOLN_SAMPLE_SET_NAME : `${LINCOLN_SAMPLE_SET_NAME} · ${from}–${to}`}
      </p>

      {rows.length === 0 ? (
        <p data-testid="want-list-empty" className="mt-4 text-sm text-neutral-800">
          {t('landing.wantEmpty')}
        </p>
      ) : (
        <WantListTable
          groups={[
            {
              key: 'sample',
              country: slots[0]?.coin.country ?? '',
              denomination: slots[0]?.coin.denomination ?? '',
              years: rows,
            },
          ]}
          showGroupHeadings={false}
          plainLabel={t('landing.plain')}
          variant="missing"
          className="mt-3"
        />
      )}

      <p data-testid="want-list-legend" className="mt-2 text-xs text-neutral-700">
        {t('landing.wantKey')}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-neutral-300 pt-3 print:hidden">
        <button
          type="button"
          data-testid="want-list-print"
          onClick={() => {
            window.print();
            track('want_list_exported', { format: 'print', scope: 'sample' });
          }}
          className={ACTION_CLASSES}
        >
          {t('landing.wantPrint')}
        </button>
        <button
          type="button"
          data-testid="want-list-csv"
          onClick={() => {
            downloadMissingCsv({ slots }, LINCOLN_SAMPLE_CSV_NAME);
            track('want_list_exported', { format: 'csv', scope: 'sample' });
          }}
          className={ACTION_CLASSES}
        >
          {t('landing.wantCsv')}
        </button>
        <span data-testid="want-list-note" className="text-xs text-neutral-700">
          {t('landing.wantNote')}
        </span>
      </div>
    </section>
  );
}
