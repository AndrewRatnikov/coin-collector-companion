'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';

const DEFAULT_LIMIT = 20;

export default function CatalogPage() {
  const [filters, setFilters] = useState<CatalogFilters>({ page: 1, limit: DEFAULT_LIMIT });
  const [country, setCountry] = useState('');
  const [denomination, setDenomination] = useState('');
  const [name, setName] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');

  const { data, isLoading, isError } = useCatalog(filters);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({
      country: country || undefined,
      denomination: denomination || undefined,
      name: name || undefined,
      yearMin: yearMin ? Number(yearMin) : undefined,
      yearMax: yearMax ? Number(yearMax) : undefined,
      page: 1,
      limit: DEFAULT_LIMIT,
    });
  }

  function goToPage(page: number) {
    setFilters((prev) => ({ ...prev, page }));
  }

  return (
    <main data-testid="catalog-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">Catalog</h1>

      <form data-testid="catalog-filter-form" onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-country" className="text-sm font-medium">
            Country
          </label>
          <input
            id="catalog-country"
            data-testid="catalog-filter-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-denomination" className="text-sm font-medium">
            Denomination
          </label>
          <input
            id="catalog-denomination"
            data-testid="catalog-filter-denomination"
            type="text"
            value={denomination}
            onChange={(e) => setDenomination(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="catalog-name"
            data-testid="catalog-filter-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-year-min" className="text-sm font-medium">
            Year min
          </label>
          <input
            id="catalog-year-min"
            data-testid="catalog-filter-year-min"
            type="number"
            value={yearMin}
            onChange={(e) => setYearMin(e.target.value)}
            className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="catalog-year-max" className="text-sm font-medium">
            Year max
          </label>
          <input
            id="catalog-year-max"
            data-testid="catalog-filter-year-max"
            type="number"
            value={yearMax}
            onChange={(e) => setYearMax(e.target.value)}
            className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          data-testid="catalog-filter-submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

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
