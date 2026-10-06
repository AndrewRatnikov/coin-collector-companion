'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ImportCoinSummary } from '@coin-collector/shared';
import { Skeleton } from '@/components/ui/skeleton';
import type { CatalogFilters } from '@/lib/catalog-api';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { formatImportCoinLabel, toImportCoinSummary } from '@/lib/import-selection';

export interface CoinSearchPickerProps {
  initialYear?: number | null;
  initialCountry?: string;
  onPick: (coin: ImportCoinSummary) => void;
  onCancel: () => void;
}

const SEARCH_LIMIT = 50;

const inputClassName =
  'rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]';

// Mounted only after the user submits, so nothing is fetched before that.
function CoinSearchResults({
  filters,
  onPick,
}: {
  filters: CatalogFilters;
  onPick: (coin: ImportCoinSummary) => void;
}) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCatalog(filters);

  if (isLoading) {
    return (
      <div data-testid="coin-search-loading">
        <Skeleton />
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-red-700">{t('common.somethingWentWrong')}</p>;
  }
  if (!data || data.items.length === 0) {
    return (
      <p data-testid="coin-search-empty" className="text-sm text-[var(--color-neutral-600)]">
        {t('import.search.empty')}
      </p>
    );
  }
  return (
    <ul className="flex flex-col border-t border-[var(--color-divider)]">
      {data.items.map((coin) => {
        const summary = toImportCoinSummary(coin);
        return (
          <li key={coin.id} className="border-b border-[var(--color-divider)]">
            <button
              type="button"
              data-testid="coin-search-result"
              data-coin-id={coin.id}
              onClick={() => onPick(summary)}
              className="w-full px-2 py-2 text-left text-sm hover:text-[var(--color-accent)]"
            >
              {formatImportCoinLabel(summary)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function CoinSearchPicker({
  initialYear,
  initialCountry,
  onPick,
  onCancel,
}: CoinSearchPickerProps) {
  const { t } = useTranslation();
  const [year, setYear] = useState(initialYear != null ? String(initialYear) : '');
  const [country, setCountry] = useState(initialCountry ?? '');
  const [filters, setFilters] = useState<CatalogFilters | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: CatalogFilters = {};
    const trimmedYear = year.trim();
    if (trimmedYear !== '' && Number.isInteger(Number(trimmedYear))) {
      next.yearMin = Number(trimmedYear);
      next.yearMax = Number(trimmedYear);
    }
    const trimmedCountry = country.trim();
    if (trimmedCountry !== '') {
      next.country = trimmedCountry;
    }
    next.limit = SEARCH_LIMIT;
    setFilters(next);
  }

  return (
    <div
      data-testid="coin-search-picker"
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-divider)] p-3"
    >
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
          {t('common.year')}
          <input
            data-testid="coin-search-year"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className={`w-24 normal-case tracking-normal ${inputClassName}`}
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
          {t('common.country')}
          <input
            data-testid="coin-search-country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={`normal-case tracking-normal ${inputClassName}`}
          />
        </label>
        <button
          type="submit"
          data-testid="coin-search-submit"
          className="rounded-[2px] bg-[var(--color-accent)] px-[18px] py-[9px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
        >
          {t('common.search')}
        </button>
        <button
          type="button"
          data-testid="coin-search-cancel"
          onClick={onCancel}
          className="text-[13px] text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]"
        >
          {t('common.cancel')}
        </button>
      </form>
      {filters && <CoinSearchResults filters={filters} onPick={onPick} />}
    </div>
  );
}
