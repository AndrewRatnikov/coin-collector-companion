'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { usePublicSets } from '@/lib/hooks/use-public-sets';

const DEFAULT_LIMIT = 20;

export default function PublicSetsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = usePublicSets({ page, limit: DEFAULT_LIMIT });

  function goToPage(nextPage: number) {
    setPage(nextPage);
  }

  return (
    <main data-testid="public-sets-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">Public sets</h1>

      {isLoading && (
        <div data-testid="public-sets-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="public-sets-error" className="text-sm text-red-600">
          Something went wrong loading public sets. Please try again.
        </p>
      )}

      {data && (
        <>
          {data.items.length === 0 ? (
            <p data-testid="public-sets-empty" className="text-sm text-gray-600">
              No public sets yet.
            </p>
          ) : (
            <ul data-testid="public-sets-list" className="flex flex-col gap-2">
              {data.items.map((set) => (
                <li key={set.id} data-testid="public-set-item" className="rounded-lg border border-gray-200 p-4">
                  <Link href={`/sets/public/${set.id}`} className="underline">
                    {set.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div data-testid="public-sets-pagination" className="flex items-center gap-3">
            <button
              type="button"
              data-testid="public-sets-page-prev"
              disabled={data.page <= 1}
              onClick={() => goToPage(data.page - 1)}
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Prev
            </button>
            <span data-testid="public-sets-page-indicator" className="text-sm text-gray-600">
              Page {data.page} of {Math.max(1, Math.ceil(data.total / data.limit))}
            </span>
            <button
              type="button"
              data-testid="public-sets-page-next"
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
