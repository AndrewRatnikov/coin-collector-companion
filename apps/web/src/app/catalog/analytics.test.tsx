/**
 * Tests for: CatalogPageView analytics (catalog_no_results)
 * Contract source: runs/run_20261123_220432/plan.md § Interface Contract → Page: CatalogPage
 *                   runs/run_20261127_133045/plan.md § Interface Contract → Component: CatalogPageView (CREATE)
 * Covers criteria: #2, #3, #4, #5, #6 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The mocking setup mirrors page.test.tsx next to this file. `track` is mocked as in
 * app/want-list/analytics.test.tsx. Assertions look only at calls for 'catalog_no_results'.
 * run_20261127_133045: the page is a server component now, so the tests render the client view
 * CatalogPageView (without initial data).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CatalogPageView } from '@/components/catalog/catalog-page-view';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { track } from '@/lib/analytics';

let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
}));

vi.mock('@/components/catalog/submit-coin-form', () => ({
  default: () => null,
}));

vi.mock('@/components/catalog/submission-confirmation', () => ({
  default: () => null,
}));

const trackMock = vi.mocked(track);
const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

function queryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isPlaceholderData: false,
    ...overrides,
  } as unknown as ReturnType<typeof useCatalog>;
}

function emptyResult(overrides: Record<string, unknown> = {}) {
  return queryResult({ data: { items: [], page: 1, limit: 20, total: 0 }, ...overrides });
}

function makeCoin(id: string) {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year: 1984,
    mintMark: '',
    variety: '',
    name: 'Lincoln Memorial Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved' as const,
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function noResultsCalls() {
  return trackMock.mock.calls.filter((call) => call[0] === 'catalog_no_results');
}

const ALL_NULL = { country: null, denomination: null, year_from: null, year_to: null, name: null };

describe('CatalogPageView analytics: catalog_no_results', () => {
  beforeEach(() => {
    trackMock.mockReset();
    useCatalogMock.mockReset();
    useCatalogFacetsMock.mockReset();
    searchParamsValue = new URLSearchParams();
    localStorage.clear();
    useCatalogMock.mockReturnValue(emptyResult());
    useCatalogFacetsMock.mockReturnValue({
      data: { countries: ['Ukraine', 'USA'], denominations: ['1 Cent', '50 Cents'] },
    } as unknown as ReturnType<typeof useCatalogFacets>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fires', () => {
    it('once with the right properties for a filtered empty result', () => {
      searchParamsValue = new URLSearchParams(
        'country=Ukraine&denomination=50%20Cents&denomination=1%20Cent&yearMin=1900&yearMax=1950&name=Lincoln%20WHEAT',
      );

      render(<CatalogPageView />);

      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
      expect(noResultsCalls()).toEqual([
        [
          'catalog_no_results',
          {
            country: 'Ukraine',
            denomination: '1 Cent,50 Cents',
            year_from: '1900',
            year_to: '1950',
            name: 'lincoln wheat',
          },
        ],
      ]);
    });

    it('once with all five properties null when no filter is set', () => {
      render(<CatalogPageView />);

      expect(noResultsCalls()).toEqual([['catalog_no_results', ALL_NULL]]);
    });

    it('sends different values for a different filter combination (not hard-coded)', () => {
      searchParamsValue = new URLSearchParams('country=USA&yearMin=1999');

      render(<CatalogPageView />);

      expect(noResultsCalls()).toEqual([
        ['catalog_no_results', { ...ALL_NULL, country: 'USA', year_from: '1999' }],
      ]);
    });
  });

  describe('does not fire', () => {
    it('when the query returns results', () => {
      useCatalogMock.mockReturnValue(
        queryResult({ data: { items: [makeCoin('c1'), makeCoin('c2')], page: 1, limit: 20, total: 2 } }),
      );

      render(<CatalogPageView />);

      expect(screen.queryByTestId('catalog-empty')).not.toBeInTheDocument();
      expect(noResultsCalls()).toHaveLength(0);
    });

    it('while loading', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: undefined, isLoading: true }));

      render(<CatalogPageView />);

      expect(noResultsCalls()).toHaveLength(0);
    });

    it('on error', () => {
      useCatalogMock.mockReturnValue(queryResult({ isError: true }));

      render(<CatalogPageView />);

      expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
      expect(noResultsCalls()).toHaveLength(0);
    });

    it('on error even when stale empty data is present', () => {
      useCatalogMock.mockReturnValue(emptyResult({ isError: true }));

      render(<CatalogPageView />);

      expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
      expect(noResultsCalls()).toHaveLength(0);
    });

    it('for placeholder data from the previous combination, even though catalog-empty renders', () => {
      useCatalogMock.mockReturnValue(emptyResult({ isPlaceholderData: true }));

      render(<CatalogPageView />);

      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
      expect(noResultsCalls()).toHaveLength(0);
    });

    it('fires after placeholder data is replaced by the real empty result', () => {
      useCatalogMock.mockReturnValue(emptyResult({ isPlaceholderData: true }));
      const { rerender } = render(<CatalogPageView />);
      expect(noResultsCalls()).toHaveLength(0);

      useCatalogMock.mockReturnValue(emptyResult({ isPlaceholderData: false }));
      rerender(<CatalogPageView />);

      expect(noResultsCalls()).toHaveLength(1);
    });
  });

  describe('once per distinct filter combination', () => {
    it('does not fire again on re-renders with the same empty result', () => {
      const { rerender } = render(<CatalogPageView />);

      rerender(<CatalogPageView />);
      rerender(<CatalogPageView />);
      rerender(<CatalogPageView />);

      expect(noResultsCalls()).toHaveLength(1);
    });

    it('fires again after the search text changes', () => {
      vi.useFakeTimers();
      searchParamsValue = new URLSearchParams('name=wheat');
      render(<CatalogPageView />);
      expect(noResultsCalls()).toHaveLength(1);

      fireEvent.change(screen.getByTestId('catalog-search'), { target: { value: 'Lincoln' } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      const calls = noResultsCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0][1]).toEqual({ ...ALL_NULL, name: 'wheat' });
      expect(calls[1][1]).toEqual({ ...ALL_NULL, name: 'lincoln' });
    });

    it('does not fire again when only the sort changes', () => {
      render(<CatalogPageView />);
      expect(noResultsCalls()).toHaveLength(1);

      fireEvent.change(screen.getByTestId('catalog-sort'), { target: { value: 'name_asc' } });

      expect(noResultsCalls()).toHaveLength(1);
    });

    it('fires again with all nulls after Clear all in the empty state', () => {
      searchParamsValue = new URLSearchParams('country=Ukraine&name=zzz');
      render(<CatalogPageView />);
      expect(noResultsCalls()).toHaveLength(1);

      fireEvent.click(screen.getByTestId('catalog-empty-clear'));

      const calls = noResultsCalls();
      expect(calls).toHaveLength(2);
      expect(calls[0][1]).toEqual({ ...ALL_NULL, country: 'Ukraine', name: 'zzz' });
      expect(calls[1][1]).toEqual(ALL_NULL);
    });
  });
});
