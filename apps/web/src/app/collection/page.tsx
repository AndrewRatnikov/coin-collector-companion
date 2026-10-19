'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { getCoinName, type CatalogCoin, type OwnershipItem } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { CollectionEmpty } from '@/components/collection/collection-empty';
import { CollectionFilterBar } from '@/components/collection/collection-filter-bar';
import { CollectionSubgroupSection } from '@/components/collection/collection-subgroup';
import { SEGMENT_BUTTON_CLASSNAME, SEGMENT_GROUP_CLASSNAME } from '@/components/sets/set-view-switch';
import type { CoinCardStatus } from '@/components/ui/coin-card';
import { Skeleton } from '@/components/ui/skeleton';
import { UndoToastProvider, useUndoToast } from '@/components/ui/undo-toast';
import {
  EMPTY_COLLECTION_FILTERS,
  filterCollection,
  getCountryChips,
  groupCollection,
  hasActiveFilters,
  isSubgroupOpen,
  mergeSessionRemoved,
  type CollectionLayout,
  type CollectionViewFilters,
} from '@/lib/collection-view';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useTranslation } from '@/lib/i18n/i18n-context';

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';
const LOADING_CARDS = 6;

function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

function CardsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function RowsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="2.75" cy="4" r="0.9" fill="currentColor" />
      <circle cx="2.75" cy="8" r="0.9" fill="currentColor" />
      <circle cx="2.75" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 10.5V2.5M4.75 5.5 8 2.25l3.25 3.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2.75 10.5v2.25h10.5V10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CollectionList() {
  const { t } = useTranslation();
  const toast = useUndoToast();

  const { data, isLoading, isError } = useCollection();
  const owned = data ?? [];
  const ownedIds = new Set(owned.map((item) => item.coinId));

  // Coins un-owned on this page stay on screen as "Removed" until the user leaves. Display only:
  // whether a coin is owned always comes from the shared collection cache.
  const [removed, setRemoved] = useState<OwnershipItem[]>([]);
  const displayItems = mergeSessionRemoved(owned, removed);

  // The ref is the source of truth (a second click can land before the state re-renders);
  // the state copy drives rendering.
  const pendingRef = useRef(new Set<string>());
  const [pendingCoinIds, setPendingCoinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [failedCoinIds, setFailedCoinIds] = useState<ReadonlySet<string>>(() => new Set());

  const [filters, setFilters] = useState<CollectionViewFilters>(EMPTY_COLLECTION_FILTERS);
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});
  const [layout, setLayout] = useState<CollectionLayout>('cards');

  function markPending(coinId: string, pending: boolean) {
    if (pending) pendingRef.current.add(coinId);
    else pendingRef.current.delete(coinId);
    setPendingCoinIds(new Set(pendingRef.current));
  }

  function markFailed(coinId: string, failed: boolean) {
    setFailedCoinIds((current) => {
      if (current.has(coinId) === failed) return current;
      const next = new Set(current);
      if (failed) next.add(coinId);
      else next.delete(coinId);
      return next;
    });
  }

  function coinFor(coinId: string): CatalogCoin | undefined {
    return displayItems.find((item) => item.coinId === coinId)?.coin;
  }

  const ownership = useSetOwnership({
    onSettled: (error, { coinId, owned: nowOwned, coin }) => {
      markPending(coinId, false);
      if (error) {
        markFailed(coinId, true);
        return;
      }
      if (nowOwned) return;
      const removedCoin = coin ?? coinFor(coinId);
      if (!removedCoin) return;
      const { title } = getCoinName(removedCoin);
      toast.show({
        message: fill(t('collection.toastRemoved'), { title, year: removedCoin.year }),
        onUndo: () => setOwned(coinId, removedCoin, true),
      });
    },
  });

  function setOwned(coinId: string, coin: CatalogCoin, nextOwned: boolean) {
    if (pendingRef.current.has(coinId)) return;
    markPending(coinId, true);
    markFailed(coinId, false);
    ownership.mutate({ coinId, owned: nextOwned, coin });
  }

  function handleToggle(item: OwnershipItem) {
    if (pendingRef.current.has(item.coinId)) return;
    const isOwnedNow = ownedIds.has(item.coinId);
    if (isOwnedNow) {
      setRemoved((current) => (current.some((r) => r.coinId === item.coinId) ? current : [...current, item]));
    }
    setOwned(item.coinId, item.coin, !isOwnedNow);
  }

  function statusFor(coinId: string): CoinCardStatus {
    if (pendingCoinIds.has(coinId)) return 'pending';
    if (failedCoinIds.has(coinId)) return 'failed';
    return 'idle';
  }

  function labelsFor(item: OwnershipItem): { toggle: string } {
    const values = { title: getCoinName(item.coin).title, year: item.coin.year };
    return {
      toggle: fill(t(ownedIds.has(item.coinId) ? 'collection.toggleRemove' : 'collection.toggleAddBack'), values),
    };
  }

  // Any filter change forgets manual open/close choices: filtering opens everything, and
  // clearing goes back to the first few open.
  function updateFilters(next: CollectionViewFilters) {
    setFilters(next);
    setOpenOverrides({});
  }

  function clearFilters() {
    updateFilters(EMPTY_COLLECTION_FILTERS);
  }

  const filtered = filterCollection(displayItems, filters);
  const groups = groupCollection(filtered);
  const chips = getCountryChips(displayItems, filters);
  const filtersActive = hasActiveFilters(filters);

  function countText(n: number): string {
    return n === 1 ? t('collection.coinCountOne') : fill(t('collection.coinCount'), { n });
  }

  const ownedTotal = owned.length;
  const subtitleParts = t(ownedTotal === 1 ? 'collection.subtitleOne' : 'collection.subtitle').split('{n}');
  const shownText =
    filtered.length === 1 ? t('collection.shownOne') : fill(t('collection.shown'), { n: filtered.length });

  let subgroupIndex = 0;

  return (
    <main
      data-testid="collection-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-[22px] px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)] max-[899px]:py-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1
            data-testid="collection-title"
            className="font-heading text-[30px] leading-[1.1] font-semibold text-text min-[721px]:text-[40px]"
          >
            {t('collection.title')}
          </h1>
          {data && (
            <p data-testid="collection-subtitle" className="text-[15px] text-neutral-700">
              {subtitleParts.map((part, index) => (
                <span key={index}>
                  {index > 0 && (
                    <span data-testid="collection-owned-count" className="font-mono lining-nums tabular-nums">
                      {ownedTotal}
                    </span>
                  )}
                  {part}
                </span>
              ))}
            </p>
          )}
        </div>

        {displayItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              data-testid="collection-layout-switch"
              aria-label={t('collection.layoutLabel')}
              className={SEGMENT_GROUP_CLASSNAME}
            >
              <button
                type="button"
                data-testid="collection-layout-cards"
                aria-pressed={layout === 'cards'}
                onClick={() => setLayout('cards')}
                className={`${SEGMENT_BUTTON_CLASSNAME} inline-flex cursor-pointer items-center gap-1.5 max-[899px]:px-3`}
              >
                <CardsIcon />
                <span className="max-[899px]:sr-only">{t('collection.layoutCards')}</span>
              </button>
              <button
                type="button"
                data-testid="collection-layout-rows"
                aria-pressed={layout === 'rows'}
                onClick={() => setLayout('rows')}
                className={`${SEGMENT_BUTTON_CLASSNAME} inline-flex cursor-pointer items-center gap-1.5 max-[899px]:px-3`}
              >
                <RowsIcon />
                <span className="max-[899px]:sr-only">{t('collection.layoutRows')}</span>
              </button>
            </div>
            <Link
              data-testid="collection-import-button"
              href="/collection/import"
              className={`inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-md)] border border-neutral-400 bg-white px-4 text-sm font-medium text-text hover:border-accent ${FOCUS_RING}`}
            >
              <UploadIcon />
              {t('collection.importLink')}
            </Link>
          </div>
        )}
      </div>

      {isLoading && (
        <div
          data-testid="collection-loading"
          className="grid grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3.5 max-[899px]:grid-cols-2 max-[899px]:gap-2.5"
        >
          {Array.from({ length: LOADING_CARDS }, (_, index) => (
            <Skeleton key={index} className="aspect-[4/5] w-full rounded-[var(--radius-lg)]" />
          ))}
        </div>
      )}

      {isError && !data && (
        <p data-testid="collection-error" role="alert" className="text-sm text-danger">
          {t('collection.errorLoading')}
        </p>
      )}

      {data && displayItems.length === 0 && (
        <div data-testid="collection-empty">
          <CollectionEmpty />
        </div>
      )}

      {data && displayItems.length > 0 && (
        <>
          <CollectionFilterBar filters={filters} onChange={updateFilters} chips={chips} onClear={clearFilters} />

          <p data-testid="collection-shown-status" role="status" aria-live="polite" className="sr-only">
            {shownText}
          </p>

          {filtered.length === 0 ? (
            <div
              data-testid="collection-no-results"
              className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-6 py-10 text-center"
            >
              <p className="text-base font-semibold text-text">{t('collection.noResults')}</p>
              <button
                type="button"
                data-testid="collection-no-results-clear"
                onClick={clearFilters}
                className={`inline-flex min-h-9 cursor-pointer items-center rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3.5 text-sm font-medium text-text hover:border-accent ${FOCUS_RING}`}
              >
                {t('collection.clearFilters')}
              </button>
            </div>
          ) : (
            <div data-testid="collection-results" className="flex flex-col gap-9">
              {groups.map((group) => (
                <section
                  key={group.country}
                  data-testid="collection-country"
                  data-country={group.country}
                  aria-label={group.country}
                  className="flex flex-col gap-5"
                >
                  <div className="flex items-baseline justify-between gap-3 border-b border-neutral-300 pb-2.5">
                    <h2
                      data-testid="collection-country-heading"
                      className="font-heading text-[30px] leading-[1.1] font-semibold text-text max-[899px]:text-[26px]"
                    >
                      {group.country}
                    </h2>
                    <span
                      data-testid="collection-country-count"
                      className="font-mono text-sm text-neutral-700 lining-nums tabular-nums"
                    >
                      {countText(group.count)}
                    </span>
                  </div>
                  {group.subgroups.map((subgroup) => {
                    const open = isSubgroupOpen(subgroupIndex, subgroup.key, filtersActive, openOverrides);
                    subgroupIndex += 1;
                    return (
                      <CollectionSubgroupSection
                        key={subgroup.key}
                        subgroup={subgroup}
                        open={open}
                        onToggleOpen={() => setOpenOverrides((current) => ({ ...current, [subgroup.key]: !open }))}
                        layout={layout}
                        isOwned={(coinId) => ownedIds.has(coinId)}
                        statusFor={statusFor}
                        labelsFor={labelsFor}
                        onToggleOwned={handleToggle}
                      />
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function CollectionPage() {
  return (
    <RequireAuth>
      <UndoToastProvider>
        <CollectionList />
      </UndoToastProvider>
    </RequireAuth>
  );
}
