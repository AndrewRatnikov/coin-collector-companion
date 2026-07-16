'use client';

import Link from 'next/link';
import { useUserSets } from '@/lib/hooks/use-user-sets';

function completionPercent(ownedSlots: number, totalSlots: number): number {
  if (totalSlots === 0) return 0;
  return Math.round((ownedSlots / totalSlots) * 100);
}

export default function MySetsPage() {
  const { data: userSets, isLoading, isError, error } = useUserSets();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-xl font-semibold">My Sets</h1>
        <p className="text-sm text-gray-600">Sets you&apos;re pursuing, with progress toward completion.</p>
      </div>

      {isLoading && <p className="text-sm text-gray-600">Loading your sets…</p>}
      {isError && (
        <p role="alert" className="text-sm text-red-600">
          {error instanceof Error ? error.message : 'Failed to load your sets.'}
        </p>
      )}
      {userSets && userSets.length === 0 && (
        <p className="text-sm text-gray-600">
          No sets activated yet. Head to the{' '}
          <Link href="/sets" className="underline">
            set catalog
          </Link>{' '}
          to get started.
        </p>
      )}

      {userSets && userSets.length > 0 && (
        <ul className="flex flex-col gap-2">
          {userSets.map((userSet) => {
            const percent = completionPercent(userSet.ownedSlots, userSet.totalSlots);
            return (
              <li key={userSet.userSetId}>
                <Link
                  href={`/my-sets/${userSet.userSetId}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4 hover:border-gray-300"
                >
                  <div>
                    <p className="font-medium">{userSet.set.name}</p>
                    <p className="text-sm text-gray-600">
                      {userSet.ownedSlots} / {userSet.totalSlots}
                      {userSet.isComplete && <span className="ml-2 font-medium text-green-600">Complete ✓</span>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-gray-700">{percent}%</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
