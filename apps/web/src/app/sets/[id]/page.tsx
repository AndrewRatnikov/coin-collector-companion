'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getCoinName } from '@coin-collector/shared';
import type { GapSlot } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import {
  useAddCoinsToSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import { useBulkSetOwnership, useSetOwnership } from '@/lib/hooks/use-collection';
import { downloadMissingCsv } from '@/lib/missing-list';
import { Badge } from '@/components/ui/badge';
import type { CoinCardStatus } from '@/components/ui/coin-card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { UndoToastProvider, useUndoToast } from '@/components/ui/undo-toast';
import { AddCoinsSheet } from '@/components/sets/add-coins-sheet';
import { SelectionActionBar } from '@/components/sets/selection-action-bar';
import { SetActionsMenu } from '@/components/sets/set-actions-menu';
import { SetAlbum } from '@/components/sets/set-album';
import { SetCoinList } from '@/components/sets/set-coin-list';
import { SEGMENT_BUTTON_CLASSNAME, SEGMENT_GROUP_CLASSNAME, SetViewSwitch } from '@/components/sets/set-view-switch';
import { SetYearGroup } from '@/components/sets/set-year-group';
import { formatOwnedOfTotal } from '@/lib/album-layout';
import { markSetDeleted } from '@/lib/set-deleted-notice';
import { buildYearGroups, getSetKind, getSetSharedParts, type SetKind } from '@/lib/set-page';
import { buildSetViewSearch, parseSetView, type SetView } from '@/lib/set-view';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 max-[899px]:py-6';

const KIND_LABEL: Record<SetKind, MessageKey> = {
  curated: 'setPage.kindCurated',
  copied: 'setPage.kindCopied',
  own: 'setPage.kindOwn',
};

const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [key, value] of Object.entries(values)) {
    text = text.split(`{${key}}`).join(String(value));
  }
  return text;
}

