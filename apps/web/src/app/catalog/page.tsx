'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CatalogCoin } from '@coin-collector/shared';
import { formatCoinLabel } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { Sheet } from '@/components/ui/sheet';
import CatalogFilterForm, {
  type CatalogFilterFormValues,
} from '@/components/catalog/catalog-filter-form';
import SubmitCoinForm from '@/components/catalog/submit-coin-form';
import SubmissionConfirmation from '@/components/catalog/submission-confirmation';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';
import { getStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';

const DEFAULT_LIMIT = 20;

export default function CatalogPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<CatalogFilters>({ page: 1, limit: DEFAULT_LIMIT });
  const [isAddCoinSheetOpen, setIsAddCoinSheetOpen] = useState(false);
  const [submittedCoin, setSubmittedCoin] = useState<CatalogCoin | null>(null);

  const { data, isLoading, isError } = useCatalog(filters);
  const isLoggedIn = Boolean(getStoredToken());

  function handleFilterSubmit(values: CatalogFilterFormValues) {
    setFilters({ ...values, page: 1, limit: DEFAULT_LIMIT });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <main
      data-testid="catalog-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <div className="flex items-baseline justify-between gap-4 border-b border-[color:var(--color-divider)] pb-4">
        <h1 className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]">
          {t('catalog.title')}
        </h1>
        {data && (
          <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
            {data.total}
          </span>
        )}
      </div>
      <CatalogFilterForm testIdPrefix="catalog" onSubmit={handleFilterSubmit} />
      {isLoggedIn && (
        <div data-testid="catalog-submit-coin-entry">
          <button
            type="button"
            data-testid="catalog-submit-coin-toggle"
            onClick={() => setIsAddCoinSheetOpen(true)}
            className="w-fit rounded-[2px] border border-[color:var(--color-divider)] px-3 py-1.5 text-sm text-[color:var(--color-text)] transition-colors hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
          >
            {t('catalog.addCoinCta')}
          </button>
        </div>
      )}
      <Sheet
        open={isAddCoinSheetOpen}
        onClose={() => {
          setIsAddCoinSheetOpen(false);
          setSubmittedCoin(null);
        }}
        title={t('catalog.addCoinSheetTitle')}
      >
        {submittedCoin ? (
          <SubmissionConfirmation coin={submittedCoin} />
        ) : (
          <SubmitCoinForm onSuccess={(coin) => setSubmittedCoin(coin)} />
        )}
      </Sheet>
      {isLoading && (
        <div data-testid="catalog-loading">
          <ListSkeleton />
        </div>
      )}
      {isError && (
        <p data-testid="catalog-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('catalog.errorLoading')}
        </p>
      )}
      {data && (
        <>
          {data.items.length === 0 ? (
            <p
              data-testid="catalog-empty"
              className="text-sm text-[color:var(--color-neutral-600)]"
            >
              {t('catalog.emptyMessage')}
            </p>
          ) : (
            <ul data-testid="catalog-results" className="flex flex-col">
              {data.items.map((coin) => (
                <li
                  key={coin.id}
                  data-testid="catalog-item"
                  className="border-b border-[color:var(--color-divider)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
                >
                  <Link
                    href={`/catalog/${coin.id}`}
                    className="flex items-center gap-4 py-4 text-[color:var(--color-text)]"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface)] font-[family-name:var(--font-heading)] text-sm text-[color:var(--color-neutral-700)] outline outline-1 outline-[color:var(--color-divider)]"
                    >
                      {coin.denomination.charAt(0)}
                    </span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[15px]">{formatCoinLabel(coin)}</span>
                      {coin.variety && (
                        <span className="text-xs text-[color:var(--color-neutral-600)]">
                          {coin.variety}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div
            data-testid="catalog-pagination"
            className="flex items-center justify-center gap-4 pt-2 font-mono text-sm tabular-nums"
          >
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => {
              const isActive = pageNumber === data.page;
              return isActive ? (
                <span
                  key={pageNumber}
                  data-testid="catalog-pagination-page"
                  aria-current="page"
                  className="underline underline-offset-4 text-[color:var(--color-text)]"
                >
                  {pageNumber}
                </span>
              ) : (
                <button
                  key={pageNumber}
                  type="button"
                  data-testid="catalog-pagination-page"
                  onClick={() => goToPage(pageNumber)}
                  className="text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-accent)]"
                >
                  {pageNumber}
                </button>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
