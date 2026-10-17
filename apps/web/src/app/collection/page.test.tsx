/**
 * Tests for: CollectionPage
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Page: CollectionPage (CREATE)
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/collection/page.tsx
 *                   runs/run_20261017_142658/plan.md § Approach §3 (name block via getCoinName)
 * Covers criteria: #7 (from run_20260721_171115's prd.md), #10 (from run_20260728_071525's prd.md),
 *                  #6 (from run_20261017_142658's prd.md)
 *
 * run_20260728_071525: plan.md keeps `useCollection(filters)` exact-match on year (§4 of
 * plan.md — changing to prefix-match is out of scope) and adds a `collection-filter-clear`
 * button, local to this page's own inline filter form (NOT the shared CatalogFilterForm —
 * Collection never used that component). Every other assertion below is carried over
 * unchanged from run_20260721_171115.
 *
 * run_20261017_142658: only the "renders the ownership list" block changes. A row no longer shows the
 * formatCoinLabel string ("USA 1 Cent (1909 S)"); it shows the getCoinName eyebrow (only when non-empty),
 * title and subtitle. Everything else is unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const SERIES_COIN = {
  ...COIN,
  id: 'coin-2',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  mintMark: '',
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
};

const KEY_COIN = {
  ...COIN,
  id: 'coin-3',
  country: 'United States',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  isKeyDate: true,
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

  describe('criterion 7 / run_20261017_142658 criterion 6: renders the ownership list using getCoinName', () => {
    it('renders one collection-item per OwnershipItem with the coin title and subtitle', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: OWNERSHIP_ITEMS }));
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('collection-item')).toHaveLength(1);
      });
      const item = screen.getByTestId('collection-item');
      expect(within(item).getByTestId('collection-item-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(item).getByTestId('collection-item-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1909-S$/);
    });

    it('no longer shows the old formatCoinLabel text', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: OWNERSHIP_ITEMS }));
      render(<CollectionPage />);

      await screen.findByTestId('collection-item');
      expect(screen.queryByText('USA 1 Cent (1909 S)')).not.toBeInTheDocument();
    });

    it('shows no eyebrow for a coin titled by its type name', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: OWNERSHIP_ITEMS }));
      render(<CollectionPage />);

      await screen.findByTestId('collection-item');
      expect(screen.queryByTestId('collection-item-eyebrow')).not.toBeInTheDocument();
    });

    it('shows the series as the eyebrow and the design as the title for a series coin', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(
        queryResult({ data: [{ coinId: 'coin-2', coin: SERIES_COIN, ownedAt: new Date('2026-01-02T00:00:00.000Z') }] }),
      );
      render(<CollectionPage />);

      const item = await screen.findByTestId('collection-item');
      expect(within(item).getByTestId('collection-item-eyebrow')).toHaveTextContent(
        /^We Are Strong\. We Are Together$/,
      );
      expect(within(item).getByTestId('collection-item-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(item).getByTestId('collection-item-subtitle')).toHaveTextContent(
        /^Ukraine · 10 Hryvnias · 2025$/,
      );
    });

    it('scopes each name block to its own row, in list order', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(
        queryResult({
          data: [
            { coinId: 'coin-2', coin: SERIES_COIN, ownedAt: new Date('2026-01-03T00:00:00.000Z') },
            { coinId: 'coin-1', coin: COIN, ownedAt: new Date('2026-01-02T00:00:00.000Z') },
            { coinId: 'coin-3', coin: KEY_COIN, ownedAt: new Date('2026-01-01T00:00:00.000Z') },
          ],
        }),
      );
      render(<CollectionPage />);

      const items = await screen.findAllByTestId('collection-item');
      expect(items).toHaveLength(3);
      expect(items.map((el) => within(el).getByTestId('collection-item-title').textContent)).toEqual([
        'Donetsk Oblast',
        'Lincoln Wheat Cent',
        '1909-S VDB',
      ]);
      expect(within(items[0]).getByTestId('collection-item-eyebrow')).toBeInTheDocument();
      expect(within(items[1]).queryByTestId('collection-item-eyebrow')).not.toBeInTheDocument();
      expect(within(items[2]).getByTestId('collection-item-eyebrow')).toHaveTextContent('Lincoln Wheat Cent');
      expect(within(items[2]).getByTestId('collection-item-subtitle')).toHaveTextContent(/^United States · 1 Cent$/);
    });

    it('run_20260728_071525 criterion 10: also shows the coin\'s year and mint mark within the row (additional content, no new testid)', async () => {
      setStoredToken('tok-abc');
      useCollectionMock.mockReturnValue(queryResult({ data: OWNERSHIP_ITEMS }));
      render(<CollectionPage />);

      const item = await screen.findByTestId('collection-item');
      expect(item).toHaveTextContent('1909');
      expect(item).toHaveTextContent('S');
    });
  });

  describe('criterion 7: filtering by country and year (exact-match, wired to the real API — plan.md §4)', () => {
    function lastCollectionFilters() {
      const calls = useCollectionMock.mock.calls;
      return calls[calls.length - 1][0] as { country?: string; year?: number };
    }

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
        expect(lastCollectionFilters().country).toBe('USA');
        expect(lastCollectionFilters().year).toBe(1909);
      });
    });

    it('reflects a second, different filter combination (rules out a hardcoded/ignored-input filter wiring)', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-filter-form')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('collection-filter-year'), '1943');
      await user.click(screen.getByTestId('collection-filter-submit'));

      await waitFor(() => {
        expect(lastCollectionFilters().year).toBe(1943);
        expect(lastCollectionFilters().country).toBeUndefined();
      });
    });
  });

  describe('run_20260728_071525 criterion 10: filter Clear button', () => {
    it('renders collection-filter-clear inside the filter form', async () => {
      setStoredToken('tok-abc');
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-filter-clear')).toBeInTheDocument();
      });
    });

    it('resets filled filter fields to empty and resubmits with no filter values', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<CollectionPage />);

      await waitFor(() => {
        expect(screen.getByTestId('collection-filter-form')).toBeInTheDocument();
      });
      await user.type(screen.getByTestId('collection-filter-country'), 'USA');
      await user.type(screen.getByTestId('collection-filter-year'), '1909');
      await user.click(screen.getByTestId('collection-filter-submit'));

      await user.click(screen.getByTestId('collection-filter-clear'));

      expect(screen.getByTestId('collection-filter-country')).toHaveValue('');
      expect(screen.getByTestId('collection-filter-year')).toHaveValue(null);

      await waitFor(() => {
        const calls = useCollectionMock.mock.calls;
        const last = calls[calls.length - 1][0] as { country?: string; year?: number };
        expect(last.country).toBeUndefined();
        expect(last.year).toBeUndefined();
      });
    });
  });
});
