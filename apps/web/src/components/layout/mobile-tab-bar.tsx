'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { getActiveNavItem, type NavItemId } from '@/lib/site-nav';

interface Tab {
  id: NavItemId;
  href: string;
  labelKey: MessageKey;
  testId: string;
  icon: ReactNode;
}

// 22px icons from R_NavMobile.dc.html.
const ICON_MY_SETS = (
  <>
    <rect x="3" y="4" width="16" height="14" rx="2" />
    <circle cx="8" cy="9" r="1.8" strokeWidth="1.4" />
    <circle cx="14" cy="9" r="1.8" strokeWidth="1.4" />
    <circle cx="8" cy="14" r="1.8" strokeWidth="1.4" />
    <circle cx="14" cy="14" r="1.8" strokeWidth="1.4" />
  </>
);

const ICON_COLLECTION = (
  <>
    <ellipse cx="11" cy="6.5" rx="6" ry="2.5" />
    <path d="M5 6.5v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6.5M5 11v4.5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V11" />
  </>
);

const ICON_CATALOG = (
  <path
    d="M3 5h5.5A2.5 2.5 0 0 1 11 7.5V18a2 2 0 0 0-2-2H3zM19 5h-5.5A2.5 2.5 0 0 0 11 7.5V18a2 2 0 0 1 2-2h6z"
    strokeLinejoin="round"
  />
);

const ICON_CHECKLISTS = (
  <path
    d="M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M10.5 6.5H18M10.5 12.5H18M4 17.5h14"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const ICON_GLOSSARY = (
  <>
    <path d="M5 4.5h9.5A2.5 2.5 0 0 1 17 7v11H7.5A2.5 2.5 0 0 1 5 15.5z" strokeLinejoin="round" />
    <path d="M8.5 8.5h5M8.5 11.5h5" strokeLinecap="round" />
  </>
);

const SIGNED_IN_TABS: Tab[] = [
  { id: 'my-sets', href: '/dashboard', labelKey: 'nav.mySets', testId: 'site-nav-tab-my-sets', icon: ICON_MY_SETS },
  {
    id: 'collection',
    href: '/collection',
    labelKey: 'nav.collection',
    testId: 'site-nav-tab-collection',
    icon: ICON_COLLECTION,
  },
  { id: 'catalog', href: '/catalog', labelKey: 'nav.catalog', testId: 'site-nav-tab-catalog', icon: ICON_CATALOG },
];

const SIGNED_OUT_TABS: Tab[] = [
  { id: 'catalog', href: '/catalog', labelKey: 'nav.catalog', testId: 'site-nav-tab-catalog', icon: ICON_CATALOG },
  {
    id: 'checklists',
    href: '/sets',
    labelKey: 'nav.checklists',
    testId: 'site-nav-tab-checklists',
    icon: ICON_CHECKLISTS,
  },
  {
    id: 'glossary',
    href: '/glossary',
    labelKey: 'nav.glossary',
    testId: 'site-nav-tab-glossary',
    icon: ICON_GLOSSARY,
  },
];

export interface MobileTabBarProps {
  isAuthenticated: boolean;
}

// Fixed bottom tab bar below 900px. SiteFooter carries 64px of extra bottom padding at
// the same breakpoint so the last content is never hidden behind it.
export function MobileTabBar({ isAuthenticated }: MobileTabBarProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const active = getActiveNavItem(pathname, isAuthenticated);
  const tabs = isAuthenticated ? SIGNED_IN_TABS : SIGNED_OUT_TABS;

  return (
    <nav
      aria-label={t('nav.mainLabel')}
      data-testid="site-nav-tabbar"
      className="fixed inset-x-0 bottom-0 z-[9] grid h-16 grid-cols-3 border-t border-[var(--color-divider)] bg-white min-[900px]:hidden print:hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            data-testid={tab.testId}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-[44px] flex-col items-center justify-center gap-1 ${
              isActive ? 'text-[var(--color-accent-700)]' : 'text-[var(--color-neutral-700)]'
            }`}
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className={isActive ? 'text-[var(--color-accent)]' : undefined}
            >
              {tab.icon}
            </svg>
            <span className="whitespace-nowrap text-[11px] font-medium">{t(tab.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
