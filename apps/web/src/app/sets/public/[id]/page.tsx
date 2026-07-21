'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';

export default function PublicSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setId(resolved.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const { data: set, isLoading, isError } = usePublicSet(id ?? '');
  const isLoggedIn = Boolean(getStoredToken());
  const gapsQuery = useSetGaps(isLoggedIn ? (id ?? '') : '');

  if (id === null) {
    return <main data-testid="public-set-detail-page" />;
  }

  const ownedById = new Map<string, boolean>(
    gapsQuery.isSuccess && gapsQuery.data ? gapsQuery.data.slots.map((slot) => [slot.coin.id, slot.owned]) : [],
  );

  return (
    <main data-testid="public-set-detail-page" className="flex flex-1 flex-col gap-4 p-8">
      {isLoading && <div data-testid="public-set-detail-loading">Loading…</div>}

      {isError && (
        <p data-testid="public-set-detail-error" className="text-sm text-red-600">
          Something went wrong loading this set. Please try again.
        </p>
      )}

      {set && (
        <>
          <h1 data-testid="public-set-detail-name" className="text-lg font-semibold">
            {set.name}
          </h1>

          {isLoggedIn && (
            <Link
              href={`/sets/new?cloneFrom=user&cloneFromId=${id}`}
              data-testid="public-set-clone-cta"
              className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              Clone into my sets
            </Link>
          )}

          <ul data-testid="public-set-detail-coin-list" className="flex flex-col gap-2">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <li
                  key={item.id}
                  data-testid="public-set-detail-coin-item"
                  className="flex items-center gap-2 rounded border border-gray-200 p-3"
                >
                  <span>{formatCoinLabel(item.coin)}</span>
                  {gapsQuery.isSuccess && ownedById.has(item.coin.id) && (
                    <span data-testid="public-set-detail-coin-status" className="text-xs text-gray-500">
                      {ownedById.get(item.coin.id) ? 'owned' : 'missing'}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </>
      )}
    </main>
  );
}
