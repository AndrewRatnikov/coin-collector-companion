'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

export type StatusToggleVariant = 'check' | 'pill';
export type StatusToggleState = 'idle' | 'pending' | 'failed';

export interface StatusToggleProps {
  variant: StatusToggleVariant;
  owned: boolean;
  coinTitle: string;
  state?: StatusToggleState;
  onToggle: () => void;
  onRetry?: () => void;
  className?: string;
  /** Pill only: under 900px the text label becomes screen-reader-only, leaving just the disc. */
  collapseLabelOnMobile?: boolean;
}

/** A pending save shows its spinner only after this long, so fast saves never flash. */
export const PENDING_SPINNER_DELAY_MS = 150;

/** True once `active` has stayed true for `delayMs`; false again as soon as it turns false. */
export function useDelayedPending(active: boolean, delayMs: number = PENDING_SPINNER_DELAY_MS): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    setElapsed(false);
    if (!active) return undefined;
    const timer = setTimeout(() => setElapsed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  return active && elapsed;
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

const SPINNER_FACE = 'border-[2.5px] border-accent-200 border-t-accent-700 bg-white animate-check-spin';

const FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/**
 * The owned / missing control. `check` is the round 44px tick on coin cards; `pill` is the
 * labelled version. Pending disables it at once and shows a spinner after 150ms; failed shows
 * danger styling and retries on click.
 */
export function StatusToggle({
  variant,
  owned,
  coinTitle,
  state = 'idle',
  onToggle,
  onRetry,
  className = '',
  collapseLabelOnMobile = false,
}: StatusToggleProps) {
  const { t } = useTranslation();
  const pending = state === 'pending';
  const failed = state === 'failed';
  const showSpinner = useDelayedPending(pending);

  let labelKey: MessageKey;
  if (pending) labelKey = 'ui.toggle.saving';
  else if (failed) labelKey = 'ui.toggle.failed';
  else labelKey = owned ? 'ui.toggle.markMissing' : 'ui.toggle.markOwned';
  const ariaLabel = t(labelKey).split('{coin}').join(coinTitle);

  function handleClick() {
    if (pending) return;
    if (failed) (onRetry ?? onToggle)();
    else onToggle();
  }

  let classes: string;
  let content: ReactNode;

  if (variant === 'check') {
    let face: string;
    let icon: ReactNode = null;
    if (showSpinner) {
      face = SPINNER_FACE;
    } else if (failed) {
      face = 'bg-white border-2 border-danger text-danger';
      icon = <AlertIcon className="size-4" />;
    } else if (owned) {
      face = 'bg-accent border-2 border-white text-white shadow-sm';
      icon = <TickIcon className="size-4" />;
    } else {
      face = 'bg-white/90 border-[1.5px] border-dashed border-neutral-500 text-neutral-500';
      icon = <TickIcon className="size-4" />;
    }

    classes = `inline-flex size-11 items-center justify-center rounded-full ${FOCUS_CLASSES}`;
    content = showSpinner ? (
      <span data-testid="status-toggle-spinner" className={`size-8 rounded-full ${face}`} />
    ) : (
      <span
        className={`flex size-8 items-center justify-center rounded-full motion-safe:transition-colors ${face}`}
      >
        {icon}
      </span>
    );
  } else {
    let tone: string;
    if (failed) tone = 'border border-danger bg-white text-danger';
    else if (owned) tone = 'border border-accent-400 bg-accent-100 text-accent-800';
    else tone = 'border border-dashed border-neutral-500 bg-white text-neutral-800';

    let disc: ReactNode;
    let label: MessageKey;
    if (showSpinner) {
      disc = <span data-testid="status-toggle-spinner" className={`size-6 rounded-full ${SPINNER_FACE}`} />;
      label = 'ui.toggle.labelSaving';
    } else if (failed) {
      disc = (
        <span className="flex size-6 items-center justify-center rounded-full border-2 border-danger bg-white text-danger">
          <AlertIcon className="size-3.5" />
        </span>
      );
      label = 'ui.toggle.labelRetry';
    } else if (owned) {
      disc = (
        <span className="flex size-6 items-center justify-center rounded-full bg-accent text-white">
          <TickIcon className="size-3.5" />
        </span>
      );
      label = 'ui.toggle.labelOwned';
    } else {
      disc = (
        <span className="flex size-6 items-center justify-center rounded-full border-[1.5px] border-dashed border-neutral-500 text-neutral-500">
          <TickIcon className="size-3.5" />
        </span>
      );
      label = 'ui.toggle.labelMissing';
    }

    const collapse = collapseLabelOnMobile ? ' max-[899px]:h-9 max-[899px]:pr-2.5' : '';
    classes = `inline-flex h-10 items-center gap-2 rounded-full pl-2 pr-3.5 text-[13px] font-medium whitespace-nowrap ${tone} ${FOCUS_CLASSES}${collapse}`;
    content = (
      <>
        {disc}
        <span className={collapseLabelOnMobile ? 'max-[899px]:sr-only' : undefined}>{t(label)}</span>
      </>
    );
  }

  return (
    <button
      type="button"
      data-testid="status-toggle"
      data-variant={variant}
      data-state={state}
      aria-pressed={owned}
      aria-label={ariaLabel}
      aria-busy={pending ? true : undefined}
      disabled={pending}
      onClick={handleClick}
      className={`${classes} cursor-pointer disabled:cursor-default ${className}`.trimEnd()}
    >
      {content}
    </button>
  );
}
