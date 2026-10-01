'use client';

import { useEffect, useState } from 'react';
import { consumeAccountDeletedNotice } from '@/lib/account-deleted-notice';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function AccountDeletedNotice() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  // Never sets `visible` back to false, so StrictMode's double effect (which consumes the
  // flag on the first run) can't hide the notice.
  useEffect(() => {
    if (consumeAccountDeletedNotice()) {
      setVisible(true);
    }
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <p
      role="status"
      data-testid="account-deleted-notice"
      className="rounded-[var(--radius-sm)] border border-[var(--color-divider)] px-4 py-3 text-sm text-[var(--color-text)]"
    >
      {t('home.accountDeletedNotice')}
    </p>
  );
}
