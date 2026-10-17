'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

/** Unpaused time a toast stays up before it commits and closes. */
export const UNDO_TOAST_DURATION_MS = 8000;

export interface UndoToastOptions {
  message: ReactNode;
  onUndo?: () => void;
  onCommit?: () => void;
  actionLabel?: string;
}

interface UndoToastApi {
  show(options: UndoToastOptions): void;
  dismiss(): void;
}

const noopApi: UndoToastApi = { show: () => {}, dismiss: () => {} };

const UndoToastContext = createContext<UndoToastApi>(noopApi);

/** Shows the page's single undo toast. Outside an UndoToastProvider, calls do nothing. */
export function useUndoToast(): UndoToastApi {
  return useContext(UndoToastContext);
}

interface VisibleToast {
  id: number;
  options: UndoToastOptions;
}

/**
 * Owns the one undo toast and its live region. A new toast commits the previous one first;
 * hovering or focusing the toast pauses its timer. The toast never takes focus.
 */
export function UndoToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toast, setToast] = useState<VisibleToast | null>(null);

  const currentRef = useRef<UndoToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remainingRef = useRef(UNDO_TOAST_DURATION_MS);
  const startedAtRef = useRef(0);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const idRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Closes the current toast and returns its options (null when none was open). */
  const close = useCallback((): UndoToastOptions | null => {
    clearTimer();
    const options = currentRef.current;
    currentRef.current = null;
    hoveredRef.current = false;
    focusedRef.current = false;
    setToast(null);
    return options;
  }, [clearTimer]);

  const commit = useCallback(() => {
    close()?.onCommit?.();
  }, [close]);

  const startTimer = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commit();
    }, remainingRef.current);
  }, [clearTimer, commit]);

  const pause = useCallback(() => {
    if (timerRef.current === null) return;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
    clearTimer();
  }, [clearTimer]);

  const resumeIfIdle = useCallback(() => {
    if (currentRef.current === null || hoveredRef.current || focusedRef.current) return;
    startTimer();
  }, [startTimer]);

  const show = useCallback(
    (options: UndoToastOptions) => {
      if (currentRef.current !== null) commit();
      currentRef.current = options;
      remainingRef.current = UNDO_TOAST_DURATION_MS;
      idRef.current += 1;
      setToast({ id: idRef.current, options });
      startTimer();
    },
    [commit, startTimer],
  );

  const undo = useCallback(() => {
    close()?.onUndo?.();
  }, [close]);

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo<UndoToastApi>(() => ({ show, dismiss: commit }), [show, commit]);

  return (
    <UndoToastContext.Provider value={api}>
      {children}
      <div data-testid="undo-toast-region" role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <div
            key={toast.id}
            data-testid="undo-toast"
            onMouseEnter={() => {
              hoveredRef.current = true;
              pause();
            }}
            onMouseLeave={() => {
              hoveredRef.current = false;
              resumeIfIdle();
            }}
            onFocus={() => {
              focusedRef.current = true;
              pause();
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              focusedRef.current = false;
              resumeIfIdle();
            }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3.5 rounded-lg bg-neutral-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg max-w-[calc(100%-32px)]"
          >
            <span data-testid="undo-toast-message" className="min-w-0">
              {toast.options.message}
            </span>
            <button
              type="button"
              data-testid="undo-toast-undo"
              onClick={undo}
              className="min-h-9 cursor-pointer px-2.5 font-semibold text-accent-200 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-200"
            >
              {toast.options.actionLabel ?? t('ui.toast.undo')}
            </button>
            <button
              type="button"
              data-testid="undo-toast-dismiss"
              aria-label={t('ui.toast.dismiss')}
              onClick={commit}
              className="flex size-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-neutral-400 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-200"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" className="size-4" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </UndoToastContext.Provider>
  );
}
