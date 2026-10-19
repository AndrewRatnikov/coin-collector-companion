/**
 * Tests for: CoinDetailPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CoinDetailPage
 *                   runs/run_20260722_121303/plan.md § Interface Contract → Modify: Loading-state fixes
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/app/catalog/[coinId]/page.tsx (MODIFY)
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/catalog/[coinId]/page.tsx
 *                   runs/run_20261017_142658/plan.md § Approach §3 and §4 (name block via getCoinName; Skeleton testid)
 *                   runs/run_20261019_205931/plan.md § Interface Contract → Page: CoinDetailPage
 * Covers criteria: #5 (from run_20260721_131640's prd.md), #1 (from run_20260722_121303's prd.md),
 *                  #7 (from run_20260725_140648's prd.md), #5 (from run_20260728_071525's prd.md),
 *                  #6, #13 (from run_20261017_142658's prd.md),
 *                  #1-#14 (from run_20261019_205931's prd.md)
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
 *
 * run_20261017_142658: two existing tests change. The "full identity fields" test now expects the
 * heading to be the getCoinName title (it used to be the formatCoinLabel string), and the loading
 * test looks for the Skeleton's testid instead of the removed `.animate-pulse` class. A new block
 * covers the eyebrow, subtitle and the removed unlabelled variety line.
 *
 * run_20261019_205931 (Phase 7): the country/denomination/year/variety spec rows are gone, so the
 * tests that asserted them are updated; "Type 2" now appears once (heading); the image name is the
 * aria-label of coin-detail-image; unknown specs render "Not recorded". The useUserSets mock gains
 * useAddCoinsToSet and the useSetOwnership mock gains failedCoinIds. New blocks cover the
 * breadcrumb, plate, ownership panel / bar, sets progress, add-to-set menu and specs table.
 *
 * CONTRACT_GAPS: none
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoinDetailPage from '@/app/catalog/[coinId]/page';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useAddCoinsToSet, useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';
import type { CatalogCoin } from '@coin-collector/shared';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCoin: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
  useSetOwnership: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
  useAddCoinsToSet: vi.fn(),
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
const useAddCoinsToSetMock = vi.mocked(useAddCoinsToSet);
const getSetGapsMock = vi.mocked(getSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

const mutateMock = vi.fn();
const mutateAsyncMock = vi.fn();

type OwnershipOptions = {
  onSettled?: (error: Error | null, vars: { coinId: string; owned: boolean }) => void;
};

function ownershipResult(overrides: { isPending?: boolean; failedCoinIds?: Set<string> } = {}) {
  return {
    mutate: mutateMock,
    isPending: false,
    failedCoinIds: new Set<string>(),
    ...overrides,
  } as unknown as ReturnType<typeof useSetOwnership>;
}

function lastOwnershipOptions(): OwnershipOptions {
  return useSetOwnershipMock.mock.calls.at(-1)?.[0] as unknown as OwnershipOptions;
}

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

const COIN_WITH_IMAGE: CatalogCoin = {
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
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
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

const OWNED_COLLECTION = [{ coinId: 'coin-1', coin: COIN_WITH_IMAGE, ownedAt: new Date() }];

/** set-a contains coin-1 (2 of 7, 29%); set-b does not. */
function mockGapsSetAOnly() {
  getSetGapsMock.mockImplementation(async (id: string) => ({
    setId: id,
    ownedCount: id === 'set-a' ? 2 : 5,
    totalCount: id === 'set-a' ? 7 : 10,
    completionPercent: id === 'set-a' ? 29 : 50,
    slots:
      id === 'set-a'
        ? [{ id: 'slot-1', position: 0, coin: COIN_WITH_IMAGE, owned: true }]
        : [{ id: 'slot-2', position: 0, coin: { ...COIN_WITH_IMAGE, id: 'other-coin' }, owned: false }],
  }));
}

function signIn() {
  getStoredTokenMock.mockReturnValue('tok-abc');
}

