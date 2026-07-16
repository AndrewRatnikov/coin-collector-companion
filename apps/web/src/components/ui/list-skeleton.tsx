import { Skeleton } from '@/components/ui/skeleton';

// Placeholder rows shown while a list query is loading — the first fetch after
// Render's free-tier API has been idle can take ~30-60s (PRD §10), so a static
// "Loading…" line reads as stuck; a skeleton communicates progress instead.
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li
          key={index}
          className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-4"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-20 shrink-0" />
        </li>
      ))}
    </ul>
  );
}
