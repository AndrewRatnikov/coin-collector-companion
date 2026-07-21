/**
 * Tests for: formatCoinLabel
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: shared coin-label formatter
 * Covers criteria: #3 (from prd.md)
 *
 * Relocated from packages/shared/src/index.test.ts (sandbox run 1): that package has no
 * test runner of its own (no vitest devDependency, no test script) and its tsconfig.json's
 * `"include": ["src"]` has no test-file exclude, so `pnpm --filter @coin-collector/shared
 * build`'s `tsc` fails trying to compile a colocated *.test.ts referencing `vitest`. Even
 * if it didn't fail the build, apps/web's vitest config never scans packages/shared, so a
 * test there would silently never run either way. apps/web already depends on
 * @coin-collector/shared and has a working vitest setup, so this exercises the same
 * public export from the actual consumer side instead.
 */

import { describe, expect, it } from 'vitest';
import { formatCoinLabel } from '@coin-collector/shared';
import type { CatalogCoin } from '@coin-collector/shared';

function makeCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'coin-1',
    country: 'USA',
    denomination: '1 Cent',
    year: 1984,
    mintMark: 'D',
    variety: '',
    name: 'Lincoln Memorial Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('formatCoinLabel', () => {
  describe('criterion 3: compact label with mint mark', () => {
    it('renders "{country} {denomination} ({year} {mintMark})" when mintMark is set', () => {
      expect(formatCoinLabel(makeCoin({ country: 'USA', denomination: '1 Cent', year: 1984, mintMark: 'D' }))).toBe(
        'USA 1 Cent (1984 D)',
      );
    });
  });

  describe('criterion 3: compact label without mint mark', () => {
    it('drops the mint mark from the parenthetical when mintMark is an empty string', () => {
      expect(formatCoinLabel(makeCoin({ country: 'USA', denomination: '1 Cent', year: 1984, mintMark: '' }))).toBe(
        'USA 1 Cent (1984)',
      );
    });
  });
});
