'use client';

import type { CoinGrade } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { gradeName, gradeShortLabel } from '@/lib/grades';

export interface GradeChipProps {
  grade: CoinGrade;
  /** Default 'grade-chip'. */
  testId?: string;
  className?: string;
}

/**
 * A small outlined pill with the grade's short code (EN `VF`, ES `MBC`) as text and its full
 * name as the title. The text carries the meaning, so it never relies on colour alone.
 */
export function GradeChip({ grade, testId = 'grade-chip', className }: GradeChipProps) {
  const { t } = useTranslation();
  const classes = [
    'inline-flex flex-none items-center rounded-full border border-neutral-400 bg-white px-1.5 text-[11px] font-semibold leading-4 text-neutral-800 no-underline',
    className ?? '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  return (
    <abbr data-testid={testId} data-grade={grade} title={gradeName(t, grade)} className={classes}>
      {gradeShortLabel(t, grade)}
    </abbr>
  );
}
