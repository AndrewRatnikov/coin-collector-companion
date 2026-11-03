'use client';

import { useId } from 'react';
import { COIN_GRADES, type CoinGrade } from '@coin-collector/shared';
import type { StatusToggleState } from '@/components/ui/status-toggle';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { gradeOptionLabel, parseGradeValue } from '@/lib/grades';

export interface CoinGradePickerProps {
  layout: 'panel' | 'bar';
  grade: CoinGrade | null;
  onChange: (grade: CoinGrade | null) => void;
  /** The grade save's state. Default 'idle'. */
  state?: StatusToggleState;
}

const FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-700';

/**
 * The owner's grade for this coin: a labelled native <select> with Not set and the seven
 * COIN_GRADES codes. Option values are the neutral codes; only the text is localized. The select
 * stays enabled while a save is pending (marked aria-busy); a failed save shows an alert.
 */
export function CoinGradePicker({ layout, grade, onChange, state = 'idle' }: CoinGradePickerProps) {
  const { t } = useTranslation();
  const id = useId();
  const isBar = layout === 'bar';

  return (
    <div className={isBar ? 'flex w-full flex-col gap-1' : 'mt-2 flex flex-col gap-1'}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className={isBar ? 'sr-only' : 'text-[13px] font-medium text-neutral-700'}>
          {t('grade.label')}
        </label>
        <select
          id={id}
          data-testid={layout === 'bar' ? 'coin-detail-mobile-bar-grade-select' : 'coin-detail-grade-select'}
          value={grade ?? ''}
          aria-busy={state === 'pending' || undefined}
          onChange={(event) => onChange(parseGradeValue(event.target.value))}
          className={`min-h-11 min-w-0 flex-1 cursor-pointer rounded-[var(--radius-md)] border border-neutral-400 bg-white px-2.5 py-1.5 text-sm text-text ${FOCUS_CLASSES}`}
        >
          <option value="">{t('grade.notSet')}</option>
          {COIN_GRADES.map((g) => (
            <option key={g} value={g}>
              {gradeOptionLabel(t, g)}
            </option>
          ))}
        </select>
      </div>
      {state === 'failed' && (
        <p
          role="alert"
          data-testid={layout === 'bar' ? 'coin-detail-mobile-bar-grade-error' : 'coin-detail-grade-error'}
          className="text-[13px] font-medium text-danger"
        >
          {t('grade.saveFailed')}
        </p>
      )}
    </div>
  );
}
