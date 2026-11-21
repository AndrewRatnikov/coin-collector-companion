/**
 * Tests for: getDenominationNumeral, getDenominationFaceValue, compareDenominations (packages/shared)
 * Contract source: runs/run_20261121_170400/plan.md § Interface Contract
 * Covers criteria: #1, #2, #3, #4, #5, #6, #7, #8 (from prd.md)
 *
 * Shared has no test runner, so these run from the web app against '@coin-collector/shared'.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import {
  compareDenominations,
  getDenominationFaceValue,
  getDenominationNumeral,
} from '@coin-collector/shared';

const FIXTURE_ORDER = [
  '1 Kopiyka',
  '2 Kopiyky',
  '5 Kopiyok',
  '10 Kopiyok',
  '25 Kopiyok',
  '50 Kopiyok',
  '1 Hryvnia',
  '2 Hryvni',
  '5 Hryvnias',
  '10 Hryvnias',
];

function sorted(list: string[]): string[] {
  return [...list].sort(compareDenominations);
}

describe('getDenominationNumeral', () => {
  it.each([
    ['1 Kopiyka', '1'],
    ['2 Kopiyky', '2'],
    ['5 Kopiyok', '5'],
    ['10 Kopiyok', '10'],
    ['25 Kopiyok', '25'],
    ['50 Kopiyok', '50'],
    ['1 Hryvnia', '1'],
    ['2 Hryvni', '2'],
    ['5 Hryvnias', '5'],
    ['10 Hryvnias', '10'],
    ['Cent', '1'],
    ['Nickel', '5'],
    ['Dime', '10'],
    ['Quarter', '25'],
    ['Half Dollar', '50'],
    ['Dollar', '1'],
    ['2 Euro', '2'],
    ['50 Euro Cent', '50'],
    ['Half 5 Cents', '5'],
  ])('shows the coin own number for %s', (denomination, numeral) => {
    expect(getDenominationNumeral(denomination)).toBe(numeral);
  });

  it('reads US words case-insensitively and ignores surrounding whitespace', () => {
    expect(getDenominationNumeral('NICKEL')).toBe('5');
    expect(getDenominationNumeral('  quarter ')).toBe('25');
    expect(getDenominationNumeral('half dollar')).toBe('50');
  });

  it('keeps a comma decimal as written and falls back to 1 with no number', () => {
    expect(getDenominationNumeral('2,5 Kopiyok')).toBe('2,5');
    expect(getDenominationNumeral('Kopiyok')).toBe('1');
  });
});

describe('getDenominationFaceValue', () => {
  it.each([
    ['1 Kopiyka', 0.01],
    ['2 Kopiyky', 0.02],
    ['5 Kopiyok', 0.05],
    ['10 Kopiyok', 0.1],
    ['25 Kopiyok', 0.25],
    ['50 Kopiyok', 0.5],
    ['1 Hryvnia', 1],
    ['2 Hryvni', 2],
    ['5 Hryvnias', 5],
    ['10 Hryvnias', 10],
    ['2 Euro', 2],
    ['50 Euro Cent', 0.5],
    ['5 Cents', 0.05],
    ['Half 5 Cents', 0.05],
    ['2,5 Kopiyok', 0.025],
    ['Cent', 0.01],
    ['Nickel', 0.05],
    ['Dime', 0.1],
    ['Quarter', 0.25],
    ['Half Dollar', 0.5],
    ['Dollar', 1],
    ['7 Widgets', 7],
    ['Cents', 1],
    ['Kopiyok', 1],
  ])('gives the main-unit value of %s', (denomination, value) => {
    expect(getDenominationFaceValue(denomination)).toBeCloseTo(value, 6);
  });

  it('is case-insensitive', () => {
    expect(getDenominationFaceValue('50 KOPIYOK')).toBeCloseTo(0.5, 6);
    expect(getDenominationFaceValue('50 kopiyok')).toBeCloseTo(0.5, 6);
    expect(getDenominationFaceValue('2 EURO')).toBeCloseTo(2, 6);
  });

  it('does not read Half Dollar as Dollar', () => {
    expect(getDenominationFaceValue('Half Dollar')).toBeLessThan(getDenominationFaceValue('Dollar'));
  });
});

describe('compareDenominations', () => {
  it('orders US words by face value', () => {
    expect(sorted(['Dollar', 'Half Dollar', 'Quarter', 'Dime', 'Nickel', 'Cent'])).toEqual([
      'Cent',
      'Nickel',
      'Dime',
      'Quarter',
      'Half Dollar',
      'Dollar',
    ]);
  });

  it('puts kopiyok before hryvnias', () => {
    expect(compareDenominations('50 Kopiyok', '1 Hryvnia')).toBeLessThan(0);
    expect(compareDenominations('50 Kopiyok', '10 Hryvnias')).toBeLessThan(0);
    expect(compareDenominations('10 Hryvnias', '50 Kopiyok')).toBeGreaterThan(0);
    expect(compareDenominations('1 Hryvnia', '10 Hryvnias')).toBeLessThan(0);
  });

  it('puts 50 Euro Cent before 2 Euro', () => {
    expect(compareDenominations('50 Euro Cent', '2 Euro')).toBeLessThan(0);
    expect(compareDenominations('2 Euro', '50 Euro Cent')).toBeGreaterThan(0);
  });

  it('keeps every fixture string in order, whatever the input order', () => {
    expect(sorted(FIXTURE_ORDER)).toEqual(FIXTURE_ORDER);
    expect(sorted([...FIXTURE_ORDER].reverse())).toEqual(FIXTURE_ORDER);
  });

  it('places Cent between 1 Kopiyka and 2 Kopiyky', () => {
    const result = sorted(['2 Kopiyky', 'Cent', '1 Kopiyka']);
    expect(result).toEqual(['1 Kopiyka', 'Cent', '2 Kopiyky']);
  });

  it('orders the fixtures and US words together by face value', () => {
    const mixed = [
      '10 Hryvnias',
      'Dollar',
      '50 Kopiyok',
      'Half Dollar',
      'Quarter',
      '25 Kopiyok',
      'Dime',
      '10 Kopiyok',
      'Nickel',
      '5 Kopiyok',
      'Cent',
      '1 Kopiyka',
      '2 Euro',
      '2 Hryvni',
      '1 Hryvnia',
      '5 Hryvnias',
      '2 Kopiyky',
      '50 Euro Cent',
    ];
    expect(sorted(mixed)).toEqual([
      '1 Kopiyka',
      'Cent',
      '2 Kopiyky',
      '5 Kopiyok',
      'Nickel',
      '10 Kopiyok',
      'Dime',
      '25 Kopiyok',
      'Quarter',
      '50 Euro Cent',
      '50 Kopiyok',
      'Half Dollar',
      '1 Hryvnia',
      'Dollar',
      '2 Euro',
      '2 Hryvni',
      '5 Hryvnias',
      '10 Hryvnias',
    ]);
  });

  it('breaks exact face-value ties by name', () => {
    expect(compareDenominations('1 Hryvnia', 'Dollar')).toBeLessThan(0);
    expect(compareDenominations('Dollar', '1 Hryvnia')).toBeGreaterThan(0);
    expect(compareDenominations('50 Kopiyok', 'Half Dollar')).toBeLessThan(0);
    expect(compareDenominations('10 Kopiyok', 'Dime')).toBeLessThan(0);
    expect(compareDenominations('5 Kopiyok', 'Nickel')).toBeLessThan(0);
    expect(compareDenominations('25 Kopiyok', 'Quarter')).toBeLessThan(0);
  });

  it('returns 0 only for identical strings', () => {
    expect(compareDenominations('Dime', 'Dime')).toBe(0);
    expect(compareDenominations('10 Kopiyok', '10 Kopiyok')).toBe(0);
    expect(compareDenominations('10 Kopiyok', 'Dime')).not.toBe(0);
  });

  it('is case-insensitive for the value and falls back to name for the tie', () => {
    expect(compareDenominations('50 kopiyok', '50 Kopiyok')).not.toBe(0);
    expect(compareDenominations('50 kopiyok', '1 Hryvnia')).toBeLessThan(0);
    expect(compareDenominations('50 Kopiyok', '1 Hryvnia')).toBeLessThan(0);
    expect(compareDenominations('50 KOPIYOK', '1 hryvnia')).toBeLessThan(0);
  });

  it('keeps comma decimals working', () => {
    expect(sorted(['10 Kopiyok', '2,5 Kopiyok', '2 Kopiyok'])).toEqual(['2 Kopiyok', '2,5 Kopiyok', '10 Kopiyok']);
  });

  it('keeps unparseable strings on first-number-wins', () => {
    expect(compareDenominations('7 Widgets', '3 Widgets')).toBeGreaterThan(0);
    expect(compareDenominations('3 Widgets', '7 Widgets')).toBeLessThan(0);
  });
});
