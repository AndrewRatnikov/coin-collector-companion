'use client';

import type { ReactNode } from 'react';
import { SEGMENT_BUTTON_CLASSNAME, SEGMENT_GROUP_CLASSNAME, SetViewSwitch } from '@/components/sets/set-view-switch';
import { PlusIcon } from '@/components/ui/icons';
import { FOCUS_RING, type SetFilter } from '@/components/set-page/set-page-shared';
import type { SetView } from '@/lib/set-view';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetPageToolbarProps {
  activeFilter: SetFilter;
  onFilterChange: (filter: SetFilter) => void;
  totalCount: number;
  missingCount: number;
  showUpgrades: boolean;
  upgradeCount: number;
  view: SetView;
  onViewChange: (view: SetView) => void;
  isOwner: boolean;
  isAlbum: boolean;
  selectMode: boolean;
  onEnterSelectMode: () => void;
  onLeaveSelectMode: () => void;
  pickerOpen: boolean;
  onOpenPicker: () => void;
  /** The <SetActionsMenu …/> element, rendered last in the owner actions cell. */
  actionsMenu: ReactNode;
}

/**
 * The header's two lower grid cells: the Show filters with the view switch, and (owner only) the
 * actions cell. Returns a fragment so both cells stay direct children of the header grid.
 */
export function SetPageToolbar({
  activeFilter,
  onFilterChange,
  totalCount,
  missingCount,
  showUpgrades,
  upgradeCount,
  view,
  onViewChange,
  isOwner,
  isAlbum,
  selectMode,
  onEnterSelectMode,
  onLeaveSelectMode,
  pickerOpen,
  onOpenPicker,
  actionsMenu,
}: SetPageToolbarProps) {
  const { t } = useTranslation();
  return (
    <>
      <div className="[grid-area:segs] flex min-w-0 flex-wrap items-center gap-3">
        <div role="group" aria-label={t('setEditor.showLabel')} className={SEGMENT_GROUP_CLASSNAME}>
          <button
            type="button"
            data-testid="set-editor-show-all-toggle"
            aria-pressed={activeFilter === 'all'}
            onClick={() => onFilterChange('all')}
            className={SEGMENT_BUTTON_CLASSNAME}
          >
            {t('setPage.showAll')} <span className="font-mono tabular-nums">{totalCount}</span>
          </button>
          <button
            type="button"
            data-testid="set-editor-show-missing-toggle"
            aria-pressed={activeFilter === 'missing'}
            onClick={() => onFilterChange('missing')}
            className={SEGMENT_BUTTON_CLASSNAME}
          >
            {t('setPage.showMissing')} <span className="font-mono tabular-nums">{missingCount}</span>
          </button>
          {showUpgrades && (
            <button
              type="button"
              data-testid="set-editor-show-upgrade-toggle"
              aria-pressed={activeFilter === 'upgrade'}
              onClick={() => onFilterChange('upgrade')}
              className={SEGMENT_BUTTON_CLASSNAME}
            >
              {t('setPage.showNeedsUpgrade')} <span className="font-mono tabular-nums">{upgradeCount}</span>
            </button>
          )}
        </div>
        <SetViewSwitch view={view} onChange={onViewChange} />
      </div>

      {isOwner && (
        <div className="[grid-area:actions] flex flex-wrap items-center justify-end gap-2 justify-self-end">
          {isAlbum && (
            <button
              type="button"
              data-testid="set-editor-select-toggle"
              aria-pressed={selectMode}
              onClick={() => (selectMode ? onLeaveSelectMode() : onEnterSelectMode())}
              className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] border border-neutral-400 bg-white px-4 text-sm font-medium text-text hover:border-accent aria-pressed:border-accent-700 aria-pressed:bg-accent-100 aria-pressed:text-accent-800 max-[899px]:hidden ${FOCUS_RING}`}
            >
              {selectMode ? t('setPage.doneSelecting') : t('setPage.select')}
            </button>
          )}
          <button
            type="button"
            data-testid="set-editor-toggle-add-coins"
            aria-haspopup="dialog"
            aria-expanded={pickerOpen}
            onClick={onOpenPicker}
            className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-accent-700 px-4 text-sm font-medium text-white hover:bg-accent-800 max-[899px]:px-0 ${FOCUS_RING}`}
          >
            <PlusIcon />
            <span className="max-[899px]:sr-only">{t('setEditor.addCoins')}</span>
          </button>
          {actionsMenu}
        </div>
      )}
    </>
  );
}
