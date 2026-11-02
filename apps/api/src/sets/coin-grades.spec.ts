/**
 * Tests for: COIN_GRADES, CoinGrade, compareGrades, meetsMinGrade (packages/shared)
 * Contract source: runs/run_20261102_194108/plan.md § Interface Contract (Shared: grade scale and helpers)
 * Covers criteria: #3, #4 (from runs/run_20261102_194108/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * packages/shared has no test runner, so these live in apps/api (whose jest maps
 * @coin-collector/shared to packages/shared/src/index.ts), like shared-types.spec.ts.
 * compareGrades is only specified by sign, so assertions use Math.sign.
 */

import { COIN_GRADES, compareGrades, meetsMinGrade } from '@coin-collector/shared';
import type { CoinGrade } from '@coin-collector/shared';

const EXPECTED: CoinGrade[] = ['G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC'];

describe('COIN_GRADES (criterion #3)', () => {
  it('lists the seven adjectival grades from worst to best', () => {
    expect([...COIN_GRADES]).toEqual(EXPECTED);
    expect(COIN_GRADES).toHaveLength(7);
  });

  it('contains no strike type or numeric value', () => {
    expect(COIN_GRADES).not.toContain('Proof');
    expect(COIN_GRADES).not.toContain('PF');
    for (const grade of COIN_GRADES) {
      expect(typeof grade).toBe('string');
      expect(Number.isNaN(Number(grade))).toBe(true);
    }
  });
});

describe('compareGrades (criterion #4)', () => {
  it('returns 0 for equal grades', () => {
    for (const grade of EXPECTED) {
      expect(compareGrades(grade, grade)).toBe(0);
    }
  });

  it('matches the sign of the scale-index difference for all 49 ordered pairs', () => {
    EXPECTED.forEach((a, i) => {
      EXPECTED.forEach((b, j) => {
        expect(Math.sign(compareGrades(a, b))).toBe(Math.sign(i - j));
      });
    });
  });

  it('ranks a lower grade below a higher one and vice versa', () => {
    expect(compareGrades('G', 'UNC')).toBeLessThan(0);
    expect(compareGrades('UNC', 'G')).toBeGreaterThan(0);
    expect(compareGrades('VF', 'XF')).toBeLessThan(0);
    expect(compareGrades('AU', 'XF')).toBeGreaterThan(0);
  });

  it('is antisymmetric', () => {
    for (const a of EXPECTED) {
      for (const b of EXPECTED) {
        expect(Math.sign(compareGrades(a, b))).toBe(-Math.sign(compareGrades(b, a)));
      }
    }
  });
});

describe('meetsMinGrade (criterion #4)', () => {
  it('is true for every grade, and for null, when there is no minimum', () => {
    for (const grade of EXPECTED) {
      expect(meetsMinGrade(grade, null)).toBe(true);
    }
    expect(meetsMinGrade(null, null)).toBe(true);
  });

  it('is false for an ungraded coin against every non-null minimum', () => {
    for (const min of EXPECTED) {
      expect(meetsMinGrade(null, min)).toBe(false);
    }
  });

  it('equals (gradeIndex >= minIndex) for all 49 pairs', () => {
    EXPECTED.forEach((grade, i) => {
      EXPECTED.forEach((min, j) => {
        expect(meetsMinGrade(grade, min)).toBe(i >= j);
      });
    });
  });

  it('gives different answers for a grade just below and just at the minimum', () => {
    expect(meetsMinGrade('F', 'VF')).toBe(false);
    expect(meetsMinGrade('VF', 'VF')).toBe(true);
    expect(meetsMinGrade('XF', 'VF')).toBe(true);
  });
});
