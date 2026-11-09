'use client';

import { Fragment, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SetProgressProps {
  /** Testids become `${testIdPrefix}-progress`, `-owned-count`, `-completion`. */
  testIdPrefix: string;
  /** Translated template containing {owned} and {total}. */
  ownedTemplate: string;
  owned: number;
  total: number;
  /** 0–100, shown as `${percent}%` and as the progressbar's aria-valuenow / width. */
  percent: number;
  /** Rendered before the % (only /sets/[id] passes one: its upgrade count). */
  upgradeSlot?: ReactNode;
  /** Extra classes on the root (e.g. grid area). */
  className?: string;
}

/** "{owned} of {total} owned" with both numbers in mono; the text content stays the plain sentence. */
export function OwnedOfTotal({ template, owned, total }: { template: string; owned: number; total: number }) {
  const parts = template.split(/(\{owned\}|\{total\})/);
  return (
    <>
      {parts.map((part, index) => {
        if (part === '{owned}') {
          return (
            <span key={index} className="font-mono text-[22px] font-medium tabular-nums text-text">
              {owned}
            </span>
          );
        }
        if (part === '{total}') {
          return (
            <span key={index} className="font-mono tabular-nums">
              {total}
            </span>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

/** The "X of Y" sentence, completion % and progress bar of a set's header. */
export function SetProgress({
  testIdPrefix,
  ownedTemplate,
  owned,
  total,
  percent,
  upgradeSlot,
  className = '',
}: SetProgressProps) {
  const { t } = useTranslation();
  return (
    <div data-testid={`${testIdPrefix}-progress`} className={`flex min-w-0 flex-col gap-2 ${className}`.trimEnd()}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span data-testid={`${testIdPrefix}-owned-count`} className="text-sm text-neutral-800">
          <OwnedOfTotal template={ownedTemplate} owned={owned} total={total} />
        </span>
        <span className="flex items-baseline gap-3">
          {upgradeSlot}
          <span data-testid={`${testIdPrefix}-completion`} className="font-mono text-sm tabular-nums text-accent-700">
            {percent}%
          </span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t('setEditor.completionLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-[var(--radius-md)] bg-neutral-300"
      >
        <div
          className="h-full rounded-[var(--radius-md)] bg-accent motion-safe:transition-[width] motion-safe:duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Loading placeholder for SetProgress: a text line and a bar. */
export function SetProgressSkeleton({ testId }: { testId: string }) {
  return (
    <div data-testid={testId} className="flex min-w-0 flex-col gap-2">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-2 w-full" />
    </div>
  );
}
