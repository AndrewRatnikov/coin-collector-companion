/**
 * Tests for: coin-page helpers (apps/web/src/lib/coin-page.ts)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Module: coin-page (MODIFY)
 * Covers criteria: #4, #4a, #10 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import {
  catalogCountryHref,
  catalogDenominationHref,
  coinIdFromPathname,
  isCoinId,
  type CoinChecklistLink,
} from '@/lib/coin-page';

describe('catalogDenominationHref', () => {
  it('carries the country and the denomination, encoded', () => {
    expect(catalogDenominationHref('United States', '1 Cent')).toBe(
      '/catalog?country=United+States&denomination=1+Cent',
    );
  });

  it('follows its arguments (not hard-coded)', () => {
    expect(catalogDenominationHref('Ukraine', '10 Hryvnias')).toBe(
      '/catalog?country=Ukraine&denomination=10+Hryvnias',
    );
  });

  it('encodes reserved characters', () => {
    expect(catalogDenominationHref('A&B', '5 c/d')).toBe('/catalog?country=A%26B&denomination=5+c%2Fd');
  });

  it('extends the country link', () => {
    expect(catalogDenominationHref('USA', '1 Cent').startsWith(catalogCountryHref('USA'))).toBe(true);
  });
});

describe('isCoinId', () => {
  it.each([
    '7e57c011-0000-4000-8000-000000000001',
    '7E57C011-0000-4000-8000-00000000000A',
    '00000000-0000-0000-0000-000000000000',
    'abcdef01-2345-6789-abcd-ef0123456789',
  ])('accepts %s', (id) => {
    expect(isCoinId(id)).toBe(true);
  });

  it.each([
    [''],
    ['not-a-uuid'],
    ['coin-1'],
    ['7e57c011-0000-4000-8000-00000000000'],
    ['7e57c011-0000-4000-8000-0000000000011'],
    ['7e57c011-0000-4000-8000-000000000001 '],
    [' 7e57c011-0000-4000-8000-000000000001'],
    ['7e57c011-0000-4000-8000-000000000001-0000'],
    ['7e57c011000040008000000000000001'],
    ['7e57c011-0000-4000-8000-00000000000g'],
    ['../7e57c011-0000-4000-8000-000000000001'],
  ])('rejects %j', (id) => {
    expect(isCoinId(id)).toBe(false);
  });
});

describe('coinIdFromPathname', () => {
  it('returns the single segment after /catalog/', () => {
    expect(coinIdFromPathname('/catalog/abc')).toBe('abc');
    expect(coinIdFromPathname('/catalog/7e57c011-0000-4000-8000-000000000001')).toBe(
      '7e57c011-0000-4000-8000-000000000001',
    );
  });

  it('decodes the segment', () => {
    expect(coinIdFromPathname('/catalog/a%20b')).toBe('a b');
  });

  it.each([['/catalog'], ['/catalog/'], ['/catalog/a/b'], [null]])('returns null for %j', (pathname) => {
    expect(coinIdFromPathname(pathname)).toBeNull();
  });

  it('returns the raw segment for a malformed escape instead of throwing', () => {
    expect(coinIdFromPathname('/catalog/%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('CoinChecklistLink', () => {
  it('is an id and a name', () => {
    const link: CoinChecklistLink = { id: 'c1', name: 'Lincoln Wheat Cents' };
    expect(Object.keys(link).sort()).toEqual(['id', 'name']);
  });
});
