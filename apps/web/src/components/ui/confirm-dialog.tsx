'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  testIdPrefix?: string;
}

// A small centered confirmation dialog (overlay + panel, Escape/overlay-click to
// cancel) for destructive actions — distinct from Sheet (which slides in from the
// right for browse/pick flows), since a yes/no prompt reads better centered and
// compact than as a side panel.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  testIdPrefix = 'confirm-dialog',
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div data-testid={testIdPrefix} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        data-testid={`${testIdPrefix}-overlay`}
        onClick={onCancel}
        aria-hidden="true"
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        data-testid={`${testIdPrefix}-panel`}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-[var(--radius-md)] border border-[var(--color-divider)] bg-[var(--color-bg)] p-6 shadow-[var(--shadow-lg)]"
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold text-[var(--color-text)]">
            {title}
          </h2>
          {description && <p className="text-sm text-[var(--color-neutral-600)]">{description}</p>}
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            data-testid={`${testIdPrefix}-cancel`}
            onClick={onCancel}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            data-testid={`${testIdPrefix}-confirm`}
            onClick={onConfirm}
            className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
