'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { RequireAuth } from '@/components/auth/require-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { WantListTable } from '@/components/want-list/want-list-table';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { buildWantGroups, downloadMissingCsv, getMissingSlots, getUpgradeSlots } from '@/lib/missing-list';
import { fill } from '@/lib/fill-template';
import { gradeShortLabel } from '@/lib/grades';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10';

const ACTION_CLASSES =
  'inline-flex h-9 w-full cursor-pointer items-center justify-center rounded-[var(--radius-md)] border border-neutral-300 bg-white px-3 text-[13px] font-medium text-text hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700 sm:w-auto';

const SECTION_HEADING_CLASSES =
  'font-[family-name:var(--font-heading)] text-[24px] font-semibold leading-tight text-text';

function SetMissingList({ id }: { id: string }) {
  const { t, locale } = useTranslation();
  const { data: set, isLoading: setLoading, isError: setIsError } = usePublicSet(id);
  const { data: gaps, isLoading: gapsLoading, isError: gapsIsError } = useSetGaps(id);

  if (setLoading || gapsLoading) {
    return (
      <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME}>
        <div data-testid="set-missing-loading">
          <Skeleton className="h-6 w-48" />
        </div>
      </main>
    );
  }

  if (setIsError || gapsIsError) {
    return (
      <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME}>
        <p data-testid="set-missing-error" className="text-sm text-danger">
          {t('setEditor.errorLoading')}
        </p>
      </main>
    );
  }

  if (!set || !gaps) {
    return <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  const name = resolveLocalizedText(set.name, locale);
  const missingSlots = getMissingSlots(gaps);
  const upgradeSlots = getUpgradeSlots(gaps);
  const showUpgrade = Boolean(gaps.minGrade) && (gaps.upgradeCount ?? 0) > 0;
  const missingGroups = buildWantGroups(missingSlots.map((slot) => ({ coin: slot.coin })));
  const upgradeGroups = buildWantGroups(
    upgradeSlots.map((slot) => ({ coin: slot.coin, grade: slot.grade, targetGrade: gaps.minGrade })),
  );
  const today = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  const backLabel = fill(t('missingList.backToSet'), { name });

  return (
    <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME}>
      <p className="text-[13px] text-neutral-700 print:hidden">
        <Link
          href={`/sets/${id}`}
          data-testid="set-missing-back-link"
          className="inline-flex min-h-9 items-center hover:text-accent-700 hover:underline"
        >
          {backLabel}
        </Link>
      </p>

      <div data-testid="set-missing-print-region" data-print-region="" className="flex flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h1
              data-testid="set-missing-title"
              className="m-0 font-[family-name:var(--font-heading)] text-[40px] font-semibold leading-[1.1] text-text max-[719px]:text-[30px]"
            >
              {t('missingList.title')}
            </h1>
            <p data-testid="set-missing-set-name" className="text-[15px] font-medium text-text">
              {name}
            </p>
            <p data-testid="set-missing-summary" className="text-sm text-neutral-700">
              <span className="font-mono tabular-nums">{gaps.ownedCount}</span> {t('common.ofSeparator')}{' '}
              <span className="font-mono tabular-nums">{gaps.totalCount}</span> {t('common.owned')} ·{' '}
              <span className="font-mono tabular-nums">{gaps.completionPercent}%</span>
            </p>
            <p data-testid="set-missing-date" className="text-sm text-neutral-700">
              {`${t('missingList.dateLabel')}: ${today}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row print:hidden">
            <button
              type="button"
              data-testid="set-missing-print-button"
              onClick={() => window.print()}
              className={ACTION_CLASSES}
            >
              {t('missingList.printButton')}
            </button>
            <button
              type="button"
              data-testid="set-missing-csv-button"
              onClick={() => downloadMissingCsv(gaps, name)}
              className={ACTION_CLASSES}
            >
              {t('missingList.downloadCsv')}
            </button>
          </div>
        </header>

        {missingSlots.length === 0 && !showUpgrade ? (
          <div data-testid="set-missing-empty" className="flex flex-col gap-2 text-sm text-text">
            <p>{t('missingList.empty')}</p>
            <p>
              <Link
                href={`/sets/${id}`}
                data-testid="set-missing-empty-link"
                className="inline-flex min-h-9 items-center text-accent-700 hover:underline"
              >
                {backLabel}
              </Link>
            </p>
          </div>
        ) : (
          <>
            <section
              data-testid="set-missing-section-missing"
              aria-labelledby="set-missing-heading-missing"
              className="flex flex-col gap-3"
            >
              <h2 id="set-missing-heading-missing" className={SECTION_HEADING_CLASSES}>
                {t('missingList.sectionMissing')}{' '}
                <span data-testid="set-missing-missing-count" className="font-mono text-[15px] tabular-nums text-neutral-800">
                  {missingSlots.length}
                </span>
              </h2>
              {missingSlots.length === 0 ? (
                <p data-testid="set-missing-nothing-missing" className="text-sm text-neutral-800">
                  {t('missingList.nothingMissing')}
                </p>
              ) : (
                <WantListTable groups={missingGroups} plainLabel={t('missingList.plain')} variant="missing" />
              )}
            </section>

            {showUpgrade && gaps.minGrade && (
              <section
                data-testid="set-missing-section-upgrade"
                aria-labelledby="set-missing-heading-upgrade"
                className="flex flex-col gap-3"
              >
                <h2 id="set-missing-heading-upgrade" className={SECTION_HEADING_CLASSES}>
                  {t('missingList.sectionUpgrade')}{' '}
                  <span data-testid="set-missing-upgrade-count" className="font-mono text-[15px] tabular-nums text-neutral-800">
                    {upgradeSlots.length}
                  </span>
                </h2>
                <p data-testid="set-missing-upgrade-note" className="text-xs text-neutral-700">
                  {fill(t('missingList.upgradeNote'), { grade: gradeShortLabel(t, gaps.minGrade) })}
                </p>
                <WantListTable groups={upgradeGroups} plainLabel={t('missingList.plain')} variant="upgrade" />
              </section>
            )}

            <p data-testid="set-missing-legend" className="text-xs text-neutral-700">
              {t('missingList.keyLegend')}
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SetMissingPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    params.then((resolved) => {
      if (!cancelled) setId(resolved.id);
    });
    return () => {
      cancelled = true;
    };
  }, [params]);

  return (
    <RequireAuth>
      {id === null ? (
        <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME} />
      ) : (
        <SetMissingList id={id} />
      )}
    </RequireAuth>
  );
}
