'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { getCoinName, type CatalogCoin, type GapSlot } from '@coin-collector/shared';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { useCollection } from '@/lib/hooks/use-collection';
import { usePatchSetCoins } from '@/lib/hooks/use-user-sets';
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
  type AddCoinsSession,
} from '@/lib/add-coins';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import { AddCoinsFilterBar, AddCoinsSearch } from '@/components/sets/add-coins/add-coins-filter-bar';
import { AddCoinsFooter, AddCoinsLiveRegion } from '@/components/sets/add-coins/add-coins-footer';
import { AddCoinsHeader } from '@/components/sets/add-coins/add-coins-header';
import {
  AddCoinsCount,
  AddCoinsEmpty,
  AddCoinsLoadError,
  AddCoinsLoading,
  AddCoinsResultsList,
  AddCoinsShowMore,
} from '@/components/sets/add-coins/add-coins-results';
import { AddCoinsRow } from '@/components/sets/add-coins/add-coins-row';
import { withSelected, type MenuOption } from '@/components/sets/add-coins/filter-options';
import { useAddCoinsFocusTrap } from '@/components/sets/add-coins/use-add-coins-focus-trap';

export interface AddCoinsSheetProps {
  setId: string;
  /** Already localized. */
  setName: string;
  /** The set's current slots: "In this set" and part of "Owned" come from here. */
  slots: GapSlot[];
  /** Close, both Done buttons, Escape and the scrim. */
  onClose: () => void;
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
  useAddCoinsFocusTrap(panelRef, onCloseRef);

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
      <AddCoinsLoadError onRetry={() => void catalogQuery.refetch()} />
    ) : (
      <AddCoinsLoading />
    );
  } else if (visibleRows.length === 0 && !showMore) {
    results = <AddCoinsEmpty />;
  } else {
    results = (
      <AddCoinsResultsList>
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
      </AddCoinsResultsList>
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
        <AddCoinsHeader titleId={titleId} setName={setName} onClose={onClose} />

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 pb-6 pt-4 max-[899px]:px-4 max-[899px]:pb-24">
          <AddCoinsSearch
            searchRef={searchRef}
            value={searchText}
            onSearchChange={handleSearchChange}
            onSearchKeyDown={handleSearchKeyDown}
          />

          <AddCoinsFilterBar
            filters={filters}
            countryOptions={countryOptions}
            denominationOptions={denominationOptions}
            onSelectCountry={selectCountry}
            onSelectDenomination={selectDenomination}
            onApplyYear={applyYear}
            onToggleHideInSet={() => setFilters((prev) => ({ ...prev, hideInSet: !prev.hideInSet }))}
          />

          {data && <AddCoinsCount resultCount={resultCount} resultsTemplate={resultsTemplate} resultsParts={resultsParts} />}

          {results}

          {showMore && (
            <AddCoinsShowMore
              onShowMore={() => setLimit((current) => Math.min(current + ADD_COINS_PAGE_SIZE, ADD_COINS_MAX_LIMIT))}
            />
          )}
        </div>

        <AddCoinsFooter addedCount={addedCount} footerText={footerText} onDone={onClose} />

        <AddCoinsLiveRegion message={liveMessage} />
      </div>
    </div>
  );
}
