'use client';

import type { GapSlot } from '@coin-collector/shared';
import type { CoinCardStatus } from '@/components/ui/coin-card';
import { SetAlbum } from '@/components/sets/set-album';
import { SetCoinList } from '@/components/sets/set-coin-list';
import { SetYearGroup } from '@/components/sets/set-year-group';
import type { SetFilter } from '@/components/set-page/set-page-shared';
import type { YearGroup } from '@/lib/set-page';

export interface SetPageYearGroupsProps {
  groups: YearGroup[];
  isOwner: boolean;
  isAlbum: boolean;
  selecting: boolean;
  activeFilter: SetFilter;
  selected: ReadonlySet<string>;
  statusFor: (coinId: string) => CoinCardStatus;
  onToggle: (slot: GapSlot) => void;
  onSelect: (coinId: string) => void;
  otherSets: Array<{ id: string; name: string }>;
  onRemove: (slot: GapSlot) => void;
  onAddToSet: (slot: GapSlot, setId: string) => void;
  onMarkYear: (year: number, coinIds: string[]) => void;
}

/** The set's coins, one SetYearGroup per year, as an album grid or a list. */
export function SetPageYearGroups({
  groups,
  isOwner,
  isAlbum,
  selecting,
  activeFilter,
  selected,
  statusFor,
  onToggle,
  onSelect,
  otherSets,
  onRemove,
  onAddToSet,
  onMarkYear,
}: SetPageYearGroupsProps) {
  return (
    <div data-testid="set-editor-groups" className="flex flex-col gap-10 max-[899px]:gap-8">
      {groups.map((group) => (
        <SetYearGroup
          key={group.year}
          year={group.year}
          ownedCount={group.ownedCount}
          totalCount={group.totalCount}
          markAllCount={group.markableCoinIds.length}
          onMarkAll={
            isOwner && !selecting && activeFilter !== 'upgrade'
              ? () => onMarkYear(group.year, group.markableCoinIds)
              : undefined
          }
        >
          {isAlbum ? (
            <SetAlbum
              slots={group.slots}
              visitor={!isOwner}
              selectMode={selecting}
              selectedCoinIds={selected}
              statusFor={statusFor}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ) : (
            <SetCoinList
              slots={group.slots}
              visitor={!isOwner}
              statusFor={statusFor}
              onToggle={onToggle}
              otherSets={otherSets}
              onRemove={onRemove}
              onAddToSet={onAddToSet}
            />
          )}
        </SetYearGroup>
      ))}
    </div>
  );
}
