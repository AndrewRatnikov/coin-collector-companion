'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function PublicSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t, locale } = useTranslation();
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
      {isLoading && (
        <div data-testid="public-set-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="public-set-detail-error" className="text-sm text-red-600">
          {t('publicSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <h1 data-testid="public-set-detail-name" className="text-lg font-semibold">
            {resolveLocalizedText(set.name, locale)}
          </h1>

          {isLoggedIn && (
            <Link
              href={`/sets/new?cloneFrom=user&cloneFromId=${id}`}
              data-testid="public-set-clone-cta"
              className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t('publicSetDetail.cloneCta')}
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
                      {ownedById.get(item.coin.id) ? t('common.owned') : t('common.missing')}
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
