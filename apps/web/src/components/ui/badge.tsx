'use client';

import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

export type BadgeVariant = 'owned' | 'in-set' | 'missing' | 'key-date' | 'complete';

export interface BadgeProps {
  variant: BadgeVariant;
  count?: number;
  children?: ReactNode;
}

const BASE_CLASSES =
  'inline-flex items-center gap-1 h-[22px] px-2 rounded-full text-xs font-medium whitespace-nowrap leading-none';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  owned: 'bg-accent-100 text-accent-800 border border-accent-400',
  'in-set': 'bg-surface text-neutral-800 border border-neutral-300',
  missing: 'bg-white text-neutral-800 border border-dashed border-neutral-500',
  'key-date': 'bg-accent-800 text-accent-100',
  complete: 'bg-accent-700 text-white',
};

function labelKey(variant: BadgeVariant, count: number | undefined): MessageKey {
  switch (variant) {
    case 'owned':
      return 'ui.badge.owned';
    case 'in-set':
      if (count === undefined) return 'ui.badge.inThisSet';
      return count === 1 ? 'ui.badge.inOneSet' : 'ui.badge.inSets';
    case 'missing':
      return 'ui.badge.missing';
    case 'key-date':
      return 'ui.badge.keyDate';
    case 'complete':
      return 'ui.badge.complete';
  }
}

/** Small status pill: owned, in N sets, N missing, key date or complete. */
export function Badge({ variant, count, children }: BadgeProps) {
  const { t } = useTranslation();
  const n = variant === 'missing' ? (count ?? 1) : count;
  const label = t(labelKey(variant, count))
    .split('{n}')
    .join(String(n ?? ''));

  return (
    <span data-testid="badge" data-variant={variant} className={`${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`}>
      {children ?? label}
    </span>
  );
}
