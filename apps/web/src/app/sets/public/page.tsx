'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const DEFAULT_LIMIT = 20;

export default function PublicSetsPage() {
  const { t, locale } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = usePublicSets({ page, limit: DEFAULT_LIMIT });

  function goToPage(nextPage: number) {
    setPage(nextPage);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <main
      data-testid="public-sets-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10"
    >
      <div className="flex flex-col gap-2 border-b border-[color:var(--color-divider)] pb-4">
        <h1 className="font-[family-name:var(--font-heading)] text-[32px] font-semibold text-[color:var(--color-text)]">
          {t('publicSets.title')}
        </h1>
      </div>

      {isLoading && (
        <div data-testid="public-sets-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="public-sets-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('publicSets.errorLoading')}
        </p>
      )}

      {data && (
        <>
          {data.items.length === 0 ? (
            <p data-testid="public-sets-empty" className="text-sm text-[color:var(--color-neutral-600)]">
              {t('publicSets.emptyMessage')}
            </p>
          ) : (
            <ul data-testid="public-sets-list" className="flex flex-col">
              {data.items.map((set) => (
                <li
                  key={set.id}
                  data-testid="public-set-item"
                  className="border-b border-[color:var(--color-divider)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
                >
                  <Link
                    href={`/sets/public/${set.id}`}
                    className="flex items-center justify-between gap-6 py-5 text-[color:var(--color-text)]"
                  >
                    <span className="flex flex-col gap-1">
                      <span className="font-[family-name:var(--font-heading)] text-[21px] font-semibold">
                        {resolveLocalizedText(set.name, locale)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div data-testid="public-sets-pagination" className="flex items-center justify-center gap-4 pt-2">
            {pageNumbers.map((num) => {
              const isActive = num === data.page;
              return isActive ? (
                <span
                  key={num}
                  data-testid="public-sets-pagination-page"
                  aria-current="page"
                  className="[font-family:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-text)] underline underline-offset-4"
                >
                  {num}
                </span>
              ) : (
                <button
                  key={num}
                  type="button"
                  data-testid="public-sets-pagination-page"
                  onClick={() => goToPage(num)}
                  className="[font-family:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
                >
                  {num}
                </button>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
