/**
 * Tests for: import-grades (GRADE_ALIASES, parseImportGrade, rowGrade, collectGradeWarnings)
 * Contract source: runs/run_20261104_064643/plan.md § Approach 2 and § Interface Contract (API module: import-grades.ts)
 * Covers criteria: #4, #5, #6, #10, #12 (from runs/run_20261104_064643/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { COIN_GRADES } from '@coin-collector/shared';
import { GRADE_ALIASES, collectGradeWarnings, parseImportGrade, rowGrade } from './import-grades';

describe('GRADE_ALIASES', () => {
  it('has exactly the documented lower-case keys', () => {
    expect(GRADE_ALIASES).toEqual({
      g: 'G',
      vg: 'VG',
      f: 'F',
      vf: 'VF',
      xf: 'XF',
      au: 'AU',
      unc: 'UNC',
      ef: 'XF',
      bu: 'UNC',
      ms: 'UNC',
      aunc: 'AU',
      rc: 'G',
      'bc-': 'VG',
      bc: 'F',
      mbc: 'VF',
      ebc: 'XF',
      'ebc+': 'AU',
      sc: 'UNC',
    });
  });

  it('only maps to neutral COIN_GRADES values', () => {
    for (const value of Object.values(GRADE_ALIASES)) {
      expect(COIN_GRADES).toContain(value);
    }
  });
});

describe('parseImportGrade', () => {
  it.each([
    ['G', 'G'],
    ['VG', 'VG'],
    ['F', 'F'],
    ['VF', 'VF'],
    ['XF', 'XF'],
    ['AU', 'AU'],
    ['UNC', 'UNC'],
  ])('keeps the English grade %s as %s', (raw, grade) => {
    expect(parseImportGrade(raw)).toEqual({ kind: 'grade', grade });
  });

  it.each([
    ['RC', 'G'],
    ['BC-', 'VG'],
    ['BC', 'F'],
    ['MBC', 'VF'],
    ['EBC', 'XF'],
    ['EBC+', 'AU'],
    ['SC', 'UNC'],
  ])('maps the Spanish abbreviation %s to %s', (raw, grade) => {
    expect(parseImportGrade(raw)).toEqual({ kind: 'grade', grade });
  });

  it.each([
    ['EF', 'XF'],
    ['BU', 'UNC'],
    ['MS', 'UNC'],
    ['aUNC', 'AU'],
  ])('maps the alias %s to %s', (raw, grade) => {
    expect(parseImportGrade(raw)).toEqual({ kind: 'grade', grade });
  });

  it('ignores case', () => {
    expect(parseImportGrade('vf')).toEqual({ kind: 'grade', grade: 'VF' });
    expect(parseImportGrade('Vf')).toEqual({ kind: 'grade', grade: 'VF' });
    expect(parseImportGrade('mbc')).toEqual({ kind: 'grade', grade: 'VF' });
    expect(parseImportGrade('Ebc+')).toEqual({ kind: 'grade', grade: 'AU' });
    expect(parseImportGrade('AUNC')).toEqual({ kind: 'grade', grade: 'AU' });
  });

  it('trims surrounding whitespace', () => {
    expect(parseImportGrade('  xf  ')).toEqual({ kind: 'grade', grade: 'XF' });
    expect(parseImportGrade('\tUNC\n')).toEqual({ kind: 'grade', grade: 'UNC' });
  });

  it('distinguishes neighbouring values (different inputs, different outputs)', () => {
    expect(parseImportGrade('BC')).not.toEqual(parseImportGrade('BC-'));
    expect(parseImportGrade('EBC')).not.toEqual(parseImportGrade('EBC+'));
    expect(parseImportGrade('F')).not.toEqual(parseImportGrade('VF'));
  });

  it('returns empty for an empty or whitespace-only cell', () => {
    expect(parseImportGrade('')).toEqual({ kind: 'empty' });
    expect(parseImportGrade('   ')).toEqual({ kind: 'empty' });
    expect(parseImportGrade('\t \n')).toEqual({ kind: 'empty' });
  });

  it.each([
    ['MS-65', 'MS-65'],
    ['Proof', 'Proof'],
    ['AG', 'AG'],
    ['G "4"', 'G "4"'],
    ['shiny', 'shiny'],
    ['E F', 'E F'],
  ])('returns unrecognised for %j with the value kept in its original case', (raw, value) => {
    expect(parseImportGrade(raw)).toEqual({ kind: 'unrecognised', value });
  });

  it('puts the trimmed original text (original case) into the unrecognised value', () => {
    expect(parseImportGrade('  Shiny  ')).toEqual({ kind: 'unrecognised', value: 'Shiny' });
  });

  it('does not collapse inner whitespace, strip accents or match partially', () => {
    expect(parseImportGrade('V  G').kind).toBe('unrecognised');
    expect(parseImportGrade('MBC ').kind).toBe('grade');
    expect(parseImportGrade('ébc').kind).toBe('unrecognised');
    expect(parseImportGrade('VGG').kind).toBe('unrecognised');
    expect(parseImportGrade('XF-45').kind).toBe('unrecognised');
  });
});

describe('rowGrade', () => {
  it('returns null when the grade column is not mapped, even if a cell holds a valid grade', () => {
    expect(rowGrade(['1950', 'USA', 'VF'], { year: 0, country: 1 })).toBeNull();
    expect(rowGrade(['1950', 'USA', 'VF'], {})).toBeNull();
  });

  it('reads the mapped column and normalises it', () => {
    expect(rowGrade(['1950', 'USA', 'mbc'], { year: 0, country: 1, grade: 2 })).toBe('VF');
    expect(rowGrade(['1950', 'EF', 'USA'], { year: 0, grade: 1 })).toBe('XF');
  });

  it('uses the mapped index, so another index gives another grade', () => {
    const values = ['G', 'UNC'];
    expect(rowGrade(values, { grade: 0 })).toBe('G');
    expect(rowGrade(values, { grade: 1 })).toBe('UNC');
  });

  it('returns null for an empty or whitespace cell', () => {
    expect(rowGrade(['1950', ''], { year: 0, grade: 1 })).toBeNull();
    expect(rowGrade(['1950', '   '], { year: 0, grade: 1 })).toBeNull();
  });

  it('returns null for an unrecognised cell', () => {
    expect(rowGrade(['1950', 'MS-65'], { year: 0, grade: 1 })).toBeNull();
  });

  it('returns null when the row is shorter than the mapped index', () => {
    expect(rowGrade(['1950'], { year: 0, grade: 3 })).toBeNull();
  });
});

describe('collectGradeWarnings', () => {
  const rows = [
    { line: 2, values: ['1950', 'VF'] },
    { line: 3, values: ['1951', 'shiny'] },
    { line: 4, values: ['1952', ''] },
    { line: 5, values: ['1953', '  MS-65  '] },
    { line: 6, values: ['1954', 'Proof'] },
  ];

  it('returns [] when the grade column is not mapped', () => {
    expect(collectGradeWarnings(rows, { year: 0 })).toEqual([]);
  });

  it('returns one warning per unrecognised non-empty cell, in input order, with the trimmed original value', () => {
    expect(collectGradeWarnings(rows, { year: 0, grade: 1 })).toEqual([
      { line: 3, code: 'grade_not_recognised', value: 'shiny' },
      { line: 5, code: 'grade_not_recognised', value: 'MS-65' },
      { line: 6, code: 'grade_not_recognised', value: 'Proof' },
    ]);
  });

  it('produces no warning for recognised or empty cells', () => {
    const ok = [
      { line: 2, values: ['1950', 'VF'] },
      { line: 3, values: ['1951', ''] },
      { line: 4, values: ['1952', '   '] },
      { line: 5, values: ['1953', 'EBC+'] },
    ];
    expect(collectGradeWarnings(ok, { year: 0, grade: 1 })).toEqual([]);
  });

  it('follows the mapped index', () => {
    const r = [{ line: 2, values: ['shiny', 'VF'] }];
    expect(collectGradeWarnings(r, { grade: 0 })).toHaveLength(1);
    expect(collectGradeWarnings(r, { grade: 1 })).toHaveLength(0);
  });

  it('returns [] for no rows', () => {
    expect(collectGradeWarnings([], { grade: 0 })).toEqual([]);
  });
});
