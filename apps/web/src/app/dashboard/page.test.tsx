/**
 * Tests for: DashboardPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: DashboardPage (MODIFY)
 * Covers criteria: #8, #9 (from prd.md)
 *
 * This replaces run_20260721_094026's placeholder dashboard test entirely — that run
 * only verified the Day 1 RequireAuth-gated placeholder; this run builds the real
 * content described in plan.md. The auth-redirect behavior is still covered below.
 *
 * DashboardPage calls the real (unmocked) `useQueries` from '@tanstack/react-query'
 * per the Interface Contract (a dynamic per-set gap query list), so every render here
 * needs a real QueryClientProvider ancestor — unlike pages that mock their query hooks
 * wholesale and need no provider at all.
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
});
