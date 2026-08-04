'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

const TABS: Array<{ href: string; testId: string; labelKey: MessageKey }> = [
  { href: '/settings', testId: 'settings-tab-account', labelKey: 'settings.accountTabLabel' },
  { href: '/settings/feedback', testId: 'settings-tab-feedback', labelKey: 'settings.feedbackTabLabel' },
];

export function SettingsTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div data-testid="settings-tabs" className="flex gap-6 border-b border-[color:var(--color-divider)]">
      {TABS.map((tab) => {
        // Exact match, not startsWith: '/settings' is a prefix of '/settings/feedback',
        // unlike SetsTabs's two hrefs which don't prefix each other.
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={tab.testId}
            aria-current={isActive ? 'page' : undefined}
            className={
              isActive
                ? 'border-b-2 border-[color:var(--color-accent)] pb-3 text-[15px] font-medium text-[color:var(--color-text)]'
                : 'border-b-2 border-transparent pb-3 text-[15px] text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-text)]'
            }
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
