'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import type { CatalogFacets } from '@coin-collector/shared';
import { parseYearInput, type CatalogViewState } from '@/lib/catalog-view';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CatalogFilterSidebarProps {
  state: CatalogViewState;
  facets: CatalogFacets | undefined;
  isLoggedIn: boolean;
  onChange: (patch: Partial<Omit<CatalogViewState, 'page' | 'name' | 'sort'>>) => void;
  onClearAll: () => void;
  idPrefix?: string; // default 'catalog-sidebar'; radio `name` and input ids
  showHeading?: boolean; // default true
}

const YEAR_DEBOUNCE_MS = 300;

const LEGEND_CLASS =
  'mb-1.5 p-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-neutral-800';
const OPTION_CLASS =
  '-mx-2 flex min-h-[34px] cursor-pointer items-center gap-2.5 rounded-[4px] px-2 text-sm text-text hover:bg-surface';
const INPUT_CLASS = 'h-4 w-4 shrink-0 accent-[var(--color-accent-700)]';
const YEAR_INPUT_CLASS =
  'h-[38px] w-full min-w-0 rounded-[4px] border border-neutral-300 bg-white px-2.5 font-mono text-sm text-text outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-200';

function formatYear(year: number | undefined): string {
  return year === undefined ? '' : String(year);
}

interface YearInputProps {
  id: string;
  testId: string;
  label: string;
  value: number | undefined;
  onApply: (year: number | undefined) => void;
}

// Keeps its own text while typing; applies after 300 ms of no typing, or at once on blur/Enter.
function YearInput({ id, testId, label, value, onApply }: YearInputProps) {
  const [text, setText] = useState(() => formatYear(value));
  const [syncedValue, setSyncedValue] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ value, onApply });
  latestRef.current = { value, onApply };

  // Render-time "adjust state": re-sync the text when the bound changes from outside
  // (Clear all, URL), without a stale paint from a useEffect.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(formatYear(value));
  }

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    },
    [],
  );

  function cancelTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function apply(nextText: string) {
    cancelTimer();
    const year = parseYearInput(nextText);
    if (year !== latestRef.current.value) latestRef.current.onApply(year);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextText = event.target.value;
    setText(nextText);
    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      apply(nextText);
    }, YEAR_DEBOUNCE_MS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      apply(event.currentTarget.value);
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      data-testid={testId}
      aria-label={label}
      placeholder={label}
      value={text}
      onChange={handleChange}
      onBlur={(event) => apply(event.currentTarget.value)}
      onKeyDown={handleKeyDown}
      className={YEAR_INPUT_CLASS}
    />
  );
}

function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col border-0 p-0">
      <legend className={LEGEND_CLASS}>{legend}</legend>
      {children}
    </fieldset>
  );
}

export default function CatalogFilterSidebar({
  state,
  facets,
  isLoggedIn,
  onChange,
  onClearAll,
  idPrefix = 'catalog-sidebar',
  showHeading = true,
}: CatalogFilterSidebarProps) {
  const { t } = useTranslation();

  const countries = [...(facets?.countries ?? [])];
  if (state.country !== '' && !countries.includes(state.country)) countries.push(state.country);

  const denominations = [...(facets?.denominations ?? [])];
  for (const selected of state.denominations) {
    if (!denominations.includes(selected)) denominations.push(selected);
  }

  function toggleDenomination(value: string, checked: boolean) {
    const next = denominations.filter((option) =>
      option === value ? checked : state.denominations.includes(option),
    );
    onChange({ denominations: next });
  }

  const radioName = `${idPrefix}-country`;

  return (
    <div className="flex flex-col gap-[22px]">
      <div className="flex items-baseline justify-between gap-3">
        {showHeading && (
          <h2 className="font-[family-name:var(--font-heading)] text-[22px] font-semibold leading-tight text-text">
            {t('catalog.filtersHeading')}
          </h2>
        )}
        <button
          type="button"
          data-testid="catalog-clear-all"
          onClick={onClearAll}
          className="ml-auto text-[13px] text-neutral-700 underline underline-offset-2 hover:text-accent-700"
        >
          {t('catalog.clearAll')}
        </button>
      </div>

      <Fieldset legend={t('common.country')}>
        {countries.map((country) => (
          <label key={country} className={OPTION_CLASS}>
            <input
              type="radio"
              name={radioName}
              value={country}
              data-testid={`catalog-filter-country-${country}`}
              checked={state.country === country}
              onChange={() => onChange({ country, denominations: [] })}
              className={INPUT_CLASS}
            />
            <span className="min-w-0 truncate">{country}</span>
          </label>
        ))}
        <label className={OPTION_CLASS}>
          <input
            type="radio"
            name={radioName}
            value=""
            data-testid="catalog-filter-country-all"
            checked={state.country === ''}
            onChange={() => onChange({ country: '', denominations: [] })}
            className={INPUT_CLASS}
          />
          <span>{t('catalog.allCountries')}</span>
        </label>
      </Fieldset>

      <Fieldset legend={t('common.denomination')}>
        {denominations.map((denomination) => (
          <label key={denomination} className={OPTION_CLASS}>
            <input
              type="checkbox"
              value={denomination}
              data-testid={`catalog-filter-denomination-${denomination}`}
              checked={state.denominations.includes(denomination)}
              onChange={(event) => toggleDenomination(denomination, event.target.checked)}
              className={INPUT_CLASS}
            />
            <span className="min-w-0 truncate">{denomination}</span>
          </label>
        ))}
      </Fieldset>

      <Fieldset legend={t('catalog.years')}>
        <div className="flex items-center gap-2">
          <YearInput
            id={`${idPrefix}-year-min`}
            testId="catalog-filter-year-min"
            label={t('catalog.yearFrom')}
            value={state.yearMin}
            onApply={(yearMin) => onChange({ yearMin })}
          />
          <span aria-hidden="true" className="text-neutral-700">
            –
          </span>
          <YearInput
            id={`${idPrefix}-year-max`}
            testId="catalog-filter-year-max"
            label={t('catalog.yearTo')}
            value={state.yearMax}
            onApply={(yearMax) => onChange({ yearMax })}
          />
        </div>
      </Fieldset>

      <Fieldset legend={t('catalog.show')}>
        <label className={OPTION_CLASS}>
          <input
            type="checkbox"
            data-testid="catalog-filter-key-date"
            checked={state.keyDateOnly}
            onChange={(event) => onChange({ keyDateOnly: event.target.checked })}
            className={INPUT_CLASS}
          />
          <span>{t('catalog.keyDatesOnly')}</span>
        </label>
        {isLoggedIn && (
          <label className={OPTION_CLASS}>
            <input
              type="checkbox"
              data-testid="catalog-filter-hide-owned"
              checked={state.hideOwned}
              onChange={(event) => onChange({ hideOwned: event.target.checked })}
              className={INPUT_CLASS}
            />
            <span>{t('catalog.hideOwned')}</span>
          </label>
        )}
      </Fieldset>
    </div>
  );
}
