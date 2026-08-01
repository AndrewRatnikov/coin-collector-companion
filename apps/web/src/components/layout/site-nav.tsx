'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearStoredToken, getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

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

  function handleLogout() {
    clearStoredToken();
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
        <Link href="/sets/canonical" data-testid="site-nav-canonical-link" className={navLinkClassName}>
          {t('nav.canonicalSets')}
        </Link>
        <Link href="/sets/public" data-testid="site-nav-public-link" className={navLinkClassName}>
          {t('nav.publicSets')}
        </Link>
        <Link href="/glossary" data-testid="site-nav-glossary-link" className={navLinkClassName}>
          {t('nav.glossary')}
        </Link>
        <div className="flex items-center gap-6 border-l border-[var(--color-divider)] pl-6">
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" data-testid="site-nav-dashboard-link" className={navLinkClassName}>
                {t('nav.dashboard')}
              </Link>
              <Link href="/collection" data-testid="site-nav-collection-link" className={navLinkClassName}>
                {t('nav.collection')}
              </Link>
              <Link href="/catalog/mine" data-testid="site-nav-my-submissions-link" className={navLinkClassName}>
                {t('nav.mySubmissions')}
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                data-testid="site-nav-logout"
                className="text-[13px] text-[var(--color-neutral-600)] transition-colors hover:text-[var(--color-accent)]"
              >
                {t('nav.logOut')}
              </button>
            </>
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
