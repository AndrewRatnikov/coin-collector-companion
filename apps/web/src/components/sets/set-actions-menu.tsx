'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetActionsMenuProps {
  /** Owner-only items (rename, delete) are omitted when the handler is absent. */
  onRename?: () => void;
  onDelete?: () => void;
  onDownloadMissing: () => void;
  printMissingHref: string;
  nothingMissing: boolean;
}

const ITEM_CLASSNAME =
  'flex min-h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-left text-sm text-text hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50';

function RenameIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.5 2.5l3 3L6 13H3v-3l7.5-7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
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

// The ⋯ menu on the set page: rename / download / print / delete behind one trigger.
export function SetActionsMenu({
  onRename,
  onDelete,
  onDownloadMissing,
  printMissingHref,
  nothingMissing,
}: SetActionsMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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

  function run(action: () => void) {
    setIsOpen(false);
    action();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid="set-editor-actions-trigger"
        aria-label={t('setEditor.actionsLabel')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] border border-neutral-400 bg-white text-neutral-800 hover:border-accent"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <circle cx="4" cy="9" r="1.6" />
          <circle cx="9" cy="9" r="1.6" />
          <circle cx="14" cy="9" r="1.6" />
        </svg>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={t('setEditor.actionsLabel')}
          data-testid="set-editor-actions-menu"
          className="absolute right-0 top-[52px] z-10 flex w-60 flex-col rounded-[var(--radius-lg)] border border-neutral-300 bg-white p-1.5 shadow-lg"
        >
          {onRename && (
            <button
              type="button"
              role="menuitem"
              data-testid="set-editor-rename-item"
              onClick={() => run(onRename)}
              className={ITEM_CLASSNAME}
            >
              <RenameIcon />
              {t('setEditor.renameSet')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            data-testid="set-editor-download-missing"
            disabled={nothingMissing}
            onClick={() => run(onDownloadMissing)}
            className={ITEM_CLASSNAME}
          >
            <DownloadIcon />
            {t('setEditor.downloadMissing')}
          </button>
          {nothingMissing ? (
            <Link
              href={printMissingHref}
              role="menuitem"
              data-testid="set-editor-print-missing"
              aria-disabled="true"
              tabIndex={-1}
              onClick={(e) => e.preventDefault()}
              className={`${ITEM_CLASSNAME} pointer-events-none opacity-50`}
            >
              <PrintIcon />
              {t('setEditor.printMissing')}
            </Link>
          ) : (
            <Link
              href={printMissingHref}
              role="menuitem"
              data-testid="set-editor-print-missing"
              onClick={() => setIsOpen(false)}
              className={ITEM_CLASSNAME}
            >
              <PrintIcon />
              {t('setEditor.printMissing')}
            </Link>
          )}
          {onDelete && (
            <>
              <span aria-hidden="true" className="mx-1 my-1.5 h-px bg-neutral-200" />
              <button
                type="button"
                role="menuitem"
                data-testid="set-editor-delete-button"
                onClick={() => run(onDelete)}
                className={`${ITEM_CLASSNAME} font-medium text-red-700`}
              >
                <TrashIcon />
                {t('setEditor.deleteMenuItem')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
