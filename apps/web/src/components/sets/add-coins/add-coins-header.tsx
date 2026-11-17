'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import { CloseIcon } from '@/components/ui/icons';
import { BTN_PRIMARY, FOCUS_RING } from '@/components/sets/add-coins/add-coins-shared';

export interface AddCoinsHeaderProps {
  titleId: string;
  /** Already localized. */
  setName: string;
  /** The close button and the top Done button. */
  onClose: () => void;
}

/** The sheet's header bar: title, "to {set}" subtitle, close and (mobile) Done. */
export function AddCoinsHeader({ titleId, setName, onClose }: AddCoinsHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start gap-3 border-b border-divider pb-3.5 pl-6 pr-4 pt-[18px] max-[899px]:items-center max-[899px]:gap-2 max-[899px]:px-2 max-[899px]:py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2
          id={titleId}
          data-testid="add-coins-title"
          className="m-0 font-[family-name:var(--font-heading)] text-[28px] font-semibold leading-[1.15] text-text max-[899px]:font-[family-name:inherit] max-[899px]:text-base max-[899px]:leading-tight"
        >
          {t('addCoins.title')}
        </h2>
        <p
          data-testid="add-coins-subtitle"
          className="text-[13px] text-neutral-700 max-[899px]:truncate"
        >
          {fill(t('addCoins.toSet'), { name: setName })}
        </p>
      </div>
      <button
        type="button"
        data-testid="add-coins-close"
        aria-label={t('common.close')}
        onClick={onClose}
        className={`inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-neutral-800 hover:bg-surface max-[899px]:order-first ${FOCUS_RING}`}
      >
        <CloseIcon />
      </button>
      <button
        type="button"
        data-testid="add-coins-done-top"
        onClick={onClose}
        className={`${BTN_PRIMARY} hidden min-h-9 px-3 text-[13px] max-[899px]:inline-flex`}
      >
        {t('addCoins.done')}
      </button>
    </div>
  );
}
