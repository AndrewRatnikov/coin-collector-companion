'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';

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

export default function CatalogFilterForm({ testIdPrefix, onSubmit }: CatalogFilterFormProps) {
  const [country, setCountry] = useState('');
  const [denomination, setDenomination] = useState('');
  const [name, setName] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      country: country || undefined,
      denomination: denomination || undefined,
      name: name || undefined,
      yearMin: yearMin ? Number(yearMin) : undefined,
      yearMax: yearMax ? Number(yearMax) : undefined,
    });
  }

  return (
    <form
      data-testid={`${testIdPrefix}-filter-form`}
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-country`} className="text-sm font-medium">
          Country
        </label>
        <input
          id={`${testIdPrefix}-country`}
          data-testid={`${testIdPrefix}-filter-country`}
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-denomination`} className="text-sm font-medium">
          Denomination
        </label>
        <input
          id={`${testIdPrefix}-denomination`}
          data-testid={`${testIdPrefix}-filter-denomination`}
          type="text"
          value={denomination}
          onChange={(e) => setDenomination(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-name`} className="text-sm font-medium">
          Name
        </label>
        <input
          id={`${testIdPrefix}-name`}
          data-testid={`${testIdPrefix}-filter-name`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-year-min`} className="text-sm font-medium">
          Year min
        </label>
        <input
          id={`${testIdPrefix}-year-min`}
          data-testid={`${testIdPrefix}-filter-year-min`}
          type="number"
          value={yearMin}
          onChange={(e) => setYearMin(e.target.value)}
          className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${testIdPrefix}-year-max`} className="text-sm font-medium">
          Year max
        </label>
        <input
          id={`${testIdPrefix}-year-max`}
          data-testid={`${testIdPrefix}-filter-year-max`}
          type="number"
          value={yearMax}
          onChange={(e) => setYearMax(e.target.value)}
          className="w-24 rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        data-testid={`${testIdPrefix}-filter-submit`}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        Search
      </button>
    </form>
  );
}
