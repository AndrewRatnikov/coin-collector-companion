'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

const menuLinkClassName =
  'block px-4 py-2 text-[13px] text-[var(--color-text)] opacity-70 transition-opacity hover:text-[var(--color-accent)] hover:opacity-100';

export interface AccountMenuProps {
  onLogout: () => void;
}

// Collapses the authenticated nav links (Dashboard/Collection/My Submissions/Log
// out) behind a single trigger — these used to render as four separate items
// directly in SiteNav's row, which was what pushed it onto a second line.
export function AccountMenu({ onLogout }: AccountMenuProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        data-testid="site-nav-account-trigger"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="flex items-center gap-1 text-[13px] text-[var(--color-text)] opacity-70 transition-opacity hover:text-[var(--color-accent)] hover:opacity-100"
      >
        {t('nav.account')}
        <span aria-hidden="true" className="text-[10px]">
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          role="menu"
          data-testid="site-nav-account-menu"
          className="absolute right-0 top-full z-10 mt-2 w-44 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-bg)] py-1 shadow-[var(--shadow-md)]"
        >
          <Link href="/dashboard" data-testid="site-nav-dashboard-link" className={menuLinkClassName} role="menuitem">
            {t('nav.dashboard')}
          </Link>
          <Link
            href="/collection"
            data-testid="site-nav-collection-link"
            className={menuLinkClassName}
            role="menuitem"
          >
            {t('nav.collection')}
          </Link>
          <Link
            href="/catalog/mine"
            data-testid="site-nav-my-submissions-link"
            className={menuLinkClassName}
            role="menuitem"
          >
            {t('nav.mySubmissions')}
          </Link>
          <Link href="/settings" data-testid="site-nav-settings-link" className={menuLinkClassName} role="menuitem">
            {t('nav.settings')}
          </Link>
          <button
            type="button"
            onClick={onLogout}
            data-testid="site-nav-logout"
            role="menuitem"
            className="block w-full px-4 py-2 text-left text-[13px] text-[var(--color-neutral-600)] transition-colors hover:text-[var(--color-accent)]"
          >
            {t('nav.logOut')}
          </button>
        </div>
      )}
    </div>
  );
}
