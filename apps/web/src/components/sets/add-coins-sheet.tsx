'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { getCoinName, type CatalogCoin, type GapSlot } from '@coin-collector/shared';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { useCollection } from '@/lib/hooks/use-collection';
import { usePatchSetCoins } from '@/lib/hooks/use-user-sets';
import { parseYearInput } from '@/lib/catalog-view';
import {
  ADD_COINS_MAX_LIMIT,
  ADD_COINS_PAGE_SIZE,
  ADD_COINS_SEARCH_DEBOUNCE_MS,
  EMPTY_ADD_COINS_FILTERS,
  countAddCoinsResults,
  countSessionAdded,
  getAddCoinsRowAction,
  getVisibleAddCoinsRows,
  toCatalogFilters,
  type AddCoinsEntry,
  type AddCoinsFilterState,
  type AddCoinsRowAction,
  type AddCoinsSession,
} from '@/lib/add-coins';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { Badge } from '@/components/ui/badge';
import { PlaceholderCoin } from '@/components/ui/placeholder-coin';
import { Skeleton } from '@/components/ui/skeleton';
import { AddCoinsFilterChip, CHIP_CLASSNAME, handleMenuArrowKeys } from '@/components/sets/add-coins-filter-chip';

export interface AddCoinsSheetProps {
  setId: string;
  /** Already localized. */
  setName: string;
  /** The set's current slots: "In this set" and part of "Owned" come from here. */
  slots: GapSlot[];
  /** Close, both Done buttons, Escape and the scrim. */
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';
const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';
const BTN_PRIMARY = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] bg-accent-700 px-[18px] text-sm font-medium text-white hover:bg-accent-800 ${FOCUS_RING}`;
const BTN_SECONDARY = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] border border-neutral-400 bg-white px-[18px] text-sm font-medium text-text hover:border-accent ${FOCUS_RING}`;
const MENU_ITEM = `flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[var(--radius-sm,4px)] px-2.5 text-left text-sm text-text hover:bg-surface aria-checked:font-medium ${FOCUS_RING}`;

function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

/** Visible in a browser; jsdom has no checkVisibility, so everything counts there. */
function isVisible(el: HTMLElement): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : true;
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-700"
    >
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m12 12 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface MenuOption {
  value: string;
  label: string;
}

function withSelected(values: string[], selected: string): string[] {
  return selected !== '' && !values.includes(selected) ? [...values, selected] : values;
}

