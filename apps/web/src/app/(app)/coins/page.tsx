'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { CoinDto } from '@coin-collector/shared';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCoins, useDeleteCoin } from '@/lib/hooks/use-coins';

function formatDenomination(denomination: string): string {
  return denomination.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function formatYearMint(coin: CoinDto): string {
  return coin.mintMark ? `${coin.year}-${coin.mintMark}` : `${coin.year}`;
}

export default function CoinsPage() {
  const { data: coins, isLoading, isError, error } = useCoins();
  const deleteMutation = useDeleteCoin();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">My Coins</h1>
          <p className="text-sm text-gray-600">Your full coin collection.</p>
        </div>
        <Link
          href="/coins/new"
          className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Add Coin
        </Link>
      </div>

      {isLoading && <ListSkeleton rows={5} />}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load coins.'}
        </p>
      )}
      {coins && coins.length === 0 && (
        <p className="text-sm text-gray-600">No coins added yet.</p>
      )}

      {coins && coins.length > 0 && (
        <ul className="flex flex-col gap-2">
          {coins.map((coin) => {
            const isConfirming = confirmingId === coin.id;
            const isDeleting = deleteMutation.isPending && deleteMutation.variables === coin.id;
            return (
              <li
                key={coin.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <p className="font-medium">
                    {formatYearMint(coin)} {formatDenomination(coin.denomination)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {coin.grade ?? 'Ungraded'}
                    {coin.slotId && <span className="ml-2 text-green-600">Linked</span>}
                  </p>
                </div>
                {isConfirming ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm text-gray-600">Delete this coin?</span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() =>
                        deleteMutation.mutate(coin.id, { onSettled: () => setConfirmingId(null) })
                      }
                      className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                    >
                      {isDeleting ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmingId(null)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/coins/${coin.id}/edit`}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(coin.id)}
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
