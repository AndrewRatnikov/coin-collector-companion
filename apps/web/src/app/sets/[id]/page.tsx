'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getCoinName } from '@coin-collector/shared';
import type { CoinGrade, GapSlot } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import {
  useAddCoinsToSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useUpdateSetMinGrade,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import { useBulkSetOwnership, useSetOwnership } from '@/lib/hooks/use-collection';
import { downloadMissingCsv } from '@/lib/missing-list';
import type { CoinCardStatus } from '@/components/ui/coin-card';
import { UndoToastProvider, useUndoToast } from '@/components/ui/undo-toast';
import { AddCoinsSheet } from '@/components/sets/add-coins-sheet';
import { SelectionActionBar } from '@/components/sets/selection-action-bar';
import { SetActionsMenu } from '@/components/sets/set-actions-menu';
import { SetPageDeleteDialog } from '@/components/set-page/set-page-delete-dialog';
import { SetPageCompleteEmpty, SetPageEmpty, SetPageUpgradeEmpty } from '@/components/set-page/set-page-empty-states';
import { SetPageHeader } from '@/components/set-page/set-page-header';
import { SetPageError, SetPageLoading } from '@/components/set-page/set-page-load-states';
import { PAGE_WRAPPER_CLASSNAME, type SetFilter } from '@/components/set-page/set-page-shared';
import { SetPageLiveRegion, SetPageSelectHint } from '@/components/set-page/set-page-status';
import { SetPageToolbar } from '@/components/set-page/set-page-toolbar';
import { SetPageYearGroups } from '@/components/set-page/set-page-year-groups';
import { fill } from '@/lib/fill-template';
import { gradeShortLabel } from '@/lib/grades';
import { markSetDeleted } from '@/lib/set-deleted-notice';
import { buildYearGroups } from '@/lib/set-page';
import { buildSetViewSearch, parseSetView, type SetView } from '@/lib/set-view';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

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
  const minGradeMutation = useUpdateSetMinGrade();
  const [minGradeFailed, setMinGradeFailed] = useState(false);

  const [nameValue, setNameValue] = useState('');
  const [savedName, setSavedName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const renamingRef = useRef(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const syncedSetRef = useRef<typeof set>(undefined);

  const [filter, setFilter] = useState<SetFilter>('all');
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
    return <SetPageLoading />;
  }

  if (setIsError || gapsIsError) {
    return <SetPageError onRetry={retryLoad} />;
  }

  if (!set || !gaps) {
    return <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  // Upgrade states come only from the API (upgradeCount is present only when the set has a
  // minimum grade), and only the owner sees them.
  const showUpgrades = isOwner && gaps.upgradeCount !== undefined;
  // Adjust state during render: the upgrade filter can't outlive the minimum it filters by.
  if (filter === 'upgrade' && !showUpgrades) setFilter('all');
  const activeFilter: SetFilter = filter === 'upgrade' && !showUpgrades ? 'all' : filter;
  const upgradeCount = gaps.upgradeCount ?? 0;

  const shownMinGrade: CoinGrade | null =
    minGradeMutation.isPending && minGradeMutation.variables ? minGradeMutation.variables.minGrade : gaps.minGrade;

  function handleMinGradeChange(next: CoinGrade | null) {
    if (next === shownMinGrade) return;
    setMinGradeFailed(false);
    minGradeMutation.mutate(
      { id, minGrade: next },
      {
        onSuccess: () =>
          setLiveMessage(
            next === null
              ? t('setEditor.minGradeCleared')
              : fill(t('setEditor.minGradeSaved'), { grade: gradeShortLabel(t, next) }),
          ),
        onError: () => setMinGradeFailed(true),
      },
    );
  }

  const busyCoinIds = new Set<string>([...pendingCoinIds, ...failedCoinIds]);
  const isAlbum = view === 'album';
  const selecting = isAlbum && selectMode;
  const missingCount = gaps.slots.filter((slot) => !slot.owned).length;
  const nothingMissing = missingCount === 0;
  const groups = buildYearGroups(gaps.slots, {
    missingOnly: activeFilter === 'missing',
    needsUpgradeOnly: activeFilter === 'upgrade',
    busyCoinIds,
  });
  const wholeSetMarkable = [...gaps.slots]
    .filter((slot) => !slot.owned && !busyCoinIds.has(slot.coin.id))
    .sort((a, b) => a.position - b.position)
    .map((slot) => slot.coin.id);
  const otherSets = (userSets ?? [])
    .filter((s) => s.id !== id)
    .map((s) => ({ id: s.id, name: resolveLocalizedText(s.name, locale) }));

  let body: ReactNode;
  if (gaps.slots.length === 0) {
    body = <SetPageEmpty isOwner={isOwner} />;
  } else if (groups.length === 0 && activeFilter === 'upgrade') {
    body = <SetPageUpgradeEmpty onShowAll={() => setFilter('all')} />;
  } else if (groups.length === 0) {
    body = <SetPageCompleteEmpty onShowAll={() => setFilter('all')} />;
  } else {
    body = (
      <SetPageYearGroups
        groups={groups}
        isOwner={isOwner}
        isAlbum={isAlbum}
        selecting={selecting}
        activeFilter={activeFilter}
        selected={selected}
        statusFor={statusFor}
        onToggle={handleToggle}
        onSelect={toggleSelected}
        otherSets={otherSets}
        onRemove={handleRemove}
        onAddToSet={handleAddToSet}
        onMarkYear={handleMarkYear}
      />
    );
  }

  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <SetPageHeader
        isOwner={isOwner}
        set={set}
        gaps={gaps}
        renaming={renaming}
        nameInputRef={nameInputRef}
        nameValue={nameValue}
        savedName={savedName}
        onNameChange={setNameValue}
        onCommitRename={commitRename}
        onCancelRename={cancelRename}
        showUpgrades={showUpgrades}
        upgradeCount={upgradeCount}
      >
        <SetPageToolbar
          activeFilter={activeFilter}
          onFilterChange={setFilter}
          totalCount={gaps.totalCount}
          missingCount={missingCount}
          showUpgrades={showUpgrades}
          upgradeCount={upgradeCount}
          view={view}
          onViewChange={handleViewChange}
          isOwner={isOwner}
          isAlbum={isAlbum}
          selectMode={selectMode}
          onEnterSelectMode={enterSelectMode}
          onLeaveSelectMode={leaveSelectMode}
          pickerOpen={pickerOpen}
          onOpenPicker={() => setPickerOpen(true)}
          actionsMenu={
            <SetActionsMenu
              onRename={startRename}
              onDelete={() => setDeleteConfirmOpen(true)}
              onDownloadMissing={() => downloadMissingCsv(gaps, set.name)}
              printMissingHref={`/sets/${id}/missing`}
              nothingMissing={nothingMissing}
              onSelectCoins={isAlbum ? enterSelectMode : undefined}
              onMarkAllOwned={() => handleMarkWholeSet(wholeSetMarkable)}
              markAllCount={wholeSetMarkable.length}
              minGrade={shownMinGrade}
              minGradePending={minGradeMutation.isPending}
              onMinGradeChange={handleMinGradeChange}
            />
          }
        />
      </SetPageHeader>

      {isOwner && minGradeFailed && (
        <p role="alert" data-testid="set-editor-min-grade-error" className="text-[13px] font-medium text-danger">
          {t('setEditor.minGradeSaveFailed')}
        </p>
      )}

      {selecting && <SetPageSelectHint />}

      {body}

      {selecting && (
        <SelectionActionBar
          count={selected.size}
          onMarkOwned={() => handleMarkSelected(true)}
          onMarkMissing={() => handleMarkSelected(false)}
          onCancel={leaveSelectMode}
        />
      )}

      <SetPageLiveRegion message={liveMessage} />

      {isOwner && pickerOpen && (
        <AddCoinsSheet
          setId={id}
          setName={resolveLocalizedText(savedName, locale)}
          slots={gaps.slots}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <SetPageDeleteDialog
        open={deleteConfirmOpen}
        setName={set.name}
        ownedCount={gaps.ownedCount}
        totalCount={gaps.totalCount}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
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
