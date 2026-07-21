'use client';

import { use } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';

export default function CanonicalSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: set, isLoading, isError } = useCanonicalSet(id);
  const isLoggedIn = Boolean(getStoredToken());

  return (
    <main data-testid="canonical-set-detail-page" className="flex flex-1 flex-col gap-4 p-8">
      {isLoading && <div data-testid="canonical-set-detail-loading">Loading…</div>}

      {isError && (
        <p data-testid="canonical-set-detail-error" className="text-sm text-red-600">
          Something went wrong loading this canonical set. Please try again.
        </p>
      )}

      {set && (
        <>
          <h1 data-testid="canonical-set-detail-name" className="text-lg font-semibold">
            {set.name}
          </h1>
          {set.description && (
            <p data-testid="canonical-set-detail-description" className="text-sm text-gray-600">
              {set.description}
            </p>
          )}

          {isLoggedIn && (
            <Link
              href={`/sets/new?cloneFrom=canonical&cloneFromId=${id}`}
              data-testid="canonical-set-clone-cta"
              className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Clone into my sets
            </Link>
          )}

          <ul data-testid="canonical-set-coin-list" className="flex flex-col gap-2">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <li key={item.id} data-testid="canonical-set-coin-item" className="rounded border border-gray-200 p-3">
                  {formatCoinLabel(item.coin)}
                </li>
              ))}
          </ul>
        </>
      )}
    </main>
  );
}
