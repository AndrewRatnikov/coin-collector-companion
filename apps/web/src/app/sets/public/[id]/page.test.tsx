/**
 * Tests for: PublicSetDetailPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: PublicSetDetailPage
 *                   runs/run_20260722_121303/plan.md § Interface Contract → Modify: Loading-state fixes
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/sets/public/[id]/page.tsx
 *                   runs/run_20261017_142658/plan.md § Approach §3 and §4 (name block via getCoinName; Skeleton testid)
 *                   runs/run_20261109_220451/plan.md § Interface Contract → Page: PublicSetDetailPage
 * Covers criteria: #5, #6, #7 (from run_20260721_161448's prd.md), #1 (from run_20260722_121303's prd.md),
 *                  #7 (from run_20260728_071525's prd.md), #6, #13 (from run_20261017_142658's prd.md),
 *                  #3, #4, #9, #10 (from run_20261109_220451's prd.md)
 *
 * Unwraps params via useEffect+useState (matching the fix already applied to
 * sets/canonical/[id]/page.tsx per memory.md's recorded use()+Suspense gotcha), not
 * React's use() — no <Suspense> boundary is needed for this render.
 *
 * run_20261017_142658: two tests change. The skeleton test looks for the Skeleton testid instead of
 * the removed `.animate-pulse` class, and the anonymous coin list test expects the getCoinName title and
 * subtitle instead of the formatCoinLabel string. The coin fixtures now carry the naming fields
 * (name, variety, isKeyDate) because getCoinName reads them.
 *
 * run_20261109_220451: the overlap line (public-set-detail-overlap) and the plain status labels
 * (public-set-detail-coin-status) are gone. The tests that covered them now cover the shared progress
 * block and the read-only marks (public-set-detail-coin-mark). Gap fixtures carry `grade` and `minGrade`.
 * The fuller signed-in/out matrix lives in progress.test.tsx.
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
      coin: {
        id: 'coin-2',
        country: 'USA',
        denomination: '1 Cent',
        year: 1958,
        mintMark: '',
        variety: '',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
    },
    {
      id: 'usc-1',
      position: 0,
      coin: {
        id: 'coin-1',
        country: 'USA',
        denomination: '1 Cent',
        year: 1909,
        mintMark: 'S',
        variety: '',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
    },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 2,
  completionPercent: 50,
  minGrade: null,
  slots: [
    { id: 'usc-1', position: 0, coin: DETAIL.coins[1].coin, owned: true, grade: 'VF' },
    { id: 'usc-2', position: 1, coin: DETAIL.coins[0].coin, owned: false, grade: null },
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

  describe('criterion 1: loading state uses a skeleton, not bare text', () => {
    it('renders a skeleton element within public-set-detail-loading and no literal "Loading…" text', async () => {
      usePublicSetMock.mockReturnValue(publicSetResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-loading')).toBeInTheDocument();
      });
      expect(
        within(screen.getByTestId('public-set-detail-loading')).getByTestId('skeleton'),
      ).toBeInTheDocument();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
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
    it('renders name and coin list with no owned/missing mark when logged out', async () => {
      getStoredTokenMock.mockReturnValue(null);
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-name')).toHaveTextContent("Alice's Wheat Cents");
      });
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByTestId('public-set-detail-coin-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(items[0]).getByTestId('public-set-detail-coin-subtitle')).toHaveTextContent(
        /^USA · 1 Cent · 1909-S$/,
      );
      expect(within(items[1]).getByTestId('public-set-detail-coin-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(items[1]).getByTestId('public-set-detail-coin-subtitle')).toHaveTextContent(
        /^USA · 1 Cent · 1958$/,
      );
      expect(screen.queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-status')).not.toBeInTheDocument();
      expect(usePublicSetMock).toHaveBeenCalledWith('set-1');
    });

    it('no longer shows the old formatCoinLabel text', async () => {
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await screen.findAllByTestId('public-set-detail-coin-item');
      expect(screen.queryByText('USA 1 Cent (1909 S)')).not.toBeInTheDocument();
      expect(screen.queryByText('USA 1 Cent (1958)')).not.toBeInTheDocument();
    });
  });

  describe('criterion 6 / run_20261109_220451 criterion 9: shows an owned/missing mark per coin when logged in and gaps resolve', () => {
    it('renders a mark matching each coin GapSlot.owned value, with the old status labels gone', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(2);
      });
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      await waitFor(() => {
        expect(within(items[0]).getByTestId('public-set-detail-coin-mark')).toHaveAttribute('data-owned', 'true');
      });
      expect(within(items[0]).getByTestId('public-set-detail-coin-mark')).toHaveTextContent('Owned');
      expect(within(items[1]).getByTestId('public-set-detail-coin-mark')).toHaveAttribute('data-owned', 'false');
      expect(within(items[1]).getByTestId('public-set-detail-coin-mark')).toHaveTextContent('Missing');
      expect(screen.queryByTestId('public-set-detail-coin-status')).not.toBeInTheDocument();
    });
  });

  describe('criterion 6: gaps-fetch failure does not block the base coin list from rendering', () => {
    it('still renders the full coin list, with no marks, when the gaps query errors', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(2);
      });
      expect(screen.queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
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

  describe('run_20261109_220451 criteria 4, 10: the "you already own" line is replaced by the shared progress block', () => {
    it('renders the progress block with the numbers of the gaps response, and no overlap line', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('public-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 1 of 2');
      expect(screen.getByTestId('public-set-detail-completion')).toHaveTextContent('50%');
      expect(screen.queryByTestId('public-set-detail-overlap')).not.toBeInTheDocument();
      expect(screen.queryByText(/You already own/)).not.toBeInTheDocument();
    });

    it('renders other numbers for another gaps fixture (the text is derived, not hardcoded)', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      const DIFFERENT_GAPS = { ...GAPS, ownedCount: 5, totalCount: 9, completionPercent: 56 };
      useSetGapsMock.mockReturnValue(gapsResult({ data: DIFFERENT_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('public-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 5 of 9');
      expect(owned.textContent).not.toContain('1 of 2');
      expect(screen.getByTestId('public-set-detail-completion')).toHaveTextContent('56%');
    });

    it('does not render the progress block when signed out', async () => {
      getStoredTokenMock.mockReturnValue(null);
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-overlap')).not.toBeInTheDocument();
    });

    it('does not render the progress block when gaps have not resolved successfully (errored)', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('public-set-detail-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
    });
  });
});
