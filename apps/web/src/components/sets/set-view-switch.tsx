'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import type { SetView } from '@/lib/set-view';

export interface SetViewSwitchProps {
  view: SetView;
  onChange: (view: SetView) => void;
}

const BUTTON_CLASSNAME = 'rounded border border-gray-300 px-3 py-1 text-sm aria-pressed:bg-surface';

export function SetViewSwitch({ view, onChange }: SetViewSwitchProps) {
  const { t } = useTranslation();

  return (
    <div
      role="group"
      data-testid="set-editor-view-switch"
      aria-label={t('setEditor.viewSwitchLabel')}
      className="flex items-center gap-1"
    >
      <button
        type="button"
        data-testid="set-editor-view-list-toggle"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
        className={BUTTON_CLASSNAME}
      >
        {t('setEditor.viewList')}
      </button>
      <button
        type="button"
        data-testid="set-editor-view-album-toggle"
        aria-pressed={view === 'album'}
        onClick={() => onChange('album')}
        className={BUTTON_CLASSNAME}
      >
        {t('setEditor.viewAlbum')}
      </button>
    </div>
  );
}
