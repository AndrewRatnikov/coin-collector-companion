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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(Boolean(getStoredToken()));
  }, []);

  if (id === null) {
    return <main data-testid="canonical-set-detail-page" />;
  }

  return (
    <main
      data-testid="canonical-set-detail-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <Link
        href="/sets/canonical"
        className="w-fit text-sm text-[color:var(--color-neutral-600)] transition-colors hover:text-[color:var(--color-accent)]"
      >
        ← {t('canonicalSets.title')}
      </Link>

      {isLoading && (
        <div data-testid="canonical-set-detail-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      )}

      {isError && (
        <p data-testid="canonical-set-detail-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('canonicalSetDetail.errorLoading')}
        </p>
      )}

      {set && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-[.14em] text-[color:var(--color-neutral-600)]">
            Canonical set
          </p>

          <h1
            data-testid="canonical-set-detail-name"
            className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]"
          >
            {resolveLocalizedText(set.name, locale)}
          </h1>
          {set.description && (
            <p
              data-testid="canonical-set-detail-description"
              className="max-w-[60ch] text-sm text-[color:var(--color-neutral-700)]"
            >
              {resolveLocalizedText(set.description, locale)}
            </p>
          )}

          <div className="flex items-center justify-between gap-4 border-y border-[color:var(--color-divider)] py-4">
            {isLoggedIn ? (
              <Link
                href={`/sets/new?cloneFrom=canonical&cloneFromId=${id}`}
                data-testid="canonical-set-clone-cta"
                className="inline-flex w-fit items-center justify-center rounded-[2px] bg-[color:var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[.1em] text-[color:var(--color-bg)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,black)]"
              >
                {t('canonicalSetDetail.cloneCta')}
              </Link>
            ) : (
              <p className="text-sm text-[color:var(--color-neutral-700)]">Log in to clone this set into your own collection.</p>
            )}
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-neutral-600)]">
              {set.coins.length}
            </span>
          </div>

          <ul data-testid="canonical-set-coin-list" className="flex flex-col">
            {[...set.coins]
              .sort((a, b) => a.position - b.position)
              .map((item) => (
                <li
                  key={item.id}
                  data-testid="canonical-set-coin-item"
                  className="flex items-center gap-4 border-b border-[color:var(--color-divider)] py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-surface)] font-[family-name:var(--font-heading)] text-xs text-[color:var(--color-neutral-700)] outline outline-1 outline-[color:var(--color-divider)]"
                  >
                    {item.coin.denomination.charAt(0)}
                  </span>
                  <span className="text-[15px] text-[color:var(--color-text)]">{formatCoinLabel(item.coin)}</span>
                </li>
              ))}
          </ul>
        </>
      )}
    </main>
  );
}
