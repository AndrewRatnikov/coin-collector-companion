'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { UserSetListItem, UserSetsSummaryResponse } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { MySetsEmpty } from '@/components/dashboard/my-sets-empty';
import { MySetsSummary } from '@/components/dashboard/my-sets-summary';
import { NextSetSuggestion } from '@/components/dashboard/next-set-suggestion';
import { SetDeletedNotice } from '@/components/sets/set-deleted-notice';
import { SetCard } from '@/components/ui/set-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSetsSummary, useUserSets } from '@/lib/hooks/use-user-sets';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';
import {
  DEFAULT_MY_SETS_SORT,
  MY_SETS_SORTS,
  getSetSourceKind,
  sortMySets,
  type MySetsSort,
} from '@/lib/my-sets';

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';
const LINK_CLASS = `text-accent-700 underline underline-offset-2 hover:text-accent-800 ${FOCUS_RING}`;
const EYEBROW_CLASS = 'text-xs font-semibold uppercase tracking-[0.06em] text-neutral-800';
const TILE_CLASS =
  'flex min-w-0 flex-col gap-2 rounded-[var(--radius-lg)] bg-surface px-[18px] py-4';
const SET_GRID_CLASS = 'm-0 grid list-none gap-4 p-0';

const SORT_LABEL_KEYS: Record<MySetsSort, MessageKey> = {
  closest: 'dashboard.sortClosest',
  recent: 'dashboard.sortRecent',
  name: 'dashboard.sortName',
  'most-missing': 'dashboard.sortMostMissing',
};

