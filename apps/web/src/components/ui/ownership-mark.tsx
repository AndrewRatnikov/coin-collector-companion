'use client';

import { TickIcon } from '@/components/ui/status-toggle';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface OwnershipMarkProps {
  owned: boolean;
  /** Default 'ownership-mark'. */
  testId?: string;
  className?: string;
}

/**
 * Read-only twin of StatusToggle's pill: the same disc and "Owned" / "Missing" text, but a plain
 * span (no button, no role), for pages where ownership can't be changed.
 */
export function OwnershipMark({ owned, testId = 'ownership-mark', className = '' }: OwnershipMarkProps) {
  const { t } = useTranslation();
  const tone = owned
    ? 'border border-accent-400 bg-accent-100 text-accent-800'
    : 'border border-dashed border-neutral-500 bg-white text-neutral-800';
  const disc = owned
    ? 'bg-accent text-white'
    : 'border-[1.5px] border-dashed border-neutral-500 text-neutral-500';

  return (
    <span
      data-testid={testId}
      data-owned={owned ? 'true' : 'false'}
      className={`inline-flex h-8 items-center gap-2 rounded-full pl-1.5 pr-3 text-[13px] font-medium whitespace-nowrap ${tone} ${className}`.trimEnd()}
    >
      <span aria-hidden="true" className={`flex size-5 items-center justify-center rounded-full ${disc}`}>
        <TickIcon className="size-3" />
      </span>
      <span>{t(owned ? 'ui.toggle.labelOwned' : 'ui.toggle.labelMissing')}</span>
    </span>
  );
}
