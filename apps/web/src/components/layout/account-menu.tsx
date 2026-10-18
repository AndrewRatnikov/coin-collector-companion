'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import type { CurrentUser } from '@/lib/auth-api';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { Locale } from '@/lib/i18n/types';
import { getAccountDisplayName, getAvatarInitial } from '@/lib/site-nav';
import { AdminNavLink } from '@/components/layout/admin-nav-link';

const menuItemClassName =
  'flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left text-sm text-[var(--color-text)] outline-none hover:bg-[var(--color-surface)] focus-visible:bg-[var(--color-surface)]';

const ITEM_SELECTOR = '[role="menuitem"], [role="menuitemradio"]';

const LANGUAGE_OPTIONS: {
  value: Locale;
  text: string;
  testId: string;
  labelKey: 'languageSwitcher.english' | 'languageSwitcher.spanish';
}[] = [
  { value: 'en', text: 'EN', testId: 'site-nav-account-language-en', labelKey: 'languageSwitcher.english' },
  { value: 'es', text: 'ES', testId: 'site-nav-account-language-es', labelKey: 'languageSwitcher.spanish' },
];

// Menu items in DOM order. The language radios are hidden at 900px and wider, so a real
// browser skips them there; jsdom has no `checkVisibility`, so all items count.
function getMenuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
    (el) => typeof el.checkVisibility !== 'function' || el.checkVisibility(),
  );
}

function MenuIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-none text-[var(--color-neutral-700)]"
    >
      {children}
    </svg>
  );
}

export interface AccountMenuProps {
  user: CurrentUser | null;
  onLogout: () => void;
}

// Avatar trigger + account dropdown. Primary destinations (My sets, Collection, Catalog)
// live in SiteNav's bar; this menu holds the account-level items only.
export function AccountMenu({ user, onLogout }: AccountMenuProps) {
  const { t, locale, setLocale } = useTranslation();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const displayName = user ? getAccountDisplayName(user) : '';
  const initial = user ? getAvatarInitial(user) : '';

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    getMenuItems(menuRef.current)[0]?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    if (isOpen) {
      getMenuItems(menuRef.current)[0]?.focus();
    } else {
      setIsOpen(true);
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = getMenuItems(menuRef.current);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;

    switch (event.key) {
      case 'ArrowDown':
        next = current === -1 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current === -1 ? items.length - 1 : (current - 1 + items.length) % items.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    items[next].focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="site-nav-account-trigger"
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={user ? `${t('nav.accountMenuFor')} ${displayName}` : t('nav.accountMenu')}
        className="inline-flex h-11 items-center gap-1 rounded-full pl-[5px] pr-2 text-[var(--color-neutral-800)] hover:bg-[var(--color-surface)] aria-expanded:bg-[var(--color-surface)]"
      >
        <span
          data-testid="site-nav-account-avatar"
          aria-hidden="true"
          className="inline-flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-[var(--color-accent-200)] text-sm font-semibold text-[var(--color-accent-800)]"
        >
          {initial}
        </span>
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('nav.accountMenu')}
          data-testid="site-nav-account-menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-40 mt-2 flex min-w-[232px] flex-col rounded-[var(--radius-lg)] border border-[var(--color-neutral-300)] bg-white p-1.5 shadow-[var(--shadow-md)]"
        >
          {user && (
            <div
              data-testid="site-nav-account-header"
              className="mb-1.5 flex flex-col border-b border-[var(--color-neutral-200)] px-3 py-2"
            >
              <b data-testid="site-nav-account-name" className="text-sm font-semibold text-[var(--color-text)]">
                {displayName}
              </b>
              <span data-testid="site-nav-account-email" className="text-xs text-[var(--color-neutral-700)]">
                {user.email}
              </span>
            </div>
          )}

          <AdminNavLink role={user?.role} className={menuItemClassName} />

          <Link href="/settings" data-testid="site-nav-settings-link" role="menuitem" className={menuItemClassName}>
            <MenuIcon>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </MenuIcon>
            {t('nav.settings')}
          </Link>
          <Link
            href="/catalog/mine"
            data-testid="site-nav-my-submissions-link"
            role="menuitem"
            className={menuItemClassName}
          >
            <MenuIcon>
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z" />
              <path d="M14 3v6h6" />
              <path d="M9 14h6M9 18h4" />
            </MenuIcon>
            {t('nav.mySubmissions')}
          </Link>
          <Link
            href="/collection/import"
            data-testid="site-nav-import-link"
            role="menuitem"
            className={menuItemClassName}
          >
            <MenuIcon>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
              <path d="M12 15V3" />
            </MenuIcon>
            {t('nav.importCollection')}
          </Link>

          <hr role="separator" className="mx-1 my-1.5 h-px border-0 bg-[var(--color-neutral-200)]" />

          <div
            role="group"
            aria-label={t('nav.languageLabel')}
            data-testid="site-nav-account-language"
            className="flex items-center justify-between gap-2 px-3 py-1 min-[900px]:hidden"
          >
            <span aria-hidden="true" className="text-sm text-[var(--color-text)]">
              {t('nav.languageLabel')}
            </span>
            <span className="inline-flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-neutral-300)]">
              {LANGUAGE_OPTIONS.map((option) => {
                const checked = locale === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    aria-label={t(option.labelKey)}
                    data-testid={option.testId}
                    onClick={() => setLocale(option.value)}
                    className={
                      checked
                        ? 'h-[30px] bg-[var(--color-text)] px-2.5 text-xs font-medium text-white outline-none'
                        : 'h-[30px] bg-transparent px-2.5 text-xs font-medium text-[var(--color-neutral-700)] outline-none focus-visible:bg-[var(--color-surface)]'
                    }
                  >
                    {option.text}
                  </button>
                );
              })}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            data-testid="site-nav-logout"
            role="menuitem"
            className={menuItemClassName}
          >
            <MenuIcon>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="m16 17 5-5-5-5" />
              <path d="M21 12H9" />
            </MenuIcon>
            {t('nav.logOut')}
          </button>
        </div>
      )}
    </div>
  );
}
