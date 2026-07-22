'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatCoinLabel } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCollection } from '@/lib/hooks/use-collection';
import type { CollectionFilters } from '@/lib/collection-api';

function CollectionList() {
  const [filters, setFilters] = useState<CollectionFilters>({});
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');

  const { data, isLoading, isError } = useCollection(filters);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({
      country: country || undefined,
      year: year ? Number(year) : undefined,
    });
  }

  return (
    <main data-testid="collection-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">My Collection</h1>

      <form data-testid="collection-filter-form" onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="collection-country" className="text-sm font-medium">
            Country
          </label>
          <input
            id="collection-country"
            data-testid="collection-filter-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="collection-year" className="text-sm font-medium">
            Year
          </label>
          <input
            id="collection-year"
            data-testid="collection-filter-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          data-testid="collection-filter-submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Search
        </button>
      </form>

      {isLoading && (
        <div data-testid="collection-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="collection-error" className="text-sm text-red-600">
          Something went wrong loading your collection. Please try again.
        </p>
      )}

      {data &&
        (data.length === 0 ? (
          <p data-testid="collection-empty" className="text-sm text-gray-600">
            You don&apos;t own any coins yet.
          </p>
        ) : (
          <ul data-testid="collection-list" className="flex flex-col gap-2">
            {data.map((item) => (
              <li
                key={item.coinId}
                data-testid="collection-item"
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                {formatCoinLabel(item.coin)}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}

export default function CollectionPage() {
  return (
    <RequireAuth>
      <CollectionList />
    </RequireAuth>
  );
}
