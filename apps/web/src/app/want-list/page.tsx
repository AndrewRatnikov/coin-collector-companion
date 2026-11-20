'use client';

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type { WantListResponse } from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ServerWakingNotice } from '@/components/ui/server-waking-notice';
import { Skeleton } from '@/components/ui/skeleton';
import { WantListSetsDisclosure } from '@/components/want-list/want-list-sets-disclosure';
import { WantListTable } from '@/components/want-list/want-list-table';
import { useSlowLoading } from '@/lib/hooks/use-slow-loading';
import { useWantList } from '@/lib/hooks/use-user-sets';
import { buildWantGroups, downloadWantListCsv } from '@/lib/missing-list';
import { useTranslation } from '@/lib/i18n/i18n-context';

const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10';

const ACTION_CLASSES =
  'inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-neutral-300 bg-white px-3 text-[13px] font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 sm:w-auto';

const SECTION_HEADING_CLASSES =
  'font-[family-name:var(--font-heading)] text-[24px] font-semibold leading-tight text-text';

const TITLE_CLASSES =
  'm-0 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.1] text-text max-[719px]:text-[30px]';

const FOCUS_RING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

const COUNT_CLASSES = 'font-mono tabular-nums';

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

/** Renders the subtitle template with each {n}/{m}/{k} placeholder as a mono count span. */
function renderSubtitle(template: string, data: WantListResponse): ReactNode[] {
  const counts: Record<string, { testId: string; value: number }> = {
    '{n}': { testId: 'want-list-set-count', value: data.setCount },
    '{m}': { testId: 'want-list-missing-count', value: data.missing.length },
    '{k}': { testId: 'want-list-upgrade-count', value: data.upgrades.length },
  };
  return template.split(/(\{[nmk]\})/).map((part, index) => {
    const count = counts[part];
    if (!count) return <Fragment key={index}>{part}</Fragment>;
    return (
      <span key={index} data-testid={count.testId} className={COUNT_CLASSES}>
        {count.value}
      </span>
    );
  });
}

function WantListContent() {
  const { t } = useTranslation();
  const { data, isLoading, isError, refetch } = useWantList();
  const slow = useSlowLoading(isLoading);

  const title = (
    <h1 data-testid="want-list-title" className={TITLE_CLASSES}>
      {t('wantList.title')}
    </h1>
  );

  if (isError) {
    return (
      <main data-testid="want-list-page" className={PAGE_WRAPPER_CLASSNAME}>
        {title}
        <div
          data-testid="want-list-error"
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-[var(--radius-lg)] border border-danger-line bg-danger-bg px-4 py-[14px] text-danger"
        >
          <AlertIcon />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <b className="font-semibold">{t('wantList.errorTitle')}</b>
            <span className="text-sm">{t('wantList.errorBody')}</span>
          </div>
          <button
            type="button"
            data-testid="want-list-retry"
            onClick={() => void refetch()}
            className={`inline-flex min-h-9 cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-neutral-400 bg-white px-3 text-[13px] font-medium text-text hover:border-accent ${FOCUS_RING}`}
          >
            {t('wantList.retry')}
          </button>
        </div>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main data-testid="want-list-page" className={PAGE_WRAPPER_CLASSNAME}>
        {title}
        <div
          data-testid="want-list-loading"
          aria-busy="true"
          aria-label={t('wantList.loadingLabel')}
          className="flex flex-col gap-3"
        >
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
        <ServerWakingNotice show={slow} />
      </main>
    );
  }

  if (data.setCount === 0) {
    return (
      <main data-testid="want-list-page" className={PAGE_WRAPPER_CLASSNAME}>
        {title}
        <div data-testid="want-list-no-sets" className="flex flex-col gap-2 text-sm text-text">
          <p>{t('wantList.noSets')}</p>
          <p>
            <Link
              href="/sets/new"
              data-testid="want-list-new-set-link"
              className={`inline-flex min-h-9 items-center text-accent-700 underline underline-offset-2 hover:text-accent-800 ${FOCUS_RING}`}
            >
              {t('wantList.newSetLink')}
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const { missing, upgrades } = data;
  const anythingWanted = missing.length + upgrades.length > 0;
  const missingGroups = buildWantGroups(missing.map((w) => ({ coin: w.coin })));
  const upgradeGroups = buildWantGroups(
    upgrades.map((u) => ({ coin: u.coin, grade: u.grade, targetGrade: u.targetGrade })),
  );

  return (
    <main data-testid="want-list-page" className={PAGE_WRAPPER_CLASSNAME}>
      <div data-testid="want-list-print-region" data-print-region="" className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            {title}
            <p data-testid="want-list-subtitle" className="text-sm text-neutral-700">
              {renderSubtitle(t('wantList.subtitle'), data)}
            </p>
          </div>
          {anythingWanted && (
            <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row print:hidden">
              <button
                type="button"
                data-testid="want-list-print-button"
                onClick={() => window.print()}
                className={ACTION_CLASSES}
              >
                {t('wantList.printButton')}
              </button>
              <button
                type="button"
                data-testid="want-list-csv-button"
                onClick={() => downloadWantListCsv(data)}
                className={ACTION_CLASSES}
              >
                {t('wantList.downloadCsv')}
              </button>
            </div>
          )}
        </header>

        {!anythingWanted ? (
          <p data-testid="want-list-nothing" className="text-sm text-text">
            {t('wantList.nothingWanted')}
          </p>
        ) : (
          <>
            <section
              data-testid="want-list-section-missing"
              aria-labelledby="want-list-heading-missing"
              className="flex flex-col gap-3"
            >
              <h2 id="want-list-heading-missing" className={SECTION_HEADING_CLASSES}>
                {t('wantList.sectionMissing')}{' '}
                <span
                  data-testid="want-list-section-missing-count"
                  className="font-mono text-[15px] tabular-nums text-neutral-800"
                >
                  {missing.length}
                </span>
              </h2>
              {missing.length === 0 ? (
                <p data-testid="want-list-missing-none" className="text-sm text-neutral-800">
                  {t('wantList.nothingMissing')}
                </p>
              ) : (
                <>
                  <WantListTable
                    groups={missingGroups}
                    showGroupHeadings
                    plainLabel={t('wantList.plain')}
                    variant="missing"
                  />
                  <WantListSetsDisclosure entries={missing} section="missing" />
                </>
              )}
            </section>

            {upgrades.length > 0 && (
              <section
                data-testid="want-list-section-upgrade"
                aria-labelledby="want-list-heading-upgrade"
                className="flex flex-col gap-3"
              >
                <h2 id="want-list-heading-upgrade" className={SECTION_HEADING_CLASSES}>
                  {t('wantList.sectionUpgrade')}{' '}
                  <span
                    data-testid="want-list-section-upgrade-count"
                    className="font-mono text-[15px] tabular-nums text-neutral-800"
                  >
                    {upgrades.length}
                  </span>
                </h2>
                <p data-testid="want-list-upgrade-note" className="text-xs text-neutral-700">
                  {t('wantList.upgradeNote')}
                </p>
                <WantListTable
                  groups={upgradeGroups}
                  showGroupHeadings
                  plainLabel={t('wantList.plain')}
                  variant="upgrade"
                />
                <WantListSetsDisclosure entries={upgrades} section="upgrade" />
              </section>
            )}

            <p data-testid="want-list-legend" className="text-xs text-neutral-700">
              {t('wantList.keyLegend')}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function WantListPage() {
  return (
    <RequireAuth>
      <WantListContent />
    </RequireAuth>
  );
}
