'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { formatCoinLabel } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import CatalogFilterForm, { type CatalogFilterFormValues } from '@/components/catalog/catalog-filter-form';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import type { CatalogFilters } from '@/lib/catalog-api';
import { Skeleton } from '@/components/ui/skeleton';

const ADD_COINS_LIMIT = 20;
const PAGE_WRAPPER_CLASSNAME = 'flex flex-1 flex-col gap-6 p-8';

function SetEditor({ id }: { id: string }) {
  const router = useRouter();

  const { data: set, isLoading: setLoading, isError: setIsError } = usePublicSet(id);
  const { data: gaps, isLoading: gapsLoading, isError: gapsIsError } = useSetGaps(id);
  const { data: userSets } = useUserSets();
  const isOwner = Boolean(userSets?.some((s) => s.id === id));

  const patchCoinsMutation = usePatchSetCoins(id);
  const ownershipMutation = useSetOwnership();
  const renameMutation = useRenameSet();
  const deleteMutation = useDeleteSet();

  const [renameValue, setRenameValue] = useState('');
  const [addCoinsFilters, setAddCoinsFilters] = useState<CatalogFilters>({ page: 1, limit: ADD_COINS_LIMIT });
  const catalogQuery = useCatalog(addCoinsFilters);

  useEffect(() => {
    if (set) setRenameValue(set.name);
  }, [set]);

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

  function handleRenameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    renameMutation.mutate({ id, name: renameValue });
  }

  function handleDelete() {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        router.push('/dashboard');
      },
    });
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
          Something went wrong loading this set. Please try again.
        </p>
      </main>
    );
  }

  if (!set || !gaps) {
    return <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  const sortedSlots = [...gaps.slots].sort((a, b) => a.position - b.position);

  return (
    <main data-testid="set-editor-page" className={PAGE_WRAPPER_CLASSNAME}>
      <h1 data-testid="set-editor-name" className="text-lg font-semibold">
        {set.name}
      </h1>
      <span data-testid="set-editor-completion" className="text-sm text-gray-600">
        {gaps.completionPercent}%
      </span>

      {isOwner && (
        <form data-testid="set-editor-rename-form" onSubmit={handleRenameSubmit} className="flex items-end gap-2">
          <input
            data-testid="set-editor-rename-input"
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            data-testid="set-editor-rename-submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            Rename
          </button>
        </form>
      )}

      {isOwner && (
        <button
          type="button"
          data-testid="set-editor-delete-button"
          onClick={handleDelete}
          className="w-fit rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600"
        >
          Delete set
        </button>
      )}

      <ul data-testid="set-editor-gap-grid" className="flex flex-col gap-2">
        {sortedSlots.map((slot) => (
          <li
            key={slot.id}
            data-testid="set-editor-gap-item"
            className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3"
          >
            <span>{formatCoinLabel(slot.coin)}</span>
            <span data-testid="set-editor-gap-status" className="text-xs text-gray-500">
              {slot.owned ? 'owned' : 'missing'}
            </span>
            {isOwner && (
              <button
                type="button"
                data-testid="set-editor-toggle-owned-button"
                onClick={() => handleToggle(slot.coin.id, slot.owned)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              >
                {slot.owned ? 'Mark not owned' : 'Mark owned'}
              </button>
            )}
            {isOwner && (
              <button
                type="button"
                data-testid="set-editor-remove-button"
                onClick={() => handleRemove(slot.coin.id)}
                className="rounded border border-gray-300 px-2 py-1 text-xs"
              >
                Remove
              </button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <div data-testid="set-editor-add-coins-panel" className="flex flex-col gap-3 rounded border border-gray-200 p-4">
          <h2 className="text-sm font-semibold">Add coins</h2>
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
                  Add
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
