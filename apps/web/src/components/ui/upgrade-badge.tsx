'use client';

import { useTranslation } from '@/lib/i18n/i18n-context';

export interface UpgradeBadgeProps {
  /** Default 'upgrade-badge'. */
  testId?: string;
  className?: string;
}

/** Up arrow over a short baseline, 16px grid, drawn like the menu icons. */
export function UpgradeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M8 11.5V3M4.5 6.5 8 3l3.5 3.5M3.5 13.5h9" />
    </svg>
  );
}

/**
 * The "Upgrade" state of an owned coin below the set's minimum grade: an icon, the visible word
 * and a screen-reader hint (also the title). A dashed outline sets it apart from the solid
 * Owned look, and the text carries the meaning, so it never relies on colour alone.
 */
export function UpgradeBadge({ testId = 'upgrade-badge', className }: UpgradeBadgeProps) {
  const { t } = useTranslation();
  const hint = t('ui.coin.upgradeHint');
  const classes = [
    'inline-flex flex-none items-center gap-1 rounded-full border border-dashed border-accent-700 bg-white px-1.5 text-[11px] font-semibold leading-4 text-accent-800',
    className ?? '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  return (
    <span data-testid={testId} data-upgrade="true" title={hint} className={classes}>
      <UpgradeIcon />
      {t('ui.coin.statusUpgrade')}
      <span className="sr-only">{`, ${hint}`}</span>
    </span>
  );
}