describe('CoinDetailPage', () => {
  beforeEach(() => {
    useCoinMock.mockReset();
    useCollectionMock.mockReset();
    useSetOwnershipMock.mockReset();
    useUserSetsMock.mockReset();
    useAddCoinsToSetMock.mockReset();
    getSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    mutateMock.mockClear();
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue([]);

    getStoredTokenMock.mockReturnValue(null);
    useCollectionMock.mockReturnValue(collectionResult());
    useSetOwnershipMock.mockReturnValue(ownershipResult());
    useUserSetsMock.mockReturnValue(userSetsResult());
    useAddCoinsToSetMock.mockReturnValue({
      mutateAsync: mutateAsyncMock,
      isPending: false,
    } as unknown as ReturnType<typeof useAddCoinsToSet>);
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
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-loading')).toBeInTheDocument();
      });
      expect(within(screen.getByTestId('coin-detail-loading')).getAllByTestId('skeleton').length).toBeGreaterThan(0);
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
    it('renders the mintMark spec and the getCoinName title as the heading; country/denomination/year/variety rows are gone', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent(/^Type 2$/);
      });
      expect(screen.getByTestId('coin-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('coin-detail-mint-mark')).toHaveTextContent('D');
      expect(screen.queryByTestId('coin-detail-country')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-denomination')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-year')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-variety')).not.toBeInTheDocument();
      expect(useCoinMock).toHaveBeenCalledWith('coin-1');
    });
  });

  describe('run_20261017_142658 criterion 6: eyebrow, title and subtitle from getCoinName', () => {
    it('shows the type name as the eyebrow above the heading and the subtitle below it', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      const label = await screen.findByTestId('coin-detail-label');
      const eyebrow = screen.getByTestId('coin-detail-eyebrow');
      const subtitle = screen.getByTestId('coin-detail-subtitle');

      expect(eyebrow).toHaveTextContent(/^Lincoln Memorial Cent$/);
      expect(subtitle).toHaveTextContent(/^USA · 1 Cent · 1984-D$/);
      expect(label.compareDocumentPosition(eyebrow) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
      expect(label.compareDocumentPosition(subtitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows the series as the eyebrow and the design as the heading for a series coin', async () => {
      const donetsk: CatalogCoin = {
        ...COIN_NO_IMAGE,
        id: 'coin-donetsk',
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        year: 2025,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        name: 'Ukraine Commemorative 10 Hryvnias',
      };
      useCoinMock.mockReturnValue(queryResult({ data: donetsk as never }));
      renderPage('coin-donetsk');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent(/^Donetsk Oblast$/);
      });
      expect(screen.getByTestId('coin-detail-eyebrow')).toHaveTextContent(/^We Are Strong\. We Are Together$/);
      expect(screen.getByTestId('coin-detail-subtitle')).toHaveTextContent(/^Ukraine · 10 Hryvnias · 2025$/);
    });

    it('renders no eyebrow element when the heading is already the type name', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, variety: '' } as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent(/^Lincoln Memorial Cent$/);
      });
      expect(screen.queryByTestId('coin-detail-eyebrow')).not.toBeInTheDocument();
      expect(screen.getByTestId('coin-detail-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1984-D$/);
    });

    it('titles a key date with its collector notation and leaves the year out of the subtitle', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, isKeyDate: true } as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent(/^1984-D Type 2$/);
      });
      expect(screen.getByTestId('coin-detail-subtitle')).toHaveTextContent(/^USA · 1 Cent$/);
      expect(screen.getByTestId('coin-detail-eyebrow')).toHaveTextContent('Lincoln Memorial Cent');
    });

    it('shows the raw variety only in the heading now that the variety row is gone', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.getAllByText('Type 2')).toHaveLength(1);
    });

    it('names the image with the flat formatCoinLabel text via aria-label on coin-detail-image', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage();

      const image = await screen.findByTestId('coin-detail-image');
      expect(image).toHaveAttribute('role', 'img');
      expect(image).toHaveAttribute('aria-label', 'USA 1 Cent (1984 D)');
    });
  });

  describe('physical specs and mintage', () => {
    it('renders each known spec with its unit and a grouped mintage', async () => {
      useCoinMock.mockReturnValue(
        queryResult({
          data: {
            ...COIN_NO_IMAGE,
            diameterMm: 19.05,
            weightG: 3.11,
            thicknessMm: 1.55,
            material: 'Bronze (95% copper, 5% tin and zinc)',
            mintage: 484000,
          },
        }),
      );
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-diameter')).toHaveTextContent('19.05 mm');
      });
      expect(screen.getByTestId('coin-detail-weight')).toHaveTextContent('3.11 g');
      expect(screen.getByTestId('coin-detail-thickness')).toHaveTextContent('1.55 mm');
      expect(screen.getByTestId('coin-detail-material')).toHaveTextContent('Bronze (95% copper, 5% tin and zinc)');
      expect(screen.getByTestId('coin-detail-mintage')).toHaveTextContent('484,000');
    });

    it('renders "Not recorded" in italic for unknown specs instead of omitting them', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, diameterMm: 19.05 } }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-diameter')).toBeInTheDocument();
      });
      for (const testId of ['weight', 'thickness', 'material', 'mintage']) {
        const cell = screen.getByTestId(`coin-detail-${testId}`);
        expect(cell).toHaveTextContent('Not recorded');
        expect(cell.className).toContain('italic');
      }
      expect(screen.getByTestId('coin-detail-diameter')).not.toHaveTextContent('Not recorded');
      expect(screen.getByTestId('coin-detail-diameter').className).toContain('font-mono');
    });

    it('shows the key-date badge only for key-date coins', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, isKeyDate: true } }));
      const { unmount } = renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-key-date-badge')).toHaveTextContent('Key date');
      });
      unmount();

      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE }));
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-key-date-badge')).not.toBeInTheDocument();
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
      useCollectionMock.mockReturnValue(collectionResult({ data: OWNED_COLLECTION as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-owned-toggle')).toHaveTextContent('Remove from collection');
      });
    });

    it('calls useSetOwnership().mutate({coinId, owned: false}) when clicked while already owned', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: OWNED_COLLECTION as never }));
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

  describe('authenticated queries are gated on login (no 401s for anonymous visitors)', () => {
    it('disables useCollection and useUserSets on every render when signed out', async () => {
      getStoredTokenMock.mockReturnValue(null);
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-login-prompt')).toBeInTheDocument();
      });
      expect(useCollectionMock).toHaveBeenCalled();
      for (const call of useCollectionMock.mock.calls) {
        expect(call[1]).toEqual({ enabled: false });
      }
      expect(useUserSetsMock).toHaveBeenCalled();
      for (const call of useUserSetsMock.mock.calls) {
        expect(call[0]).toEqual({ enabled: false });
      }
    });

    it('enables useCollection and useUserSets once a stored token is detected', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-owned-toggle')).toBeInTheDocument();
      });
      expect(useCollectionMock.mock.calls.at(-1)?.[1]).toEqual({ enabled: true });
      expect(useUserSetsMock.mock.calls.at(-1)?.[0]).toEqual({ enabled: true });
    });
  });

  describe('run_20260728_071525 criterion 5: "Appears in your sets" section', () => {
    it('renders coin-detail-sets-list with one coin-detail-set-item per own set that contains this coin, when signed in', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      mockGapsSetAOnly();
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-sets-list')).toBeInTheDocument();
      });
      const items = screen.getAllByTestId('coin-detail-set-item');
      expect(items).toHaveLength(1);
      expect(within(items[0]).getByText('My Wheat Cents')).toBeInTheDocument();
      expect(within(items[0]).getByTestId('coin-detail-set-link').getAttribute('href')).toBe('/sets/set-a');
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

  describe('run_20261019_205931 criterion 1: breadcrumb', () => {
    it('links Catalog to /catalog and the country to the filtered catalog; series is plain text', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const nav = await screen.findByTestId('coin-detail-breadcrumb');
      expect(nav.tagName).toBe('NAV');
      expect(nav).toHaveAttribute('aria-label', 'Breadcrumb');
      expect(within(nav).getByTestId('coin-detail-breadcrumb-catalog')).toHaveAttribute('href', '/catalog');
      const country = within(nav).getByTestId('coin-detail-breadcrumb-country');
      expect(country).toHaveAttribute('href', '/catalog?country=USA');
      expect(country).toHaveTextContent('USA');
      const series = within(nav).getByTestId('coin-detail-breadcrumb-series');
      expect(series).toHaveTextContent('Lincoln Memorial Cent');
      expect(series.tagName).not.toBe('A');
    });

    it('encodes the country in the link', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, country: 'United States' } as never }));
      renderPage();

      expect(await screen.findByTestId('coin-detail-breadcrumb-country')).toHaveAttribute(
        'href',
        '/catalog?country=United+States',
      );
    });

    it('omits the series segment when the coin has no series (empty eyebrow)', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, variety: '' } as never }));
      renderPage();

      await screen.findByTestId('coin-detail-breadcrumb-country');
      expect(screen.queryByTestId('coin-detail-breadcrumb-series')).not.toBeInTheDocument();
    });

    it('shows only the Catalog link while the coin is loading', async () => {
      useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      expect(await screen.findByTestId('coin-detail-breadcrumb-catalog')).toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-breadcrumb-country')).not.toBeInTheDocument();
    });

    it('no longer renders the old Catalogue entry or Plate not yet photographed labels', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await screen.findByTestId('coin-detail-label');
      expect(screen.queryByText('Catalogue entry')).not.toBeInTheDocument();
      expect(screen.queryByText('Plate not yet photographed')).not.toBeInTheDocument();
    });
  });

  describe('run_20261019_205931 criterion 3: plate', () => {
    it('shows the placeholder caption and no attribution when there is no imageUrl', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const caption = await screen.findByTestId('coin-detail-plate-caption');
      expect(caption).toHaveTextContent('Placeholder. A photo from Wikimedia Commons will appear here.');
      expect(within(screen.getByTestId('coin-detail-plate')).getByTestId('placeholder-coin')).toBeInTheDocument();
    });

    it('shows the attribution and no placeholder caption when imageUrl exists', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage();

      await screen.findByTestId('coin-detail-attribution');
      expect(screen.queryByTestId('coin-detail-plate-caption')).not.toBeInTheDocument();
      expect(within(screen.getByTestId('coin-detail-plate')).getByTestId('coin-detail-image')).toBeInTheDocument();
    });

    it('data-owned is false for a signed-out visitor', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      expect(await screen.findByTestId('coin-detail-plate')).toHaveAttribute('data-owned', 'false');
    });

    it('data-owned is false when signed in and not owned', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await screen.findByTestId('coin-detail-ownership-panel');
      expect(screen.getByTestId('coin-detail-plate')).toHaveAttribute('data-owned', 'false');
    });

    it('data-owned is true when signed in and owned', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: OWNED_COLLECTION as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-plate')).toHaveAttribute('data-owned', 'true');
      });
    });

    it('puts the key-date badge inside the plate', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: { ...COIN_NO_IMAGE, isKeyDate: true } as never }));
      renderPage();

      const badge = await screen.findByTestId('coin-detail-key-date-badge');
      expect(screen.getByTestId('coin-detail-plate')).toContainElement(badge);
      expect(within(badge).getByTestId('badge')).toHaveAttribute('data-variant', 'key-date');
      expect(badge).toHaveTextContent('★ Key date');
    });
  });

  describe('run_20261019_205931 criteria 4-7, 13: ownership panel and mobile bar', () => {
    it('renders the not-owned panel and bar when signed in', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const panel = await screen.findByTestId('coin-detail-ownership-panel');
      expect(panel).toHaveAttribute('data-state', 'not-owned');
      expect(within(panel).getByTestId('coin-detail-ownership-title')).toHaveTextContent('Not in your collection');
      expect(within(panel).getByTestId('coin-detail-ownership-note')).toBeInTheDocument();
      const bar = screen.getByTestId('coin-detail-mobile-bar');
      expect(bar).toHaveAttribute('data-state', 'not-owned');
      expect(screen.getByTestId('coin-detail-mobile-bar-toggle')).toHaveTextContent('Mark as owned');
    });

    it('renders the owned state in the panel and the bar', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: OWNED_COLLECTION as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-ownership-panel')).toHaveAttribute('data-state', 'owned');
      });
      expect(screen.getByTestId('coin-detail-mobile-bar')).toHaveAttribute('data-state', 'owned');
      expect(screen.getByTestId('coin-detail-mobile-bar-toggle')).toHaveTextContent('Remove from collection');
    });

    it('the bar toggle calls mutate with the opposite of the owned value', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByTestId('coin-detail-mobile-bar-toggle'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'coin-1', owned: true });
    });

    it('names the toggle with the getCoinName title', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const toggle = await screen.findByTestId('coin-detail-owned-toggle');
      expect(toggle).toHaveAttribute('aria-label', 'Mark Type 2 as owned');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('is pending while the mutation is in flight: toggles are disabled', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useSetOwnershipMock.mockReturnValue(ownershipResult({ isPending: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-ownership-panel')).toHaveAttribute('data-state', 'pending');
      });
      expect(screen.getByTestId('coin-detail-owned-toggle')).toBeDisabled();
      expect(screen.getByTestId('coin-detail-mobile-bar-toggle')).toBeDisabled();
    });

    it('shows the failed state when failedCoinIds has this coin and not for another coin', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useSetOwnershipMock.mockReturnValue(ownershipResult({ failedCoinIds: new Set(['coin-1']) }));
      const { unmount } = renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-ownership-panel')).toHaveAttribute('data-state', 'failed');
      });
      expect(
        within(screen.getByTestId('coin-detail-ownership-panel')).getByTestId('coin-detail-ownership-title'),
      ).toHaveTextContent('Couldn’t save');
      expect(screen.getByTestId('coin-detail-owned-toggle')).toHaveTextContent('Try again');
      expect(screen.getByTestId('coin-detail-mobile-bar')).toHaveAttribute('data-state', 'failed');
      unmount();

      useSetOwnershipMock.mockReturnValue(ownershipResult({ failedCoinIds: new Set(['other-coin']) }));
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-ownership-panel')).toHaveAttribute('data-state', 'not-owned');
      });
    });

    it('Try again re-issues the change: mark owned when the coin is not owned', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useSetOwnershipMock.mockReturnValue(ownershipResult({ failedCoinIds: new Set(['coin-1']) }));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByTestId('coin-detail-owned-toggle'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'coin-1', owned: true });
    });

    it('Try again from the bar re-issues the removal when the coin is owned', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useCollectionMock.mockReturnValue(collectionResult({ data: OWNED_COLLECTION as never }));
      useSetOwnershipMock.mockReturnValue(ownershipResult({ failedCoinIds: new Set(['coin-1']) }));
      const user = userEvent.setup();
      renderPage();

      await user.click(await screen.findByTestId('coin-detail-mobile-bar-toggle'));

      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'coin-1', owned: false });
    });

    it('signed out: no panel, no bar, no sets section, no add-to-set; login prompt stays', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await screen.findByTestId('coin-detail-login-prompt');
      expect(screen.queryByTestId('coin-detail-ownership-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-mobile-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-sets')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-add-to-set')).not.toBeInTheDocument();
    });
  });

  describe('run_20261019_205931 criterion 6: live region', () => {
    async function renderSignedIn() {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();
      return screen.findByTestId('coin-detail-live');
    }

    it('is a polite status region, empty at first', async () => {
      const live = await renderSignedIn();
      expect(live).toHaveAttribute('role', 'status');
      expect(live).toHaveAttribute('aria-live', 'polite');
      expect(live).toHaveTextContent(/^$/);
    });

    it('announces an owned save', async () => {
      const live = await renderSignedIn();
      act(() => {
        lastOwnershipOptions().onSettled?.(null, { coinId: 'coin-1', owned: true });
      });
      expect(live).toHaveTextContent('Type 2 marked as owned.');
    });

    it('announces a removal', async () => {
      const live = await renderSignedIn();
      act(() => {
        lastOwnershipOptions().onSettled?.(null, { coinId: 'coin-1', owned: false });
      });
      expect(live).toHaveTextContent('Type 2 removed from your collection.');
    });

    it('announces a failure', async () => {
      const live = await renderSignedIn();
      act(() => {
        lastOwnershipOptions().onSettled?.(new Error('boom'), { coinId: 'coin-1', owned: true });
      });
      expect(live).toHaveTextContent('Couldn’t save Type 2.');
    });

    it('ignores settles for other coins', async () => {
      const live = await renderSignedIn();
      act(() => {
        lastOwnershipOptions().onSettled?.(null, { coinId: 'other-coin', owned: true });
      });
      expect(live).toHaveTextContent(/^$/);
    });

    it('does not steal focus from the toggle', async () => {
      await renderSignedIn();
      const toggle = screen.getByTestId('coin-detail-owned-toggle');
      toggle.focus();
      act(() => {
        lastOwnershipOptions().onSettled?.(null, { coinId: 'coin-1', owned: true });
      });
      expect(toggle).toHaveFocus();
    });
  });

  describe('run_20261019_205931 criterion 9: In your sets progress', () => {
    it('shows a link, progressbar and mono label for each set that contains the coin', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      mockGapsSetAOnly();
      renderPage();

      const section = await screen.findByTestId('coin-detail-sets');
      expect(within(section).getByRole('heading', { name: 'In your sets' })).toBeInTheDocument();
      const progress = within(section).getByTestId('coin-detail-set-progress');
      expect(progress).toHaveAttribute('role', 'progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '29');
      expect(progress).toHaveAttribute('aria-valuemin', '0');
      expect(progress).toHaveAttribute('aria-valuemax', '100');
      const label = within(section).getByTestId('coin-detail-set-progress-label');
      expect(label).toHaveTextContent('2 of 7 owned · 29%');
      expect(label.className).toContain('font-mono');
    });

    it('renders one row per containing set with its own numbers', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 'set-a' ? 2 : 5,
        totalCount: id === 'set-a' ? 7 : 10,
        completionPercent: id === 'set-a' ? 29 : 50,
        slots: [{ id: `${id}-slot`, position: 0, coin: COIN_WITH_IMAGE, owned: true }],
      }));
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('coin-detail-set-item')).toHaveLength(2);
      });
      const labels = screen.getAllByTestId('coin-detail-set-progress-label').map((l) => l.textContent);
      expect(labels).toEqual(['2 of 7 owned · 29%', '5 of 10 owned · 50%']);
      expect(screen.getAllByTestId('coin-detail-set-link').map((l) => l.getAttribute('href'))).toEqual([
        '/sets/set-a',
        '/sets/set-b',
      ]);
    });

    it('hides the whole section (no empty heading) when the coin is in no set, but keeps Add to a set…', async () => {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      getSetGapsMock.mockResolvedValue({
        setId: 'x',
        ownedCount: 0,
        totalCount: 3,
        completionPercent: 0,
        slots: [{ id: 's', position: 0, coin: { ...COIN_WITH_IMAGE, id: 'other-coin' }, owned: false }],
      });
      renderPage();

      await screen.findByTestId('coin-detail-add-to-set');
      expect(screen.queryByTestId('coin-detail-sets')).not.toBeInTheDocument();
      expect(screen.queryByText('In your sets')).not.toBeInTheDocument();
    });
  });

  describe('run_20261019_205931 criteria 10-11: Add to a set menu', () => {
    async function openMenuWithSets() {
      signIn();
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      useUserSetsMock.mockReturnValue(userSetsResult({ data: USER_SETS as never }));
      mockGapsSetAOnly();
      const user = userEvent.setup();
      renderPage();

      await screen.findByTestId('coin-detail-sets');
      await user.click(screen.getByTestId('coin-detail-add-to-set'));
      return user;
    }

    it('lists each user set: containing sets are checked and inert, others available', async () => {
      await openMenuWithSets();

      const menu = screen.getByTestId('coin-detail-add-to-set-menu');
      expect(menu).toHaveAttribute('role', 'menu');
      const items = within(menu).getAllByTestId('coin-detail-add-to-set-item');
      expect(items.map((i) => i.getAttribute('data-set-id'))).toEqual(['set-a', 'set-b']);
      expect(items[0]).toHaveAttribute('aria-checked', 'true');
      expect(items[0]).toHaveAttribute('aria-disabled', 'true');
      expect(items[0]).toHaveTextContent('✓ Added');
      expect(items[1]).toHaveAttribute('aria-checked', 'false');
      expect(items[1]).toHaveTextContent('My Key Dates');
      expect(items[1]).not.toHaveAttribute('aria-disabled', 'true');
      expect(within(menu).getByTestId('coin-detail-add-to-set-new')).toHaveAttribute('href', '/sets/new');
    });

    it('clicking an available set calls useAddCoinsToSet().mutateAsync with the set and this coin', async () => {
      const user = await openMenuWithSets();

      await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[1]);

      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
      expect(mutateAsyncMock).toHaveBeenCalledWith({ setId: 'set-b', coinIds: ['coin-1'] });
    });

    it('does not call mutateAsync when clicking an already-added set', async () => {
      const user = await openMenuWithSets();

      await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[0]);

      expect(mutateAsyncMock).not.toHaveBeenCalled();
    });

    it('shows Added and announces success after the add resolves, keeping the menu open', async () => {
      const user = await openMenuWithSets();

      await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[1]);

      await waitFor(() => {
        expect(screen.getAllByTestId('coin-detail-add-to-set-item')[1]).toHaveAttribute('aria-checked', 'true');
      });
      expect(screen.getAllByTestId('coin-detail-add-to-set-item')[1]).toHaveTextContent('✓ Added');
      expect(screen.getByTestId('coin-detail-live')).toHaveTextContent('Type 2 added to My Key Dates.');
      expect(screen.getByTestId('coin-detail-add-to-set-menu')).toBeInTheDocument();
    });

    it('shows Adding… while the request is in flight', async () => {
      let resolveAdd: (value: unknown) => void = () => undefined;
      mutateAsyncMock.mockReturnValue(new Promise((resolve) => (resolveAdd = resolve)));
      const user = await openMenuWithSets();

      await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[1]);

      await waitFor(() => {
        expect(screen.getAllByTestId('coin-detail-add-to-set-item')[1]).toHaveTextContent('Adding…');
      });
      expect(screen.getAllByTestId('coin-detail-add-to-set-item')[1]).toHaveAttribute('aria-disabled', 'true');
      await act(async () => {
        resolveAdd([]);
      });
    });

    it('announces a failure and leaves the set available', async () => {
      mutateAsyncMock.mockRejectedValue(new Error('nope'));
      const user = await openMenuWithSets();

      await user.click(screen.getAllByTestId('coin-detail-add-to-set-item')[1]);

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-live')).toHaveTextContent('Couldn’t add Type 2 to My Key Dates.');
      });
      const item = screen.getAllByTestId('coin-detail-add-to-set-item')[1];
      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('run_20261019_205931 criterion 12: specs table', () => {
    it('always renders six rows in order with their labels', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const table = await screen.findByTestId('coin-detail-specs');
      const headers = within(table).getAllByRole('rowheader');
      expect(headers.map((h) => h.textContent)).toEqual([
        'Diameter',
        'Weight',
        'Thickness',
        'Material',
        'Mintage',
        'Mint mark',
      ]);
      expect(within(table).getAllByRole('row')).toHaveLength(6);
    });

    it('renders recorded values in mono and a missing mint mark as Not recorded', async () => {
      useCoinMock.mockReturnValue(
        queryResult({
          data: { ...COIN_NO_IMAGE, mintMark: '', weightG: 2.5, mintage: 1234567 } as never,
        }),
      );
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-weight')).toHaveTextContent('2.5 g');
      });
      expect(screen.getByTestId('coin-detail-mintage')).toHaveTextContent('1,234,567');
      expect(screen.getByTestId('coin-detail-mintage').className).toContain('tabular-nums');
      expect(screen.getByTestId('coin-detail-mint-mark')).toHaveTextContent('Not recorded');
      expect(screen.getByTestId('coin-detail-mint-mark').className).toContain('italic');
    });

    it('shows the Wikipedia attribution under the table', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      const attribution = await screen.findByTestId('coin-detail-specs-attribution');
      expect(attribution).toHaveTextContent(/Wikipedia/);
      expect(within(attribution).getByRole('link')).toBeInTheDocument();
      const table = screen.getByTestId('coin-detail-specs');
      expect(table.compareDocumentPosition(attribution) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
