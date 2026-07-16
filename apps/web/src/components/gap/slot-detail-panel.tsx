'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { CoinDto, Denomination, GapSlot } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { useLinkCoin, useUnlinkCoin } from '@/lib/hooks/use-coins';

function formatEnumLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// Same formula as the slot card (PRD §4.1: label ?? `${year}${mintMark ? `-${mintMark}` : ''}`).
function slotDisplayLabel(slot: GapSlot): string {
  return slot.label ?? `${slot.year}${slot.mintMark ? `-${slot.mintMark}` : ''}`;
}

function coinDisplayLabel(coin: Pick<CoinDto, 'denomination' | 'year' | 'mintMark'>): string {
  return `${formatEnumLabel(coin.denomination)} — ${coin.year}${coin.mintMark ? `-${coin.mintMark}` : ''}`;
}

function coinSearchText(coin: CoinDto): string {
  return [coin.denomination, coin.year, coin.mintMark, coin.grade, coin.notes]
    .filter((part): part is string | number => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase();
}

function addNewCoinHref(slot: GapSlot, setDenomination: Denomination, userSetId: string): string {
  const params = new URLSearchParams({
    denomination: setDenomination,
    year: String(slot.year),
    returnTo: 'gap',
    userSetId,
  });
  if (slot.mintMark) {
    params.set('mintMark', slot.mintMark);
  }
  return `/coins/new?${params.toString()}`;
}

interface SlotDetailPanelProps {
  slot: GapSlot;
  setDenomination: Denomination;
  userSetId: string;
  coins: CoinDto[] | undefined;
  onClose: () => void;
}

// PRD §4.1: a missing slot opens "search own coins, or add new pre-filled with year/mint";
// an owned slot shows the linked coin's detail with an unlink action.
export function SlotDetailPanel({
  slot,
  setDenomination,
  userSetId,
  coins,
  onClose,
}: SlotDetailPanelProps) {
  const linkMutation = useLinkCoin();
  const unlinkMutation = useUnlinkCoin();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // GapSlot.linkedCoin already carries grade/acquiredDate, so the owned view renders
  // instantly; the full CoinDto (denomination display, notes, price) fills in once the
  // coins list is fetched, without blocking on it.
  const linkedCoin = useMemo(
    () => (slot.linkedCoin ? coins?.find((c) => c.id === slot.linkedCoin?.coinId) : undefined),
    [coins, slot.linkedCoin],
  );

  // Manual search candidates: the user's own unlinked coins (a linked coin belongs to
  // another open slot already — displacing it is the auto-suggest "replace" flow, not
  // this manual one), same-denomination matches surfaced first.
  const candidates = useMemo(() => {
    const unlinked = (coins ?? []).filter((c) => c.slotId === null);
    const query = search.trim().toLowerCase();
    const filtered = query ? unlinked.filter((c) => coinSearchText(c).includes(query)) : unlinked;
    return [...filtered].sort((a, b) => {
      const aMatch = a.denomination === setDenomination;
      const bMatch = b.denomination === setDenomination;
      if (aMatch === bMatch) return 0;
      return aMatch ? -1 : 1;
    });
  }, [coins, search, setDenomination]);

  function handleLink(coinId: string) {
    setError(null);
    linkMutation.mutate(
      { id: coinId, slotId: slot.slotId },
      {
        onSuccess: onClose,
        onError: (err) => {
          setError(err instanceof ApiError ? err.message : 'Could not link this coin. Please try again.');
        },
      },
    );
  }

  function handleUnlink() {
    if (!slot.linkedCoin) return;
    setError(null);
    unlinkMutation.mutate(slot.linkedCoin.coinId, {
      onSuccess: onClose,
      onError: (err) => {
        setError(err instanceof ApiError ? err.message : 'Could not unlink this coin. Please try again.');
      },
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-blue-900">{slotDisplayLabel(slot)}</p>
        <button type="button" onClick={onClose} className="text-sm text-gray-600 underline">
          Close
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {slot.linkedCoin ? (
        <div className="flex flex-col gap-3">
          <div className="rounded border border-blue-100 bg-white p-3 text-sm">
            <p className="font-medium text-gray-900">
              {linkedCoin ? coinDisplayLabel(linkedCoin) : slotDisplayLabel(slot)}
            </p>
            <p className="mt-1 text-gray-600">
              {slot.linkedCoin.grade ? formatEnumLabel(slot.linkedCoin.grade) : 'Ungraded'}
            </p>
            {slot.linkedCoin.acquiredDate && (
              <p className="mt-1 text-gray-500">Acquired {slot.linkedCoin.acquiredDate.slice(0, 10)}</p>
            )}
            {linkedCoin?.purchasePrice && (
              <p className="mt-1 text-gray-500">Paid ${linkedCoin.purchasePrice}</p>
            )}
            {linkedCoin?.notes && <p className="mt-1 text-gray-500">{linkedCoin.notes}</p>}
          </div>
          <button
            type="button"
            onClick={handleUnlink}
            disabled={unlinkMutation.isPending}
            className="self-start rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
          >
            {unlinkMutation.isPending ? 'Unlinking…' : 'Unlink'}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Search your coins…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          />

          {coins === undefined ? (
            <p className="text-sm text-gray-600">Loading your coins…</p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-600">No unlinked coins match.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {candidates.map((coin) => (
                <li
                  key={coin.id}
                  className="flex items-center justify-between rounded border border-blue-100 bg-white px-3 py-2 text-sm"
                >
                  <span>
                    {coinDisplayLabel(coin)}
                    {coin.grade && <span className="ml-1 text-gray-500">({formatEnumLabel(coin.grade)})</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleLink(coin.id)}
                    disabled={linkMutation.isPending}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                  >
                    Link
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link
            href={addNewCoinHref(slot, setDenomination, userSetId)}
            className="self-start text-sm text-blue-600 underline"
          >
            + Add new coin for this slot
          </Link>
        </div>
      )}
    </div>
  );
}
