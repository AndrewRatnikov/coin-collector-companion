'use client';

import { useEffect, useRef, useState } from 'react';
import { parseYearInput } from '@/lib/catalog-view';
import { ADD_COINS_SEARCH_DEBOUNCE_MS } from '@/lib/add-coins';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { FOCUS_RING, MENU_ITEM } from '@/components/sets/add-coins/add-coins-shared';

export interface YearPopoverProps {
  year: number | undefined;
  onApply: (year: number | undefined) => void;
  close: () => void;
}

/** The Year popover: a typed year (applied after 300ms or on Enter) and "Any year". */
export function YearPopover({
  year,
  onApply,
  close,
}: YearPopoverProps) {
  const { t } = useTranslation();
  const [text, setText] = useState(year === undefined ? '' : String(year));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => clearTimer, []);

  return (
    <div className="flex flex-col gap-2 p-1">
      <input
        type="text"
        inputMode="numeric"
        data-testid="add-coins-year-input"
        aria-label={t('common.year')}
        value={text}
        onChange={(event) => {
          const value = event.target.value;
          setText(value);
          clearTimer();
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            onApply(parseYearInput(value));
          }, ADD_COINS_SEARCH_DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          clearTimer();
          onApply(parseYearInput(text));
          close();
        }}
        className={`h-10 w-full rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 font-mono text-sm tabular-nums text-text ${FOCUS_RING}`}
      />
      <button
        type="button"
        data-testid="add-coins-year-any"
        onClick={() => {
          clearTimer();
          onApply(undefined);
          close();
        }}
        className={MENU_ITEM}
      >
        {t('addCoins.anyYear')}
      </button>
    </div>
  );
}