/** "{owned} of {total} owned" with both numbers in mono; the text content stays the plain sentence. */
function OwnedOfTotal({ template, owned, total }: { template: string; owned: number; total: number }) {
  const parts = template.split(/(\{owned\}|\{total\})/);
  return (
    <>
      {parts.map((part, index) => {
        if (part === '{owned}') {
          return (
            <span key={index} className="font-mono text-[22px] font-medium tabular-nums text-text">
              {owned}
            </span>
          );
        }
        if (part === '{total}') {
          return (
            <span key={index} className="font-mono tabular-nums">
              {total}
            </span>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true" className="flex-none text-danger">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

function SetEditor({ id }: { id: string }) {
  const router = useRouter();
  const { t, locale } = useTranslation();
  const toast = useUndoToast();

  const setQuery = usePublicSet(id);
  const gapsQuery = useSetGaps(id);
  const { data: set, isLoading: setLoading, isError: setIsError } = setQuery;
  const { data: gaps, isLoading: gapsLoading, isError: gapsIsError } = gapsQuery;
  const { data: userSets } = useUserSets();
  const isOwner = Boolean(userSets?.some((s) => s.id === id));

  // In-flight coins (single toggles and bulk changes). The ref is the source of truth (a second
  // click can land before the state re-renders); the state copy drives rendering.
  const pendingRef = useRef(new Set<string>());
  const [pendingCoinIds, setPendingCoinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [failedCoinIds, setFailedCoinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [liveMessage, setLiveMessage] = useState('');

  function markPending(coinIds: readonly string[], pending: boolean) {
    for (const coinId of coinIds) {
      if (pending) pendingRef.current.add(coinId);
      else pendingRef.current.delete(coinId);
    }
    setPendingCoinIds(new Set(pendingRef.current));
  }

  function markFailed(coinIds: readonly string[], failed: boolean) {
    setFailedCoinIds((current) => {
      if (coinIds.every((coinId) => current.has(coinId) === failed)) return current;
      const next = new Set(current);
      for (const coinId of coinIds) {
        if (failed) next.add(coinId);
        else next.delete(coinId);
      }
      return next;
    });
  }

  function titleFor(coinId: string): string {
    const slot = gaps?.slots.find((s) => s.coin.id === coinId);
    return slot ? getCoinName(slot.coin).title : '';
  }

  const ownershipMutation = useSetOwnership({
    onSettled: (error, { coinId, owned, coin }) => {
      markPending([coinId], false);
      const title = coin ? getCoinName(coin).title : titleFor(coinId);
      if (error) {
        markFailed([coinId], true);
        setLiveMessage(fill(t('setPage.liveFailed'), { title }));
      } else {
        setLiveMessage(fill(t(owned ? 'setPage.liveOwned' : 'setPage.liveMissing'), { title }));
      }
    },
  });
  const bulkMutation = useBulkSetOwnership({
    onSettled: (error, { coinIds }) => {
      markPending(coinIds, false);
      if (error) {
        markFailed(coinIds, true);
        setLiveMessage(
          coinIds.length === 1
            ? t('setPage.liveBulkFailedOne')
            : fill(t('setPage.liveBulkFailed'), { n: coinIds.length }),
        );
      }
    },
  });
  const patchCoinsMutation = usePatchSetCoins(id);
  const addCoinsToSetMutation = useAddCoinsToSet();
  const renameMutation = useRenameSet();
  const deleteMutation = useDeleteSet();

  const [nameValue, setNameValue] = useState('');
  const [savedName, setSavedName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const renamingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const syncedSetRef = useRef<typeof set>(undefined);

  const [missingOnly, setMissingOnly] = useState(false);
  // Reading window here is safe: SetEditor only mounts on the client (after the params
  // effect sets `id`, inside RequireAuth), and a lazy initializer avoids an Album->List flash.
  const [view, setView] = useState<SetView>(() => parseSetView(window.location.search));
  const [selectMode, setSelectMode] = useState(false);
  // A Set keeps insertion order, so the bulk request lists coins in the order they were clicked.
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Adjust the name state during render (React's "adjust state" pattern) rather than in an
  // effect, so the first render with `set` already shows the right name.
  if (set && syncedSetRef.current !== set) {
    syncedSetRef.current = set;
    setNameValue(set.name);
    setSavedName(set.name);
  }

  useEffect(() => {
    if (!renaming) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [renaming]);

  useEffect(() => {
    if (!selectMode) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setSelectMode(false);
      setSelected(new Set());
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectMode]);

  function statusFor(coinId: string): CoinCardStatus {
    if (pendingCoinIds.has(coinId)) return 'pending';
    if (failedCoinIds.has(coinId)) return 'failed';
    return 'idle';
  }

  function handleToggle(slot: GapSlot) {
    const coinId = slot.coin.id;
    if (pendingRef.current.has(coinId)) return;
    markPending([coinId], true);
    markFailed([coinId], false);
    ownershipMutation.mutate({ coinId, owned: !slot.owned, coin: slot.coin });
  }

  function runBulk(coinIds: string[], owned: boolean, onSuccess?: () => void) {
    if (coinIds.length === 0) return;
    markPending(coinIds, true);
    markFailed(coinIds, false);
    bulkMutation.mutate({ coinIds, owned }, onSuccess ? { onSuccess } : undefined);
  }

  function markAllOwned(coinIds: string[], message: string) {
    runBulk(coinIds, true, () => {
      toast.show({ message, onUndo: () => runBulk(coinIds, false) });
    });
  }

  function handleMarkYear(year: number, coinIds: string[]) {
    const message =
      coinIds.length === 1
        ? fill(t('setPage.toastMarkedYearOne'), { year })
        : fill(t('setPage.toastMarkedYear'), { n: coinIds.length, year });
    markAllOwned(coinIds, message);
  }

  function handleMarkWholeSet(coinIds: string[]) {
    const message =
      coinIds.length === 1 ? t('setPage.toastMarkedOwnedOne') : fill(t('setPage.toastMarkedOwned'), { n: coinIds.length });
    markAllOwned(coinIds, message);
  }

  function enterSelectMode() {
    setSelected(new Set());
    setSelectMode(true);
  }

  function leaveSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelected(coinId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(coinId)) next.delete(coinId);
      else next.add(coinId);
      return next;
    });
  }

  function handleMarkSelected(owned: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ownedBefore = new Map((gaps?.slots ?? []).map((slot) => [slot.coin.id, slot.owned]));
    const changed = ids.filter((coinId) => ownedBefore.get(coinId) !== owned);
    leaveSelectMode();

    let message: string;
    if (owned) {
      message = ids.length === 1 ? t('setPage.toastMarkedOwnedOne') : fill(t('setPage.toastMarkedOwned'), { n: ids.length });
    } else {
      message =
        ids.length === 1 ? t('setPage.toastMarkedMissingOne') : fill(t('setPage.toastMarkedMissing'), { n: ids.length });
    }
    runBulk(ids, owned, () => {
      toast.show({
        message,
        onUndo: () => {
          if (changed.length > 0) runBulk(changed, !owned);
        },
      });
    });
  }

  function handleViewChange(next: SetView) {
    setView(next);
    if (next !== 'album') leaveSelectMode();
    // replace, not push: switching views shouldn't add Back-button entries.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${buildSetViewSearch(search, next)}${hash}`);
  }

  function handleRemove(slot: GapSlot) {
    const coinId = slot.coin.id;
    const title = getCoinName(slot.coin).title;
    patchCoinsMutation.mutate(
      { remove: [coinId] },
      {
        onSuccess: () => {
          toast.show({
            message: fill(t('setPage.toastRemoved'), { title }),
            onUndo: () => patchCoinsMutation.mutate({ add: [coinId] }),
          });
        },
        onError: () => setLiveMessage(fill(t('setPage.liveRemoveFailed'), { title })),
      },
    );
  }

  function handleAddToSet(slot: GapSlot, setId: string) {
    const title = getCoinName(slot.coin).title;
    const target = userSets?.find((s) => s.id === setId);
    const setName = target ? resolveLocalizedText(target.name, locale) : '';
    addCoinsToSetMutation.mutate(
      { setId, coinIds: [slot.coin.id] },
      { onSuccess: () => setLiveMessage(fill(t('setPage.liveAddedToSet'), { title, set: setName })) },
    );
  }

  function startRename() {
    setNameValue(savedName);
    renamingRef.current = true;
    setRenaming(true);
  }

  function commitRename() {
    if (!renamingRef.current) return;
    renamingRef.current = false;
    setRenaming(false);
    if (nameValue.trim() === '') {
      setNameValue(savedName);
      return;
    }
    if (nameValue !== savedName) {
      setSavedName(nameValue);
      renameMutation.mutate({ id, name: nameValue });
    }
  }

  function cancelRename() {
    if (!renamingRef.current) return;
    renamingRef.current = false;
    setRenaming(false);
    setNameValue(savedName);
  }

  function handleDelete() {
    setDeleteConfirmOpen(false);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        markSetDeleted(set?.name ?? '');
        router.push('/dashboard');
      },
    });
  }

  function retryLoad() {
    void setQuery.refetch();
    void gapsQuery.refetch();
  }

  if (setLoading || gapsLoading) {
    return (
      <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
        <div data-testid="set-editor-loading" aria-busy="true" className="flex flex-col gap-6">
          <span className="sr-only">{t('setPage.loadingLabel')}</span>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-3/5" />
            <Skeleton className="h-4 w-2/5" />
          </div>
          <Skeleton className="h-11 w-full" />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(172px,100%),1fr))] gap-3.5 max-[899px]:grid-cols-2 max-[899px]:gap-2.5">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="aspect-[3/4] w-full rounded-lg" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (setIsError || gapsIsError) {
    return (
      <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
        <div
          data-testid="set-editor-error"
          role="alert"
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg p-4 text-sm text-text"
        >
          <AlertIcon />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="font-semibold">{t('setPage.errorTitle')}</p>
            <p className="text-neutral-800">{t('setPage.errorBody')}</p>
            <div className="mt-2">
              <button
                type="button"
                data-testid="set-editor-error-retry"
                onClick={retryLoad}
                className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] border border-neutral-400 bg-white px-4 text-sm font-medium text-text hover:border-accent ${FOCUS_RING}`}
              >
                {t('setPage.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!set || !gaps) {
    return <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  const busyCoinIds = new Set<string>([...pendingCoinIds, ...failedCoinIds]);
  const isAlbum = view === 'album';
  const selecting = isAlbum && selectMode;
  const missingCount = gaps.slots.filter((slot) => !slot.owned).length;
  const nothingMissing = missingCount === 0;
  const groups = buildYearGroups(gaps.slots, { missingOnly, busyCoinIds });
  const wholeSetMarkable = [...gaps.slots]
    .filter((slot) => !slot.owned && !busyCoinIds.has(slot.coin.id))
    .sort((a, b) => a.position - b.position)
    .map((slot) => slot.coin.id);
  const otherSets = (userSets ?? [])
    .filter((s) => s.id !== id)
    .map((s) => ({ id: s.id, name: resolveLocalizedText(s.name, locale) }));

  const shared = getSetSharedParts(gaps.slots);
  const subtitleParts: ReactNode[] = [t(KIND_LABEL[getSetKind(set)])];
  if (shared.country !== null) subtitleParts.push(shared.country);
  if (shared.denomination !== null) subtitleParts.push(shared.denomination);
  if (shared.years !== null) {
    subtitleParts.push(
      <span data-testid="set-editor-subtitle-years" className="font-mono tabular-nums">
        {shared.years}
      </span>,
    );
  }

  let body: ReactNode;
  if (gaps.slots.length === 0) {
    body = (
      <div className="flex flex-col gap-1 rounded-[var(--radius-lg)] bg-surface px-5 py-8 text-center">
        <p data-testid="set-editor-empty" className="text-base font-semibold text-text">
          {t('setPage.empty')}
        </p>
        {isOwner && (
          <p data-testid="set-editor-empty-owner-hint" className="text-sm text-neutral-700">
            {t('setPage.emptyOwnerHint')}
          </p>
        )}
      </div>
    );
  } else if (groups.length === 0) {
    body = (
      <div
        data-testid="set-editor-complete-empty"
        className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-5 py-10 text-center"
      >
        <Badge variant="complete" />
        <p className="text-base font-semibold text-text">{t('setPage.completeTitle')}</p>
        <button
          type="button"
          data-testid="set-editor-show-all-coins"
          onClick={() => setMissingOnly(false)}
          className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] px-2 text-sm font-medium text-accent-700 underline hover:text-accent-800 ${FOCUS_RING}`}
        >
          {t('setPage.showAllCoins')}
        </button>
      </div>
    );
  } else {
    body = (
      <div data-testid="set-editor-groups" className="flex flex-col gap-10 max-[899px]:gap-8">
        {groups.map((group) => (
          <SetYearGroup
            key={group.year}
            year={group.year}
            ownedCount={group.ownedCount}
            totalCount={group.totalCount}
            markAllCount={group.markableCoinIds.length}
            onMarkAll={
              isOwner && !selecting ? () => handleMarkYear(group.year, group.markableCoinIds) : undefined
            }
          >
            {isAlbum ? (
              <SetAlbum
                slots={group.slots}
                visitor={!isOwner}
                selectMode={selecting}
                selectedCoinIds={selected}
                statusFor={statusFor}
                onToggle={handleToggle}
                onSelect={toggleSelected}
              />
            ) : (
              <SetCoinList
                slots={group.slots}
                visitor={!isOwner}
                statusFor={statusFor}
                onToggle={handleToggle}
                otherSets={otherSets}
                onRemove={handleRemove}
                onAddToSet={handleAddToSet}
              />
            )}
          </SetYearGroup>
        ))}
      </div>
    );
  }

  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      {/* One DOM for both layouts: grid areas move the actions next to the crumb under 900px. */}
      <header
        className={[
          'grid items-end gap-x-6 gap-y-3 border-b border-divider pb-[18px]',
          'grid-cols-[minmax(0,1fr)_minmax(0,300px)]',
          "[grid-template-areas:'crumb_crumb'_'title_progress'_'segs_actions']",
          'max-[899px]:grid-cols-[minmax(0,1fr)_auto] max-[899px]:items-center',
          "max-[899px]:[grid-template-areas:'crumb_actions'_'title_title'_'progress_progress'_'segs_segs']",
        ].join(' ')}
      >
        <p className="[grid-area:crumb] text-[13px] text-neutral-700">
          <Link
            href={isOwner ? '/dashboard' : '/sets/public'}
            data-testid="set-editor-breadcrumb"
            className="inline-flex min-h-9 items-center hover:text-accent-700 hover:underline"
          >
            {isOwner ? t('setPage.breadcrumbMySets') : t('setPage.breadcrumbPublicSets')}
          </Link>
        </p>

        <div className="[grid-area:title] flex min-w-0 flex-col gap-1.5 self-end">
          <h1
            data-testid="set-editor-name"
            className="m-0 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.1] [overflow-wrap:anywhere] max-[719px]:text-[30px]"
          >
            {renaming ? (
              <input
                ref={nameInputRef}
                data-testid="set-editor-name-input"
                type="text"
                aria-label={t('setEditor.renameSet')}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                  }
                }}
                className="w-full border-b border-accent-700 bg-transparent [font:inherit] focus:outline-none"
              />
            ) : (
              resolveLocalizedText(savedName, locale)
            )}
          </h1>
          <p data-testid="set-editor-subtitle" className="text-sm text-neutral-700">
            {subtitleParts.map((part, index) => (
              <Fragment key={index}>
                {index > 0 && ' · '}
                {part}
              </Fragment>
            ))}
          </p>
        </div>

        <div data-testid="set-editor-progress" className="[grid-area:progress] flex min-w-0 flex-col gap-2 self-end">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span data-testid="set-editor-owned-count" className="text-sm text-neutral-800">
              <OwnedOfTotal template={t('setEditor.ownedOfTotal')} owned={gaps.ownedCount} total={gaps.totalCount} />
            </span>
            <span data-testid="set-editor-completion" className="font-mono text-sm tabular-nums text-accent-700">
              {gaps.completionPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={t('setEditor.completionLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={gaps.completionPercent}
            className="h-2 overflow-hidden rounded-[var(--radius-md)] bg-neutral-300"
          >
            <div
              className="h-full rounded-[var(--radius-md)] bg-accent motion-safe:transition-[width] motion-safe:duration-300"
              style={{ width: `${gaps.completionPercent}%` }}
            />
          </div>
        </div>

        <div className="[grid-area:segs] flex min-w-0 flex-wrap items-center gap-3">
          <div role="group" aria-label={t('setEditor.showLabel')} className={SEGMENT_GROUP_CLASSNAME}>
            <button
              type="button"
              data-testid="set-editor-show-all-toggle"
              aria-pressed={!missingOnly}
              onClick={() => setMissingOnly(false)}
              className={SEGMENT_BUTTON_CLASSNAME}
            >
              {t('setPage.showAll')} <span className="font-mono tabular-nums">{gaps.totalCount}</span>
            </button>
            <button
              type="button"
              data-testid="set-editor-show-missing-toggle"
              aria-pressed={missingOnly}
              onClick={() => setMissingOnly(true)}
              className={SEGMENT_BUTTON_CLASSNAME}
            >
              {t('setPage.showMissing')} <span className="font-mono tabular-nums">{missingCount}</span>
            </button>
          </div>
          <SetViewSwitch view={view} onChange={handleViewChange} />
        </div>

        {isOwner && (
          <div className="[grid-area:actions] flex flex-wrap items-center justify-end gap-2 justify-self-end">
            {isAlbum && (
              <button
                type="button"
                data-testid="set-editor-select-toggle"
                aria-pressed={selectMode}
                onClick={() => (selectMode ? leaveSelectMode() : enterSelectMode())}
                className={`min-h-11 cursor-pointer rounded-[var(--radius-md)] border border-neutral-400 bg-white px-4 text-sm font-medium text-text hover:border-accent aria-pressed:border-accent-700 aria-pressed:bg-accent-100 aria-pressed:text-accent-800 max-[899px]:hidden ${FOCUS_RING}`}
              >
                {selectMode ? t('setPage.doneSelecting') : t('setPage.select')}
              </button>
            )}
            <button
              type="button"
              data-testid="set-editor-toggle-add-coins"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              onClick={() => setPickerOpen(true)}
              className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-accent-700 px-4 text-sm font-medium text-white hover:bg-accent-800 max-[899px]:px-0 ${FOCUS_RING}`}
            >
              <PlusIcon />
              <span className="max-[899px]:sr-only">{t('setEditor.addCoins')}</span>
            </button>
            <SetActionsMenu
              onRename={startRename}
              onDelete={() => setDeleteConfirmOpen(true)}
              onDownloadMissing={() => downloadMissingCsv(gaps, set.name)}
              printMissingHref={`/sets/${id}/missing`}
              nothingMissing={nothingMissing}
              onSelectCoins={isAlbum ? enterSelectMode : undefined}
              onMarkAllOwned={() => handleMarkWholeSet(wholeSetMarkable)}
              markAllCount={wholeSetMarkable.length}
            />
          </div>
        )}
      </header>

      {selecting && (
        <p data-testid="set-editor-select-hint" className="text-sm text-neutral-700">
          {t('setPage.selectHint')}
        </p>
      )}

      {body}

      {selecting && (
        <SelectionActionBar
          count={selected.size}
          onMarkOwned={() => handleMarkSelected(true)}
          onMarkMissing={() => handleMarkSelected(false)}
          onCancel={leaveSelectMode}
        />
      )}

      <p data-testid="set-editor-live" role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      {isOwner && pickerOpen && (
        <AddCoinsSheet
          setId={id}
          setName={resolveLocalizedText(savedName, locale)}
          slots={gaps.slots}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('setEditor.deleteConfirmTitle').split('{name}').join(set.name)}
        description={
          <>
            {formatOwnedOfTotal(t('setEditor.deleteConfirmMessage'), 0, gaps.totalCount)}
            {gaps.ownedCount > 0 && (
              <p
                data-testid="set-editor-delete-confirm-safe"
                className="mt-3 rounded-[var(--radius-md)] bg-accent-100 px-3.5 py-3 text-accent-800"
              >
                {formatOwnedOfTotal(t('setEditor.deleteConfirmSafe'), gaps.ownedCount, gaps.totalCount)}
              </p>
            )}
          </>
        }
        variant="danger"
        confirmLabel={t('setEditor.deleteButton')}
        cancelLabel={t('common.cancel')}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        testIdPrefix="set-editor-delete-confirm"
      />
    </main>
  );
}

export default function SetEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setId(resolved.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <RequireAuth>
      {id === null ? (
        <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} />
      ) : (
        <UndoToastProvider>
          <SetEditor id={id} />
        </UndoToastProvider>
      )}
    </RequireAuth>
  );
}
