'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export interface ServerWakingNoticeProps {
  show: boolean;
  className?: string;
}

/**
 * One quiet status line for a cold API ("Waking the server..."). Callers pass the
 * useSlowLoading result, so it appears only after a few seconds of loading. Renders nothing otherwise.
 */
export function ServerWakingNotice({ show, className = '' }: ServerWakingNoticeProps) {
  const { t } = useTranslation();
  if (!show) return null;

  return (
    <p
      data-testid="server-waking-notice"
      role="status"
      aria-live="polite"
      className={`text-[13px] text-neutral-700 ${className}`.trimEnd()}
    >
      {t('common.serverWaking')}
    </p>
  );
}
