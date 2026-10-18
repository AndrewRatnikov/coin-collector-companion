'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export interface AddCoinsFilterChipProps {
  /** Forwarded to the chip <button>. */
  'data-testid': string;
  /** Visible chip text. */
  label: ReactNode;
  /** aria-pressed: a value is set. */
  pressed: boolean;
  /** Accessible name for the popover region. */
  popoverLabel: string;
  /** Popover content; call `close()` to close it and return focus to the chip. */
  children: (close: () => void) => ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const POPOVER_WIDTH = 240;
const POPOVER_GAP = 6;
const VIEWPORT_MARGIN = 8;

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

// `.chip` from the design: 36px pill, white; aria-pressed=true gives the dark fill.
export const CHIP_CLASSNAME = [
  'inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-neutral-300 bg-white px-3.5 text-[13px] text-neutral-800 hover:border-accent',
  'aria-pressed:border-text aria-pressed:bg-text aria-pressed:text-white',
  FOCUS_RING,
].join(' ');

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * onKeyDown helper for a role="menu" container: ArrowDown / ArrowUp move focus among the
 * menu items (wrapping), Home / End jump to the first / last item.
 */
export function handleMenuArrowKeys(event: ReactKeyboardEvent<HTMLElement>): void {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'));
  if (items.length === 0) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number;
  switch (event.key) {
    case 'ArrowDown':
      next = index === -1 ? 0 : (index + 1) % items.length;
      break;
    case 'ArrowUp':
      next = index <= 0 ? items.length - 1 : index - 1;
      break;
    case 'Home':
      next = 0;
      break;
    case 'End':
      next = items.length - 1;
      break;
    default:
      return;
  }
  event.preventDefault();
  items[next].focus();
}

/**
 * A filter chip with a popover anchored under it. The popover is position: fixed (from the
 * chip's rect) so a horizontally scrolling chip row can't clip it.
 */
export function AddCoinsFilterChip({
  'data-testid': testId,
  label,
  pressed,
  popoverLabel,
  children,
}: AddCoinsFilterChipProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const popoverId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    function place() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN);
      setPosition({ top: rect.bottom + POPOVER_GAP, left: Math.min(Math.max(rect.left, VIEWPORT_MARGIN), maxLeft) });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const popover = popoverRef.current;
    const initial =
      popover?.querySelector<HTMLElement>('[role^="menuitem"][aria-checked="true"]') ??
      popover?.querySelector<HTMLElement>(FOCUSABLE);
    initial?.focus();

    function handleMouseDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  return (
    <div ref={wrapperRef} className="flex-none">
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        aria-pressed={pressed}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        className={CHIP_CLASSNAME}
      >
        {label}
        <ChevronIcon />
      </button>
      {open && (
        <div
          ref={popoverRef}
          id={popoverId}
          role="group"
          aria-label={popoverLabel}
          style={{ top: position.top, left: position.left, width: POPOVER_WIDTH }}
          className="fixed z-[60] max-h-[min(320px,60vh)] overflow-y-auto rounded-[var(--radius-md)] border border-neutral-300 bg-white p-1.5 shadow-[0_8px_24px_rgba(45,43,43,0.18)]"
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            // Keep the sheet open: it ignores an Escape whose default was prevented.
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
