/**
 * Tests for: lib/grades (grade label helpers) and the grade.* i18n keys
 * Contract source: runs/run_20261102_220909/plan.md § Interface Contract → Module: grades (labels), i18n keys
 * Covers criteria: #9, #10
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { COIN_GRADES, type CoinGrade } from '@coin-collector/shared';
import en, { type MessageKey } from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import {
  GRADE_NAME_KEYS,
  GRADE_SHORT_KEYS,
  gradeName,
  gradeOptionLabel,
  gradeShortLabel,
  parseGradeValue,
} from '@/lib/grades';

const tEn = (key: MessageKey) => en[key];
const tEs = (key: MessageKey) => es[key];

const EN_SHORT: Record<CoinGrade, string> = { G: 'G', VG: 'VG', F: 'F', VF: 'VF', XF: 'XF', AU: 'AU', UNC: 'UNC' };
const ES_SHORT: Record<CoinGrade, string> = {
  G: 'RC',
  VG: 'BC-',
  F: 'BC',
  VF: 'MBC',
  XF: 'EBC',
  AU: 'EBC+',
  UNC: 'SC',
};
const EN_NAME: Record<CoinGrade, string> = {
  G: 'Good',
  VG: 'Very Good',
  F: 'Fine',
  VF: 'Very Fine',
  XF: 'Extremely Fine',
  AU: 'About Uncirculated',
  UNC: 'Uncirculated',
};
const ES_NAME: Record<CoinGrade, string> = {
  G: 'Regular conservación',
  VG: 'Bien conservada (baja)',
  F: 'Bien conservada',
  VF: 'Muy bien conservada',
  XF: 'Extraordinariamente bien conservada',
  AU: 'Extraordinariamente bien conservada (alta)',
  UNC: 'Sin circular',
};

describe('key maps', () => {
  it('maps every grade to its grade.short.* and grade.name.* key', () => {
    for (const g of COIN_GRADES) {
      expect(GRADE_SHORT_KEYS[g]).toBe(`grade.short.${g}`);
      expect(GRADE_NAME_KEYS[g]).toBe(`grade.name.${g}`);
    }
    expect(Object.keys(GRADE_SHORT_KEYS)).toHaveLength(7);
    expect(Object.keys(GRADE_NAME_KEYS)).toHaveLength(7);
  });
});

describe('gradeShortLabel / gradeName', () => {
  it.each(COIN_GRADES)('EN short code and name for %s', (g) => {
    expect(gradeShortLabel(tEn, g)).toBe(EN_SHORT[g]);
    expect(gradeName(tEn, g)).toBe(EN_NAME[g]);
  });

  it.each(COIN_GRADES)('ES abbreviation and name for %s', (g) => {
    expect(gradeShortLabel(tEs, g)).toBe(ES_SHORT[g]);
    expect(gradeName(tEs, g)).toBe(ES_NAME[g]);
  });

  it('gives different results for different grades and locales', () => {
    expect(gradeShortLabel(tEn, 'VF')).not.toBe(gradeShortLabel(tEn, 'XF'));
    expect(gradeShortLabel(tEn, 'VF')).not.toBe(gradeShortLabel(tEs, 'VF'));
  });
});

describe('gradeOptionLabel', () => {
  it('joins the short code and the name with a middle dot (EN)', () => {
    expect(gradeOptionLabel(tEn, 'VF')).toBe('VF · Very Fine');
    expect(gradeOptionLabel(tEn, 'UNC')).toBe('UNC · Uncirculated');
  });

  it('joins the abbreviation and the name (ES)', () => {
    expect(gradeOptionLabel(tEs, 'VF')).toBe('MBC · Muy bien conservada');
    expect(gradeOptionLabel(tEs, 'G')).toBe('RC · Regular conservación');
  });

  it('leaves no unreplaced placeholder', () => {
    for (const g of COIN_GRADES) {
      expect(gradeOptionLabel(tEn, g)).not.toMatch(/[{}]/);
      expect(gradeOptionLabel(tEs, g)).not.toMatch(/[{}]/);
    }
  });
});

describe('parseGradeValue', () => {
  it.each(COIN_GRADES)('returns %s for its own code', (g) => {
    expect(parseGradeValue(g)).toBe(g);
  });

  it('returns null for the empty string (Not set)', () => {
    expect(parseGradeValue('')).toBeNull();
  });

  it('returns null for unknown values, including wrong case and localized codes', () => {
    expect(parseGradeValue('vf')).toBeNull();
    expect(parseGradeValue('MBC')).toBeNull();
    expect(parseGradeValue('MINT')).toBeNull();
  });
});

describe('grade.* dictionary entries (en and es)', () => {
  const KEYS: MessageKey[] = [
    'grade.label',
    'grade.notSet',
    'grade.optionLabel',
    'grade.saveFailed',
    'coinDetail.liveGradeSaved',
    'coinDetail.liveGradeFailed',
    ...COIN_GRADES.map((g) => `grade.short.${g}` as MessageKey),
    ...COIN_GRADES.map((g) => `grade.name.${g}` as MessageKey),
  ];

  it('defines every key with a non-empty string in both locales', () => {
    for (const key of KEYS) {
      expect(en[key].length).toBeGreaterThan(0);
      expect(es[key].length).toBeGreaterThan(0);
    }
  });

  it('has the exact EN and ES copy for the single-string keys', () => {
    expect(en['grade.label']).toBe('Grade');
    expect(es['grade.label']).toBe('Conservación');
    expect(en['grade.notSet']).toBe('Not set');
    expect(es['grade.notSet']).toBe('Sin indicar');
    expect(en['grade.saveFailed']).toBe('Couldn’t save the grade. It was changed back.');
    expect(es['grade.saveFailed']).toBe('No se pudo guardar la conservación. Se ha restaurado la anterior.');
  });

  it('keeps the {title} placeholder in the live messages', () => {
    expect(en['coinDetail.liveGradeSaved']).toBe('Grade saved for {title}.');
    expect(en['coinDetail.liveGradeFailed']).toBe('Couldn’t save the grade for {title}.');
    expect(es['coinDetail.liveGradeSaved']).toBe('Conservación guardada para {title}.');
    expect(es['coinDetail.liveGradeFailed']).toBe('No se pudo guardar la conservación de {title}.');
  });

  it('has the same key set in en and es', () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });
});