const SOURCE_LABEL_KEYS: Record<'curated' | 'collector', MessageKey> = {
  curated: 'dashboard.sourceCurated',
  collector: 'dashboard.sourceCollector',
};

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-px flex-none text-danger"
    >
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.6" />
      <path d="M10 6v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="10" cy="13.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export default function DashboardPage() {
  const { t, locale } = useTranslation();
  const setsQuery = useUserSets();
  const summaryQuery = useSetsSummary();
  const [sort, setSort] = useState<MySetsSort>(DEFAULT_MY_SETS_SORT);

  const isError = setsQuery.isError || summaryQuery.isError;
  const isLoading = !isError && (setsQuery.isLoading || summaryQuery.isLoading);
  const sets: UserSetListItem[] | undefined = setsQuery.data;
  const summary: UserSetsSummaryResponse | undefined = summaryQuery.data;
  const loaded = !isError && !isLoading && sets !== undefined && summary !== undefined;
  const isEmpty = loaded && sets.length === 0;
  const hasSets = loaded && sets.length > 0;

  function retry() {
    void setsQuery.refetch();
    void summaryQuery.refetch();
  }

  function renderSetGrid(list: UserSetListItem[], singleColumn: boolean) {
    return (
      <ul
        data-testid="dashboard-set-grid"
        className={`${SET_GRID_CLASS} ${
          singleColumn ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]'
        }`}
      >
        {sortMySets(list, sort).map((set) => {
          const sourceKind = getSetSourceKind(set);
          return (
            <li key={set.id} data-testid="dashboard-set-item" className="min-w-0">
              <SetCard
                href={`/sets/${set.id}`}
                name={resolveLocalizedText(set.name, locale)}
                source={sourceKind ? t(SOURCE_LABEL_KEYS[sourceKind]) : undefined}
                ownedCount={set.ownedCount}
                totalCount={set.totalCount}
                nextMissingTitle={set.firstMissing}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <RequireAuth>
      <main
        data-testid="dashboard-page"
        className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-7 px-[clamp(20px,5vw,48px)] py-10 text-text max-[899px]:py-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              data-testid="dashboard-title"
              className="font-heading text-[30px] leading-[1.1] font-semibold lining-nums min-[721px]:text-[40px]"
            >
              {t('dashboard.title')}
            </h1>
            {hasSets && (
              <p data-testid="dashboard-set-count" className="text-neutral-700">
                {sets.length === 1
                  ? t('dashboard.setCountOne')
                  : t('dashboard.setCountMany').split('{n}').join(String(sets.length))}
              </p>
            )}
          </div>
          {!isEmpty && (
            <div className="flex flex-wrap items-center gap-4 max-[899px]:hidden">
              <Link
                data-testid="dashboard-browse-link"
                href="/sets"
                className={`text-sm ${LINK_CLASS}`}
              >
                {t('dashboard.browseLink')}
              </Link>
              <Link
                data-testid="dashboard-new-set"
                href="/sets/new"
                className={`inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] bg-accent-700 px-[18px] text-sm font-medium text-white hover:bg-accent-800 ${FOCUS_RING}`}
              >
                <PlusIcon />
                {t('dashboard.newSet')}
              </Link>
            </div>
          )}
        </div>

        <SetDeletedNotice />

        {isError && (
          <div
            data-testid="dashboard-error"
            role="alert"
            className="flex flex-wrap items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg px-4 py-[14px] text-danger"
          >
            <AlertIcon />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <b className="font-semibold">{t('dashboard.errorTitle')}</b>
              <span className="text-sm">{t('dashboard.errorBody')}</span>
            </div>
            <button
              type="button"
              data-testid="dashboard-retry"
              onClick={retry}
              className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-[13px] font-medium text-text hover:border-accent ${FOCUS_RING}`}
            >
              {t('dashboard.retry')}
            </button>
          </div>
        )}

        {isLoading && (
          <div
            data-testid="dashboard-loading"
            aria-busy="true"
            aria-label={t('dashboard.loadingLabel')}
            className="flex flex-col gap-7"
          >
            <div className="grid grid-cols-2 gap-[10px] min-[900px]:grid-cols-3 min-[900px]:gap-4">
              {Array.from({ length: 3 }, (_, index) => (
                <div
                  key={index}
                  className={`${TILE_CLASS} ${index === 1 ? 'order-last col-span-2 min-[900px]:order-none min-[900px]:col-span-1' : ''}`}
                >
                  <Skeleton className="h-[30px] w-[60px]" />
                  <Skeleton className="h-3 w-[70%]" />
                </div>
              ))}
            </div>
            <ul
              className={`${SET_GRID_CLASS} grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))]`}
            >
              {Array.from({ length: 3 }, (_, index) => (
                <li key={index} className="min-w-0">
                  <SetCard loading href="" name="" ownedCount={0} totalCount={0} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {isEmpty && (
          <div data-testid="dashboard-empty">
            <MySetsEmpty />
          </div>
        )}

        {hasSets && (
          <>
            <MySetsSummary sets={sets} summary={summary} />

            <div className="flex flex-col gap-[14px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <h2 className={EYEBROW_CLASS}>{t('dashboard.yourSets')}</h2>
                  <Link
                    data-testid="dashboard-browse-link-mobile"
                    href="/sets"
                    className={`text-[13px] min-[900px]:hidden ${LINK_CLASS}`}
                  >
                    {t('dashboard.browseLinkShort')}
                  </Link>
                </div>
                <label className="flex items-center gap-2 text-[13px] text-neutral-800">
                  {t('dashboard.sortLabel')}
                  <select
                    data-testid="dashboard-sort"
                    value={sort}
                    onChange={(event) => setSort(event.target.value as MySetsSort)}
                    className="h-9 rounded-[var(--radius-md)] border border-neutral-400 bg-white px-2 text-[13px] text-text focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-200"
                  >
                    {MY_SETS_SORTS.map((value) => (
                      <option key={value} value={value}>
                        {t(SORT_LABEL_KEYS[value])}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {sets.length === 1 && summary.suggestedSet ? (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] items-start gap-4">
                  {renderSetGrid(sets, true)}
                  <NextSetSuggestion suggestion={summary.suggestedSet} />
                </div>
              ) : (
                renderSetGrid(sets, false)
              )}
            </div>
          </>
        )}
      </main>
    </RequireAuth>
  );
}
