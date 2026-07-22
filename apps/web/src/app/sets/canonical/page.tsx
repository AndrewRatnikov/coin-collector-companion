'use client';

import Link from 'next/link';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { ListSkeleton } from '@/components/ui/list-skeleton';

export default function CanonicalSetsPage() {
  const { data, isLoading, isError } = useCanonicalSets();

  return (
    <main data-testid="canonical-sets-page" className="flex flex-1 flex-col gap-6 p-8">
      <h1 className="text-lg font-semibold">Canonical sets</h1>

      {isLoading && (
        <div data-testid="canonical-sets-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="canonical-sets-error" className="text-sm text-red-600">
          Something went wrong loading canonical sets. Please try again.
        </p>
      )}

      {data &&
        (data.length === 0 ? (
          <p data-testid="canonical-sets-empty" className="text-sm text-gray-600">
            No canonical sets yet.
          </p>
        ) : (
          <ul data-testid="canonical-sets-list" className="flex flex-col gap-2">
            {data.map((set) => (
              <li key={set.id} data-testid="canonical-set-item" className="rounded-lg border border-gray-200 p-4">
                <Link href={`/sets/canonical/${set.id}`} className="underline">
                  {set.name}
                </Link>
                {set.description && <p className="text-sm text-gray-600">{set.description}</p>}
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}
