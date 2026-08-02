'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/auth-api';
import { getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { AccountMenu } from '@/components/layout/account-menu';

const navLinkClassName =
  'text-[13px] text-[var(--color-text)] opacity-70 transition-opacity hover:text-[var(--color-accent)] hover:opacity-100';

export function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(Boolean(getStoredToken()));
  }, [pathname]);

  // Awaits logout() (backlog_password-management.md Step 2, task 2.12) — today's purely
  // client-side logout no longer actually ends the session once a server-tracked refresh
  // token exists; logout() itself clears the stored token after the server call resolves.
  async function handleLogout() {
    await logout();
    setIsAuthenticated(false);
    router.push('/login');
  }

  return (
    <nav
      data-testid="site-nav"
      className="sticky top-0 z-[9] border-b border-[var(--color-divider)] bg-[var(--color-bg)]"
    >
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center gap-6 px-[clamp(20px,5vw,48px)] py-4">
        <Link
          href="/"
          data-testid="site-nav-brand"
          className="mr-auto flex items-center gap-2 font-heading text-[19px] font-semibold text-[var(--color-text)]"
        >
          <Image src="/coin-logo.png" alt="" width={24} height={24} priority />
          {t('nav.brand')}
        </Link>
        <Link href="/catalog" data-testid="site-nav-catalog-link" className={navLinkClassName}>
          {t('nav.catalog')}
        </Link>
        <Link href="/sets" data-testid="site-nav-sets-link" className={navLinkClassName}>
          {t('nav.sets')}
        </Link>
        <Link href="/glossary" data-testid="site-nav-glossary-link" className={navLinkClassName}>
          {t('nav.glossary')}
        </Link>
        <div className="flex items-center gap-6 border-l border-[var(--color-divider)] pl-6">
          {isAuthenticated ? (
            <AccountMenu onLogout={handleLogout} />
          ) : (
            <>
              <Link href="/login" data-testid="site-nav-login-link" className={navLinkClassName}>
                {t('nav.logIn')}
              </Link>
              <Link href="/signup" data-testid="site-nav-signup-link" className={navLinkClassName}>
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </div>
        <LanguageSwitcher />
      </div>
    </nav>
  );
}
