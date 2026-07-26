'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { CatalogCoin } from '@coin-collector/shared';
import { formatCoinLabel } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import CatalogFilterForm, { type CatalogFilterFormValues } from '@/components/catalog/catalog-filter-form';
import SubmitCoinForm from '@/components/catalog/submit-coin-form';
import SubmissionConfirmation from '@/components/catalog/submission-confirmation';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';
import { getStoredToken } from '@/lib/auth-token';

const DEFAULT_LIMIT = 20;

export default function CatalogPage() {
  const [filters, setFilters] = useState<CatalogFilters>({ page: 1, limit: DEFAULT_LIMIT });
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submittedCoin, setSubmittedCoin] = useState<CatalogCoin | null>(null);

  const { data, isLoading, isError } = useCatalog(filters);
  const isLoggedIn = Boolean(getStoredToken());

  function handleFilterSubmit(values: CatalogFilterFormValues) {
    setFilters({ ...values, page: 1, limit: DEFAULT_LIMIT });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return (
    <main data-testid="catalog-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">Catalog</h1>

      <CatalogFilterForm testIdPrefix="catalog" onSubmit={handleFilterSubmit} />

      {isLoggedIn && !submittedCoin && (
        <div data-testid="catalog-submit-coin-entry">
          <button
            type="button"
            data-testid="catalog-submit-coin-toggle"
            onClick={() => setShowSubmitForm((v) => !v)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            Can&apos;t find this coin? Add it
          </button>
          {showSubmitForm && (
            <SubmitCoinForm
              onSuccess={(coin) => {
                setSubmittedCoin(coin);
                setShowSubmitForm(false);
              }}
            />
          )}
        </div>
      )}

      {submittedCoin && <SubmissionConfirmation coin={submittedCoin} />}

      {isLoading && (
        <div data-testid="catalog-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="catalog-error" className="text-sm text-red-600">
          Something went wrong loading the catalog. Please try again.
        </p>
      )}

      {data && (
        <>
          {data.items.length === 0 ? (
            <p data-testid="catalog-empty" className="text-sm text-gray-600">
              No coins found.
            </p>
          ) : (
            <ul data-testid="catalog-results" className="flex flex-col gap-2">
              {data.items.map((coin) => (
                <li
                  key={coin.id}
                  data-testid="catalog-item"
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
                >
                  <Link href={`/catalog/${coin.id}`} className="underline">
                    {formatCoinLabel(coin)}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div data-testid="catalog-pagination" className="flex items-center gap-3">
            <button
              type="button"
              data-testid="catalog-page-prev"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span data-testid="catalog-page-indicator" className="text-sm text-gray-600">
              Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}
            </span>
            <button
              type="button"
              data-testid="catalog-page-next"
              disabled={data.page * data.limit >= data.total}
              onClick={() => goToPage(data.page + 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </main>
  );
}
