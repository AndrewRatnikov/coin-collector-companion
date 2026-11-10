'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { BTN_PRIMARY } from '@/components/sets/add-coins/add-coins-shared';

export interface AddCoinsFooterProps {
  addedCount: number;
  footerText: string;
  onDone: () => void;
}

/** The footer: session count and Done (a floating bar on mobile once something was added). */
export function AddCoinsFooter({ addedCount, footerText, onDone }: AddCoinsFooterProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="add-coins-footer"
      className={[
        'flex items-center justify-between gap-3 border-t border-divider bg-white py-3 pl-6 pr-4',
        addedCount === 0
          ? 'max-[899px]:hidden'
          : 'max-[899px]:absolute max-[899px]:bottom-4 max-[899px]:left-1/2 max-[899px]:w-[calc(100%-32px)] max-[899px]:max-w-[420px] max-[899px]:-translate-x-1/2 max-[899px]:rounded-[var(--radius-lg)] max-[899px]:border-0 max-[899px]:bg-text max-[899px]:py-2 max-[899px]:pl-4 max-[899px]:pr-2 max-[899px]:text-white max-[899px]:shadow-[0_8px_24px_rgba(45,43,43,0.3)]',
      ].join(' ')}
    >
      <span data-testid="add-coins-footer-count" className="min-w-0 text-[13px] text-neutral-700 max-[899px]:text-inherit">
        {footerText}
      </span>
      <button type="button" data-testid="add-coins-done" onClick={onDone} className={BTN_PRIMARY}>
        {t('addCoins.done')}
      </button>
    </div>
  );
}

export interface AddCoinsLiveRegionProps {
  message: string;
}

export function AddCoinsLiveRegion({ message }: AddCoinsLiveRegionProps) {
  return (
    <p data-testid="add-coins-live" role="status" aria-live="polite" className="sr-only">
      {message}
    </p>
  );
}
