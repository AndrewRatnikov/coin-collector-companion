/**
 * Tests for: CanonicalSetsPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CanonicalSetsPage
 * Covers criteria: #8 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CanonicalSetsPage from '@/app/sets/canonical/page';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

const useCanonicalSetsMock = vi.mocked(useCanonicalSets);

function queryResult(overrides: Partial<ReturnType<typeof useCanonicalSets>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCanonicalSets>;
}

const SETS = [
  { id: 's1', name: 'Lincoln Wheat Cent Key Dates', description: 'The key dates only', source: 'seed-template', templateVersion: 'v1' },
  { id: 's2', name: 'Lincoln Wheat Cents', description: 'Every year', source: 'seed-template', templateVersion: 'v1' },
];

describe('CanonicalSetsPage', () => {
  beforeEach(() => {
    useCanonicalSetsMock.mockReset();
  });

  describe('rendering', () => {
    it('renders the page root', () => {
      useCanonicalSetsMock.mockReturnValue(queryResult());
      render(<CanonicalSetsPage />);
      expect(screen.getByTestId('canonical-sets-page')).toBeInTheDocument();
    });
  });

  describe('criterion 8: shows a loading state while the canonical-sets query is loading', () => {
    it('renders canonical-sets-loading and no list while isLoading is true', () => {
      useCanonicalSetsMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CanonicalSetsPage />);

      expect(screen.getByTestId('canonical-sets-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('canonical-sets-list')).not.toBeInTheDocument();
    });
  });

  describe('criterion 8: shows an error state when the query fails', () => {
    it('renders canonical-sets-error when isError is true', () => {
      useCanonicalSetsMock.mockReturnValue(queryResult({ isError: true }));
      render(<CanonicalSetsPage />);

      expect(screen.getByTestId('canonical-sets-error')).toBeInTheDocument();
    });
  });

  describe('criterion 8: renders the list of canonical sets', () => {
    it('renders one canonical-set-item per set, each linking to its detail page', () => {
      useCanonicalSetsMock.mockReturnValue(queryResult({ data: SETS as never }));
      render(<CanonicalSetsPage />);

      expect(screen.getByTestId('canonical-sets-list')).toBeInTheDocument();
      const items = screen.getAllByTestId('canonical-set-item');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByText(/Lincoln Wheat Cent Key Dates/)).toBeInTheDocument();
      expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/sets/canonical/s1');
      expect(within(items[1]).getByText(/Lincoln Wheat Cents/)).toBeInTheDocument();
      expect(within(items[1]).getByRole('link').getAttribute('href')).toBe('/sets/canonical/s2');
    });

    it('renders canonical-sets-empty when there are no canonical sets', () => {
      useCanonicalSetsMock.mockReturnValue(queryResult({ data: [] as never }));
      render(<CanonicalSetsPage />);

      expect(screen.getByTestId('canonical-sets-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-item')).not.toBeInTheDocument();
    });
  });
});
