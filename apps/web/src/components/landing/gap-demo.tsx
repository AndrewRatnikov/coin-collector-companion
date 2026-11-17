'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { GapSlot } from '@coin-collector/shared';
import { Badge } from '@/components/ui/badge';
import { CoinCard } from '@/components/ui/coin-card';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { fill } from '@/lib/fill-template';
import { collectorLabel, LINCOLN_SAMPLE_SET_NAME } from '@/lib/landing/lincoln-sample';

/** The demo switches itself to Missing this long after mount, unless the visitor acted first. */
export const DEMO_AUTO_SWITCH_MS = 2500;

export interface GapDemoProps {
  /** The sample with its current ownership (24 coins, or the 12-coin 1909-1912 slice on mobile). */
  slots: GapSlot[];
  /** false (default) = variant A, read-only cards; true = variant B, cards toggle in local state. */
  interactive?: boolean;
  /** Variant B: called with the coin id of a tapped card. */
  onToggle?: (coinId: string) => void;
  /** Under 900px: the short sample label and subtitle. */
  compact?: boolean;
  /** {total} in the subtitle: the coin count of the real Lincoln Wheat Cents checklist. */
  setCoinCount: number;
  fullChecklistHref: string;
}

type DemoFilter = 'all' | 'missing';

interface YearGroup {
  year: number;
  slots: GapSlot[];
  owned: number;
}

function groupByYear(slots: readonly GapSlot[]): YearGroup[] {
  const groups: YearGroup[] = [];
  for (const slot of slots) {
    let group = groups.find((g) => g.year === slot.coin.year);
    if (!group) {
      group = { year: slot.coin.year, slots: [], owned: 0 };
      groups.push(group);
    }
    group.slots.push(slot);
    if (slot.owned) group.owned += 1;
  }
  return groups;
}

const SEGMENT_CLASSES =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[var(--radius-md)] px-3 text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/**
 * The sample checklist panel: progress, the All / Missing switch and the cards grouped by year.
 * Network-free: everything comes from `slots`. Variant A shows read-only cards; variant B
 * (`interactive`) puts a StatusToggle on each card and reports taps through `onToggle`.
 */
