'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatCoinLabel } from '@coin-collector/shared';
import type { GapSlot } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import CatalogFilterForm, { type CatalogFilterFormValues } from '@/components/catalog/catalog-filter-form';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet } from '@/components/ui/sheet';
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

  const patchCoinsMutation = usePatchSetCoins(id);
  const ownershipMutation = useSetOwnership();
  const renameMutation = useRenameSet();
  const deleteMutation = useDeleteSet();

  const [nameValue, setNameValue] = useState('');
  const savedNameRef = useRef('');
  const syncedSetRef = useRef<typeof set>(undefined);
  const [gapOnly, setGapOnly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [collapsedDecades, setCollapsedDecades] = useState<Record<string, boolean>>({});
  const [addCoinsFilters, setAddCoinsFilters] = useState<CatalogFilters>({ page: 1, limit: ADD_COINS_LIMIT });
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
  const decadeGroups = buildDecadeGroups(gaps.slots, gapOnly);

  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <div className="flex items-start justify-between gap-4">
        {isOwner ? (
          <input
            data-testid="set-editor-name-input"
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleNameBlur}
            className="w-full border-b border-transparent bg-transparent text-lg font-semibold hover:border-gray-300 focus:border-blue-600 focus:outline-none"
          />
        ) : (
          <h1 data-testid="set-editor-name" className="text-lg font-semibold">
            {resolveLocalizedText(set.name, locale)}
          </h1>
        )}

        {isOwner && (
          <button
            type="button"
            data-testid="set-editor-delete-button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="w-fit shrink-0 rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600"
          >
            {t('setEditor.deleteButton')}
          </button>
        )}
      </div>

      <span data-testid="set-editor-completion" className="text-sm text-gray-600">
        {gaps.completionPercent}%
      </span>

      <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="set-editor-show-all-toggle"
            aria-pressed={!gapOnly}
            onClick={() => setGapOnly(false)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            {t('setEditor.allCoins')}
          </button>
          <button
            type="button"
            data-testid="set-editor-show-missing-toggle"
            aria-pressed={gapOnly}
            onClick={() => setGapOnly(true)}
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          >
            {missingCount} {t('setEditor.missing')}
          </button>
        </div>

        {isOwner && (
          <button
            type="button"
            data-testid="set-editor-toggle-add-coins"
            onClick={() => setPickerOpen(true)}
            className="rounded border border-gray-300 px-4 py-2 text-sm font-medium"
          >
            {t('setEditor.addCoins')}
          </button>
        )}
      </div>

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
                      <span className="flex flex-col">
                        <span className="text-[15px] font-medium">{slot.coin.name}</span>
                        <span className="text-xs text-gray-500">{formatCoinLabel(slot.coin)}</span>
                      </span>
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
        title={t('setEditor.deleteConfirmTitle')}
        description={t('setEditor.deleteConfirmMessage')}
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
        <SetEditor id={id} />
      )}
    </RequireAuth>
  );
}
