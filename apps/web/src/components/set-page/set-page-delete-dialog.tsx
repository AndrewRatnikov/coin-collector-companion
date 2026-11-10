'use client';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatOwnedOfTotal } from '@/lib/album-layout';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetPageDeleteDialogProps {
  open: boolean;
  /** The set's raw name, as stored. */
  setName: string;
  ownedCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/** The delete-set confirmation, with a note that owned coins stay in the collection. */
export function SetPageDeleteDialog({ open, setName, ownedCount, totalCount, onConfirm, onCancel }: SetPageDeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      open={open}
      title={t('setEditor.deleteConfirmTitle').split('{name}').join(setName)}
      description={
        <>
          {formatOwnedOfTotal(t('setEditor.deleteConfirmMessage'), 0, totalCount)}
          {ownedCount > 0 && (
            <p
              data-testid="set-editor-delete-confirm-safe"
              className="mt-3 rounded-[var(--radius-md)] bg-accent-100 px-3.5 py-3 text-accent-800"
            >
              {formatOwnedOfTotal(t('setEditor.deleteConfirmSafe'), ownedCount, totalCount)}
            </p>
          )}
        </>
      }
      variant="danger"
      confirmLabel={t('setEditor.deleteButton')}
      cancelLabel={t('common.cancel')}
      onConfirm={onConfirm}
      onCancel={onCancel}
      testIdPrefix="set-editor-delete-confirm"
    />
  );
}
