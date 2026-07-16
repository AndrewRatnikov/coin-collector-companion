'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CoinDto, CoinMutationResponse, Denomination } from '@coin-collector/shared';
import { CoinForm } from '@/components/coins/coin-form';
import { SuggestionPanel } from '@/components/coins/suggestion-panel';
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
  const searchParams = useSearchParams();
  const createMutation = useCreateCoin();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationResult, setMutationResult] = useState<CoinMutationResponse | null>(null);

  // A gap-view missing slot deep-links here pre-filled with its denomination/year/mint
  // (PRD §4.1's "add new coin" flow), via ?denomination=&year=&mintMark=; returnTo=gap
  // sends the user back to that set's gap view on success instead of the coin list.
  const prefill = useMemo((): Partial<CoinDto> | undefined => {
    const denomination = searchParams.get('denomination');
    const year = searchParams.get('year');
    if (!denomination || !year) return undefined;
    return {
      denomination: denomination as Denomination,
      year: Number(year),
      mintMark: searchParams.get('mintMark'),
    };
  }, [searchParams]);

  const returnTo = searchParams.get('returnTo');
  const userSetId = searchParams.get('userSetId');
  const redirectTarget = returnTo === 'gap' && userSetId ? `/my-sets/${userSetId}` : '/coins';

  function handleSubmit(input: CoinInput) {
    setFieldErrors({});
    setFormError(null);
    createMutation.mutate(input, {
      onSuccess: (result) => {
        if (result.suggestions.length > 0) {
          setMutationResult(result);
        } else {
          router.replace(redirectTarget);
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
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Add Coin</h1>
        <p className="text-sm text-gray-600">Add a coin to your collection.</p>
      </div>

      {mutationResult ? (
        <SuggestionPanel
          coinId={mutationResult.coin.id}
          suggestions={mutationResult.suggestions}
          onDone={() => router.replace(redirectTarget)}
        />
      ) : (
        <CoinForm
          initialCoin={prefill}
          onSubmit={handleSubmit}
          submitting={createMutation.isPending}
          submitLabel="Add Coin"
          formError={formError}
          fieldErrors={fieldErrors}
        />
      )}

      <Link href={redirectTarget} className="text-sm text-blue-600 underline">
        Cancel
      </Link>
    </main>
  );
}
