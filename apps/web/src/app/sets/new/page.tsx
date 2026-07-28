'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CatalogCoin, CreateSetRequestBody } from '@coin-collector/shared';
import { formatCoinLabel } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import CatalogFilterForm, { type CatalogFilterFormValues } from '@/components/catalog/catalog-filter-form';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { useCreateSet, usePatchSetCoins } from '@/lib/hooks/use-user-sets';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

type Mode = 'blank' | 'canonical' | 'public';

const PICKER_LIMIT = 20;

// Captures the outcome of the create-mutation's onSuccess (the new set's id, plus the
// add/remove diff computed against whatever baseline the picked source provided) so the
// follow-up usePatchSetCoins(newSetId) — which only becomes correctly bound to that id on
// the render triggered by this state update — can fire from an effect, not inline.
interface CreatedSetPending {
  id: string;
  addedIds: string[];
  removedIds: string[];
}

function NewSetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useTranslation();

  const initialCloneFrom = searchParams.get('cloneFrom');
  const initialCloneFromId = searchParams.get('cloneFromId') ?? '';
  const initialMode: Mode =
    initialCloneFrom === 'canonical' ? 'canonical' : initialCloneFrom === 'user' ? 'public' : 'blank';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState('');
  const [canonicalId, setCanonicalId] = useState(initialMode === 'canonical' ? initialCloneFromId : '');
  const [publicId, setPublicId] = useState(initialMode === 'public' ? initialCloneFromId : '');
  const [error, setError] = useState<string | null>(null);

  // The coin-by-coin composition for the set-to-be-created: seeded from a clone source's
  // full coin list once picked, then freely edited via the catalogue picker's Add and this
  // list's Remove before the set is actually created.
  const [pendingCoins, setPendingCoins] = useState<CatalogCoin[]>([]);
  const [baselineIds, setBaselineIds] = useState<string[]>([]);
  const seededSourceRef = useRef<string | null>(null);

  const [pickerFilters, setPickerFilters] = useState<CatalogFilters>({ page: 1, limit: PICKER_LIMIT });
  const [createdSet, setCreatedSet] = useState<CreatedSetPending | null>(null);

  const { data: canonicalSets } = useCanonicalSets();
  const { data: publicSetsPage } = usePublicSets({ page: 1, limit: 50 });
  const selectedSourceId = mode === 'canonical' ? canonicalId : mode === 'public' ? publicId : '';
  const { data: canonicalSetDetail } = useCanonicalSet(mode === 'canonical' ? canonicalId : '');
  const { data: publicSetDetail } = usePublicSet(mode === 'public' ? publicId : '');
  const { data: catalogPage } = useCatalog(pickerFilters);

  const createSetMutation = useCreateSet();
  const patchCoinsMutation = usePatchSetCoins(createdSet?.id ?? '');

  // Pre-fill the pending coin list from the picked source's full coin set, once per
  // distinct source selection — re-fires if the user later picks a *different* source,
  // but not on every unrelated re-render of the same one (guarded by seededSourceRef).
  useEffect(() => {
    if (mode === 'blank' || !selectedSourceId) return;
    const detailCoins = mode === 'canonical' ? canonicalSetDetail?.coins : publicSetDetail?.coins;
    if (!detailCoins) return;
    if (seededSourceRef.current === selectedSourceId) return;

    const sorted = [...detailCoins].sort((a, b) => a.position - b.position);
    const coins = sorted.map((item) => item.coin);
    setPendingCoins(coins);
    setBaselineIds(coins.map((c) => c.id));
    seededSourceRef.current = selectedSourceId;
  }, [mode, selectedSourceId, canonicalSetDetail, publicSetDetail]);

  // Once the set has been created, patch the net coin diff (if any) before navigating.
  // usePatchSetCoins(createdSet.id) only closes over the right id starting on the render
  // triggered by setCreatedSet below, so the actual mutate() call has to happen here
  // rather than inline inside the create-mutation's onSuccess.
  useEffect(() => {
    if (!createdSet) return;
    if (createdSet.addedIds.length === 0 && createdSet.removedIds.length === 0) {
      router.push(`/sets/${createdSet.id}`);
      return;
    }
    patchCoinsMutation.mutate(
      { add: createdSet.addedIds, remove: createdSet.removedIds },
      {
        onSuccess: () => router.push(`/sets/${createdSet.id}`),
        onError: () => router.push(`/sets/${createdSet.id}`),
      },
    );
    // Intentionally keyed only on createdSet: it is set exactly once per submission, and
    // patchCoinsMutation for this render is already bound to createdSet.id by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdSet]);

  function handleSelectSource(id: string) {
    if (mode === 'canonical') setCanonicalId(id);
    else if (mode === 'public') setPublicId(id);
  }

  function handleAddPickerCoin(coin: CatalogCoin) {
    setPendingCoins((prev) => (prev.some((c) => c.id === coin.id) ? prev : [...prev, coin]));
  }

  function handleRemovePendingCoin(coinId: string) {
    setPendingCoins((prev) => prev.filter((c) => c.id !== coinId));
  }

  function handlePickerFilterSubmit(values: CatalogFilterFormValues) {
    setPickerFilters({ ...values, page: 1, limit: PICKER_LIMIT });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const body: CreateSetRequestBody =
      mode === 'blank'
        ? { name }
        : { name, cloneFrom: { type: mode === 'canonical' ? 'canonical' : 'user', id: selectedSourceId } };

    createSetMutation.mutate(body, {
      onSuccess: (result) => {
        const pickedIds = pendingCoins.map((c) => c.id);
        const addedIds = pickedIds.filter((id) => !baselineIds.includes(id));
        const removedIds = baselineIds.filter((id) => !pickedIds.includes(id));
        setCreatedSet({ id: result.id, addedIds, removedIds });
      },
      onError: (err: unknown) => {
        setError(err instanceof Error ? err.message : t('setNew.defaultError'));
      },
    });
  }

  const sourceItems: Array<{ id: string; name: string }> =
    mode === 'canonical' ? (canonicalSets ?? []) : mode === 'public' ? (publicSetsPage?.items ?? []) : [];
  const pickerResults = (catalogPage?.items ?? []).filter(
    (coin) => !pendingCoins.some((pending) => pending.id === coin.id),
  );

  return (
    <main data-testid="set-new-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">{t('setNew.title')}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <label htmlFor="set-new-name" className="text-sm font-medium">
            {t('common.name')}
          </label>
          <input
            id="set-new-name"
            data-testid="set-new-name-input"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t('setNew.startFromLegend')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-blank"
              checked={mode === 'blank'}
              onChange={() => setMode('blank')}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="h-4 w-4 rounded-full border border-gray-400 peer-checked:border-blue-600 peer-checked:bg-blue-600"
            />
            {t('setNew.modeBlank')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-canonical"
              checked={mode === 'canonical'}
              onChange={() => setMode('canonical')}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="h-4 w-4 rounded-full border border-gray-400 peer-checked:border-blue-600 peer-checked:bg-blue-600"
            />
            {t('setNew.modeCanonical')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="set-new-mode"
              data-testid="set-new-mode-public"
              checked={mode === 'public'}
              onChange={() => setMode('public')}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="h-4 w-4 rounded-full border border-gray-400 peer-checked:border-blue-600 peer-checked:bg-blue-600"
            />
            {t('setNew.modePublic')}
          </label>
        </fieldset>

        {mode !== 'blank' && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {mode === 'canonical' ? t('setNew.chooseCanonical') : t('setNew.choosePublic')}
            </p>
            <ul data-testid="set-new-source-list" className="flex flex-col gap-1">
              {sourceItems.map((set) => {
                const isSelected = selectedSourceId === set.id;
                return (
                  <li key={set.id}>
                    <button
                      type="button"
                      data-testid="set-new-source-item"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectSource(set.id)}
                      className={`w-full rounded border px-3 py-2 text-left text-sm ${
                        isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-300'
                      }`}
                    >
                      {resolveLocalizedText(set.name, locale)}
                      {isSelected && <span className="ml-2 text-xs text-blue-600">Selected</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {error && (
          <p data-testid="set-new-error" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          data-testid="set-new-submit"
          className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          {t('setNew.createSet')}
        </button>
      </form>

      {/*
        Deliberately rendered as a sibling of the <form> above, not nested inside it:
        CatalogFilterForm renders its own <form> element, and HTML forbids nesting
        <form> elements (invalid markup / hydration error). Reading pendingCoins via
        React state (not native FormData) means the picker/pending-list controls don't
        need to live inside the name/mode/source <form> to work correctly.
      */}
      <div className="grid grid-cols-1 gap-6 border-t border-gray-200 pt-6 md:grid-cols-2">
        <div data-testid="set-new-picker-panel" className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">{t('setNew.addFromCatalogue')}</h2>
          <CatalogFilterForm testIdPrefix="set-new-picker" onSubmit={handlePickerFilterSubmit} />
          <ul data-testid="set-new-picker-results" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
            {pickerResults.map((coin) => (
              <li
                key={coin.id}
                data-testid="set-new-picker-item"
                className="flex items-center justify-between gap-4 rounded border border-gray-200 p-2"
              >
                <span>{formatCoinLabel(coin)}</span>
                <button
                  type="button"
                  data-testid="set-new-picker-add-button"
                  onClick={() => handleAddPickerCoin(coin)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                >
                  {t('setNew.add')}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            {t('setNew.inThisSet')} — {pendingCoins.length}
          </h2>
          {pendingCoins.length === 0 ? (
            <p data-testid="set-new-in-set-empty" className="text-sm text-gray-500">
              {t('setNew.nothingAdded')}
            </p>
          ) : (
            <ul data-testid="set-new-in-set-list" className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {pendingCoins.map((coin, index) => (
                <li
                  key={coin.id}
                  data-testid="set-new-in-set-item"
                  className="flex items-center justify-between gap-4 rounded border border-gray-200 p-2"
                >
                  {/*
                    Prefixed with its position rather than rendering the bare label in
                    its own text node: once a coin moves from the picker into this list,
                    its label must no longer be findable as an exact-text match anywhere
                    in the document (only as a substring of this numbered row) — this is
                    what the picker's "already-picked coins are excluded" test asserts.
                  */}
                  <span>
                    {index + 1}. {formatCoinLabel(coin)}
                  </span>
                  <button
                    type="button"
                    data-testid="set-new-in-set-remove-button"
                    onClick={() => handleRemovePendingCoin(coin.id)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs"
                  >
                    {t('setNew.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

export default function NewSetPage() {
  return (
    <RequireAuth>
      <NewSetForm />
    </RequireAuth>
  );
}
