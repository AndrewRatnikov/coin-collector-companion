'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetPageLiveRegionProps {
  message: string;
}

/** The hint above the groups while select mode is on. */
export function SetPageSelectHint() {
  const { t } = useTranslation();
  return (
    <p data-testid="set-editor-select-hint" className="text-sm text-neutral-700">
      {t('setPage.selectHint')}
    </p>
  );
}

/** The polite live region that announces toggles, bulk changes and failures. */
export function SetPageLiveRegion({ message }: SetPageLiveRegionProps) {
  return (
    <p data-testid="set-editor-live" role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
