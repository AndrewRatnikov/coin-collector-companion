'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CoinRowMenuProps {
  coinId: string;
  coinTitle: string;
  otherSets: Array<{ id: string; name: string }>;
  onRemove: () => void;
  onAddToSet: (setId: string) => void;
}

type Panel = 'main' | 'sets';

const ITEM_BASE_CLASSNAME =
  'flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left text-sm hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent';
const ITEM_CLASSNAME = `${ITEM_BASE_CLASSNAME} text-text`;

function OpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Enabled menu items in DOM order (disabled buttons are skipped).
function enabledItems(menu: HTMLElement | null): HTMLElement[] {
  if (!menu) return [];
  return Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).filter(
    (item) => !item.hasAttribute('disabled') && item.getAttribute('aria-disabled') !== 'true',
  );
}

/**
 * The ⋯ menu on a set list row: Open coin page, Add to another set… (a second panel listing the
 * user's other sets) and Remove from set. Keyboard handling matches SetActionsMenu: focus lands
 * on the first enabled item, arrows / Home / End move (wrapping), Escape closes and refocuses
 * the trigger, Tab or an outside mousedown closes.
 */
export function CoinRowMenu({ coinId, coinTitle, otherSets, onRemove, onAddToSet }: CoinRowMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>('main');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    enabledItems(menuRef.current)[0]?.focus();
  }, [isOpen, panel]);

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
    const items = enabledItems(menuRef.current);
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

  function toggle() {
    setPanel('main');
    setIsOpen((open) => !open);
  }

  function run(action: () => void) {
    setIsOpen(false);
    setPanel('main');
    action();
  }

  const label = t('setPage.rowMenuLabel').split('{title}').join(coinTitle);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="coin-row-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        className="relative z-[3] inline-flex size-11 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-neutral-700 hover:bg-neutral-200 hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="9" r="1.6" />
          <circle cx="9" cy="9" r="1.6" />
          <circle cx="14" cy="9" r="1.6" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          data-testid="coin-row-menu"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-12 z-40 flex w-60 flex-col rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-1.5 shadow-lg"
        >
          {panel === 'main' ? (
            <>
              <Link
                href={`/catalog/${coinId}`}
                role="menuitem"
                tabIndex={-1}
                data-testid="coin-row-menu-open"
                onClick={() => setIsOpen(false)}
                className={ITEM_CLASSNAME}
              >
                <OpenIcon />
                {t('setPage.openCoinPage')}
              </Link>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-testid="coin-row-menu-add-to-set"
                onClick={() => setPanel('sets')}
                className={ITEM_CLASSNAME}
              >
                <AddIcon />
                {t('setPage.addToAnotherSet')}
              </button>
              <span aria-hidden="true" className="mx-1 my-1.5 h-px bg-neutral-200" />
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-testid="coin-row-menu-remove"
                onClick={() => run(onRemove)}
                className={`${ITEM_BASE_CLASSNAME} font-medium text-danger`}
              >
                <TrashIcon />
                {t('setPage.removeFromSet')}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                data-testid="coin-row-menu-back"
                onClick={() => setPanel('main')}
                className={`${ITEM_CLASSNAME} font-medium`}
              >
                {t('setPage.backToMenu')}
              </button>
              <span aria-hidden="true" className="mx-1 my-1.5 h-px bg-neutral-200" />
              {otherSets.length === 0 ? (
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled
                  data-testid="coin-row-menu-no-sets"
                  className={`${ITEM_BASE_CLASSNAME} text-neutral-700`}
                >
                  {t('setPage.noOtherSets')}
                </button>
              ) : (
                otherSets.map((set) => (
                  <button
                    key={set.id}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    data-testid="coin-row-menu-set-item"
                    onClick={() => run(() => onAddToSet(set.id))}
                    className={`${ITEM_CLASSNAME} [overflow-wrap:anywhere]`}
                  >
                    {set.name}
                  </button>
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
