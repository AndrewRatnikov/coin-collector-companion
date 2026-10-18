'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCurrentUser, logout, type CurrentUser } from '@/lib/auth-api';
import { getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { getActiveNavItem, getMobilePageAction, getMobilePageTitleKey, type NavItemId } from '@/lib/site-nav';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { AccountMenu } from '@/components/layout/account-menu';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';

interface PrimaryItem {
  id: NavItemId;
  href: string;
  labelKey: MessageKey;
  testId: string;
}

const SIGNED_IN_ITEMS: PrimaryItem[] = [
  { id: 'my-sets', href: '/dashboard', labelKey: 'nav.mySets', testId: 'site-nav-my-sets-link' },
  { id: 'collection', href: '/collection', labelKey: 'nav.collection', testId: 'site-nav-collection-link' },
  { id: 'catalog', href: '/catalog', labelKey: 'nav.catalog', testId: 'site-nav-catalog-link' },
];

const SIGNED_OUT_ITEMS: PrimaryItem[] = [
  { id: 'catalog', href: '/catalog', labelKey: 'nav.catalog', testId: 'site-nav-catalog-link' },
  { id: 'checklists', href: '/sets', labelKey: 'nav.checklists', testId: 'site-nav-checklists-link' },
];

const primaryLinkClassName =
  'relative flex h-16 items-center whitespace-nowrap px-3 text-[15px] text-[var(--color-neutral-800)] hover:text-[var(--color-text)]';

// The 2px accent bar sits at bottom -1px, on top of the header's bottom border.
const primaryLinkActiveClassName =
  'font-medium text-[var(--color-text)] after:absolute after:inset-x-3 after:bottom-[-1px] after:h-0.5 after:bg-[var(--color-accent)]';

// One responsive header: the 64px desktop bar at 900px and wider, the 56px mobile top bar
// below it, plus the fixed MobileTabBar (rendered as a sibling).
export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    setIsAuthenticated(Boolean(getStoredToken()));
  }, [pathname]);

  // One /auth/me per transition to signed in; it feeds the avatar, the menu header and
  // the Admin item. Plain effect + state rather than react-query, so SiteNav keeps working
  // without a QueryClientProvider. On error the user stays null (no Admin item); a failed
  // /auth/me is handled elsewhere (apiFetch's 401 flow).
  useEffect(() => {
    if (!isAuthenticated) {
      // Signed out (logout, or apiFetch cleared the token): drop the previous account.
      setUser(null);
      return;
    }
    let active = true;
    getCurrentUser()
      .then((current) => {
        if (active) setUser(current);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  // logout() awaits the server call (which revokes the refresh token) and then clears
  // the stored token itself.
  async function handleLogout() {
    await logout();
    setIsAuthenticated(false);
    setUser(null);
    router.push('/login');
  }

  const activeItem = getActiveNavItem(pathname, isAuthenticated);
  const pageAction = isAuthenticated ? getMobilePageAction(pathname) : null;
  const items = isAuthenticated ? SIGNED_IN_ITEMS : SIGNED_OUT_ITEMS;

  return (
    <>
      <header
        data-testid="site-nav"
        className="sticky top-0 z-[9] border-b border-[var(--color-divider)] bg-[var(--color-bg)] print:hidden"
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 min-[900px]:h-16 min-[900px]:gap-7 min-[900px]:px-10">
          <Link
            href="/"
            data-testid="site-nav-brand"
            className="flex flex-none items-center gap-2.5 whitespace-nowrap font-heading text-[22px] font-semibold text-[var(--color-text)] min-[900px]:text-2xl"
          >
            <Image src="/coin-logo.png" alt="" width={28} height={28} priority />
            <span className={isAuthenticated ? 'hidden min-[900px]:inline' : undefined}>{t('nav.brand')}</span>
          </Link>

          {isAuthenticated && (
            <span
              data-testid="site-nav-page-title"
              className="min-w-0 flex-1 truncate text-base font-medium text-[var(--color-text)] min-[900px]:hidden"
            >
              {t(getMobilePageTitleKey(pathname))}
            </span>
          )}

          <nav
            aria-label={t('nav.mainLabel')}
            data-testid="site-nav-main"
            className="hidden h-16 items-stretch min-[900px]:flex"
          >
            {items.map((item) => {
              const isActive = item.id === activeItem;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  data-testid={item.testId}
                  aria-current={isActive ? 'page' : undefined}
                  className={isActive ? `${primaryLinkClassName} ${primaryLinkActiveClassName}` : primaryLinkClassName}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2">
            {pageAction && (
              <Link
                href={pageAction.href}
                data-testid="site-nav-page-action"
                aria-label={t(pageAction.labelKey)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-neutral-800)] hover:bg-[var(--color-surface)] min-[900px]:hidden"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </Link>
            )}
            <div className="hidden min-[900px]:block">
              <LanguageSwitcher />
            </div>
            {isAuthenticated ? (
              <AccountMenu user={user} onLogout={handleLogout} />
            ) : (
              <>
                <Link
                  href="/login"
                  data-testid="site-nav-login-link"
                  className="inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] border border-[var(--color-neutral-400)] bg-white px-3 text-[13px] font-medium text-[var(--color-text)] hover:border-[var(--color-accent)] min-[900px]:min-h-11 min-[900px]:border-transparent min-[900px]:bg-transparent min-[900px]:px-[18px] min-[900px]:text-sm min-[900px]:text-[var(--color-neutral-800)] min-[900px]:hover:bg-[var(--color-surface)]"
                >
                  {t('nav.logIn')}
                </Link>
                <Link
                  href="/signup"
                  data-testid="site-nav-signup-link"
                  className="hidden min-h-11 items-center justify-center whitespace-nowrap rounded-[var(--radius-md)] bg-[var(--color-accent-700)] px-[18px] text-sm font-medium text-white hover:bg-[var(--color-accent-800)] min-[900px]:inline-flex"
                >
                  {t('nav.createAccount')}
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <MobileTabBar isAuthenticated={isAuthenticated} />
    </>
  );
}
