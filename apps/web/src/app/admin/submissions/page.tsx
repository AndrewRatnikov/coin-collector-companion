'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { SubmissionReviewItem } from '@/components/admin/submission-review-item';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { ApiError } from '@/lib/api-client';
import { usePendingSubmissions } from '@/lib/hooks/use-admin';
import { useTranslation } from '@/lib/i18n/i18n-context';

function AdminSubmissionsList() {
  const { t } = useTranslation();
  const { data, isLoading, error } = usePendingSubmissions();
  // A logged-in non-admin reaching this URL gets a 403 from the API: show a clear
  // "not authorized" state instead of a generic failure.
  const isForbidden = error instanceof ApiError && error.status === 403;

  return (
    <main
      data-testid="admin-submissions-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('admin.submissionsTitle')}</h1>

      {isLoading && (
        <div data-testid="admin-submissions-loading">
          <ListSkeleton />
        </div>
      )}

      {isForbidden && (
        <p data-testid="admin-submissions-forbidden" className="text-sm text-[color:var(--color-accent-800)]">
          {t('admin.forbidden')}
        </p>
      )}

      {error && !isForbidden && (
        <p data-testid="admin-submissions-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('admin.errorLoading')}
        </p>
      )}

      {data &&
        !error &&
        (data.items.length === 0 ? (
          <p data-testid="admin-submissions-empty" className="text-sm text-[var(--color-neutral-600)]">
            {t('admin.emptyMessage')}
          </p>
        ) : (
          <ul data-testid="admin-submissions-list" className="flex flex-col border-t border-[var(--color-divider)]">
            {data.items.map((coin) => (
              <SubmissionReviewItem key={coin.id} coin={coin} />
            ))}
          </ul>
        ))}
    </main>
  );
}

export default function AdminSubmissionsPage() {
  return (
    <RequireAuth>
      <AdminSubmissionsList />
    </RequireAuth>
  );
}
