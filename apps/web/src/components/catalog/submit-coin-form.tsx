'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import type { CatalogCoin } from '@coin-collector/shared';
import { FormField } from '@/components/auth/form-field';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { ApiError } from '@/lib/api-client';
import { useSubmitCoin } from '@/lib/hooks/use-catalog';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SubmitCoinFormProps {
  onSuccess: (coin: CatalogCoin) => void;
}

const FIELDS = ['country', 'denomination', 'name', 'year', 'mintMark', 'variety'];

export default function SubmitCoinForm({ onSuccess }: SubmitCoinFormProps) {
  const { t } = useTranslation();
  const [country, setCountry] = useState('');
  const [denomination, setDenomination] = useState('');
  const [name, setName] = useState('');
  const [year, setYear] = useState('');
  const [mintMark, setMintMark] = useState('');
  const [variety, setVariety] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const submitCoinMutation = useSubmitCoin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');

    submitCoinMutation.mutate(
      {
        country,
        denomination,
        name,
        year: Number(year),
        mintMark: mintMark || undefined,
        variety: variety || undefined,
      },
      {
        onSuccess: (coin) => onSuccess(coin),
        onError: (error: unknown) => {
          if (error instanceof ApiError) {
            if (error.status === 400) {
              setFieldErrors(fieldErrorsFrom(error.details, FIELDS));
              const unmatched = error.details.filter(
                (detail) => !FIELDS.some((field) => detail.toLowerCase().startsWith(field.toLowerCase())),
              );
              setFormError(unmatched.join(', '));
            } else {
              setFormError(error.details.join(', '));
            }
          } else {
            setFormError(t('common.somethingWentWrong'));
          }
        },
      },
    );
  }

  return (
    <form data-testid="submit-coin-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField
        id="submit-coin-country"
        label={t('common.country')}
        value={country}
        onChange={setCountry}
        error={fieldErrors.country}
      />
      <FormField
        id="submit-coin-denomination"
        label={t('common.denomination')}
        value={denomination}
        onChange={setDenomination}
        error={fieldErrors.denomination}
      />
      <FormField
        id="submit-coin-name"
        label={t('common.name')}
        value={name}
        onChange={setName}
        error={fieldErrors.name}
      />
      <FormField
        id="submit-coin-year"
        label={t('common.year')}
        type="number"
        value={year}
        onChange={setYear}
        error={fieldErrors.year}
      />
      <FormField
        id="submit-coin-mint-mark"
        label={t('common.mintMark')}
        value={mintMark}
        onChange={setMintMark}
        error={fieldErrors.mintMark}
      />
      <FormField
        id="submit-coin-variety"
        label={t('common.variety')}
        value={variety}
        onChange={setVariety}
        error={fieldErrors.variety}
      />
      {formError && (
        <p data-testid="submit-coin-form-error" className="text-sm text-red-600">
          {formError}
        </p>
      )}
      <button
        type="submit"
        data-testid="submit-coin-submit"
        className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
      >
        {t('submitCoinForm.submit')}
      </button>
    </form>
  );
}