/** The single-select menu inside the Country / Denomination popovers. */
function FilterMenu({
  testId,
  optionTestId,
  label,
  options,
  selected,
  onSelect,
}: {
  testId: 'add-coins-country-menu' | 'add-coins-denomination-menu';
  optionTestId: 'add-coins-country-option' | 'add-coins-denomination-option';
  label: string;
  options: MenuOption[];
  selected: string;
  onSelect: (value: string) => void;
}) {
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

/** The Year popover: a typed year (applied after 300ms or on Enter) and "Any year". */
function YearPopover({
  year,
  onApply,
  close,
}: {
  year: number | undefined;
  onApply: (year: number | undefined) => void;
  close: () => void;
}) {
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

export function AddCoinsSheet({ setId, setName, slots, onClose }: AddCoinsSheetProps) {
  const { t } = useTranslation();
  const titleId = useId();

  const [filters, setFilters] = useState<AddCoinsFilterState>(EMPTY_ADD_COINS_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [limit, setLimit] = useState(ADD_COINS_PAGE_SIZE);
  const [stickyCoinIds, setStickyCoinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [syncedFilters, setSyncedFilters] = useState(filters);
  // The ref is the source of truth (a second click can land before a re-render); the state
  // copy drives rendering.
  const sessionRef = useRef<AddCoinsSession>(new Map());
  const [session, setSession] = useState<AddCoinsSession>(sessionRef.current);
  const [liveMessage, setLiveMessage] = useState('');

  // Any filter change (chip, applied search, hide toggle) resets Show more and the sticky rows.
  // "Adjust state during render" rather than an effect, so no frame uses the stale limit.
  if (syncedFilters !== filters) {
    setSyncedFilters(filters);
    setLimit(ADD_COINS_PAGE_SIZE);
    setStickyCoinIds(new Set());
  }

  const catalogQuery = useCatalog(toCatalogFilters(filters, limit));
  const facetsQuery = useCatalogFacets(filters.country || undefined);
  const collectionQuery = useCollection();
  const patch = usePatchSetCoins(setId);

  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus in, lock body scroll; on unmount restore both.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    searchRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (searchTimerRef.current !== null) clearTimeout(searchTimerRef.current);
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  // Escape closes (unless a popover already handled it); Tab / Shift+Tab stay in the panel.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (event.defaultPrevented) return;
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (!(active instanceof Node) || !panel.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function applySearch(text: string) {
    const trimmed = text.trim();
    setFilters((prev) => (prev.search === trimmed ? prev : { ...prev, search: trimmed }));
  }

  function clearSearchTimer() {
    if (searchTimerRef.current !== null) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = null;
    }
  }

  function handleSearchChange(value: string) {
    setSearchText(value);
    clearSearchTimer();
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = null;
      applySearch(value);
    }, ADD_COINS_SEARCH_DEBOUNCE_MS);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    clearSearchTimer();
    applySearch(searchText);
  }

  function selectCountry(value: string) {
    setFilters((prev) => (prev.country === value ? prev : { ...prev, country: value, denomination: '' }));
  }

  function selectDenomination(value: string) {
    setFilters((prev) => (prev.denomination === value ? prev : { ...prev, denomination: value }));
  }

  function applyYear(year: number | undefined) {
    setFilters((prev) => (prev.year === year ? prev : { ...prev, year }));
  }

  function setEntry(coinId: string, entry: AddCoinsEntry | null) {
    const next = new Map(sessionRef.current);
    if (entry === null) next.delete(coinId);
    else next.set(coinId, entry);
    sessionRef.current = next;
    setSession(next);
  }

  function add(coin: CatalogCoin) {
    const status = sessionRef.current.get(coin.id)?.status;
    if (status === 'adding' || status === 'added' || status === 'undoing') return;
    const title = getCoinName(coin).title;
    setEntry(coin.id, { status: 'adding', error: null });
    setStickyCoinIds((current) => (current.has(coin.id) ? current : new Set(current).add(coin.id)));
    patch.mutateAsync({ add: [coin.id] }).then(
      () => {
        setEntry(coin.id, { status: 'added', error: null });
        setLiveMessage(fill(t('addCoins.liveAdded'), { title }));
      },
      () => {
        setEntry(coin.id, { status: 'idle', error: 'add' });
        setLiveMessage(fill(t('addCoins.liveAddFailed'), { title }));
      },
    );
  }

  function undo(coin: CatalogCoin) {
    if (sessionRef.current.get(coin.id)?.status !== 'added') return;
    const title = getCoinName(coin).title;
    setEntry(coin.id, { status: 'undoing', error: null });
    patch.mutateAsync({ remove: [coin.id] }).then(
      () => {
        setEntry(coin.id, null);
        setLiveMessage(fill(t('addCoins.liveRemoved'), { title }));
      },
      () => {
        // The coin is still in the set, so the recoverable action is Undo again.
        setEntry(coin.id, { status: 'added', error: 'undo' });
        setLiveMessage(fill(t('addCoins.liveUndoFailed'), { title }));
      },
    );
  }

  const inSetCoinIds = new Set(slots.map((slot) => slot.coin.id));
  const ownedCoinIds = new Set<string>([
    ...(collectionQuery.data ?? []).map((item) => item.coinId),
    ...slots.filter((slot) => slot.owned).map((slot) => slot.coin.id),
  ]);

  const data = catalogQuery.data;
  const visibleRows = data
    ? getVisibleAddCoinsRows(data.items, { hideInSet: filters.hideInSet, inSetCoinIds, session, stickyCoinIds })
    : [];
  const showMore = data !== undefined && data.items.length < data.total && limit < ADD_COINS_MAX_LIMIT;
  const resultCount = data
    ? countAddCoinsResults({
        total: data.total,
        state: filters,
        setCoins: slots.map((slot) => slot.coin),
        stickyCoinIds,
      })
    : 0;
  const addedCount = countSessionAdded(session);

  const facets = facetsQuery.data;
  const countryOptions: MenuOption[] = [
    { value: '', label: t('addCoins.anyCountry') },
    ...withSelected(facets?.countries ?? [], filters.country).map((value) => ({ value, label: value })),
  ];
  const denominationOptions: MenuOption[] = [
    { value: '', label: t('addCoins.anyDenomination') },
    ...withSelected(facets?.denominations ?? [], filters.denomination).map((value) => ({ value, label: value })),
  ];

  const resultsTemplate = resultCount === 1 ? t('addCoins.resultsOne') : t('addCoins.results');
  const resultsParts = resultsTemplate.split('{n}');

  let footerText: string;
  if (addedCount === 0) footerText = t('addCoins.footerHint');
  else if (addedCount === 1) footerText = t('addCoins.footerOne');
  else footerText = fill(t('addCoins.footer'), { n: addedCount });

  let results: ReactNode;
  if (!data) {
    results = catalogQuery.isError ? (
      <div
        data-testid="add-coins-error"
        role="alert"
        className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg p-4 text-sm text-text"
      >
        <p className="font-semibold">{t('addCoins.loadError')}</p>
        <button
          type="button"
          data-testid="add-coins-error-retry"
          onClick={() => void catalogQuery.refetch()}
          className={BTN_SECONDARY}
        >
          {t('addCoins.retry')}
        </button>
      </div>
    ) : (
      <div data-testid="add-coins-loading" aria-busy="true" className="flex flex-col gap-2">
        <span className="sr-only">{t('addCoins.loading')}</span>
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[60px] w-full" />
        ))}
      </div>
    );
  } else if (visibleRows.length === 0 && !showMore) {
    results = (
      <p data-testid="add-coins-empty" className="rounded-[var(--radius-lg)] bg-surface px-5 py-8 text-center text-sm text-neutral-800">
        {t('addCoins.empty')}
      </p>
    );
  } else {
    results = (
      <ul data-testid="add-coins-results" className="rounded-[var(--radius-lg)] border border-neutral-300 bg-white">
        {visibleRows.map((coin) => (
          <AddCoinsRow
            key={coin.id}
            coin={coin}
            action={getAddCoinsRowAction(coin.id, inSetCoinIds, session)}
            owned={ownedCoinIds.has(coin.id)}
            error={session.get(coin.id)?.error ?? null}
            onAdd={() => add(coin)}
            onUndo={() => undo(coin)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div data-testid="add-coins-root" className="fixed inset-0 z-50">
      <div
        data-testid="add-coins-scrim"
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(32,31,29,0.45)] max-[899px]:hidden"
      />
      <div
        ref={panelRef}
        data-testid="add-coins-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-[min(560px,100%)] flex-col bg-bg shadow-[-12px_0_32px_rgba(45,43,43,0.22)] max-[899px]:w-full max-[899px]:shadow-none"
      >
        <div className="flex items-start gap-3 border-b border-divider pb-3.5 pl-6 pr-4 pt-[18px] max-[899px]:items-center max-[899px]:gap-2 max-[899px]:px-2 max-[899px]:py-2">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2
              id={titleId}
              data-testid="add-coins-title"
              className="m-0 font-[family-name:var(--font-heading)] text-[28px] font-semibold leading-[1.15] text-text max-[899px]:font-[family-name:inherit] max-[899px]:text-base max-[899px]:leading-tight"
            >
              {t('addCoins.title')}
            </h2>
            <p
              data-testid="add-coins-subtitle"
              className="text-[13px] text-neutral-700 max-[899px]:truncate"
            >
              {fill(t('addCoins.toSet'), { name: setName })}
            </p>
          </div>
          <button
            type="button"
            data-testid="add-coins-close"
            aria-label={t('common.close')}
            onClick={onClose}
            className={`inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[var(--radius-md)] text-neutral-800 hover:bg-surface max-[899px]:order-first ${FOCUS_RING}`}
          >
            <CloseIcon />
          </button>
          <button
            type="button"
            data-testid="add-coins-done-top"
            onClick={onClose}
            className={`${BTN_PRIMARY} hidden min-h-9 px-3 text-[13px] max-[899px]:inline-flex`}
          >
            {t('addCoins.done')}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-6 pt-4 max-[899px]:px-4 max-[899px]:pb-24">
          <div className="relative">
            <SearchIcon />
            <input
              ref={searchRef}
              type="search"
              data-testid="add-coins-search"
              aria-label={t('addCoins.searchLabel')}
              placeholder={t('addCoins.searchPlaceholder')}
              value={searchText}
              onChange={(event) => handleSearchChange(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              className={`h-11 w-full rounded-[var(--radius-md)] border border-neutral-400 bg-white pl-10 pr-3 text-sm text-text placeholder:text-neutral-600 ${FOCUS_RING}`}
            />
          </div>

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
                    selectCountry(value);
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
                    selectDenomination(value);
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
              {(close) => <YearPopover year={filters.year} onApply={applyYear} close={close} />}
            </AddCoinsFilterChip>
            <button
              type="button"
              data-testid="add-coins-hide-in-set"
              aria-pressed={filters.hideInSet}
              onClick={() => setFilters((prev) => ({ ...prev, hideInSet: !prev.hideInSet }))}
              className={CHIP_CLASSNAME}
            >
              {t('addCoins.hideInSet')}
            </button>
          </div>

          {data && (
            <p data-testid="add-coins-count" className="text-[13px] text-neutral-700">
              {resultsParts.length > 1 ? (
                <>
                  {resultsParts[0]}
                  <span className="font-mono tabular-nums">{resultCount}</span>
                  {resultsParts.slice(1).join(String(resultCount))}
                </>
              ) : (
                resultsTemplate
              )}
            </p>
          )}

          {results}

          {showMore && (
            <button
              type="button"
              data-testid="add-coins-show-more"
              onClick={() => setLimit((current) => Math.min(current + ADD_COINS_PAGE_SIZE, ADD_COINS_MAX_LIMIT))}
              className={`${BTN_SECONDARY} self-center`}
            >
              {t('addCoins.showMore')}
            </button>
          )}
        </div>

        <div
          data-testid="add-coins-footer"
          className={[
            'flex items-center justify-between gap-3 border-t border-divider bg-white py-3 pl-6 pr-4',
            addedCount === 0
              ? 'max-[899px]:hidden'
              : 'max-[899px]:absolute max-[899px]:bottom-4 max-[899px]:left-1/2 max-[899px]:w-[calc(100%-32px)] max-[899px]:max-w-[420px] max-[899px]:-translate-x-1/2 max-[899px]:rounded-[var(--radius-lg)] max-[899px]:border-0 max-[899px]:bg-text max-[899px]:py-2 max-[899px]:pl-4 max-[899px]:pr-2 max-[899px]:text-white max-[899px]:shadow-[0_8px_24px_rgba(45,43,43,0.3)]',
          ].join(' ')}
        >
          <span data-testid="add-coins-footer-count" className="min-w-0 text-[13px] text-neutral-700 max-[899px]:text-inherit">
            {footerText}
          </span>
          <button type="button" data-testid="add-coins-done" onClick={onClose} className={BTN_PRIMARY}>
            {t('addCoins.done')}
          </button>
        </div>

        <p data-testid="add-coins-live" role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </p>
      </div>
    </div>
  );
}

function AddCoinsRow({
  coin,
  action,
  owned,
  error,
  onAdd,
  onUndo,
}: {
  coin: CatalogCoin;
  action: AddCoinsRowAction;
  owned: boolean;
  error: AddCoinsEntry['error'];
  onAdd: () => void;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  const name = getCoinName(coin);
  const addLabel =
    name.subtitle !== ''
      ? fill(t('addCoins.addLabel'), { title: name.title, sub: name.subtitle })
      : fill(t('addCoins.addLabelNoSub'), { title: name.title });

  let actionCell: ReactNode;
  switch (action) {
    case 'add':
      actionCell = (
        <button
          type="button"
          data-testid="add-coins-row-add"
          aria-label={addLabel}
          onClick={onAdd}
          className={`inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-[13px] font-medium text-text hover:border-accent max-[899px]:size-11 max-[899px]:px-0 ${FOCUS_RING}`}
        >
          <PlusIcon />
          <span className="max-[899px]:sr-only">{t('addCoins.add')}</span>
        </button>
      );
      break;
    case 'adding':
      actionCell = (
        <span
          data-testid="add-coins-row-adding"
          aria-live="polite"
          className="inline-flex min-h-9 items-center gap-2 text-[13px] italic text-neutral-700"
        >
          <span
            aria-hidden="true"
            className="hidden size-5 rounded-full border-2 border-neutral-300 border-t-accent-700 motion-safe:animate-spin max-[899px]:inline-block"
          />
          <span className="max-[899px]:sr-only">{t('addCoins.adding')}</span>
        </span>
      );
      break;
    case 'added':
    case 'undoing':
      actionCell = (
        <span className="inline-flex items-center gap-2">
          <span
            data-testid="add-coins-row-added"
            aria-live="polite"
            className="inline-flex h-9 items-center rounded-full border border-accent-400 bg-accent-100 px-3 text-[13px] font-medium text-accent-800 max-[899px]:sr-only"
          >
            {t('addCoins.added')}
          </span>
          <button
            type="button"
            data-testid="add-coins-row-undo"
            aria-label={fill(t('addCoins.undoLabel'), { title: name.title })}
            disabled={action === 'undoing'}
            aria-busy={action === 'undoing' ? true : undefined}
            onClick={onUndo}
            className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] px-1 text-[13px] font-medium text-accent-700 underline hover:text-accent-800 disabled:cursor-not-allowed disabled:opacity-50 max-[899px]:size-11 max-[899px]:rounded-full max-[899px]:bg-accent-700 max-[899px]:px-0 max-[899px]:text-white max-[899px]:no-underline ${FOCUS_RING}`}
          >
            <span className="hidden max-[899px]:inline-flex">
              <CheckIcon />
            </span>
            <span className="max-[899px]:sr-only">{t('addCoins.undo')}</span>
          </button>
        </span>
      );
      break;
    case 'already':
      actionCell = (
        <span data-testid="add-coins-row-already" className="text-[13px] text-neutral-700 max-[899px]:sr-only">
          {t('addCoins.already')}
        </span>
      );
      break;
  }

  return (
    <li
      data-testid="add-coins-row"
      data-coin-id={coin.id}
      data-action={action}
      className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[rgba(32,31,29,0.1)] px-3 py-2.5 last:border-b-0"
    >
      <PlaceholderCoin size={40} denomination={coin.denomination} material={coin.material} imageUrl={coin.imageUrl} />
      <div className="flex min-w-0 flex-col gap-px leading-[1.3]">
        {name.eyebrow !== '' && (
          <span data-testid="add-coins-row-eyebrow" className="truncate text-[11px] font-medium text-neutral-700">
            {name.eyebrow}
          </span>
        )}
        <Link
          href={`/catalog/${coin.id}`}
          data-testid="add-coins-row-title"
          className={`self-start text-[15px] font-semibold text-text [overflow-wrap:anywhere] hover:underline ${FOCUS_RING}`}
        >
          {name.title}
        </Link>
        <span data-testid="add-coins-row-subtitle" className="text-xs text-neutral-700">
          {name.subtitle}
        </span>
        {(action === 'already' || owned) && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {action === 'already' && <Badge variant="in-set" />}
            {owned && <Badge variant="owned" />}
          </span>
        )}
        {error !== null && (
          <span data-testid="add-coins-row-error" className="mt-1 text-xs font-medium text-danger">
            {error === 'add' ? t('addCoins.addFailed') : t('addCoins.undoFailed')}
          </span>
        )}
      </div>
      <div className="flex items-center justify-end">{actionCell}</div>
    </li>
  );
}
