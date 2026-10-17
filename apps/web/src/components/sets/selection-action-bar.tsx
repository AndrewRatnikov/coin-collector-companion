'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SelectionActionBarProps {
  count: number;
  onMarkOwned: () => void;
  onMarkMissing: () => void;
  onCancel: () => void;
}

const BUTTON_BASE =
  'inline-flex min-h-9 cursor-pointer items-center rounded-[var(--radius-md)] px-3.5 text-[13px] font-medium disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-200';

/** The sticky dark bar shown in select mode: "{n} selected", Mark owned, Mark missing, Cancel. */
export function SelectionActionBar({ count, onMarkOwned, onMarkMissing, onCancel }: SelectionActionBarProps) {
  const { t } = useTranslation();
  const [before, after = ''] = t('setPage.selectedCount').split('{n}');
  const nothing = count === 0;

  return (
    <div
      role="region"
      aria-label={t('setPage.selectionLabel')}
      data-testid="selection-bar"
      className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-lg)] bg-neutral-900 px-4 py-2.5 text-sm text-white shadow-lg"
    >
      <span data-testid="selection-bar-count" className="mr-auto">
        {before}
        <span className="font-mono font-medium tabular-nums">{count}</span>
        {after}
      </span>
      <button
        type="button"
        data-testid="selection-bar-mark-owned"
        disabled={nothing}
        onClick={onMarkOwned}
        className={`${BUTTON_BASE} bg-accent-700 text-white hover:bg-accent-800`}
      >
        {t('setPage.markOwned')}
      </button>
      <button
        type="button"
        data-testid="selection-bar-mark-missing"
        disabled={nothing}
        onClick={onMarkMissing}
        className={`${BUTTON_BASE} border border-neutral-500 text-white hover:border-white`}
      >
        {t('setPage.markMissing')}
      </button>
      <button
        type="button"
        data-testid="selection-bar-cancel"
        onClick={onCancel}
        className={`${BUTTON_BASE} text-neutral-300 hover:text-white`}
      >
        {t('setPage.cancel')}
      </button>
    </div>
  );
}
