'use client';

import { useEffect, useState } from 'react';
import { consumeSetDeletedNotice } from '@/lib/set-deleted-notice';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function SetDeletedNotice() {
  const { t } = useTranslation();
  const [name, setName] = useState<string | null>(null);

  // Never resets `name` to null, so StrictMode's double effect (which consumes the
  // flag on the first run) can't hide the notice.
  useEffect(() => {
    const deletedName = consumeSetDeletedNotice();
    if (deletedName) {
      setName(deletedName);
    }
  }, []);

  if (!name) {
    return null;
  }

  return (
    <p
      role="status"
      data-testid="set-deleted-notice"
      className="rounded-[var(--radius-md)] border border-divider bg-accent-100 px-4 py-3 text-sm text-accent-800"
    >
      {t('setEditor.deletedNotice').split('{name}').join(name)}
    </p>
  );
}
