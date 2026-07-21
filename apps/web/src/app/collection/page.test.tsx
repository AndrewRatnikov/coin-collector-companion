/**
 * Tests for: CollectionPage
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Page: CollectionPage (CREATE)
 * Covers criteria: #7 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CollectionPage from '@/app/collection/page';
import { useCollection } from '@/lib/hooks/use-collection';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
}));

const useCollectionMock = vi.mocked(useCollection);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

const COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const OWNERSHIP_ITEMS = [{ coinId: 'coin-1', coin: COIN, ownedAt: new Date('2026-01-02T00:00:00.000Z') }];

describe('CollectionPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    useCollectionMock.mockReset();
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
  });

  describe('auth gating', () => {
    it('does not render collection-page and redirects to /login when no token is present', async () => {
      render(<CollectionPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('collection-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion 7: loading, error, and empty states', () => {
    it('renders collection-loading while the query is loading', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-loading')).toBeInTheDocument();
      });
    });

    it('renders collection-error when the query fails', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ isError: true }));
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-error')).toBeInTheDocument();
      });
    });

    it('renders collection-empty when the user owns no coins yet', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: [] }));
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('collection-list')).not.toBeInTheDocument();
    });
  });

  describe('criterion 7: renders the ownership list using formatCoinLabel', () => {
    it('renders one collection-item per OwnershipItem with the formatted coin label', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: OWNERSHIP_ITEMS }));
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('collection-item')).toHaveLength(1);
      });
      expect(screen.getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
    });
  });

  describe('criterion 7: filtering by country and year', () => {
    it('calls useCollection with the filter values entered when the filter form is submitted', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-filter-form')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('collection-filter-country'), 'USA');
      await user.type(screen.getByTestId('collection-filter-year'), '1909');
      await user.click(screen.getByTestId('collection-filter-submit'));

      await waitFor(() => {
        const lastCallArgs = useCollectionMock.mock.calls[useCollectionMock.mock.calls.length - 1][0] as {
          country?: string;
          year?: number;
        };
        expect(lastCallArgs.country).toBe('USA');
        expect(lastCallArgs.year).toBe(1909);
      });
    });
  });
});
