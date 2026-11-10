'use client';

import { CheckIcon } from '@/components/ui/icons';
import { handleMenuArrowKeys } from '@/components/sets/add-coins-filter-chip';
import { MENU_ITEM } from '@/components/sets/add-coins/add-coins-shared';
import type { MenuOption } from '@/components/sets/add-coins/filter-options';

export interface FilterMenuProps {
  testId: 'add-coins-country-menu' | 'add-coins-denomination-menu';
  optionTestId: 'add-coins-country-option' | 'add-coins-denomination-option';
  label: string;
  options: MenuOption[];
  selected: string;
  onSelect: (value: string) => void;
}

/** The single-select menu inside the Country / Denomination popovers. */
export function FilterMenu({
  testId,
  optionTestId,
  label,
  options,
  selected,
  onSelect,
}: FilterMenuProps) {
  return (
    <div role="menu" aria-label={label} data-testid={testId} onKeyDown={handleMenuArrowKeys} className="flex flex-col">
      {options.map((option) => (
        <button
          key={option.value === '' ? '__any' : option.value}
          type="button"
          role="menuitemradio"
          data-testid={optionTestId}
          data-value={option.value}
          aria-checked={option.value === selected}
          tabIndex={-1}
          onClick={() => onSelect(option.value)}
          className={MENU_ITEM}
        >
          <span className="flex size-4 flex-none items-center justify-center">
            {option.value === selected && <CheckIcon />}
          </span>
          <span className="min-w-0 truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
