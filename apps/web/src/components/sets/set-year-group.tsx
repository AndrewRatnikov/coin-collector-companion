'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetYearGroupProps {
  year: number;
  ownedCount: number;
  totalCount: number;
  markAllCount: number;
  /** The Mark all button renders only when this is given and markAllCount > 0. */
  onMarkAll?: () => void;
  children: ReactNode;
}

/** One year of a set: the mono year header, "N of M owned", a rule, and the optional Mark all. */
export function SetYearGroup({ year, ownedCount, totalCount, markAllCount, onMarkAll, children }: SetYearGroupProps) {
  const { t } = useTranslation();
  const yearText = String(year);

  const markAllLabel =
    markAllCount === 1 ? t('setPage.markOneOwned') : t('setPage.markAllOwned').split('{n}').join(String(markAllCount));

  return (
    <section data-testid="set-year-group" data-year={yearText} aria-label={yearText} className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        <h2
          data-testid="set-year-group-year"
          className="font-mono text-[20px] font-medium leading-none tabular-nums text-text max-[899px]:text-[18px]"
        >
          {yearText}
        </h2>
        <span data-testid="set-year-group-summary" className="font-mono text-[13px] tabular-nums text-neutral-700">
          {t('setPage.groupOwnedOfTotal')
            .split('{owned}')
            .join(String(ownedCount))
            .split('{total}')
            .join(String(totalCount))}
        </span>
        <span aria-hidden="true" className="h-px min-w-6 flex-1 bg-divider" />
        {onMarkAll && markAllCount > 0 && (
          <button
            type="button"
            data-testid="set-year-group-mark-all"
            onClick={onMarkAll}
            className="min-h-9 cursor-pointer rounded-[var(--radius-md)] px-3 text-[13px] font-medium text-accent-700 hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 max-[899px]:hidden"
          >
            {markAllLabel}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
