'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

export type AddToSetStatus = 'available' | 'adding' | 'added' | 'loading';

export interface AddToSetMenuSet {
  id: string;
  name: string;
  status: AddToSetStatus;
}

export interface AddToSetMenuProps {
  coinTitle: string;
  sets: AddToSetMenuSet[];
  onAdd: (setId: string) => void;
}

const ITEM_CLASSNAME =
  'flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left text-sm text-text hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent-700 aria-disabled:cursor-default';

const MARK_KEYS: Record<AddToSetStatus, MessageKey> = {
  available: 'coinDetail.addToSetAdd',
  adding: 'coinDetail.addToSetAdding',
  added: 'coinDetail.addToSetAdded',
  loading: 'coinDetail.addToSetAdd',
};

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

// Every item in DOM order, inert ones included, so a screen reader still reaches "Added, checked".
function menuItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"], [role="menuitem"]'));
}

/**
 * "Add to a set…" on the coin page: a menu of the user's sets as menuitemcheckbox items
 * (sets that already hold the coin are checked and inert) plus a "New set with this coin" link.
 * Adding leaves the menu open. Keyboard handling follows CoinRowMenu: focus lands on the first
 * item, arrows / Home / End move (wrapping), Escape closes and refocuses the trigger, Tab or an
 * outside mousedown closes.
 */
export function AddToSetMenu({ coinTitle, sets, onAdd }: AddToSetMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    menuItems(menuRef.current)[0]?.focus();
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
      } else if (event.key === 'Tab') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const items = menuItems(menuRef.current);
    if (items.length === 0) return;
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (event.key) {
      case 'ArrowDown':
        next = current < 0 ? 0 : (current + 1) % items.length;
        break;
      case 'ArrowUp':
        next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length;
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

  const label = t('coinDetail.addToSet');
  const title = t('coinDetail.addToSetMenuTitle').split('{title}').join(coinTitle);

  return (
    <div ref={containerRef} className="relative w-fit">
      <button
        ref={triggerRef}
        type="button"
        data-testid="coin-detail-add-to-set"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex min-h-11 cursor-pointer items-center gap-2 whitespace-normal rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3.5 text-sm font-medium text-text hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
      >
        <PlusIcon />
        {label}
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          data-testid="coin-detail-add-to-set-menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-12 z-40 flex w-[min(320px,calc(100vw-32px))] flex-col rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-1.5 shadow-lg"
        >
          <p className="px-3 pb-1.5 pt-2 text-xs font-medium text-neutral-700 [overflow-wrap:anywhere]">{title}</p>
          {sets.map((set) => {
            const inert = set.status !== 'available';
            const added = set.status === 'added';
            return (
              <button
                key={set.id}
                type="button"
                role="menuitemcheckbox"
                tabIndex={-1}
                data-testid="coin-detail-add-to-set-item"
                data-set-id={set.id}
                aria-checked={added}
                aria-disabled={inert || undefined}
                onClick={() => {
                  if (!inert) onAdd(set.id);
                }}
                className={ITEM_CLASSNAME}
              >
                <span className="min-w-0 flex-1 truncate">{set.name}</span>
                <span
                  className={
                    added
                      ? 'flex-none font-semibold text-accent-700'
                      : `flex-none ${inert ? 'text-neutral-600' : 'font-medium text-accent-700'}`
                  }
                >
                  {t(MARK_KEYS[set.status])}
                </span>
              </button>
            );
          })}
          <span aria-hidden="true" className="mx-1 my-1.5 h-px bg-neutral-200" />
          <Link
            href="/sets/new"
            role="menuitem"
            tabIndex={-1}
            data-testid="coin-detail-add-to-set-new"
            onClick={() => setIsOpen(false)}
            className={`${ITEM_CLASSNAME} font-medium`}
          >
            <PlusIcon />
            {t('coinDetail.newSetWithCoin')}
          </Link>
        </div>
      )}
    </div>
  );
}
