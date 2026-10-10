'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatCoinLabel } from '@coin-collector/shared';
import type { GapSlot } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import CatalogFilterForm, { type CatalogFilterFormValues } from '@/components/catalog/catalog-filter-form';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { downloadMissingCsv } from '@/lib/missing-list';
import type { CatalogFilters } from '@/lib/catalog-api';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet } from '@/components/ui/sheet';
import { SetActionsMenu } from '@/components/sets/set-actions-menu';
import { SetAlbum } from '@/components/sets/set-album';
import { SEGMENT_BUTTON_CLASSNAME, SEGMENT_GROUP_CLASSNAME, SetViewSwitch } from '@/components/sets/set-view-switch';
import { formatOwnedOfTotal } from '@/lib/album-layout';
import { buildSetViewSearch, parseSetView, type SetView } from '@/lib/set-view';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const ADD_COINS_LIMIT = 20;
const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10';

interface DecadeGroup {
  decade: number;
  label: string;
  ownedCount: number;
  totalCount: number;
  visibleSlots: GapSlot[];
}

function buildDecadeGroups(slots: GapSlot[], gapOnly: boolean): DecadeGroup[] {
  const byDecade = new Map<number, GapSlot[]>();
  for (const slot of slots) {
    const decade = Math.floor(slot.coin.year / 10) * 10;
    const bucket = byDecade.get(decade);
    if (bucket) {
      bucket.push(slot);
    } else {
      byDecade.set(decade, [slot]);
    }
  }

  const decades = [...byDecade.keys()].sort((a, b) => a - b);

  return decades
    .map((decade) => {
      const allSlots = [...(byDecade.get(decade) ?? [])].sort((a, b) => a.position - b.position);
      const ownedCount = allSlots.filter((slot) => slot.owned).length;
      const visibleSlots = gapOnly ? allSlots.filter((slot) => !slot.owned) : allSlots;
      return {
        decade,
        label: `${decade}s`,
        ownedCount,
        totalCount: allSlots.length,
        visibleSlots,
      };
    })
    .filter((group) => group.visibleSlots.length > 0);
}

