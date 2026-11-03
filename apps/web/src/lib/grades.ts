// Display labels for coin grades. Grades are stored and sent as the neutral COIN_GRADES codes;
// only these helpers turn them into localized text (EN codes, ES abbreviations, full names).

import { COIN_GRADES, type CoinGrade } from '@coin-collector/shared';
import type { MessageKey } from '@/lib/i18n/locales/en';

/** The `t` from useTranslation(); tests can pass `(key) => es[key]`. */
type Translate = (key: MessageKey) => string;

export const GRADE_SHORT_KEYS: Record<CoinGrade, MessageKey> = {
  G: 'grade.short.G',
  VG: 'grade.short.VG',
  F: 'grade.short.F',
  VF: 'grade.short.VF',
  XF: 'grade.short.XF',
  AU: 'grade.short.AU',
  UNC: 'grade.short.UNC',
};

export const GRADE_NAME_KEYS: Record<CoinGrade, MessageKey> = {
  G: 'grade.name.G',
  VG: 'grade.name.VG',
  F: 'grade.name.F',
  VF: 'grade.name.VF',
  XF: 'grade.name.XF',
  AU: 'grade.name.AU',
  UNC: 'grade.name.UNC',
};

/** The short code shown on chips: `VF` in English, `MBC` in Spanish. */
export function gradeShortLabel(t: Translate, grade: CoinGrade): string {
  return t(GRADE_SHORT_KEYS[grade]);
}

/** The full grade name, e.g. `Very Fine`. */
export function gradeName(t: Translate, grade: CoinGrade): string {
  return t(GRADE_NAME_KEYS[grade]);
}

/** A picker option's text, e.g. `VF · Very Fine`. */
export function gradeOptionLabel(t: Translate, grade: CoinGrade): string {
  return t('grade.optionLabel')
    .split('{short}')
    .join(gradeShortLabel(t, grade))
    .split('{name}')
    .join(gradeName(t, grade));
}

/** A `<select>` value back to a grade: one of COIN_GRADES, otherwise null (`''` is Not set). */
export function parseGradeValue(value: string): CoinGrade | null {
  return (COIN_GRADES as readonly string[]).includes(value) ? (value as CoinGrade) : null;
}
