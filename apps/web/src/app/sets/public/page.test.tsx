/**
 * Tests for: PublicSetsPage
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: PublicSetsPage
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/sets/public/page.tsx
 * Covers criteria: #4 (from run_20260721_161448's prd.md), #7 (from run_20260728_071525's prd.md)
 *
 * run_20260728_071525: replaces the Prev/indicator/Next pagination assertions with
 * numbered public-sets-pagination-page assertions (REMOVE public-sets-page-prev/
 * -page-indicator/-page-next per plan.md, same pattern as Catalog's numbered
 * pagination). Every other assertion below is carried over unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PublicSetsPage from '@/app/sets/public/page';
import { usePublicSets } from '@/lib/hooks/use-public-sets';

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
}));

const usePublicSetsMock = vi.mocked(usePublicSets);

function queryResult(overrides: Partial<ReturnType<typeof usePublicSets>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof usePublicSets>;
}

const SETS = [
  {
    id: 'u1',
    userId: 'user-1',
    name: 'Alice Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'u2',
    userId: 'user-2',
    name: 'Bob Key Dates',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('PublicSetsPage', () => {
  beforeEach(() => {
    usePublicSetsMock.mockReset();
  });

  describe('criterion 4: anonymous access, no auth gating', () => {
    it('renders result content synchronously with no stored token', () => {
      localStorage.clear();
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 20, total: 2 } }));
      render(<PublicSetsPage />);

      // A route wrapped in RequireAuth never renders its children synchronously when
      // there is no stored token (the auth check itself is an async useEffect) — getting
      // real result content back immediately proves this page isn't gated.
      expect(screen.getByTestId('public-sets-page')).toBeInTheDocument();
      expect(screen.getAllByTestId('public-set-item')).toHaveLength(2);
    });
  });

  describe('criterion 4: shows a loading state while the query is loading', () => {
    it('renders public-sets-loading and no list while isLoading is true', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<PublicSetsPage />);

      expect(screen.getByTestId('public-sets-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('public-sets-list')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: shows an error state when the query fails', () => {
    it('renders public-sets-error when isError is true', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ isError: true }));
      render(<PublicSetsPage />);

      expect(screen.getByTestId('public-sets-error')).toBeInTheDocument();
    });
  });

  describe('criterion 4: renders a paginated list of public sets', () => {
    it('renders one public-set-item per set, linking to its detail page', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 20, total: 2 } }));
      render(<PublicSetsPage />);

      const rows = screen.getAllByTestId('public-set-item');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText('Alice Wheat Cents')).toBeInTheDocument();
      expect(within(rows[0]).getByRole('link').getAttribute('href')).toBe('/sets/public/u1');
      expect(within(rows[1]).getByText('Bob Key Dates')).toBeInTheDocument();
      expect(within(rows[1]).getByRole('link').getAttribute('href')).toBe('/sets/public/u2');
    });

    it('renders public-sets-empty when the result set is empty', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<PublicSetsPage />);

      expect(screen.getByTestId('public-sets-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('public-set-item')).not.toBeInTheDocument();
    });
  });

  describe('run_20260728_071525 criterion 7: numbered pagination (replaces Prev/indicator/Next)', () => {
    it('renders one public-sets-pagination-page element per page, numbered in order', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 2, limit: 1, total: 3 } }));
      render(<PublicSetsPage />);

      const pages = screen.getAllByTestId('public-sets-pagination-page');
      expect(pages).toHaveLength(3);
      expect(pages.map((page) => page.textContent)).toEqual(['1', '2', '3']);
    });

    it('marks the active page with aria-current="page" and leaves the others without it', () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 2, limit: 1, total: 3 } }));
      render(<PublicSetsPage />);

      const pages = screen.getAllByTestId('public-sets-pagination-page');
      expect(pages[1]).toHaveAttribute('aria-current', 'page');
      expect(pages[0]).not.toHaveAttribute('aria-current');
      expect(pages[2]).not.toHaveAttribute('aria-current');
    });

    it('clicking an inactive page number calls usePublicSets with that page number', async () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 1, total: 3 } }));
      const user = userEvent.setup();
      render(<PublicSetsPage />);

      const pages = screen.getAllByTestId('public-sets-pagination-page');
      await user.click(pages[2]);

      const lastCall = usePublicSetsMock.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ page: 3 });
    });

    it('the active page is not clickable — clicking it triggers no additional usePublicSets call', async () => {
      usePublicSetsMock.mockReturnValue(queryResult({ data: { items: SETS, page: 1, limit: 1, total: 3 } }));
      const user = userEvent.setup();
      render(<PublicSetsPage />);

      const callCountBefore = usePublicSetsMock.mock.calls.length;
      const pages = screen.getAllByTestId('public-sets-pagination-page');
      await user.click(pages[0]);

      expect(usePublicSetsMock.mock.calls.length).toBe(callCountBefore);
    });
  });
});
