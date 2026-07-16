'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CoinMutationResponse } from '@coin-collector/shared';
import { CoinForm } from '@/components/coins/coin-form';
import { SuggestionPanel } from '@/components/coins/suggestion-panel';
import { ApiError } from '@/lib/api-client';
import type { CoinInput } from '@/lib/coins-api';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useCoins, useUpdateCoin } from '@/lib/hooks/use-coins';

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

export default function EditCoinPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  // No GET /coins/:id endpoint exists — the edit form is seeded from the already-fetched
  // coin list rather than a dedicated fetch.
  const { data: coins, isLoading, isError } = useCoins();
  const updateMutation = useUpdateCoin();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationResult, setMutationResult] = useState<CoinMutationResponse | null>(null);

  const coin = coins?.find((c) => c.id === id);

  function handleSubmit(input: CoinInput) {
    setFieldErrors({});
    setFormError(null);
    updateMutation.mutate(
      { id, input },
      {
        onSuccess: (result) => {
          // PATCH returns the bare coin unless denomination/year/mintMark changed (SD §4);
          // only the wrapped CoinMutationResponse carries suggestions.
          if ('suggestions' in result && result.suggestions.length > 0) {
            setMutationResult(result);
          } else {
            router.replace('/coins');
          }
        },
        onError: (error) => {
          if (error instanceof ApiError && error.status === 400) {
            setFieldErrors(fieldErrorsFrom(error.details, FORM_FIELDS));
          } else if (error instanceof ApiError) {
            setFormError(error.message);
          } else {
            setFormError('Something went wrong. Please try again.');
          }
        },
      },
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Edit Coin</h1>
      </div>

      {isLoading && <p className="text-sm text-gray-600">Loading coin…</p>}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          Failed to load coin.
        </p>
      )}
      {!isLoading && !isError && !coin && (
        <p role="alert" className="text-sm text-red-600">
          Coin not found.
        </p>
      )}

      {coin && mutationResult && (
        <SuggestionPanel
          coinId={mutationResult.coin.id}
          suggestions={mutationResult.suggestions}
          onDone={() => router.replace('/coins')}
        />
      )}

      {coin && !mutationResult && (
        <CoinForm
          initialCoin={coin}
          onSubmit={handleSubmit}
          submitting={updateMutation.isPending}
          submitLabel="Save Changes"
          formError={formError}
          fieldErrors={fieldErrors}
        />
      )}

      <Link href="/coins" className="text-sm text-blue-600 underline">
        Cancel
      </Link>
    </main>
  );
}
