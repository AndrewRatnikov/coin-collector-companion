'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

// A slide-in side panel matching the shape of shadcn/ui's Sheet (overlay + panel
// sliding in from the right, Escape/overlay-click/X to close) but hand-built with
// this repo's own design tokens, since no Radix/shadcn is installed here.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  const { t } = useTranslation();

  // Deferred to a second render (via requestAnimationFrame) so the panel first
  // paints off-screen (translate-x-full), then transitions to translate-x-0 —
  // mounting already-in-place would skip the CSS transition entirely.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div data-testid="sheet" className="fixed inset-0 z-50 flex justify-end">
      <div
        data-testid="sheet-overlay"
        onClick={onClose}
        aria-hidden="true"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid="sheet-panel"
        className={`relative flex h-full w-full max-w-md flex-col gap-4 border-l border-[var(--color-divider)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-lg)] transition-transform duration-200 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] pb-4">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-text)]">
            {title}
          </h2>
          <button
            type="button"
            data-testid="sheet-close"
            onClick={onClose}
            aria-label={t('common.close')}
            className="rounded-[var(--radius-sm)] px-2 text-xl leading-none text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
