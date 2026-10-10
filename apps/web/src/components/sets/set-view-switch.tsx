'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import type { SetView } from '@/lib/set-view';

export interface SetViewSwitchProps {
  view: SetView;
  onChange: (view: SetView) => void;
}

export const SEGMENT_BUTTON_CLASSNAME =
  'min-h-[38px] rounded-[5px] px-4 text-sm text-neutral-800 aria-pressed:bg-white aria-pressed:font-medium aria-pressed:text-text aria-pressed:shadow-sm';
export const SEGMENT_GROUP_CLASSNAME = 'flex items-center gap-0.5 rounded-[var(--radius-lg)] bg-surface p-[3px]';

export function SetViewSwitch({ view, onChange }: SetViewSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      data-testid="set-editor-view-switch"
      aria-label={t('setEditor.viewSwitchLabel')}
      className={SEGMENT_GROUP_CLASSNAME}
    >
      <button
        type="button"
        data-testid="set-editor-view-list-toggle"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
        className={SEGMENT_BUTTON_CLASSNAME}
      >
        {t('setEditor.viewList')}
      </button>
      <button
        type="button"
        data-testid="set-editor-view-album-toggle"
        aria-pressed={view === 'album'}
        onClick={() => onChange('album')}
        className={SEGMENT_BUTTON_CLASSNAME}
      >
        {t('setEditor.viewAlbum')}
      </button>
    </div>
  );
}