export function GapDemo({
  slots,
  interactive = false,
  onToggle,
  compact = false,
  setCoinCount,
  fullChecklistHref,
}: GapDemoProps) {
  const { t } = useTranslation();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [filter, setFilter] = useState<DemoFilter>('all');
  // True once the visitor acted or the auto-switch ran: no (further) automatic switch.
  const [settled, setSettled] = useState(false);
  const [note, setNote] = useState<'auto' | null>(null);
  const [tapped, setTapped] = useState(false);

  useEffect(() => {
    if (settled || reducedMotion) return undefined;
    const timer = setTimeout(() => {
      setFilter('missing');
      setNote('auto');
      setSettled(true);
    }, DEMO_AUTO_SWITCH_MS);
    return () => clearTimeout(timer);
  }, [settled, reducedMotion]);

  function chooseFilter(next: DemoFilter) {
    setSettled(true);
    setNote(null);
    setFilter(next);
  }

  function handleToggle(coinId: string) {
    setSettled(true);
    setNote(null);
    setTapped(true);
    onToggle?.(coinId);
  }

  const total = slots.length;
  const ownedCount = slots.filter((slot) => slot.owned).length;
  const missingCount = total - ownedCount;
  const percent = total === 0 ? 0 : Math.round((ownedCount / total) * 100);
  const years = slots.map((slot) => slot.coin.year);
  const from = years.length > 0 ? Math.min(...years) : 0;
  const to = years.length > 0 ? Math.max(...years) : 0;

  const groups = groupByYear(slots)
    .map((group) => ({
      ...group,
      shown: filter === 'missing' ? group.slots.filter((slot) => !slot.owned) : group.slots,
    }))
    .filter((group) => group.shown.length > 0);

  let noteText = '';
  if (note === 'auto') noteText = t('landing.autoNote');
  else if (reducedMotion && !settled && filter === 'all') noteText = t('landing.tapNote');

  const subtitle = compact
    ? fill(t('landing.demoSubtitleShort'), { from, to })
    : fill(t('landing.demoSubtitle'), { shown: total, total: setCoinCount });

  return (
    <section
      data-testid="gap-demo"
      data-filter={filter}
      aria-labelledby="gap-demo-title"
      className="flex min-w-0 flex-col gap-[18px] rounded-[7px] border border-neutral-300 bg-white px-[26px] pt-6 pb-7 max-[599px]:px-4 max-[599px]:pt-4 max-[599px]:pb-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dashed border-neutral-300 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[13px] text-neutral-700">
          <Badge variant="in-set">{t('landing.sampleBadge')}</Badge>
          <span>{compact ? t('landing.sampleLabelShort') : t('landing.sampleLabel')}</span>
        </div>
        {interactive && (
          <span data-testid="gap-demo-try-hint" className="text-[13px] font-medium text-accent-700">
            {t('landing.tryHint')}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 id="gap-demo-title" className="text-[32px] leading-[1.1] text-text">
            {LINCOLN_SAMPLE_SET_NAME}
          </h2>
          <p data-testid="gap-demo-subtitle" className="mt-1 text-[13px] text-neutral-700">
            {subtitle}
          </p>
        </div>
        <div className="flex w-full max-w-[240px] flex-col gap-1.5 min-[600px]:w-[240px]">
          <div className="flex items-baseline justify-between gap-3">
            <p data-testid="gap-demo-owned" className="text-[13px] text-neutral-800">
              <span className="font-mono text-[22px] font-medium text-text">{ownedCount}</span>{' '}
              {t('landing.ownedOf')} {total} {t('landing.ownedWord')}
            </p>
            <span data-testid="gap-demo-percent" className="font-mono text-[15px] font-medium text-accent-700">
              {percent}%
            </span>
          </div>
          <div
            data-testid="gap-demo-progress"
            role="progressbar"
            aria-label={t('landing.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2 overflow-hidden rounded-full bg-neutral-200"
          >
            <div className="h-full rounded-full bg-accent-700" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-neutral-700">{t('landing.showLabel')}</span>
          <div className="inline-flex gap-1 rounded-[var(--radius-md)] border border-neutral-300 bg-neutral-100 p-0.5">
            <button
              type="button"
              data-testid="gap-demo-filter-all"
              aria-pressed={filter === 'all'}
              onClick={() => chooseFilter('all')}
              className={`${SEGMENT_CLASSES} ${filter === 'all' ? 'bg-white text-text shadow-sm' : 'text-neutral-700'}`}
            >
              {t('landing.filterAll')}
              <span className="font-mono text-xs">{total}</span>
            </button>
            <button
              type="button"
              data-testid="gap-demo-filter-missing"
              aria-pressed={filter === 'missing'}
              onClick={() => chooseFilter('missing')}
              className={`${SEGMENT_CLASSES} ${filter === 'missing' ? 'bg-white text-text shadow-sm' : 'text-neutral-700'}`}
            >
              {t('landing.filterMissing')}
              <span className="font-mono text-xs">{missingCount}</span>
            </button>
          </div>
        </div>
        <p data-testid="gap-demo-note" role="status" aria-live="polite" className="text-[13px] text-neutral-700">
          {noteText}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-7 gap-y-[22px] min-[600px]:grid-cols-2">
        {groups.map((group) => (
          <section key={group.year} data-testid="gap-demo-group" data-year={group.year} aria-label={String(group.year)}>
            <div className="mb-2 flex items-baseline gap-3 border-b border-neutral-300 pb-1">
              <span className="font-mono text-[17px] font-medium text-text">{group.year}</span>
              <span data-testid="gap-demo-group-summary" className="text-xs text-neutral-700">
                {fill(t('landing.groupSummary'), { owned: group.owned, total: group.slots.length })}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-2 min-[900px]:grid-cols-4">
              {group.shown.map((slot) => {
                const label = collectorLabel(slot.coin);
                return (
                  <li key={slot.id}>
                    <CoinCard
                      coin={slot.coin}
                      owned={slot.owned}
                      density="compact"
                      titleOverride={label}
                      linkToCoin={false}
                      readOnly={!interactive}
                      ownedStatusLabel={t('landing.statusOwned')}
                      missingStatusLabel={t('landing.statusMissing')}
                      toggleLabel={fill(t(slot.owned ? 'landing.markMissing' : 'landing.markOwned'), { coin: label })}
                      onToggle={() => handleToggle(slot.coin.id)}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {interactive && tapped && (
        <p data-testid="gap-demo-save-note" className="rounded-[var(--radius-md)] bg-accent-100 px-4 py-3 text-sm text-accent-800">
          {t('landing.saveNote')}{' '}
          <Link
            href="/signup"
            data-testid="gap-demo-save-link"
            className="font-medium underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
          >
            {t('landing.ctaPrimary')}
          </Link>
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-neutral-300 pt-3 text-[13px]">
        <span className="text-neutral-700">{fill(t('landing.demoFoot'), { from, to })}</span>
        <Link
          href={fullChecklistHref}
          data-testid="gap-demo-full-link"
          className="font-medium text-accent-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700"
        >
          {t('landing.seeFull')}
        </Link>
      </div>
    </section>
  );
}
