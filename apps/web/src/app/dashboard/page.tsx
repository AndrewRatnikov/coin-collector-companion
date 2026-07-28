'use client';

import { useQueries } from '@tanstack/react-query';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth/require-auth';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const { data: sets, isLoading, isError } = useUserSets();

  const gapQueries = useQueries({
    queries: (sets ?? []).map((set) => ({
      queryKey: ['user-sets', set.id, 'gaps'],
      queryFn: () => getSetGaps(set.id),
      enabled: Boolean(sets),
    })),
  });

  const hasSets = Boolean(sets && sets.length > 0);
  const allGapsResolved = hasSets && gapQueries.length > 0 && gapQueries.every((query) => query.isSuccess);
  const coinsOwnedTotal = allGapsResolved
    ? gapQueries.reduce((sum, query) => sum + (query.data?.ownedCount ?? 0), 0)
    : null;
  const averageCompletion = allGapsResolved
    ? Math.round(gapQueries.reduce((sum, query) => sum + (query.data?.completionPercent ?? 0), 0) / gapQueries.length)
    : null;

  return (
    <RequireAuth>
      <main
        data-testid="dashboard-page"
        className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-8 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('dashboard.title')}</h1>
        </div>

        {isLoading && (
          <div data-testid="dashboard-loading">
            <ListSkeleton />
          </div>
        )}

        {isError && (
          <p data-testid="dashboard-error" className="text-sm text-red-700">
            {t('dashboard.errorLoadingSets')}
          </p>
        )}

        {sets &&
          (sets.length === 0 ? (
            <div data-testid="dashboard-empty" className="flex flex-col gap-3 border-t border-[var(--color-divider)] pt-6">
              <p className="text-sm text-[var(--color-neutral-600)]">{t('dashboard.emptyMessage')}</p>
              <Link
                href="/sets/new"
                data-testid="dashboard-new-set-cta"
                className="w-fit rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
              >
                {t('dashboard.startFirstSetCta')}
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6 border-y border-[var(--color-divider)] py-6 sm:grid-cols-3">
                <div data-testid="dashboard-stat-sets" className="flex flex-col gap-1">
                  <span className="[font-family:var(--font-heading)] text-[52px] font-normal leading-none tabular-nums">
                    {sets.length}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
                    {t('dashboard.statSets')}
                  </span>
                </div>
                <div data-testid="dashboard-stat-coins-owned" className="flex flex-col gap-1">
                  <span className="[font-family:var(--font-heading)] text-[52px] font-normal leading-none tabular-nums">
                    {coinsOwnedTotal ?? '—'}
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
                    {t('dashboard.statCoinsOwned')}
                  </span>
                </div>
                <div data-testid="dashboard-stat-average-completion" className="flex flex-col gap-1">
                  <span className="[font-family:var(--font-heading)] text-[52px] font-normal leading-none tabular-nums">
                    {averageCompletion ?? '—'}
                    <span className="text-[24px]">%</span>
                  </span>
                  <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]">
                    {t('dashboard.statAverageCompletion')}
                  </span>
                </div>
              </div>

              <ul data-testid="dashboard-set-list" className="flex flex-col border-t border-[var(--color-divider)]">
                {sets.map((set, index) => {
                  const gapsResult = gapQueries[index];
                  return (
                    <li
                      key={set.id}
                      data-testid="dashboard-set-item"
                      className="border-b border-[var(--color-divider)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-text)_3%,transparent)]"
                    >
                      <Link href={`/sets/${set.id}`} className="flex items-center justify-between gap-4 px-1 py-4">
                        <span className="text-[16px] [font-family:var(--font-heading)]">
                          {resolveLocalizedText(set.name, locale)}
                        </span>
                        <span
                          data-testid="dashboard-set-completion"
                          className="[font-family:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-neutral-600)]"
                        >
                          {gapsResult?.data ? `${gapsResult.data.completionPercent}%` : '—'}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          ))}
      </main>
    </RequireAuth>
  );
}
