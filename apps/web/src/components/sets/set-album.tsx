'use client';

import type { GapSlot } from '@coin-collector/shared';
import { CoinCard, type CoinCardStatus } from '@/components/ui/coin-card';

export interface SetAlbumProps {
  /** One year group's visible slots, already ordered. */
  slots: GapSlot[];
  visitor: boolean;
  selectMode: boolean;
  selectedCoinIds: ReadonlySet<string>;
  statusFor: (coinId: string) => CoinCardStatus;
  /** The card's check and its Retry. */
  onToggle: (slot: GapSlot) => void;
  onSelect: (coinId: string) => void;
}

/**
 * The album grid for one year group: a CoinCard per slot, auto-filling ~172px columns on
 * desktop and two columns under 900px.
 */
export function SetAlbum({ slots, visitor, selectMode, selectedCoinIds, statusFor, onToggle, onSelect }: SetAlbumProps) {
  return (
    <ul
      data-testid="set-album-grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3.5 max-[899px]:grid-cols-2 max-[899px]:gap-2.5"
    >
      {slots.map((slot) => (
        <li key={slot.id} data-testid="set-album-item" data-coin-id={slot.coin.id}>
          <CoinCard
            coin={slot.coin}
            owned={slot.owned}
            status={visitor ? 'idle' : statusFor(slot.coin.id)}
            visitor={visitor}
            selectMode={selectMode}
            selected={selectMode && selectedCoinIds.has(slot.coin.id)}
            onToggle={() => onToggle(slot)}
            onSelect={() => onSelect(slot.coin.id)}
          />
        </li>
      ))}
    </ul>
  );
}
