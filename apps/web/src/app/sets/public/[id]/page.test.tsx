/**
 * Tests for: PublicSetDetailPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: PublicSetDetailPage
 * Covers criteria: #5, #6, #7 (from prd.md)
 *
 * Unwraps params via useEffect+useState (matching the fix already applied to
 * sets/canonical/[id]/page.tsx per memory.md's recorded use()+Suspense gotcha), not
 * React's use() — no <Suspense> boundary is needed for this render.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import PublicSetDetailPage from '@/app/sets/public/[id]/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function publicSetResult(overrides: Partial<ReturnType<typeof usePublicSet>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof usePublicSet>;
}

function gapsResult(overrides: Partial<ReturnType<typeof useSetGaps>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useSetGaps>;
}

function renderPage(id = 'set-1') {
  return render(<PublicSetDetailPage params={Promise.resolve({ id })} />);
}

const DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  coins: [
    {
      id: 'usc-2',
      position: 1,
      coin: { id: 'coin-2', country: 'USA', denomination: '1 Cent', year: 1958, mintMark: '' },
    },
    {
      id: 'usc-1',
      position: 0,
      coin: { id: 'coin-1', country: 'USA', denomination: '1 Cent', year: 1909, mintMark: 'S' },
    },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 2,
  completionPercent: 50,
  slots: [
    { id: 'usc-1', position: 0, coin: DETAIL.coins[1].coin, owned: true },
    { id: 'usc-2', position: 1, coin: DETAIL.coins[0].coin, owned: false },
  ],
};

describe('PublicSetDetailPage', () => {
  beforeEach(() => {
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useSetGapsMock.mockReturnValue(gapsResult());
  });

  describe('criterion 5: shows a loading state while the base query is loading', () => {
    it('renders public-set-detail-loading while isLoading is true', async () => {
      usePublicSetMock.mockReturnValue(publicSetResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-loading')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: shows an error state when the base query fails', () => {
    it('renders public-set-detail-error when isError is true', async () => {
      usePublicSetMock.mockReturnValue(publicSetResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: renders the base coin list, sorted by position, for an anonymous visitor', () => {
    it('renders name and coin list with no owned/missing status when logged out', async () => {
      getStoredTokenMock.mockReturnValue(null);
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-name')).toHaveTextContent("Alice's Wheat Cents");
      });
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
      expect(within(items[1]).getByText('USA 1 Cent (1958)')).toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-status')).not.toBeInTheDocument();
      expect(usePublicSetMock).toHaveBeenCalledWith('set-1');
    });
  });

  describe('criterion 6: shows owned/missing status per coin when logged in and gaps resolve', () => {
    it('renders a status badge matching each coin GapSlot.owned value', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(2);
      });
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      expect(within(items[0]).getByTestId('public-set-detail-coin-status')).toHaveTextContent('owned');
      expect(within(items[1]).getByTestId('public-set-detail-coin-status')).toHaveTextContent('missing');
    });
  });

  describe('criterion 6: gaps-fetch failure does not block the base coin list from rendering', () => {
    it('still renders the full coin list, with no status badges, when the gaps query errors', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(2);
      });
      expect(screen.queryByTestId('public-set-detail-coin-status')).not.toBeInTheDocument();
    });
  });

  describe('criterion 7: clone CTA is auth-gated and pre-fills the user-clone source', () => {
    it('is absent from the DOM when no token is stored', async () => {
      getStoredTokenMock.mockReturnValue(null);
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('public-set-clone-cta')).not.toBeInTheDocument();
    });

    it('links to /sets/new with cloneFrom=user and the set id when a token is stored', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-clone-cta')).toBeInTheDocument();
      });
      const href = screen.getByTestId('public-set-clone-cta').getAttribute('href');
      expect(href).toBe('/sets/new?cloneFrom=user&cloneFromId=set-1');
    });
  });
});
