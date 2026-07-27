'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import { getStoredToken } from '@/lib/auth-token';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function CanonicalSetDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { data: set, isLoading, isError } = useCanonicalSet(id ?? '');
  const isLoggedIn = Boolean(getStoredToken());

  if (id === null) {
    return <main data-testid="canonical-set-detail-page" />;
  }

  return (
    <main data-testid="canonical-set-detail-page" className="flex flex-1 flex-col gap-4 p-8">
      {isLoading && (
        <div data-testid="canonical-set-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="canonical-set-detail-error" className="text-sm text-red-600">
          {t('canonicalSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <h1 data-testid="canonical-set-detail-name" className="text-lg font-semibold">
            {resolveLocalizedText(set.name, locale)}
          </h1>
          {set.description && (
            <p data-testid="canonical-set-detail-description" className="text-sm text-gray-600">
              {resolveLocalizedText(set.description, locale)}
            </p>
          )}

          {isLoggedIn && (
            <Link
              href={`/sets/new?cloneFrom=canonical&cloneFromId=${id}`}
              data-testid="canonical-set-clone-cta"
              className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
            >
              {t('canonicalSetDetail.cloneCta')}
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
