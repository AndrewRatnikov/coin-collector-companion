'use client';

import { useState } from 'react';
import { useActivateSet, useTemplateSets } from '@/lib/hooks/use-sets';
import type { SetListItem } from '@/lib/sets-api';

function formatDenomination(denomination: string): string {
  return denomination.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function groupByCategory(sets: SetListItem[]): [string, SetListItem[]][] {
  const groups = new Map<string, SetListItem[]>();
  for (const set of sets) {
    const group = groups.get(set.category) ?? [];
    group.push(set);
    groups.set(set.category, group);
  }
  return Array.from(groups.entries());
}

export default function SetCatalogPage() {
  const { data: sets, isLoading, isError, error } = useTemplateSets();
  const activateMutation = useActivateSet();
  const [activatedIds, setActivatedIds] = useState<Set<string>>(new Set());

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">Set Catalog</h1>
        <p className="text-sm text-gray-600">Activate a template to start tracking its gap view.</p>
      </div>

      {isLoading && <p className="text-sm text-gray-600">Loading sets…</p>}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load sets.'}
        </p>
      )}
      {sets && sets.length === 0 && <p className="text-sm text-gray-600">No set templates available yet.</p>}

      {sets &&
        groupByCategory(sets).map(([category, categorySets]) => (
          <section key={category} className="flex flex-col gap-3">
            <h2 className="text-sm font-medium tracking-wide text-gray-500 uppercase">{category}</h2>
            <ul className="flex flex-col gap-2">
              {categorySets.map((set) => {
                const isActivated = activatedIds.has(set.id);
                const isPending = activateMutation.isPending && activateMutation.variables === set.id;
                return (
                  <li
                    key={set.id}
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <div>
                      <p className="font-medium">{set.name}</p>
                      <p className="text-sm text-gray-600">{formatDenomination(set.denomination)}</p>
                    </div>
                    {isActivated ? (
                      <span className="shrink-0 text-sm font-medium text-green-600">Activated ✓</span>
                    ) : (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() =>
                          activateMutation.mutate(set.id, {
                            onSuccess: () => setActivatedIds((prev) => new Set(prev).add(set.id)),
                          })
                        }
                        className="shrink-0 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                      >
                        {isPending ? 'Activating…' : 'Activate'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </main>
  );
}
