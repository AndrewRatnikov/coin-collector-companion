'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AlertIcon } from '@/components/ui/icons';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { FOCUS_RING, PAGE_WRAPPER_CLASSNAME } from '@/components/set-page/set-page-shared';

export interface SetPageErrorProps {
  onRetry: () => void;
}

/** The set page while the set or its gaps are loading. */
export function SetPageLoading() {
  const { t } = useTranslation();
  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <div data-testid="set-editor-loading" aria-busy="true" className="flex flex-col gap-6">
        <span className="sr-only">{t('setPage.loadingLabel')}</span>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-11 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
        </div>
        <Skeleton className="h-11 w-full" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3.5 max-[899px]:grid-cols-2 max-[899px]:gap-2.5">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full rounded-lg" />
          ))}
        </div>
      </div>
    </main>
  );
}

/** The set page when the set or its gaps failed to load, with a retry. */
export function SetPageError({ onRetry }: SetPageErrorProps) {
  const { t } = useTranslation();
  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <div
        data-testid="set-editor-error"
        role="alert"
        className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg p-4 text-sm text-text"
      >
        <AlertIcon className="flex-none text-danger" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-semibold">{t('setPage.errorTitle')}</p>
          <p className="text-neutral-800">{t('setPage.errorBody')}</p>
          <div className="mt-2">
            <button
              type="button"
              data-testid="set-editor-error-retry"
              onClick={onRetry}
              className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] border border-neutral-400 bg-white px-4 text-sm font-medium text-text hover:border-accent ${FOCUS_RING}`}
            >
              {t('setPage.tryAgain')}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
