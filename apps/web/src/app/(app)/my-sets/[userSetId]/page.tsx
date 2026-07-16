'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { GapSlot } from '@coin-collector/shared';
import { SlotDetailPanel } from '@/components/gap/slot-detail-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { useCoins } from '@/lib/hooks/use-coins';
import { useGapView } from '@/lib/hooks/use-user-sets';

function formatEnumLabel(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
}

// PRD §4.1: label ?? `${year}${mintMark ? `-${mintMark}` : ''}` — a null mint mark
// (Philadelphia/no-mark) renders as the year alone, never "1909-P".
function slotDisplayLabel(slot: GapSlot): string {
  return slot.label ?? `${slot.year}${slot.mintMark ? `-${slot.mintMark}` : ''}`;
}

function decadeLabel(year: number): string {
  return `${Math.floor(year / 10) * 10}s`;
}

function completionPercent(ownedSlots: number, totalSlots: number): number {
  if (totalSlots === 0) return 0;
  return Math.round((ownedSlots / totalSlots) * 100);
}

// Groups pre-ordered slots (by sortOrder, per the API) into consecutive decade buckets —
// pure client-side presentation (SD §4), no grouping data from the backend.
function groupByDecade(slots: GapSlot[]): { decade: string; slots: GapSlot[] }[] {
  const groups: { decade: string; slots: GapSlot[] }[] = [];
  for (const slot of slots) {
    const decade = decadeLabel(slot.year);
    const current = groups[groups.length - 1];
    if (current && current.decade === decade) {
      current.slots.push(slot);
    } else {
      groups.push({ decade, slots: [slot] });
    }
  }
  return groups;
}

function SlotCard({
  slot,
  selected,
  onSelect,
}: {
  slot: GapSlot;
  selected: boolean;
  onSelect: () => void;
}) {
  const owned = slot.linkedCoin !== null;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-lg border p-3 text-left ${
        owned ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
      } ${selected ? 'ring-2 ring-blue-400' : ''}`}
    >
      <p className="text-sm font-medium text-gray-900">{slotDisplayLabel(slot)}</p>
      <p
        className={`mt-1 flex items-center gap-1 text-xs font-medium ${
          owned ? 'text-green-700' : 'text-gray-500'
        }`}
      >
        <span aria-hidden="true">{owned ? '✓' : '○'}</span>
        {owned ? 'Owned' : 'Missing'}
      </p>
      {slot.isKeyDate && (
        <p className={`mt-1 text-xs font-medium ${owned ? 'text-gray-400' : 'text-amber-600'}`}>
          {'★'} Key date
        </p>
      )}
      {owned && slot.linkedCoin?.grade && (
        <p className="mt-1 text-xs text-gray-500">{formatEnumLabel(slot.linkedCoin.grade)}</p>
      )}
    </button>
  );
}

function GapGridSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-4 w-24" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {Array.from({ length: 12 }, (_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function GapViewPage() {
  const { userSetId } = useParams<{ userSetId: string }>();
  const { data: gapView, isLoading, isError, error } = useGapView(userSetId);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  // Only fetch the coin list once a slot is actually opened — the gap view itself
  // doesn't need it.
  const { data: coins } = useCoins({ enabled: selectedSlotId !== null });

  const groups = gapView ? groupByDecade(gapView.slots) : [];
  const selectedSlot = gapView?.slots.find((slot) => slot.slotId === selectedSlotId) ?? null;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <Link href="/my-sets" className="text-sm text-blue-600 underline">
          Back to My Sets
        </Link>
      </div>

      {isLoading && <GapGridSkeleton />}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load this set.'}
        </p>
      )}

      {gapView && (
        <>
          <div>
            <h1 className="text-xl font-semibold">{gapView.set.name}</h1>
            <p className="text-sm text-gray-600">{gapView.set.category}</p>
            <p className="mt-1 text-sm text-gray-700">
              <span className="font-medium">
                {completionPercent(gapView.ownedSlots, gapView.totalSlots)}%
              </span>{' '}
              &middot; {gapView.ownedSlots} / {gapView.totalSlots} owned
            </p>
          </div>

          {selectedSlot && (
            <SlotDetailPanel
              slot={selectedSlot}
              setDenomination={gapView.set.denomination}
              userSetId={gapView.userSetId}
              coins={coins}
              onClose={() => setSelectedSlotId(null)}
            />
          )}

          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <div key={group.decade}>
                <h2 className="mb-2 text-sm font-semibold text-gray-500">{group.decade}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {group.slots.map((slot) => (
                    <SlotCard
                      key={slot.slotId}
                      slot={slot}
                      selected={slot.slotId === selectedSlotId}
                      onSelect={() =>
                        setSelectedSlotId((current) => (current === slot.slotId ? null : slot.slotId))
                      }
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
