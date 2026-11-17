// Constants and types shared by the new-set page (/sets/new) and its step components.

import type { SourceCoinItem } from '@/lib/new-set-preview';

export const HEADING_FONT = 'font-[family-name:var(--font-heading)]';
export const INPUT_CLASS =
  'rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-sm focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-200';
export const CHIP_CLASS = 'rounded-[var(--radius-md)] bg-surface px-2 py-0.5 font-mono text-xs';
export const SUBHEADING_CLASS = 'text-xs font-semibold uppercase tracking-[0.06em] text-neutral-800';
export const PRIMARY_BUTTON_CLASS =
  'rounded-[var(--radius-md)] bg-accent-700 px-5 text-sm font-semibold text-white hover:bg-accent-800 disabled:cursor-not-allowed disabled:opacity-70';

/** The step-2 source detail, normalised over the canonical and public shapes. */
export interface SourceDetail {
  name: string;
  description: string | null;
  coins: SourceCoinItem[];
}
