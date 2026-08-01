'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

const TABS: Array<{ href: string; testId: string; labelKey: MessageKey }> = [
  { href: '/sets/canonical', testId: 'sets-tab-canonical', labelKey: 'nav.canonicalSets' },
  { href: '/sets/public', testId: 'sets-tab-public', labelKey: 'nav.publicSets' },
];

export function SetsTabs() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <div data-testid="sets-tabs" className="flex gap-6 border-b border-[color:var(--color-divider)]">
      {TABS.map((tab) => {
        const isActive = pathname?.startsWith(tab.href) ?? false;
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
