/**
 * Tests for: CatalogPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CatalogPage
 * Covers criteria: #4 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogPage from '@/app/catalog/page';
import { useCatalog } from '@/lib/hooks/use-catalog';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const useCatalogMock = vi.mocked(useCatalog);

function queryResult(overrides: Partial<ReturnType<typeof useCatalog>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCatalog>;
}

const COINS = [
  { id: 'c1', country: 'USA', denomination: '1 Cent', year: 1984, mintMark: 'D', variety: '', name: 'Lincoln Memorial Cent' },
  { id: 'c2', country: 'USA', denomination: '1 Cent', year: 1958, mintMark: '', variety: '', name: 'Lincoln Wheat Cent' },
];

describe('CatalogPage', () => {
  beforeEach(() => {
    useCatalogMock.mockReset();
  });

  describe('rendering', () => {
    it('renders the page root and filter form fields', () => {
      useCatalogMock.mockReturnValue(queryResult());
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-form')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-country')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-denomination')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-name')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-min')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-max')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-submit')).toBeInTheDocument();
    });
  });

  describe('criterion 4: shows a loading state while the catalog query is loading', () => {
    it('renders catalog-loading and no results while isLoading is true', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-results')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: shows an error state when the catalog query fails', () => {
    it('renders catalog-error when isError is true', () => {
      useCatalogMock.mockReturnValue(queryResult({ isError: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
    });
  });

  describe('criterion 4: renders a paginated result grid using formatCoinLabel', () => {
    it('renders one catalog-item per coin with the compact label and a link to the coin detail page', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 20, total: 2 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
      const rows = screen.getAllByTestId('catalog-item');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText('USA 1 Cent (1984 D)')).toBeInTheDocument();
      expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe('/catalog/c1');
      expect(within(rows[1]).getByText('USA 1 Cent (1958)')).toBeInTheDocument();
      expect(within(rows[1]).getByRole('link').getAttribute('href')).toBe('/catalog/c2');
    });

    it('renders catalog-empty when the result set is empty', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-item')).not.toBeInTheDocument();
    });

    it('disables Prev on page 1 and enables Next when more pages remain', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 1, total: 3 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page-prev')).toBeDisabled();
      expect(screen.getByTestId('catalog-page-next')).not.toBeDisabled();
      expect(screen.getByTestId('catalog-page-indicator')).toHaveTextContent('1');
    });

    it('disables Next on the last page', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 3, limit: 1, total: 3 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page-next')).toBeDisabled();
      expect(screen.getByTestId('catalog-page-prev')).not.toBeDisabled();
    });
  });

  describe('criterion 4: filter form requires an explicit submit before querying', () => {
    it('passes the submitted filter values to useCatalog and resets to page 1', async () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.type(screen.getByTestId('catalog-filter-country'), 'USA');
      await user.type(screen.getByTestId('catalog-filter-name'), 'Lincoln');
      await user.click(screen.getByTestId('catalog-filter-submit'));

      const lastCall = useCatalogMock.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ country: 'USA', name: 'Lincoln', page: 1 });
    });
  });
});