function SetEditor({ id }: { id: string }) {
  const router = useRouter();
  const { t, locale } = useTranslation();

  const { data: set, isLoading: setLoading, isError: setIsError } = usePublicSet(id);
  const { data: gaps, isLoading: gapsLoading, isError: gapsIsError } = useSetGaps(id);
  const { data: userSets } = useUserSets();
  const isOwner = Boolean(userSets?.some((s) => s.id === id));

  // Album slots track their own in-flight requests so each slot can be disabled on its own.
  // The ref is the source of truth (a second click can land before the state re-renders);
  // the state copy drives rendering.
  const albumPendingRef = useRef(new Set<string>());
  const [albumPendingCoinIds, setAlbumPendingCoinIds] = useState<ReadonlySet<string>>(() => new Set());
  const [albumToggleFailed, setAlbumToggleFailed] = useState(false);

  const patchCoinsMutation = usePatchSetCoins(id);
  const ownershipMutation = useSetOwnership({
    onSettled: (error, { coinId }) => {
      if (!albumPendingRef.current.delete(coinId)) return;
      setAlbumPendingCoinIds(new Set(albumPendingRef.current));
      if (error) setAlbumToggleFailed(true);
    },
  });
  const renameMutation = useRenameSet();
  const deleteMutation = useDeleteSet();

  const [nameValue, setNameValue] = useState('');
  const savedNameRef = useRef('');
  const nameInputRef = useRef<HTMLInputElement>(null);
  const syncedSetRef = useRef<typeof set>(undefined);
  const [gapOnly, setGapOnly] = useState(false);
  // Reading window here is safe: SetEditor only mounts on the client (after the params
  // effect sets `id`, inside RequireAuth), and a lazy initializer avoids a List->Album flash.
  const [view, setView] = useState<SetView>(() => parseSetView(window.location.search));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [collapsedDecades, setCollapsedDecades] = useState<Record<string, boolean>>({});
  const [addCoinsFilters, setAddCoinsFilters] = useState<CatalogFilters>({
    page: 1,
    limit: ADD_COINS_LIMIT,
  });
  const catalogQuery = useCatalog(addCoinsFilters);

  // Adjust nameValue during render (React's endorsed "adjust state" pattern) rather than
  // via useEffect: an effect only fires after commit, so the input would first paint with
  // its stale initial value on the very render where `set` becomes available (it's already
  // guaranteed non-null by the time this component reaches its main return, since the
  // !set/!gaps branch above returns early) before a second render corrected it, racing any
  // assertion or blur made immediately after the input appears.
  if (set && syncedSetRef.current !== set) {
    syncedSetRef.current = set;
    setNameValue(set.name);
    savedNameRef.current = set.name;
  }

  function handleToggle(coinId: string, currentlyOwned: boolean) {
    ownershipMutation.mutate({ coinId, owned: !currentlyOwned });
  }

  function handleAlbumToggle(coinId: string, currentlyOwned: boolean) {
    if (albumPendingRef.current.has(coinId)) return;
    albumPendingRef.current.add(coinId);
    setAlbumPendingCoinIds(new Set(albumPendingRef.current));
    setAlbumToggleFailed(false);
    ownershipMutation.mutate({ coinId, owned: !currentlyOwned });
  }

  function handleViewChange(next: SetView) {
    setView(next);
    // replace, not push: switching views shouldn't add Back-button entries.
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, '', `${pathname}${buildSetViewSearch(search, next)}${hash}`);
  }

  function handleRemove(coinId: string) {
    patchCoinsMutation.mutate({ remove: [coinId] });
  }

  function handleAdd(coinId: string) {
    patchCoinsMutation.mutate({ add: [coinId] });
  }

  function handleAddCoinsFilterSubmit(values: CatalogFilterFormValues) {
    setAddCoinsFilters({ ...values, page: 1, limit: ADD_COINS_LIMIT });
  }

  function handleNameBlur() {
    if (nameValue !== savedNameRef.current) {
      savedNameRef.current = nameValue;
      renameMutation.mutate({ id, name: nameValue });
    }
  }

  function handleDelete() {
    setDeleteConfirmOpen(false);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        router.push('/dashboard');
      },
    });
  }

  function toggleDecade(key: string) {
    setCollapsedDecades((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  if (setLoading || gapsLoading) {
    return (
      <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
        <div data-testid="set-editor-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      </main>
    );
  }

  if (setIsError || gapsIsError) {
    return (
      <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
        <p data-testid="set-editor-error" className="text-sm text-red-600">
          {t('setEditor.errorLoading')}
        </p>
      </main>
    );
  }

  if (!set || !gaps) {
    return <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  const missingCount = gaps.slots.filter((slot) => !slot.owned).length;
  const nothingMissing = missingCount === 0;
  const decadeGroups = buildDecadeGroups(gaps.slots, gapOnly);

  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-[13px] text-neutral-700">
            <Link
              href={isOwner ? '/sets' : '/sets/public'}
              data-testid="set-editor-breadcrumb"
              className="hover:text-accent-700 hover:underline"
            >
              {isOwner ? t('setEditor.breadcrumbMySets') : t('setEditor.breadcrumbPublicSets')}
            </Link>
          </p>
          {isOwner ? (
            <input
              ref={nameInputRef}
              data-testid="set-editor-name-input"
              type="text"
              aria-label={t('setEditor.renameSet')}
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              className="w-full border-b border-transparent bg-transparent font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.1] hover:border-neutral-400 focus:border-accent-700 focus:outline-none"
            />
          ) : (
            <h1 data-testid="set-editor-name" className="text-[40px] font-semibold leading-[1.1]">
              {resolveLocalizedText(set.name, locale)}
            </h1>
          )}
        </div>

        <div className="flex w-[280px] max-w-full flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span data-testid="set-editor-owned-count" className="text-sm text-neutral-800">
              {formatOwnedOfTotal(t('setEditor.ownedOfTotal'), gaps.ownedCount, gaps.totalCount)}
            </span>
            <span data-testid="set-editor-completion" className="font-mono text-sm text-accent-700">
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
              className="h-full rounded-[var(--radius-md)] bg-accent"
              style={{ width: `${gaps.completionPercent}%` }}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-divider pb-5">
        <div className="flex flex-wrap items-center gap-4">
          <div role="group" aria-label={t('setEditor.showLabel')} className={SEGMENT_GROUP_CLASSNAME}>
            <button
              type="button"
              data-testid="set-editor-show-all-toggle"
              aria-pressed={!gapOnly}
              onClick={() => setGapOnly(false)}
              className={SEGMENT_BUTTON_CLASSNAME}
            >
              {t('setEditor.allCoins')} · {gaps.totalCount}
            </button>
            <button
              type="button"
              data-testid="set-editor-show-missing-toggle"
              aria-pressed={gapOnly}
              onClick={() => setGapOnly(true)}
              className={SEGMENT_BUTTON_CLASSNAME}
            >
              {missingCount} {t('setEditor.missing')}
            </button>
          </div>
          <SetViewSwitch view={view} onChange={handleViewChange} />
        </div>

        <div className="flex items-center gap-2">
          {isOwner && (
            <button
              type="button"
              data-testid="set-editor-toggle-add-coins"
              onClick={() => setPickerOpen(true)}
              className="min-h-11 rounded-[var(--radius-md)] bg-accent-700 px-5 text-sm font-medium text-white hover:bg-accent-800"
            >
              + {t('setEditor.addCoins')}
            </button>
          )}
          <SetActionsMenu
            onRename={isOwner ? () => nameInputRef.current?.focus() : undefined}
            onDelete={isOwner ? () => setDeleteConfirmOpen(true) : undefined}
            onDownloadMissing={() => downloadMissingCsv(gaps, set.name)}
            printMissingHref={`/sets/${id}/missing`}
            nothingMissing={nothingMissing}
          />
        </div>
      </div>

      {view === 'album' ? (
        <SetAlbum
          slots={gaps.slots}
          isOwner={isOwner}
          gapOnly={gapOnly}
          onToggle={handleAlbumToggle}
          pendingCoinIds={albumPendingCoinIds}
          toggleFailed={albumToggleFailed}
        />
      ) : (
        <ul data-testid="set-editor-gap-grid" className="flex flex-col gap-4">
          {decadeGroups.map((group) => {
            const decadeKey = `${id}-${group.label}`;
            const isCollapsed = Boolean(collapsedDecades[decadeKey]);
            return (
              <li
                key={group.decade}
                data-testid="set-editor-decade-group"
                className="flex flex-col gap-2 rounded border border-gray-200 p-3"
              >
                <button
                  type="button"
                  data-testid="set-editor-decade-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleDecade(decadeKey)}
                  className="flex w-full items-center justify-between text-left text-sm font-semibold"
                >
                  <span>
                    {isCollapsed ? '+' : '–'} {group.label}
                  </span>
                  <span className="text-xs font-normal text-gray-500">
                    {group.ownedCount} of {group.totalCount} owned
                  </span>
                </button>
                {!isCollapsed && (
                  <ul className="flex flex-col gap-2">
                    {group.visibleSlots.map((slot) => (
                      <li
                        key={slot.id}
                        data-testid="set-editor-gap-item"
                        className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3"
                      >
                        <Link
                          href={`/catalog/${slot.coin.id}`}
                          data-testid="set-editor-gap-coin-link"
                          className="flex flex-col hover:underline"
                        >
                          <span className="text-[15px] font-medium">{slot.coin.name}</span>
                          <span className="text-xs text-gray-500">{formatCoinLabel(slot.coin)}</span>
                          {slot.coin.variety ? (
                            <span data-testid="set-editor-gap-variety" className="text-xs text-gray-500">
                              {slot.coin.variety}
                            </span>
                          ) : null}
                        </Link>
                        <span data-testid="set-editor-gap-status" className="text-xs text-gray-500">
                          {slot.owned ? t('common.owned') : t('common.missing')}
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            data-testid="set-editor-toggle-owned-button"
                            onClick={() => handleToggle(slot.coin.id, slot.owned)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            {slot.owned ? t('setEditor.markNotOwned') : t('setEditor.markOwned')}
                          </button>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            data-testid="set-editor-remove-button"
                            onClick={() => handleRemove(slot.coin.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                          >
                            {t('setEditor.removeButton')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title={t('setEditor.addCoinsHeading')}>
        <div data-testid="set-editor-add-coins-panel" className="flex flex-col gap-3">
          <CatalogFilterForm testIdPrefix="set-editor-add-coins" onSubmit={handleAddCoinsFilterSubmit} />
          <ul data-testid="set-editor-add-coins-results" className="flex flex-col gap-2">
            {(catalogQuery.data?.items ?? []).map((coin) => (
              <li
                key={coin.id}
                data-testid="set-editor-add-coins-item"
                className="flex items-center justify-between gap-4 rounded border border-gray-200 p-2"
              >
                <span>{formatCoinLabel(coin)}</span>
                <button
                  type="button"
                  data-testid="set-editor-add-coins-add-button"
                  onClick={() => handleAdd(coin.id)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {t('setEditor.addButton')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title={t('setEditor.deleteConfirmTitle').split('{name}').join(set.name)}
        description={
          <>
            {formatOwnedOfTotal(t('setEditor.deleteConfirmMessage'), 0, gaps.totalCount)}
            <span className="mt-3 block rounded-[var(--radius-md)] bg-accent-100 px-3.5 py-3 text-accent-800">
              {formatOwnedOfTotal(t('setEditor.deleteConfirmSafe'), gaps.ownedCount, gaps.totalCount)}
            </span>
          </>
        }
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
      {id === null ? <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} /> : <SetEditor id={id} />}
    </RequireAuth>
  );
}
