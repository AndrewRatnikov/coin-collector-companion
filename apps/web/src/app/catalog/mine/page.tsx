'use client';

import Link from 'next/link';
import { formatCoinLabel } from '@coin-collector/shared';
import type { CatalogCoin, CoinStatus } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useMySubmissions } from '@/lib/hooks/use-catalog';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

const STATUS_LABEL_KEY: Record<CoinStatus, MessageKey> = {
  pending: 'mySubmissions.statusPending',
  approved: 'mySubmissions.statusApproved',
  rejected: 'mySubmissions.statusRejected',
};

function MySubmissionsList() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useMySubmissions();

  return (
    <main
      data-testid="my-submissions-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('mySubmissions.title')}</h1>

      {isLoading && (
        <div data-testid="my-submissions-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="my-submissions-error" className="text-sm text-[color:var(--color-accent-800)]">
          {t('mySubmissions.errorLoading')}
        </p>
      )}

      {data &&
        (data.items.length === 0 ? (
          <p data-testid="my-submissions-empty" className="text-sm text-[var(--color-neutral-600)]">
            {t('mySubmissions.emptyMessage')}
          </p>
        ) : (
          <ul data-testid="my-submissions-list" className="flex flex-col border-t border-[var(--color-divider)]">
            {data.items.map((coin: CatalogCoin) => (
              <li
                key={coin.id}
                data-testid="my-submissions-item"
                className="flex items-center justify-between gap-4 border-b border-[var(--color-divider)] px-1 py-4"
              >
                <Link
                  href={`/catalog/${coin.id}`}
                  className="text-sm text-[var(--color-text)] transition-colors hover:text-[var(--color-accent)]"
                >
                  {formatCoinLabel(coin)}
                </Link>
                <span
                  data-testid="my-submissions-status-badge"
                  className="w-fit rounded-[2px] bg-[color:var(--color-accent-100)] px-2 py-1 text-xs font-medium text-[color:var(--color-accent-800)]"
                >
                  {t(STATUS_LABEL_KEY[coin.status])}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </main>
  );
}

export default function MySubmissionsPage() {
  return (
    <RequireAuth>
      <MySubmissionsList />
    </RequireAuth>
  );
}
