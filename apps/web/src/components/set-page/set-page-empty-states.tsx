'use client';

import { Badge } from '@/components/ui/badge';
import { FOCUS_RING } from '@/components/set-page/set-page-shared';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetPageEmptyProps {
  isOwner: boolean;
}

export interface SetPageShowAllProps {
  /** Switches the filter back to All. */
  onShowAll: () => void;
}

/** A set with no coins at all; owners also get a hint on how to add some. */
export function SetPageEmpty({ isOwner }: SetPageEmptyProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] bg-surface px-5 py-8 text-center">
      <p data-testid="set-editor-empty" className="text-base font-semibold text-text">
        {t('setPage.empty')}
      </p>
      {isOwner && (
        <p data-testid="set-editor-empty-owner-hint" className="text-sm text-neutral-700">
          {t('setPage.emptyOwnerHint')}
        </p>
      )}
    </div>
  );
}

/** The Upgrade filter with nothing left to upgrade. */
export function SetPageUpgradeEmpty({ onShowAll }: SetPageShowAllProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="set-editor-upgrade-empty"
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-5 py-10 text-center"
    >
      <p className="text-base font-semibold text-text">{t('setPage.upgradeEmptyTitle')}</p>
      <button
        type="button"
        data-testid="set-editor-upgrade-show-all"
        onClick={() => onShowAll()}
        className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] px-2 text-sm font-medium text-accent-700 underline hover:text-accent-800 ${FOCUS_RING}`}
      >
        {t('setPage.showAllCoins')}
      </button>
    </div>
  );
}

/** The Missing filter on a complete set. */
export function SetPageCompleteEmpty({ onShowAll }: SetPageShowAllProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="set-editor-complete-empty"
      className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-5 py-10 text-center"
    >
      <Badge variant="complete" />
      <p className="text-base font-semibold text-text">{t('setPage.completeTitle')}</p>
      <button
        type="button"
        data-testid="set-editor-show-all-coins"
        onClick={() => onShowAll()}
        className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] px-2 text-sm font-medium text-accent-700 underline hover:text-accent-800 ${FOCUS_RING}`}
      >
        {t('setPage.showAllCoins')}
      </button>
    </div>
  );
}
