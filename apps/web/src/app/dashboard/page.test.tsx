/**
 * Tests for: DashboardPage (My sets)
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Component: DashboardPage (MODIFY)
 *                   runs/run_20261011_095624/plan.md § Interface Contract → Page: DashboardPage (MODIFY)
 *                   runs/run_20261018_105617/plan.md § Interface Contract → Page: DashboardPage
 * Covers criteria: #14 (from run_20261011_095624's prd.md: set-deleted notice);
 *                  #1, #4, #5, #6, #7, #8, #9 (from run_20261018_105617's prd.md)
 *
 * This file replaces the earlier dashboard test: the old stat tiles (dashboard-stat-*), list
 * (dashboard-set-list, dashboard-set-completion), per-set /gaps queries and dashboard-new-set-cta
 * are gone, so their assertions are removed. The auth redirect and the set-deleted notice tests are
 * carried over.
 *
 * The page now takes its data from useUserSets() and useSetsSummary() (both mocked here) and
 * MySetsEmpty calls useCanonicalSets() (mocked as well), so no QueryClientProvider is needed.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CanonicalSetSummary, UserSetListItem, UserSetsSummaryResponse } from '@coin-collector/shared';
import DashboardPage from '@/app/dashboard/page';
import { useSetsSummary, useUserSets } from '@/lib/hooks/use-user-sets';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
  useSetsSummary: vi.fn(),
}));

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

const useUserSetsMock = vi.mocked(useUserSets);
const useSetsSummaryMock = vi.mocked(useSetsSummary);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);

const setsRefetch = vi.fn();
const summaryRefetch = vi.fn();

function setsResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: setsRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useUserSets>;
}

function summaryResult(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: summaryRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useSetsSummary>;
}

function canonicalResult(overrides: Record<string, unknown> = {}) {
  return { data: [], isLoading: false, isError: false, ...overrides } as unknown as ReturnType<
    typeof useCanonicalSets
  >;
}

function makeSet(over: Partial<UserSetListItem> & Pick<UserSetListItem, 'id' | 'name'>): UserSetListItem {
  return {
    userId: 'user-1',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownedCount: 0,
    totalCount: 10,
    firstMissing: null,
    ...over,
  };
}

// closest: bravo, alpha, charlie; name: alpha, bravo, charlie; recent: alpha, charlie, bravo;
// most missing: charlie, alpha, bravo. Each sort gives a different order.
const BRAVO = makeSet({
  id: 's-bravo',
  name: 'Bravo Set',
  ownedCount: 8,
  totalCount: 10,
  firstMissing: 'Odesa Oblast',
  clonedFromCanonicalId: 'cs-1',
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});
const CHARLIE = makeSet({
  id: 's-charlie',
  name: 'Charlie Set',
  ownedCount: 2,
  totalCount: 10,
  firstMissing: 'Kyiv Oblast',
  clonedFromUserSetId: 'us-9',
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
});
const ALPHA = makeSet({
  id: 's-alpha',
  name: 'Alpha Set',
  ownedCount: 5,
  totalCount: 10,
  firstMissing: null,
  updatedAt: new Date('2026-04-01T00:00:00.000Z'),
});
const SETS = [BRAVO, CHARLIE, ALPHA];

const SUMMARY: UserSetsSummaryResponse = {
  uniqueMissingCount: 15,
  collectionCount: 40,
  suggestedSet: null,
};

const SUGGESTION = { id: 'cs-7', name: 'Lincoln Wheat Cents', coinCount: 187, ownedCount: 9 };

function checklist(id: string, name: string, coinCount: number): CanonicalSetSummary {
  return { id, name, description: null, source: 'admin', templateVersion: '1', coinCount };
}

function renderDashboard() {
  return render(<DashboardPage />);
}

function mockLoaded(sets: UserSetListItem[], summary: UserSetsSummaryResponse = SUMMARY) {
  useUserSetsMock.mockReturnValue(setsResult({ data: sets }));
  useSetsSummaryMock.mockReturnValue(summaryResult({ data: summary }));
}

function renderedNames() {
  return screen
    .getAllByTestId('dashboard-set-item')
    .map((item) => within(item).getByTestId('set-card-link').textContent);
}

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    replaceMock.mockClear();
    setsRefetch.mockReset();
    summaryRefetch.mockReset();
    useUserSetsMock.mockReset();
    useSetsSummaryMock.mockReset();
    useCanonicalSetsMock.mockReset();
    useCanonicalSetsMock.mockReturnValue(canonicalResult());
  });

  describe('auth gating (unchanged from Day 1)', () => {
    it('does not render dashboard content and redirects to /login when no token is present', async () => {
      mockLoaded([]);
      renderDashboard();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion 1: header', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
    });

    it('renders the "My sets" title', async () => {
      mockLoaded(SETS);
      renderDashboard();

      const title = await screen.findByTestId('dashboard-title');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveTextContent('My sets');
    });

    it('shows "{n} sets" for several sets', async () => {
      mockLoaded(SETS);
      renderDashboard();

      expect(await screen.findByTestId('dashboard-set-count')).toHaveTextContent(/^3 sets$/);
    });

    it('shows the singular "1 set" for one set', async () => {
      mockLoaded([ALPHA]);
      renderDashboard();

      expect(await screen.findByTestId('dashboard-set-count')).toHaveTextContent(/^1 set$/);
    });

    it('links to the browse page and the New set flow', async () => {
      mockLoaded(SETS);
      renderDashboard();

      const browse = await screen.findByTestId('dashboard-browse-link');
      expect(browse).toHaveAttribute('href', '/sets');
      expect(browse).toHaveTextContent('Browse checklists and collectors’ sets');
      const newSet = screen.getByTestId('dashboard-new-set');
      expect(newSet).toHaveAttribute('href', '/sets/new');
      expect(newSet).toHaveTextContent('New set');
    });

    it('keeps the header actions during loading and error', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ isLoading: true }));
      useSetsSummaryMock.mockReturnValue(summaryResult({ isLoading: true }));
      const { unmount } = renderDashboard();
      expect(await screen.findByTestId('dashboard-new-set')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-browse-link')).toBeInTheDocument();
      unmount();

      useUserSetsMock.mockReturnValue(setsResult({ isError: true }));
      useSetsSummaryMock.mockReturnValue(summaryResult());
      renderDashboard();
      expect(await screen.findByTestId('dashboard-new-set')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-browse-link')).toBeInTheDocument();
    });

    it('does not show the old stat tiles or list markup', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-page');
      for (const id of [
        'dashboard-stat-sets',
        'dashboard-stat-coins-owned',
        'dashboard-stat-average-completion',
        'dashboard-set-list',
        'dashboard-set-completion',
        'dashboard-new-set-cta',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });
  });

  describe('criterion 4: summary tiles', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
    });

    it('renders the three tiles with values from the summary', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-summary');
      expect(screen.getByTestId('dashboard-tile-missing-value')).toHaveTextContent(/^15$/);
      expect(screen.getByTestId('dashboard-tile-collection-value')).toHaveTextContent(/^40$/);
      expect(screen.getByTestId('dashboard-tile-closest-name')).toHaveTextContent('Bravo Set');
    });

    it('shows the closest set coins-to-go detail', async () => {
      mockLoaded(SETS);
      renderDashboard();

      expect(await screen.findByTestId('dashboard-tile-closest-detail')).toHaveTextContent(
        '2 coins to go · Odesa Oblast',
      );
    });
  });

  describe('criterion 5: set grid', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
    });

    it('renders one SetCard per set, each linking to /sets/{id}', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      const items = screen.getAllByTestId('dashboard-set-item');
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(within(item).getAllByTestId('set-card')).toHaveLength(1);
      }
      const hrefs = Object.fromEntries(
        items.map((item) => {
          const link = within(item).getByTestId('set-card-link');
          return [link.textContent, link.getAttribute('href')];
        }),
      );
      expect(hrefs).toEqual({
        'Bravo Set': '/sets/s-bravo',
        'Charlie Set': '/sets/s-charlie',
        'Alpha Set': '/sets/s-alpha',
      });
      expect(screen.getByTestId('dashboard-set-grid').tagName).toBe('UL');
      expect(items[0].tagName).toBe('LI');
    });

    it('feeds each card its own progress and next missing coin', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      // Default order is closest to complete: Bravo, Alpha, Charlie.
      const [bravo, alpha, charlie] = screen.getAllByTestId('dashboard-set-item');
      expect(within(bravo).getByTestId('set-card-owned')).toHaveTextContent(/^8 of 10 owned$/);
      expect(within(bravo).getByTestId('set-card-percent')).toHaveTextContent(/^80%$/);
      expect(within(bravo).getByTestId('set-card-next')).toHaveTextContent('Odesa Oblast');

      expect(within(charlie).getByTestId('set-card-owned')).toHaveTextContent(/^2 of 10 owned$/);
      expect(within(charlie).getByTestId('set-card-next')).toHaveTextContent('Kyiv Oblast');

      expect(within(alpha).queryByTestId('set-card-next')).not.toBeInTheDocument();
      expect(within(alpha).getByTestId('set-card-to-find')).toHaveTextContent('5');
    });

    it('shows the complete state for a complete set', async () => {
      mockLoaded([makeSet({ id: 's-done', name: 'Done Set', ownedCount: 4, totalCount: 4 })]);
      renderDashboard();

      const card = await screen.findByTestId('set-card');
      expect(card).toHaveAttribute('data-complete', 'true');
      expect(within(card).getByTestId('set-card-every-found')).toBeInTheDocument();
    });

    it('labels the source of cloned sets and leaves scratch sets unlabeled', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      // Default order is closest to complete: Bravo, Alpha, Charlie.
      const [bravo, alpha, charlie] = screen.getAllByTestId('dashboard-set-item');
      expect(within(bravo).getByTestId('set-card-source')).toHaveTextContent('From curated checklist');
      expect(within(charlie).getByTestId('set-card-source')).toHaveTextContent('From a collector’s set');
      expect(within(alpha).queryByTestId('set-card-source')).not.toBeInTheDocument();
    });

    it('offers a mobile browse link beside the grid', async () => {
      mockLoaded(SETS);
      renderDashboard();

      const mobileLink = await screen.findByTestId('dashboard-browse-link-mobile');
      expect(mobileLink).toHaveAttribute('href', '/sets');
    });
  });

  describe('criterion 6: sorting', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
      mockLoaded(SETS);
    });

    it('offers the four sorts in order and defaults to closest to complete', async () => {
      renderDashboard();

      const select = await screen.findByTestId('dashboard-sort');
      expect(select.tagName).toBe('SELECT');
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.getAttribute('value'))).toEqual(['closest', 'recent', 'name', 'most-missing']);
      expect(options.map((o) => o.textContent)).toEqual([
        'Closest to complete',
        'Recently updated',
        'Name A–Z',
        'Most missing',
      ]);
      expect(select).toHaveValue('closest');
    });

    it('orders by closest to complete by default', async () => {
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      expect(renderedNames()).toEqual(['Bravo Set', 'Alpha Set', 'Charlie Set']);
    });

    it('reorders by name A to Z', async () => {
      renderDashboard();

      fireEvent.change(await screen.findByTestId('dashboard-sort'), { target: { value: 'name' } });

      expect(renderedNames()).toEqual(['Alpha Set', 'Bravo Set', 'Charlie Set']);
    });

    it('reorders by recently updated', async () => {
      renderDashboard();

      fireEvent.change(await screen.findByTestId('dashboard-sort'), { target: { value: 'recent' } });

      expect(renderedNames()).toEqual(['Alpha Set', 'Charlie Set', 'Bravo Set']);
    });

    it('reorders by most missing', async () => {
      renderDashboard();

      fireEvent.change(await screen.findByTestId('dashboard-sort'), { target: { value: 'most-missing' } });

      expect(renderedNames()).toEqual(['Charlie Set', 'Alpha Set', 'Bravo Set']);
    });

    it('goes back to closest when selected again', async () => {
      renderDashboard();
      const select = await screen.findByTestId('dashboard-sort');

      fireEvent.change(select, { target: { value: 'name' } });
      fireEvent.change(select, { target: { value: 'closest' } });

      expect(renderedNames()).toEqual(['Bravo Set', 'Alpha Set', 'Charlie Set']);
    });
  });

  describe('criterion 7: one set and the next-set suggestion', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
    });

    it('shows the suggestion beside a single set', async () => {
      mockLoaded([ALPHA], { ...SUMMARY, suggestedSet: SUGGESTION });
      renderDashboard();

      expect(await screen.findByTestId('dashboard-suggestion')).toBeInTheDocument();
      expect(screen.getByTestId('dashboard-suggestion-name')).toHaveTextContent('Lincoln Wheat Cents');
      expect(screen.getByTestId('dashboard-suggestion-body')).toHaveTextContent('You already own 9 of them');
      expect(screen.getByTestId('dashboard-suggestion-cta')).toHaveAttribute(
        'href',
        '/sets/new?cloneFrom=canonical&cloneFromId=cs-7',
      );
      expect(screen.getAllByTestId('dashboard-set-item')).toHaveLength(1);
    });

    it('hides the suggestion for a single set when the API has no candidate', async () => {
      mockLoaded([ALPHA], { ...SUMMARY, suggestedSet: null });
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      expect(screen.queryByTestId('dashboard-suggestion')).not.toBeInTheDocument();
    });

    it('hides the suggestion when there is more than one set, even if the API returned one', async () => {
      mockLoaded(SETS, { ...SUMMARY, suggestedSet: SUGGESTION });
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      expect(screen.queryByTestId('dashboard-suggestion')).not.toBeInTheDocument();
    });
  });

  describe('criterion 8: zero sets', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
      mockLoaded([]);
      useCanonicalSetsMock.mockReturnValue(
        canonicalResult({
          data: [
            checklist('c1', 'First', 10),
            checklist('c2', 'Second', 50),
            checklist('c3', 'Third', 30),
            checklist('c4', 'Fourth', 20),
          ],
        }),
      );
    });

    it('renders the empty state with the curated action and the popular checklists', async () => {
      renderDashboard();

      const empty = await screen.findByTestId('dashboard-empty');
      expect(within(empty).getByTestId('dashboard-empty-curated-cta')).toHaveAttribute('href', '/sets/new');
      expect(within(empty).getAllByTestId('dashboard-popular-item')).toHaveLength(3);
      expect(within(empty).getByTestId('dashboard-empty-blank-link')).toHaveAttribute('href', '/sets/new');
    });

    it('does not render the tiles, count, sort, grid or header actions', async () => {
      renderDashboard();

      await screen.findByTestId('dashboard-empty');
      expect(screen.getByTestId('dashboard-title')).toHaveTextContent('My sets');
      for (const id of [
        'dashboard-summary',
        'dashboard-set-count',
        'dashboard-sort',
        'dashboard-set-grid',
        'dashboard-browse-link',
        'dashboard-new-set',
        'dashboard-browse-link-mobile',
        'dashboard-suggestion',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });
  });

  describe('criterion 9: loading and error', () => {
    beforeEach(() => {
      setStoredToken('tok-abc');
    });

    it('shows skeleton tiles and cards while the sets load', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ isLoading: true }));
      useSetsSummaryMock.mockReturnValue(summaryResult({ isLoading: true }));
      renderDashboard();

      const loading = await screen.findByTestId('dashboard-loading');
      expect(loading).toHaveAttribute('aria-busy', 'true');
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(0);
      expect(within(loading).getAllByTestId('set-card-skeleton')).toHaveLength(3);
      expect(screen.queryByTestId('dashboard-set-grid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-set-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-empty')).not.toBeInTheDocument();
    });

    it('keeps showing the loading state while only the summary is still loading', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ data: SETS }));
      useSetsSummaryMock.mockReturnValue(summaryResult({ isLoading: true }));
      renderDashboard();

      expect(await screen.findByTestId('dashboard-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-set-grid')).not.toBeInTheDocument();
    });

    it('shows no loading state once both queries have data', async () => {
      mockLoaded(SETS);
      renderDashboard();

      await screen.findByTestId('dashboard-set-grid');
      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-error')).not.toBeInTheDocument();
    });

    it('shows an alert with the wake-up hint when the sets query fails', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ isError: true }));
      useSetsSummaryMock.mockReturnValue(summaryResult());
      renderDashboard();

      const alert = await screen.findByTestId('dashboard-error');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert).toHaveTextContent('We couldn’t load your sets.');
      expect(alert).toHaveTextContent('up to a minute to wake');
      expect(screen.queryByTestId('dashboard-loading')).not.toBeInTheDocument();
    });

    it('shows the same alert when only the summary query fails, instead of a half-loaded page', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ data: SETS }));
      useSetsSummaryMock.mockReturnValue(summaryResult({ isError: true }));
      renderDashboard();

      expect(await screen.findByTestId('dashboard-error')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-set-grid')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-set-count')).not.toBeInTheDocument();
    });

    it('refetches both queries when "Try again" is clicked', async () => {
      useUserSetsMock.mockReturnValue(setsResult({ isError: true }));
      useSetsSummaryMock.mockReturnValue(summaryResult({ isError: true }));
      renderDashboard();

      const retry = await screen.findByTestId('dashboard-retry');
      expect(retry).toHaveTextContent('Try again');
      expect(setsRefetch).not.toHaveBeenCalled();

      fireEvent.click(retry);

      expect(setsRefetch).toHaveBeenCalledTimes(1);
      expect(summaryRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('run_20261011_095624 criterion 14: one-time set-deleted notice', () => {
    beforeEach(() => {
      sessionStorage.clear();
      setStoredToken('tok-abc');
      mockLoaded(SETS);
    });

    it('shows no notice when the flag is not set', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-deleted-notice')).not.toBeInTheDocument();
    });

    it('shows a status notice naming the deleted set inside the dashboard, and removes the flag', async () => {
      sessionStorage.setItem('ccc-set-deleted', 'My Wheat Cents');
      renderDashboard();

      const notice = await screen.findByTestId('set-deleted-notice');
      expect(notice).toHaveAttribute('role', 'status');
      expect(notice).toHaveTextContent(
        '“My Wheat Cents” was deleted. The coins you own from it are still in your collection.',
      );
      expect(within(screen.getByTestId('dashboard-page')).getByTestId('set-deleted-notice')).toBe(notice);
      expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
    });

    it('prints the stored name, not a fixed one', async () => {
      sessionStorage.setItem('ccc-set-deleted', 'Some Other Set');
      renderDashboard();

      const notice = await screen.findByTestId('set-deleted-notice');
      expect(notice).toHaveTextContent('“Some Other Set” was deleted.');
      expect(notice).not.toHaveTextContent('My Wheat Cents');
    });

    it('does not show the notice again after unmount and a fresh render', async () => {
      sessionStorage.setItem('ccc-set-deleted', 'My Wheat Cents');
      const first = renderDashboard();
      await screen.findByTestId('set-deleted-notice');
      first.unmount();

      renderDashboard();
      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-deleted-notice')).not.toBeInTheDocument();
    });
  });
});
