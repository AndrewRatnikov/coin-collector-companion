'use client';

import type { ReactNode } from 'react';
import { useDelayedPending, type StatusToggleState } from '@/components/ui/status-toggle';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { getOwnershipPanelState } from '@/lib/coin-page';

export interface CoinOwnershipPanelProps {
  layout: 'panel' | 'bar';
  /** getCoinName(coin).title, used in the button's accessible name. */
  coinTitle: string;
  owned: boolean;
  state: StatusToggleState;
  onToggle: () => void;
  onRetry: () => void;
  /** Extra classes on the root, e.g. the page's negative margin that bleeds the bar to the edges. */
  className?: string;
}

function TickIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" className={className} aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.25" className={className} aria-hidden="true">
      <path d="M8 3.5v5.5" strokeLinecap="round" />
      <circle cx="8" cy="12.25" r="0.6" fill="currentColor" />
    </svg>
  );
}

const FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/**
 * The coin page's ownership surface. `panel` is the desktop card (title, note and button);
 * `bar` is the sticky bar under 900px (title and button). Pending disables the button at once
 * and shows "Saving…" with a spinner after 150ms; failed shows danger styling and retries.
 * The page owns the single live region, so this component announces nothing itself.
 */
export function CoinOwnershipPanel({
  layout,
  coinTitle,
  owned,
  state,
  onToggle,
  onRetry,
  className = '',
}: CoinOwnershipPanelProps) {
  const { t } = useTranslation();
  const pending = state === 'pending';
  const failed = state === 'failed';
  const panelState = getOwnershipPanelState({ owned, pending, failed });
  const showSpinner = useDelayedPending(pending);
  const isBar = layout === 'bar';

  let titleKey: MessageKey;
  if (failed) titleKey = 'coinDetail.saveFailed';
  else if (showSpinner) titleKey = 'coinDetail.saving';
  else titleKey = owned ? 'coinDetail.inCollection' : 'coinDetail.notInCollection';

  let noteKey: MessageKey;
  if (failed) noteKey = 'coinDetail.saveFailedNote';
  else noteKey = owned ? 'coinDetail.ownedNote' : 'coinDetail.notOwnedNote';

  let buttonKey: MessageKey;
  let ariaKey: MessageKey;
  if (failed) {
    buttonKey = 'coinDetail.tryAgain';
    ariaKey = 'coinDetail.retryLabel';
  } else if (owned) {
    buttonKey = 'coinDetail.removeOwned';
    ariaKey = 'coinDetail.removeOwnedLabel';
  } else {
    buttonKey = 'coinDetail.markOwned';
    ariaKey = 'coinDetail.markOwnedLabel';
  }
  const ariaLabel = t(ariaKey).split('{title}').join(coinTitle);

  function handleClick() {
    if (pending) return;
    if (failed) onRetry();
    else onToggle();
  }

  // Disc: spinner once pending has lasted 150ms, else an alert / tick / dashed ring.
  const discSize = isBar ? 'size-7' : 'size-9';
  const iconSize = isBar ? 'size-3.5' : 'size-4';
  let disc: ReactNode;
  if (showSpinner) {
    disc = (
      <span
        data-testid="coin-detail-ownership-spinner"
        aria-hidden="true"
        className={`${discSize} flex-none rounded-full border-[2.5px] border-accent-200 border-t-accent-700 bg-white motion-safe:animate-check-spin`}
      />
    );
  } else if (failed) {
    disc = (
      <span
        aria-hidden="true"
        className={`${discSize} flex flex-none items-center justify-center rounded-full border-2 border-danger bg-white text-danger`}
      >
        <AlertIcon className={iconSize} />
      </span>
    );
  } else if (owned) {
    disc = (
      <span
        aria-hidden="true"
        className={`${discSize} flex flex-none items-center justify-center rounded-full bg-accent text-white`}
      >
        <TickIcon className={iconSize} />
      </span>
    );
  } else {
    disc = (
      <span
        aria-hidden="true"
        className={`${discSize} flex flex-none items-center justify-center rounded-full border-[1.5px] border-dashed border-neutral-500 bg-white text-neutral-500`}
      >
        <TickIcon className={iconSize} />
      </span>
    );
  }

  // Primary for not-owned and failed, secondary for owned. Pending keeps the current value's style.
  const buttonTone =
    failed || !owned
      ? 'bg-accent-700 text-white hover:bg-accent-800 disabled:hover:bg-accent-700'
      : 'border border-neutral-400 bg-white text-text hover:bg-neutral-100 disabled:hover:bg-white';

  const button = (
    <button
      type="button"
      data-testid={layout === 'bar' ? 'coin-detail-mobile-bar-toggle' : 'coin-detail-owned-toggle'}
      aria-pressed={owned}
      aria-label={ariaLabel}
      aria-busy={pending || undefined}
      disabled={pending}
      onClick={handleClick}
      className={`inline-flex min-h-11 flex-none cursor-pointer items-center justify-center whitespace-normal rounded-[var(--radius-md)] px-[18px] py-2 text-sm font-medium motion-safe:transition-colors disabled:cursor-default disabled:opacity-80 ${buttonTone} ${FOCUS_CLASSES}`}
    >
      {t(buttonKey)}
    </button>
  );

  const title = (
    <p data-testid="coin-detail-ownership-title" className="text-[15px] font-semibold text-text">
      {t(titleKey)}
    </p>
  );

  if (isBar) {
    const barTone = failed ? 'bg-danger-bg' : 'bg-white';
    return (
      <div
        role="region"
        aria-label={t('coinDetail.ownershipLabel')}
        data-testid="coin-detail-mobile-bar"
        data-state={panelState}
        className={`sticky bottom-16 z-[8] flex items-center gap-3 border-t border-[var(--color-divider)] py-3 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] min-[900px]:hidden ${barTone} ${className}`.trimEnd()}
      >
        {disc}
        <div className="min-w-0 flex-1">{title}</div>
        {button}
      </div>
    );
  }

  let panelTone: string;
  if (failed) panelTone = 'border border-danger-line bg-danger-bg';
  else if (owned) panelTone = 'border border-solid border-accent-400 bg-accent-100';
  else panelTone = 'border border-dashed border-neutral-500 bg-white';

  return (
    <section
      aria-label={t('coinDetail.ownershipLabel')}
      data-testid="coin-detail-ownership-panel"
      data-state={panelState}
      className={`hidden flex-wrap items-center gap-3.5 rounded-[var(--radius-lg)] px-[18px] py-4 min-[900px]:flex ${panelTone} ${className}`.trimEnd()}
    >
      {disc}
      <div className="flex min-w-[12rem] flex-1 flex-col gap-0.5">
        {title}
        <p data-testid="coin-detail-ownership-note" className="text-[13px] text-neutral-700">
          {t(noteKey)}
        </p>
      </div>
      {button}
    </section>
  );
}
