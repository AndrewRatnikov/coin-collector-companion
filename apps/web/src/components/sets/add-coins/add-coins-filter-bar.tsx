'use client';

import { type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react';
import { type AddCoinsFilterState } from '@/lib/add-coins';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { SearchIcon } from '@/components/ui/icons';
import { AddCoinsFilterChip, CHIP_CLASSNAME } from '@/components/sets/add-coins-filter-chip';
import { FOCUS_RING } from '@/components/sets/add-coins/add-coins-shared';
import { FilterMenu } from '@/components/sets/add-coins/filter-menu';
import type { MenuOption } from '@/components/sets/add-coins/filter-options';
import { YearPopover } from '@/components/sets/add-coins/year-popover';

export interface AddCoinsSearchProps {
  searchRef: RefObject<HTMLInputElement | null>;
  value: string;
  onSearchChange: (value: string) => void;
  onSearchKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
}

/** The search box (debounced and Enter handling live in the sheet). */
export function AddCoinsSearch({ searchRef, value, onSearchChange, onSearchKeyDown }: AddCoinsSearchProps) {
  const { t } = useTranslation();

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700" />
      <input
        ref={searchRef}
        type="search"
        data-testid="add-coins-search"
        aria-label={t('addCoins.searchLabel')}
        placeholder={t('addCoins.searchPlaceholder')}
        value={value}
        onChange={(event) => onSearchChange(event.target.value)}
        onKeyDown={onSearchKeyDown}
        className={`h-11 w-full rounded-[var(--radius-md)] border border-neutral-400 bg-white pl-10 pr-3 text-sm text-text placeholder:text-neutral-600 ${FOCUS_RING}`}
      />
    </div>
  );
}

export interface AddCoinsFilterBarProps {
  filters: AddCoinsFilterState;
  countryOptions: MenuOption[];
  denominationOptions: MenuOption[];
  onSelectCountry: (value: string) => void;
  onSelectDenomination: (value: string) => void;
  onApplyYear: (year: number | undefined) => void;
  onToggleHideInSet: () => void;
}

/** The chips row: Country, Denomination, Year and the "Hide in set" toggle. */
export function AddCoinsFilterBar({
  filters,
  countryOptions,
  denominationOptions,
  onSelectCountry,
  onSelectDenomination,
  onApplyYear,
  onToggleHideInSet,
}: AddCoinsFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-2 max-[899px]:-mx-4 max-[899px]:flex-nowrap max-[899px]:overflow-x-auto max-[899px]:px-4 max-[899px]:pb-1">
      <AddCoinsFilterChip
        data-testid="add-coins-filter-country"
        label={filters.country || t('addCoins.anyCountry')}
        pressed={filters.country !== ''}
        popoverLabel={t('common.country')}
      >
        {(close) => (
          <FilterMenu
            testId="add-coins-country-menu"
            optionTestId="add-coins-country-option"
            label={t('common.country')}
            options={countryOptions}
            selected={filters.country}
            onSelect={(value) => {
              onSelectCountry(value);
              close();
            }}
          />
        )}
      </AddCoinsFilterChip>
      <AddCoinsFilterChip
        data-testid="add-coins-filter-denomination"
        label={filters.denomination || t('addCoins.anyDenomination')}
        pressed={filters.denomination !== ''}
        popoverLabel={t('common.denomination')}
      >
        {(close) => (
          <FilterMenu
            testId="add-coins-denomination-menu"
            optionTestId="add-coins-denomination-option"
            label={t('common.denomination')}
            options={denominationOptions}
            selected={filters.denomination}
            onSelect={(value) => {
              onSelectDenomination(value);
              close();
            }}
          />
        )}
      </AddCoinsFilterChip>
      <AddCoinsFilterChip
        data-testid="add-coins-filter-year"
        label={
          filters.year === undefined ? (
            t('addCoins.anyYear')
          ) : (
            <span className="font-mono tabular-nums">{filters.year}</span>
          )
        }
        pressed={filters.year !== undefined}
        popoverLabel={t('common.year')}
      >
        {(close) => <YearPopover year={filters.year} onApply={onApplyYear} close={close} />}
      </AddCoinsFilterChip>
      <button
        type="button"
        data-testid="add-coins-hide-in-set"
        aria-pressed={filters.hideInSet}
        onClick={onToggleHideInSet}
        className={CHIP_CLASSNAME}
      >
        {t('addCoins.hideInSet')}
      </button>
    </div>
  );
}
