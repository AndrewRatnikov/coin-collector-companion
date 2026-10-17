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

function AlbumIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="2.75" cy="4" r="0.9" fill="currentColor" />
      <circle cx="2.75" cy="8" r="0.9" fill="currentColor" />
      <circle cx="2.75" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

// Album first (the default), then List. Under 900px only the icons show; the text stays
// as the accessible name.
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
        data-testid="set-editor-view-album-toggle"
        aria-pressed={view === 'album'}
        onClick={() => onChange('album')}
        className={`${SEGMENT_BUTTON_CLASSNAME} inline-flex items-center gap-1.5 max-[899px]:px-3`}
      >
        <AlbumIcon />
        <span className="max-[899px]:sr-only">{t('setEditor.viewAlbum')}</span>
      </button>
      <button
        type="button"
        data-testid="set-editor-view-list-toggle"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
        className={`${SEGMENT_BUTTON_CLASSNAME} inline-flex items-center gap-1.5 max-[899px]:px-3`}
      >
        <ListIcon />
        <span className="max-[899px]:sr-only">{t('setEditor.viewList')}</span>
      </button>
    </div>
  );
}
