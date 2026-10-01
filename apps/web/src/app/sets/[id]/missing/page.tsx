'use client';

import { useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { getMissingSlots } from '@/lib/missing-list';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { resolveLocalizedText } from '@/lib/i18n/translate-field';

const PAGE_WRAPPER_CLASSNAME =
  'mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10';

const CELL_CLASSNAME = 'border border-gray-300 px-2 py-1 text-left';

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
        <p data-testid="set-missing-error" className="text-sm text-red-600">
          {t('setEditor.errorLoading')}
        </p>
      </main>
    );
  }

  if (!set || !gaps) {
    return <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME} />;
  }

  const missingSlots = getMissingSlots(gaps);
  const summary = `${gaps.ownedCount} ${t('common.ofSeparator')} ${gaps.totalCount} ${t('common.owned')} (${gaps.completionPercent}%)`;
  const today = new Date().toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <main data-testid="set-missing-page" className={PAGE_WRAPPER_CLASSNAME}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 data-testid="set-missing-title" className="text-lg font-semibold">
            {resolveLocalizedText(set.name, locale)}
          </h1>
          <h2 className="text-base">{t('missingList.heading')}</h2>
          <p data-testid="set-missing-summary" className="text-sm text-gray-600">
            {summary}
          </p>
          <p data-testid="set-missing-date" className="text-sm text-gray-600">
            {`${t('missingList.dateLabel')}: ${today}`}
          </p>
        </div>
        <button
          type="button"
          data-testid="set-missing-print-button"
          onClick={() => window.print()}
          className="w-fit shrink-0 rounded border border-gray-300 px-4 py-2 text-sm font-medium"
        >
          {t('missingList.printButton')}
        </button>
      </div>

      {missingSlots.length === 0 ? (
        <p data-testid="set-missing-empty" className="text-sm">
          {t('missingList.empty')}
        </p>
      ) : (
        <table data-testid="set-missing-table" className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={CELL_CLASSNAME}>{t('common.name')}</th>
              <th className={CELL_CLASSNAME}>{t('common.country')}</th>
              <th className={CELL_CLASSNAME}>{t('common.denomination')}</th>
              <th className={CELL_CLASSNAME}>{t('common.year')}</th>
              <th className={CELL_CLASSNAME}>{t('common.mintMark')}</th>
              <th className={CELL_CLASSNAME}>{t('common.variety')}</th>
              <th className={CELL_CLASSNAME}>{t('missingList.colKeyDate')}</th>
            </tr>
          </thead>
          <tbody>
            {missingSlots.map((slot) => (
              <tr
                key={slot.id}
                data-testid="set-missing-row"
                data-key-date={slot.coin.isKeyDate ? 'true' : 'false'}
                className={slot.coin.isKeyDate ? 'font-semibold' : undefined}
              >
                <td data-testid="set-missing-cell-name" className={CELL_CLASSNAME}>
                  {slot.coin.name}
                </td>
                <td className={CELL_CLASSNAME}>{slot.coin.country}</td>
                <td className={CELL_CLASSNAME}>{slot.coin.denomination}</td>
                <td data-testid="set-missing-cell-year" className={CELL_CLASSNAME}>
                  {slot.coin.year}
                </td>
                <td className={CELL_CLASSNAME}>{slot.coin.mintMark}</td>
                <td className={CELL_CLASSNAME}>{slot.coin.variety}</td>
                <td className={CELL_CLASSNAME}>
                  {slot.coin.isKeyDate && (
                    <span data-testid="set-missing-key-date">{t('missingList.keyDateBadge')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
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
