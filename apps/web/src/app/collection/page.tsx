'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatCoinLabel } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCollection } from '@/lib/hooks/use-collection';
import type { CollectionFilters } from '@/lib/collection-api';
import { useTranslation } from '@/lib/i18n/i18n-context';

function CollectionList() {
  const { t } = useTranslation();
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

  function handleClear() {
    setCountry('');
    setYear('');
    setFilters({});
  }

  return (
    <main
      data-testid="collection-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('collection.title')}</h1>

      <form
        data-testid="collection-filter-form"
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-4 border-y border-[var(--color-divider)] py-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="collection-country" className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
            {t('common.country')}
          </label>
          <input
            id="collection-country"
            data-testid="collection-filter-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="collection-year" className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
            {t('common.year')}
          </label>
          <input
            id="collection-year"
            data-testid="collection-filter-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-24 rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]"
          />
        </div>
        <button
          type="submit"
          data-testid="collection-filter-submit"
          className="rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
        >
          {t('common.search')}
        </button>
        <button
          type="button"
          data-testid="collection-filter-clear"
          onClick={handleClear}
          className="text-[13px] text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
        >
          {t('common.clear')}
        </button>
      </form>

      {isLoading && (
        <div data-testid="collection-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="collection-error" className="text-sm text-red-700">
          {t('collection.errorLoading')}
        </p>
      )}

      {data &&
        (data.length === 0 ? (
          <p data-testid="collection-empty" className="text-sm text-[var(--color-neutral-600)]">
            {t('collection.emptyMessage')}
          </p>
        ) : (
          <ul data-testid="collection-list" className="flex flex-col border-t border-[var(--color-divider)]">
            {data.map((item) => (
              <li
                key={item.coinId}
                data-testid="collection-item"
                className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-1 py-4"
              >
                <span>{formatCoinLabel(item.coin)}</span>
                <span className="[font-family:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-neutral-600)]">
                  {item.coin.year} {item.coin.mintMark}
                </span>
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
