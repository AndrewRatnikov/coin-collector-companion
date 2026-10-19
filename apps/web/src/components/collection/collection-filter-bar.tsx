'use client';

import { useId, useState } from 'react';
import { CHIP_CLASSNAME } from '@/components/sets/add-coins-filter-chip';
import {
  hasActiveFilters,
  sanitizeYearInput,
  type CollectionViewFilters,
  type CountryChips,
} from '@/lib/collection-view';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CollectionFilterBarProps {
  filters: CollectionViewFilters;
  onChange: (next: CollectionViewFilters) => void;
  chips: CountryChips;
  onClear: () => void;
}

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

const INPUT_CLASSNAME =
  'h-10 rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-sm text-text placeholder:text-neutral-600 focus:border-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-700';

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`motion-safe:transition-transform ${open ? 'rotate-180' : ''}`.trimEnd()}
    >
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChipCount({ count }: { count: number }) {
  return (
    <span data-testid="collection-country-chip-count" className="font-mono tabular-nums text-xs opacity-80">
      {count}
    </span>
  );
}

/**
 * The /collection filter bar: live search, country chips with counts (every filter but the
 * country), a From/To year range and Clear. Under 900px the chips scroll in one row and the
 * year range hides behind a Years chip.
 */
export function CollectionFilterBar({ filters, onChange, chips, onClear }: CollectionFilterBarProps) {
  const { t } = useTranslation();
  const yearsId = useId();
  const [yearsOpen, setYearsOpen] = useState(false);
  const active = hasActiveFilters(filters);

  return (
    <div
      role="search"
      data-testid="collection-filter-bar"
      aria-label={t('collection.filterLabel')}
      className="flex flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-surface p-3"
    >
      <div className="relative flex min-w-0 flex-[1_1_280px] items-center max-[899px]:basis-full">
        <span className="pointer-events-none absolute left-3 text-neutral-600">
          <SearchIcon />
        </span>
        <input
          type="search"
          data-testid="collection-search"
          aria-label={t('collection.searchLabel')}
          placeholder={t('collection.searchPlaceholder')}
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className={`${INPUT_CLASSNAME} w-full pl-9`}
        />
      </div>

      <div
        role="group"
        data-testid="collection-country-chips"
        aria-label={t('collection.countryLabel')}
        className="flex min-w-0 flex-wrap items-center gap-2 max-[899px]:-mx-3 max-[899px]:basis-[calc(100%+24px)] max-[899px]:flex-nowrap max-[899px]:overflow-x-auto max-[899px]:px-3"
      >
        <button
          type="button"
          data-testid="collection-country-chip-all"
          aria-pressed={filters.country === null}
          onClick={() => onChange({ ...filters, country: null })}
          className={CHIP_CLASSNAME}
        >
          {t('collection.allCountries')}
          <ChipCount count={chips.allCount} />
        </button>
        {chips.chips.map(({ country, count }) => (
          <button
            key={country}
            type="button"
            data-testid="collection-country-chip"
            data-country={country}
            aria-pressed={filters.country === country}
            onClick={() => onChange({ ...filters, country })}
            className={CHIP_CLASSNAME}
          >
            {country}
            <ChipCount count={count} />
          </button>
        ))}
        <button
          type="button"
          data-testid="collection-years-toggle"
          aria-expanded={yearsOpen}
          aria-controls={yearsId}
          onClick={() => setYearsOpen((open) => !open)}
          className={`${CHIP_CLASSNAME} min-[900px]:hidden`}
        >
          {t('collection.yearsLegend')}
          <ChevronIcon open={yearsOpen} />
        </button>
      </div>

      <fieldset
        id={yearsId}
        data-testid="collection-years"
        className={`m-0 flex min-w-0 items-center gap-2 border-0 p-0 ${yearsOpen ? '' : 'max-[899px]:hidden'}`.trimEnd()}
      >
        <legend className="sr-only">{t('collection.yearsLegend')}</legend>
        <input
          type="text"
          inputMode="numeric"
          data-testid="collection-year-from"
          aria-label={t('collection.yearFromLabel')}
          placeholder={t('collection.yearFromPlaceholder')}
          value={filters.yearFrom}
          onChange={(event) => onChange({ ...filters, yearFrom: sanitizeYearInput(event.target.value) })}
          className={`${INPUT_CLASSNAME} w-[84px] font-mono tabular-nums`}
        />
        <span aria-hidden="true" className="text-neutral-700">
          –
        </span>
        <input
          type="text"
          inputMode="numeric"
          data-testid="collection-year-to"
          aria-label={t('collection.yearToLabel')}
          placeholder={t('collection.yearToPlaceholder')}
          value={filters.yearTo}
          onChange={(event) => onChange({ ...filters, yearTo: sanitizeYearInput(event.target.value) })}
          className={`${INPUT_CLASSNAME} w-[84px] font-mono tabular-nums`}
        />
      </fieldset>

      {active && (
        <button
          type="button"
          data-testid="collection-filter-clear"
          onClick={onClear}
          className={`min-h-9 cursor-pointer rounded-[var(--radius-md)] px-2 text-sm font-medium text-accent-700 underline underline-offset-2 hover:text-accent-800 ${FOCUS_RING}`}
        >
          {t('common.clear')}
        </button>
      )}
    </div>
  );
}
