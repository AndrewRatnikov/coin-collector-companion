'use client';

import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';

export default function DashboardPage() {
  const { data: sets, isLoading, isError } = useUserSets();

  const gapQueries = useQueries({
    queries: (sets ?? []).map((set) => ({
      queryKey: ['user-sets', set.id, 'gaps'],
      queryFn: () => getSetGaps(set.id),
      enabled: Boolean(sets),
    })),
  });

  return (
    <RequireAuth>
      <main data-testid="dashboard-page" className="flex flex-1 flex-col gap-6 p-8">
        <h1 className="text-lg font-semibold">Dashboard</h1>

        {isLoading && (
          <div data-testid="dashboard-loading">
            <ListSkeleton />
          </div>
        )}

        {isError && (
          <p data-testid="dashboard-error" className="text-sm text-red-600">
            Something went wrong loading your sets. Please try again.
          </p>
        )}

        {sets &&
          (sets.length === 0 ? (
            <div data-testid="dashboard-empty" className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">You don&apos;t have any sets yet.</p>
              <Link
                href="/sets/new"
                data-testid="dashboard-new-set-cta"
                className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                Start your first set
              </Link>
            </div>
          ) : (
            <ul data-testid="dashboard-set-list" className="flex flex-col gap-2">
              {sets.map((set, index) => {
                const gapsResult = gapQueries[index];
                return (
                  <li
                    key={set.id}
                    data-testid="dashboard-set-item"
                    className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
                  >
                    <Link href={`/sets/${set.id}`} className="underline">
                      {set.name}
                    </Link>
                    <span data-testid="dashboard-set-completion" className="text-sm text-gray-600">
                      {gapsResult?.data ? `${gapsResult.data.completionPercent}%` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          ))}
      </main>
    </RequireAuth>
  );
}
