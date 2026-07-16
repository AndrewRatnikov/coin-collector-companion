'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CoinForm } from '@/components/coins/coin-form';
import { ApiError } from '@/lib/api-client';
import type { CoinInput } from '@/lib/coins-api';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useCreateCoin } from '@/lib/hooks/use-coins';

const FORM_FIELDS = [
  'denomination',
  'year',
  'mintMark',
  'country',
  'grade',
  'purchasePrice',
  'notes',
  'acquiredDate',
];

export default function NewCoinPage() {
  const router = useRouter();
  const createMutation = useCreateCoin();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function handleSubmit(input: CoinInput) {
    setFieldErrors({});
    setFormError(null);
    createMutation.mutate(input, {
      onSuccess: () => router.replace('/coins'),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 400) {
          setFieldErrors(fieldErrorsFrom(error.details, FORM_FIELDS));
        } else if (error instanceof ApiError) {
          setFormError(error.message);
        } else {
          setFormError('Something went wrong. Please try again.');
        }
      },
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Add Coin</h1>
        <p className="text-sm text-gray-600">Add a coin to your collection.</p>
      </div>

      <CoinForm
        onSubmit={handleSubmit}
        submitting={createMutation.isPending}
        submitLabel="Add Coin"
        formError={formError}
        fieldErrors={fieldErrors}
      />

      <Link href="/coins" className="text-sm text-blue-600 underline">
        Cancel
      </Link>
    </main>
  );
}
