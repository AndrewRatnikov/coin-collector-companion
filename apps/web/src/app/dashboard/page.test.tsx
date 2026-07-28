/**
 * Tests for: DashboardPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: DashboardPage (MODIFY)
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/dashboard/page.tsx
 * Covers criteria: #8, #9 (from run_20260721_161448's prd.md), #9 (from run_20260728_071525's prd.md)
 *
 * This replaces run_20260721_094026's placeholder dashboard test entirely — that run
 * only verified the Day 1 RequireAuth-gated placeholder; this run builds the real
 * content described in plan.md. The auth-redirect behavior is still covered below.
 *
 * DashboardPage calls the real (unmocked) `useQueries` from '@tanstack/react-query'
 * per the Interface Contract (a dynamic per-set gap query list), so every render here
 * needs a real QueryClientProvider ancestor — unlike pages that mock their query hooks
 * wholesale and need no provider at all.
 *
 * run_20260728_071525: adds coverage for the three new stat tiles
 * (dashboard-stat-sets / dashboard-stat-coins-owned / dashboard-stat-average-completion),
 * per plan.md's exact formula: coins-owned sums ownedCount across all resolved per-set
 * gap query results (double-counting a coin present in >1 set is a deliberate,
 * documented simplification, not a bug — see plan.md § Risks), and average-completion is
 * the rounded mean of completionPercent across the same resolved results. Every other
 * assertion below is carried over unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DashboardPage from '@/app/dashboard/page';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
}));

vi.mock('@/lib/user-sets-api', () => ({
  getSetGaps: vi.fn(),
}));

const useUserSetsMock = vi.mocked(useUserSets);
const getSetGapsMock = vi.mocked(getSetGaps);

function userSetsResult(overrides: Partial<ReturnType<typeof useUserSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useUserSets>;
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

const SETS = [
  {
    id: 's1',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 's2',
    userId: 'user-1',
    name: 'My Key Dates',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    useUserSetsMock.mockReset();
    getSetGapsMock.mockReset();
  });

  describe('auth gating (unchanged from Day 1)', () => {
    it('does not render dashboard content and redirects to /login when no token is present', async () => {
      useUserSetsMock.mockReturnValue(userSetsResult({ data: [] }));
      renderDashboard();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });

  describe("criterion 8: lists the user's own sets with completion % when a token is present", () => {
    it('renders one dashboard-set-item per set, each linking to its own /sets/[id] page, with completion %', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: SETS }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 's1' ? 3 : 0,
        totalCount: 10,
        completionPercent: id === 's1' ? 30 : 0,
        slots: [],
      }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getAllByTestId('dashboard-set-item')).toHaveLength(2);
      });
      const items = screen.getAllByTestId('dashboard-set-item');
      expect(within(items[0]).getByText('My Wheat Cents')).toBeInTheDocument();
      expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/sets/s1');
      expect(within(items[1]).getByText('My Key Dates')).toBeInTheDocument();
      expect(within(items[1]).getByRole('link').getAttribute('href')).toBe('/sets/s2');

      await waitFor(() => {
        expect(within(items[0]).getByTestId('dashboard-set-completion')).toHaveTextContent('30%');
      });
      await waitFor(() => {
        expect(within(items[1]).getByTestId('dashboard-set-completion')).toHaveTextContent('0%');
      });
    });

    it('shows dashboard-loading while the set list query is loading', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ isLoading: true }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
      });
    });

    it('shows dashboard-error when the set list query fails', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ isError: true }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 9: shows an empty state pointing at /sets/new when the user has no sets', () => {
    it('renders dashboard-empty and dashboard-new-set-cta instead of a list', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: [] }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('dashboard-new-set-cta').getAttribute('href')).toBe('/sets/new');
      expect(screen.queryByTestId('dashboard-set-list')).not.toBeInTheDocument();
    });
  });

  describe('run_20260728_071525 criterion 9: stat tiles', () => {
    it('renders dashboard-stat-sets as sets.length', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: SETS }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 's1' ? 3 : 0,
        totalCount: 10,
        completionPercent: id === 's1' ? 30 : 0,
        slots: [],
      }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-stat-sets')).toHaveTextContent('2');
      });
    });

    it('renders dashboard-stat-coins-owned as the sum of ownedCount across all resolved per-set gap queries (double-counting allowed, not deduplicated)', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: SETS }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 's1' ? 3 : 5,
        totalCount: 10,
        completionPercent: id === 's1' ? 30 : 50,
        slots: [],
      }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-stat-coins-owned')).toHaveTextContent('8');
      });
    });

    it('renders dashboard-stat-average-completion as the rounded mean of completionPercent across all resolved per-set gap queries', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: SETS }));
      getSetGapsMock.mockImplementation(async (id: string) => ({
        setId: id,
        ownedCount: id === 's1' ? 3 : 0,
        totalCount: 10,
        completionPercent: id === 's1' ? 30 : 0,
        slots: [],
      }));
      renderDashboard();

      // mean of [30, 0] = 15
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-stat-average-completion')).toHaveTextContent('15');
      });
    });

    it('does not show resolved numeric totals for the gap-dependent stats before the per-set gap queries resolve', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: SETS }));
      // Never resolves within this test, simulating gap queries still in flight.
      getSetGapsMock.mockImplementation(() => new Promise(() => {}));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-stat-sets')).toHaveTextContent('2');
      });

      // Per plan.md, the gap-dependent tiles either render '—' or are omitted entirely
      // while their useQueries results are loading (consistent with the existing
      // per-row dashboard-set-completion loading behavior) — either way, they must not
      // show a resolved digit-bearing total yet.
      const coinsOwned = screen.queryByTestId('dashboard-stat-coins-owned');
      const avgCompletion = screen.queryByTestId('dashboard-stat-average-completion');
      if (coinsOwned) {
        expect(coinsOwned.textContent).not.toMatch(/\d/);
      }
      if (avgCompletion) {
        expect(avgCompletion.textContent).not.toMatch(/\d/);
      }
    });

    it('does not render any stat tile when the user has no sets (dashboard-empty state)', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(userSetsResult({ data: [] }));
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('dashboard-stat-sets')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-stat-coins-owned')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-stat-average-completion')).not.toBeInTheDocument();
    });
  });
});
