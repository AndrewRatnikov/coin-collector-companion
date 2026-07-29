'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface CatalogFilterFormValues {
  country?: string;
  denomination?: string;
  name?: string;
  yearMin?: number;
  yearMax?: number;
}

export interface CatalogFilterFormProps {
  testIdPrefix: string;
  onSubmit: (values: CatalogFilterFormValues) => void;
}

const inputClassName =
  'border-0 border-b border-[var(--color-divider)] bg-transparent px-1 py-2 text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none';

const labelClassName = 'text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]';

export default function CatalogFilterForm({ testIdPrefix, onSubmit }: CatalogFilterFormProps) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('');
  const [denomination, setDenomination] = useState('');
  const [name, setName] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');

  function submitValues(values: {
    country: string;
    denomination: string;
    name: string;
    yearMin: string;
    yearMax: string;
  }) {
    onSubmit({
      country: values.country || undefined,
      denomination: values.denomination || undefined,
      name: values.name || undefined,
      yearMin: values.yearMin ? Number(values.yearMin) : undefined,
      yearMax: values.yearMax ? Number(values.yearMax) : undefined,
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitValues({ country, denomination, name, yearMin, yearMax });
  }

  function handleClear() {
    setCountry('');
    setDenomination('');
    setName('');
    setYearMin('');
    setYearMax('');
    submitValues({ country: '', denomination: '', name: '', yearMin: '', yearMax: '' });
  }

  return (
    <form
      data-testid={`${testIdPrefix}-filter-form`}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-country`} className={labelClassName}>
          {t('common.country')}
        </label>
        <input
          id={`${testIdPrefix}-country`}
          data-testid={`${testIdPrefix}-filter-country`}
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-denomination`} className={labelClassName}>
          {t('common.denomination')}
        </label>
        <input
          id={`${testIdPrefix}-denomination`}
          data-testid={`${testIdPrefix}-filter-denomination`}
          type="text"
          value={denomination}
          onChange={(e) => setDenomination(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-name`} className={labelClassName}>
          {t('common.name')}
        </label>
        <input
          id={`${testIdPrefix}-name`}
          data-testid={`${testIdPrefix}-filter-name`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClassName}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-year-min`} className={labelClassName}>
          {t('common.yearMin')}
        </label>
        <input
          id={`${testIdPrefix}-year-min`}
          data-testid={`${testIdPrefix}-filter-year-min`}
          type="number"
          value={yearMin}
          onChange={(e) => setYearMin(e.target.value)}
          className={`w-24 font-mono ${inputClassName}`}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-year-max`} className={labelClassName}>
          {t('common.yearMax')}
        </label>
        <input
          id={`${testIdPrefix}-year-max`}
          data-testid={`${testIdPrefix}-filter-year-max`}
          type="number"
          value={yearMax}
          onChange={(e) => setYearMax(e.target.value)}
          className={`w-24 font-mono ${inputClassName}`}
        />
      </div>
      <button
        type="submit"
        data-testid={`${testIdPrefix}-filter-submit`}
        className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
      >
        {t('common.search')}
      </button>
      <button
        type="button"
        data-testid={`${testIdPrefix}-filter-clear`}
        onClick={handleClear}
        className="text-[13px] text-[var(--color-neutral-600)] underline hover:text-[var(--color-accent)]"
      >
        {t('common.clear')}
      </button>
    </form>
  );
}
