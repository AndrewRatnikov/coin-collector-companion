'use client';

import { type ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Skeleton } from '@/components/ui/skeleton';
import { BTN_SECONDARY } from '@/components/sets/add-coins/add-coins-shared';

export interface AddCoinsLoadErrorProps {
  onRetry: () => void;
}

/** The catalog query failed before any data arrived. */
export function AddCoinsLoadError({ onRetry }: AddCoinsLoadErrorProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="add-coins-error"
      role="alert"
      className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg p-4 text-sm text-text"
    >
      <p className="font-semibold">{t('addCoins.loadError')}</p>
      <button
        type="button"
        data-testid="add-coins-error-retry"
        onClick={onRetry}
        className={BTN_SECONDARY}
      >
        {t('addCoins.retry')}
      </button>
    </div>
  );
}

/** First load: four skeleton rows. */
export function AddCoinsLoading() {
  const { t } = useTranslation();

  return (
    <div data-testid="add-coins-loading" aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{t('addCoins.loading')}</span>
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} className="h-[60px] w-full" />
      ))}
    </div>
  );
}

/** No rows to show and nothing more to load. */
export function AddCoinsEmpty() {
  const { t } = useTranslation();

  return (
    <p data-testid="add-coins-empty" className="rounded-[var(--radius-lg)] bg-surface px-5 py-8 text-center text-sm text-neutral-800">
      {t('addCoins.empty')}
    </p>
  );
}

export interface AddCoinsResultsListProps {
  /** The `AddCoinsRow`s. */
  children: ReactNode;
}

export function AddCoinsResultsList({ children }: AddCoinsResultsListProps) {
  return (
    <ul data-testid="add-coins-results" className="rounded-[var(--radius-lg)] border border-neutral-300 bg-white">
      {children}
    </ul>
  );
}

export interface AddCoinsCountProps {
  resultCount: number;
  resultsTemplate: string;
  /** `resultsTemplate` split on `{n}`. */
  resultsParts: string[];
}

/** "{n} results" with the number in mono. */
export function AddCoinsCount({ resultCount, resultsTemplate, resultsParts }: AddCoinsCountProps) {
  return (
    <p data-testid="add-coins-count" className="text-[13px] text-neutral-700">
      {resultsParts.length > 1 ? (
        <>
          {resultsParts[0]}
          <span className="font-mono tabular-nums">{resultCount}</span>
          {resultsParts.slice(1).join(String(resultCount))}
        </>
      ) : (
        resultsTemplate
      )}
    </p>
  );
}

export interface AddCoinsShowMoreProps {
  onShowMore: () => void;
}

export function AddCoinsShowMore({ onShowMore }: AddCoinsShowMoreProps) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      data-testid="add-coins-show-more"
      onClick={onShowMore}
      className={`${BTN_SECONDARY} self-center`}
    >
      {t('addCoins.showMore')}
    </button>
  );
}
