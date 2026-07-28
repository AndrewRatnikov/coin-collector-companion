/**
 * Tests for: CoinDetailPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CoinDetailPage
 *                   runs/run_20260722_121303/plan.md § Interface Contract → Modify: Loading-state fixes
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/app/catalog/[coinId]/page.tsx (MODIFY)
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/catalog/[coinId]/page.tsx
 * Covers criteria: #5 (from run_20260721_131640's prd.md), #1 (from run_20260722_121303's prd.md),
 *                  #7 (from run_20260725_140648's prd.md), #5 (from run_20260728_071525's prd.md)
 *
 * CoinDetailPage unwraps its `params` prop (a Promise, per the Next.js 16 App Router
 * contract) via React's `use()`, which suspends on first render. Rendering it directly
 * with RTL therefore needs a <Suspense> boundary in the test itself — the app-level
 * Suspense boundaries Next.js provides in real navigation don't exist under a raw
 * render() call.
 *
 * run_20260728_071525: the page now also calls the real (unmocked) `useQueries` from
 * '@tanstack/react-query' per the Interface Contract (fanning out getSetGaps(set.id) over
 * the signed-in user's own sets, same pattern as DashboardPage) — every render below now
 * needs a real QueryClientProvider ancestor, so `renderPage` is updated accordingly. This
 * is purely test-infrastructure; it does not change the assertions of any pre-existing
 * test in this file. getStoredToken, useCollection, and useSetOwnership are mocked (like
 * every other page's use of getStoredToken elsewhere in this repo), since they are plain
 * lib functions / thin query-mutation hooks whose own internals are covered by their own
 * dedicated test files, not this page's.
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoinDetailPage from '@/app/catalog/[coinId]/page';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCoin: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
  useSetOwnership: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
}));

vi.mock('@/lib/user-sets-api', () => ({
  getSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCoinMock = vi.mocked(useCoin);
const useCollectionMock = vi.mocked(useCollection);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useUserSetsMock = vi.mocked(useUserSets);
const getSetGapsMock = vi.mocked(getSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

const mutateMock = vi.fn();

function queryResult(overrides: Partial<ReturnType<typeof useCoin>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCoin>;
}

function collectionResult(overrides: Partial<ReturnType<typeof useCollection>> = {}) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCollection>;
}

function userSetsResult(overrides: Partial<ReturnType<typeof useUserSets>> = {}) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useUserSets>;
}

function renderPage(coinId = 'coin-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div />}>
        <CoinDetailPage params={Promise.resolve({ coinId })} />
      </Suspense>
    </QueryClientProvider>,
  );
}

const COIN_WITH_IMAGE = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1984,
  mintMark: 'D',
  variety: 'Type 2',
  name: 'Lincoln Memorial Cent',
  imageUrl: 'https://upload.wikimedia.org/coin.jpg',
  imageSource: 'Wikimedia Commons',
  imageLicense: 'CC BY-SA 4.0',
  status: 'approved',
  submittedAt: null,
};

const COIN_NO_IMAGE = { ...COIN_WITH_IMAGE, imageUrl: null, imageSource: null, imageLicense: null };

const USER_SETS = [
  {
    id: 'set-a',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'set-b',
    userId: 'user-1',
    name: 'My Key Dates',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('CoinDetailPage', () => {
  beforeEach(() => {
    useCoinMock.mockReset();
    useCollectionMock.mockReset();
    useSetOwnershipMock.mockReset();
    useUserSetsMock.mockReset();
    getSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    mutateMock.mockClear();

    getStoredTokenMock.mockReturnValue(null);
    useCollectionMock.mockReturnValue(collectionResult());
    useSetOwnershipMock.mockReturnValue({ mutate: mutateMock, isPending: false } as unknown as ReturnType<
      typeof useSetOwnership
    >);
    useUserSetsMock.mockReturnValue(userSetsResult());
    getSetGapsMock.mockResolvedValue({ setId: '', ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] });
  });

  describe('criterion 5: shows a loading state while the coin query is loading', () => {
    it('renders coin-detail-loading while isLoading is true', async () => {
      useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-loading')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 1: loading state uses a Skeleton, not bare text', () => {
    it('renders a skeleton element within coin-detail-loading and no literal "Loading…" text', async () => {
      useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
      const { container } = renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-loading')).toBeInTheDocument();
      });
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
  });

  describe('criterion 5: shows an error state when the coin query fails', () => {
    it('renders coin-detail-error when isError is true', async () => {
      useCoinMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: renders full identity fields', () => {
    it('renders country/denomination/year/mintMark/variety and the compact label', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent('USA 1 Cent (1984 D)');
      });
      expect(screen.getByTestId('coin-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('coin-detail-country')).toHaveTextContent('USA');
      expect(screen.getByTestId('coin-detail-denomination')).toHaveTextContent('1 Cent');
      expect(screen.getByTestId('coin-detail-year')).toHaveTextContent('1984');
      expect(screen.getByTestId('coin-detail-mint-mark')).toHaveTextContent('D');
      expect(screen.getByTestId('coin-detail-variety')).toHaveTextContent('Type 2');
      expect(useCoinMock).toHaveBeenCalledWith('coin-1');
    });
  });

  describe('criterion 10: not gated by auth', () => {
    it('resolves to real content with no stored token (RequireAuth would instead redirect and never render children)', async () => {
      localStorage.clear();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: per-image attribution', () => {
    it('renders the image and its imageSource/imageLicense credit when imageUrl is set', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-image')).toBeInTheDocument();
      });
      const attribution = screen.getByTestId('coin-detail-attribution');
      expect(attribution).toHaveTextContent('Wikimedia Commons');
      expect(attribution).toHaveTextContent('CC BY-SA 4.0');
    });

    it('omits the image and attribution when imageUrl is null', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-image')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-attribution')).not.toBeInTheDocument();
    });
  });

  describe('run_20260725_140648 criterion 7: pending badge', () => {
    it('renders coin-detail-pending-badge when status is pending', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_WITH_IMAGE, status: 'pending' } as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-pending-badge')).toBeInTheDocument();
      });
    });

    it('renders coin-detail-pending-badge when status is rejected too (anything not approved)', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_WITH_IMAGE, status: 'rejected' } as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-pending-badge')).toBeInTheDocument();
      });
    });

    it('does not render coin-detail-pending-badge when status is approved', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_WITH_IMAGE, status: 'approved' } as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-pending-badge')).not.toBeInTheDocument();
    });
  });

  describe('run_20260728_071525 criterion 5: owned/missing toggle (signed-in)', () => {
    it('shows "Mark as owned" and no login prompt when signed in and the coin is not in the collection', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: [] }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-owned-toggle')).toHaveTextContent('Mark as owned');
      });
      expect(screen.queryByTestId('coin-detail-login-prompt')).not.toBeInTheDocument();
    });

    it('calls useSetOwnership().mutate({coinId, owned: true}) when clicked while not owned', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: [] }));
      const user = userEvent.setup();
      renderPage('coin-1');

      const toggle = await screen.findByTestId('coin-detail-owned-toggle');
      await user.click(toggle);

      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'coin-1', owned: true });
    });

    it('shows "Remove from collection" when the coin is already in the user\'s collection', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useCollectionMock.mockReturnValue(
        collectionResult({ data: [{ coinId: 'coin-1', coin: COIN_WITH_IMAGE, ownedAt: new Date() }] as never }),
      );
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-owned-toggle')).toHaveTextContent('Remove from collection');
      });
    });

    it('calls useSetOwnership().mutate({coinId, owned: false}) when clicked while already owned', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useCollectionMock.mockReturnValue(
        collectionResult({ data: [{ coinId: 'coin-1', coin: COIN_WITH_IMAGE, ownedAt: new Date() }] as never }),
      );
      const user = userEvent.setup();
      renderPage('coin-1');

      const toggle = await screen.findByTestId('coin-detail-owned-toggle');
      await user.click(toggle);

      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'coin-1', owned: false });
    });
  });

  describe('run_20260728_071525 criterion 5: login prompt (signed-out)', () => {
    it('shows coin-detail-login-prompt and no owned/missing toggle when signed out', async () => {
      getStoredTokenMock.mockReturnValue(null);
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-login-prompt')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-owned-toggle')).not.toBeInTheDocument();
    });
  });

  describe('run_20260728_071525 criterion 5: "Appears in your sets" section', () => {
    it('renders coin-detail-sets-list with one coin-detail-set-item per own set that contains this coin, when signed in', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 'set-a' ? 1 : 0,
        totalCount: 10,
        completionPercent: id === 'set-a' ? 10 : 0,
        slots:
          id === 'set-a'
            ? [{ id: 'slot-1', position: 0, coin: COIN_WITH_IMAGE, owned: true }]
            : [{ id: 'slot-2', position: 0, coin: { ...COIN_WITH_IMAGE, id: 'other-coin' }, owned: false }],
      }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-sets-list')).toBeInTheDocument();
      });
      const items = screen.getAllByTestId('coin-detail-set-item');
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByText('My Wheat Cents')).toBeInTheDocument();
      expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/sets/set-a');
    });

    it('does not render coin-detail-sets-list when the coin appears in none of the user\'s sets', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      getSetGapsMock.mockResolvedValue({
        setId: 'set-a',
        ownedCount: 0,
        totalCount: 10,
        completionPercent: 0,
        slots: [{ id: 'slot-2', position: 0, coin: { ...COIN_WITH_IMAGE, id: 'other-coin' }, owned: false }],
      });
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-sets-list')).not.toBeInTheDocument();
    });

    it('does not render coin-detail-sets-list when signed out, even if it would otherwise match', async () => {
      getStoredTokenMock.mockReturnValue(null);
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      getSetGapsMock.mockResolvedValue({
        setId: 'set-a',
        ownedCount: 1,
        totalCount: 10,
        completionPercent: 10,
        slots: [{ id: 'slot-1', position: 0, coin: COIN_WITH_IMAGE, owned: true }],
      });
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-login-prompt')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-sets-list')).not.toBeInTheDocument();
    });
  });
});
