/**
 * Tests for: SetEditorPage Album default, view switch / URL, year groups, Show filter, owner toggle
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Page: SetEditorPage (MODIFY),
 *                  lib/set-view.ts, SetYearGroup, SetAlbum, SetCoinList
 * Covers criteria: #1, #3, #5, #7, #8, #11, #13 (page-level)
 *
 * Replaces the previous run's version: List was the default there, ?view=album was the URL param, and the
 * album was country pages with mint-mark tables. Now Album is the default, ?view=list selects List, and both
 * views are grouped by year.
 *
 * jsdom loads no CSS, so owner-only and breakpoint-only elements are all present; tests use specific testids.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoinName } from '@coin-collector/shared';
import SetEditorPage from '@/app/sets/[id]/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import {
  useAddCoinsToSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import { useBulkSetOwnership, useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
  useUserSets: vi.fn(),
  usePatchSetCoins: vi.fn(),
  useAddCoinsToSet: vi.fn(),
  useRenameSet: vi.fn(),
  useDeleteSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useSetOwnership: vi.fn(),
  useBulkSetOwnership: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const useUserSetsMock = vi.mocked(useUserSets);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useAddCoinsToSetMock = vi.mocked(useAddCoinsToSet);
const useRenameSetMock = vi.mocked(useRenameSet);
const useDeleteSetMock = vi.mocked(useDeleteSet);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useBulkSetOwnershipMock = vi.mocked(useBulkSetOwnership);
const useCatalogMock = vi.mocked(useCatalog);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), isPending: false } as never;
}

const BASE_COIN = {
  id: 'coin-a',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  mintMark: '',
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_A = BASE_COIN; // 2025, owned
const COIN_B = { ...BASE_COIN, id: 'coin-b', variety: 'We Are Strong. We Are Together: Luhansk Oblast' }; // 2025
const COIN_C = { ...BASE_COIN, id: 'coin-c', year: 2026, variety: 'We Are Strong. We Are Together: Odesa Oblast' };
const COIN_D = { ...BASE_COIN, id: 'coin-d', year: 2026, variety: 'We Are Strong. We Are Together: Kyiv Oblast' };

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'We Are Strong. We Are Together',
  clonedFromCanonicalId: 'canon-1',
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-a', position: 0, coin: COIN_A },
    { id: 'usc-b', position: 1, coin: COIN_B },
    { id: 'usc-c', position: 2, coin: COIN_C },
    { id: 'usc-d', position: 3, coin: COIN_D },
  ],
};

// Array order is deliberately not position order and not year order.
const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-d', position: 3, coin: COIN_D, owned: false },
    { id: 'usc-a', position: 0, coin: COIN_A, owned: true },
    { id: 'usc-c', position: 2, coin: COIN_C, owned: false },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: false },
  ],
};

const GAPS_ALL_OWNED = {
  ...GAPS,
  ownedCount: 4,
  completionPercent: 100,
  slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
};

// 2025 fully owned, 2026 missing
const GAPS_2025_DONE = {
  ...GAPS,
  ownedCount: 2,
  completionPercent: 50,
  slots: GAPS.slots.map((s) => ({ ...s, owned: s.coin.year === 2025 })),
};

const MY_SETS = [
  {
    id: 'set-1',
    userId: 'user-1',
    name: 'We Are Strong. We Are Together',
    clonedFromCanonicalId: 'canon-1',
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

function renderPage(id = 'set-1') {
  const params = Promise.resolve({ id });
  const utils = render(<SetEditorPage params={params} />);
  return { ...utils, params };
}

function setUrl(path: string) {
  window.history.replaceState(null, '', path);
}

function groupFor(year: number): HTMLElement {
  const found = screen.getAllByTestId('set-year-group').find((el) => el.getAttribute('data-year') === String(year));
  if (!found) throw new Error(`no group for ${year}`);
  return found;
}

function itemIds(container: HTMLElement): (string | null)[] {
  return within(container)
    .getAllByTestId('set-album-item')
    .map((el) => el.getAttribute('data-coin-id'));
}

describe('SetEditorPage: Album default, views and year groups', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('/sets/set-1');
    pushMock.mockClear();
    replaceMock.mockClear();
    [
      usePublicSetMock,
      useSetGapsMock,
      useUserSetsMock,
      usePatchSetCoinsMock,
      useAddCoinsToSetMock,
      useRenameSetMock,
      useDeleteSetMock,
      useSetOwnershipMock,
      useBulkSetOwnershipMock,
      useCatalogMock,
    ].forEach((m) => m.mockReset());

    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
    usePatchSetCoinsMock.mockReturnValue(mutationMock());
    useAddCoinsToSetMock.mockReturnValue(mutationMock());
    useRenameSetMock.mockReturnValue(mutationMock());
    useDeleteSetMock.mockReturnValue(mutationMock());
    useSetOwnershipMock.mockReturnValue(mutationMock());
    useBulkSetOwnershipMock.mockReturnValue(mutationMock());
    useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
    setStoredToken('tok-abc');
  });

  describe('criterion 1: Album is the default view', () => {
    it('shows the album with Album pressed when there is no ?view', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-groups')).toBeInTheDocument();
      });
      expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('set-coin-list')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('falls back to the album for an invalid ?view value and for ?view=album', async () => {
      setUrl('/sets/set-1?view=grid');
      const { unmount } = renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      });
      expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'true');
      unmount();

      setUrl('/sets/set-1?view=album');
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      });
      expect(screen.queryByTestId('set-coin-list')).not.toBeInTheDocument();
    });

    it('opens List when loaded with ?view=list', async () => {
      setUrl('/sets/set-1?view=list');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-list').length).toBeGreaterThan(0);
      });
      expect(screen.queryByTestId('set-album-grid')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('puts Album before List in the view switch', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-view-switch')).toBeInTheDocument();
      });

      const buttons = within(screen.getByTestId('set-editor-view-switch')).getAllByRole('button');
      expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
        'set-editor-view-album-toggle',
        'set-editor-view-list-toggle',
      ]);
    });
  });

  describe('view is kept in the URL (replaceState, never a router push)', () => {
    it('selecting List shows the list and writes ?view=list', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      });

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));

      expect(screen.getAllByTestId('set-coin-list').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('set-album-grid')).not.toBeInTheDocument();
      expect(window.location.search).toBe('?view=list');
      expect(window.location.pathname).toBe('/sets/set-1');
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('switching back to Album removes the view param', async () => {
      setUrl('/sets/set-1?view=list');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-list').length).toBeGreaterThan(0);
      });

      await user.click(screen.getByTestId('set-editor-view-album-toggle'));

      expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      expect(window.location.search).toBe('');
    });

    it('preserves other query params when switching', async () => {
      setUrl('/sets/set-1?x=1');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-view-list-toggle')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));
      expect(window.location.search).toBe('?x=1&view=list');

      await user.click(screen.getByTestId('set-editor-view-album-toggle'));
      expect(window.location.search).toBe('?x=1');
    });

    it('keeps the Missing filter and the progress when switching views', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-show-missing-toggle')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));
      await user.click(screen.getByTestId('set-editor-view-list-toggle'));

      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');
    });
  });

  describe('criterion 5: coins are grouped by year', () => {
    it('renders groups in ascending year order with owned / total summaries, from scrambled slots', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      const groups = screen.getAllByTestId('set-year-group');
      expect(groups.map((g) => g.getAttribute('data-year'))).toEqual(['2025', '2026']);
      expect(within(groups[0]).getByTestId('set-year-group-summary')).toHaveTextContent('1 of 2 owned');
      expect(within(groups[1]).getByTestId('set-year-group-summary')).toHaveTextContent('0 of 2 owned');
      expect(within(screen.getByTestId('set-editor-groups')).getAllByTestId('set-year-group')).toHaveLength(2);
    });

    it('orders cards in a group by position', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      expect(itemIds(groupFor(2025))).toEqual(['coin-a', 'coin-b']);
      expect(itemIds(groupFor(2026))).toEqual(['coin-c', 'coin-d']);
    });

    it('groups List rows by year too', async () => {
      setUrl('/sets/set-1?view=list');
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      const rows2025 = within(groupFor(2025)).getAllByTestId('set-coin-row');
      expect(rows2025.map((r) => r.getAttribute('data-coin-id'))).toEqual(['coin-a', 'coin-b']);
      const rows2026 = within(groupFor(2026)).getAllByTestId('set-coin-row');
      expect(rows2026.map((r) => r.getAttribute('data-coin-id'))).toEqual(['coin-c', 'coin-d']);
    });

    it('shows Mark all only on groups with missing coins, with the singular for one', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      expect(within(groupFor(2025)).getByTestId('set-year-group-mark-all')).toHaveTextContent('Mark 1 as owned');
      expect(within(groupFor(2026)).getByTestId('set-year-group-mark-all')).toHaveTextContent('Mark all 2 as owned');
    });

    it('has no Mark all on a fully owned year', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_2025_DONE }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      expect(within(groupFor(2025)).queryByTestId('set-year-group-mark-all')).not.toBeInTheDocument();
      expect(within(groupFor(2026)).getByTestId('set-year-group-mark-all')).toBeInTheDocument();
    });

    it('has no Mark all anywhere for a visitor', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      expect(screen.queryAllByTestId('set-year-group-mark-all')).toHaveLength(0);
    });
  });

  describe('criterion 1: Show All / Missing filter', () => {
    it('Missing hides owned coins and keeps the whole-year counts; All brings them back', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.getAllByTestId('set-album-item').map((i) => i.getAttribute('data-coin-id'))).toEqual([
        'coin-b',
        'coin-c',
        'coin-d',
      ]);
      expect(within(groupFor(2025)).getByTestId('set-year-group-summary')).toHaveTextContent('1 of 2 owned');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByTestId('set-editor-show-all-toggle'));
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
    });

    it('Missing drops a year group whose coins are all owned', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_2025_DONE }));
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.getAllByTestId('set-year-group').map((g) => g.getAttribute('data-year'))).toEqual(['2026']);

      await user.click(screen.getByTestId('set-editor-show-all-toggle'));
      expect(screen.getAllByTestId('set-year-group').map((g) => g.getAttribute('data-year'))).toEqual([
        '2025',
        '2026',
      ]);
    });

    it('Missing in List view filters the rows the same way', async () => {
      setUrl('/sets/set-1?view=list');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.getAllByTestId('set-coin-row').map((r) => r.getAttribute('data-coin-id'))).toEqual([
        'coin-b',
        'coin-c',
        'coin-d',
      ]);
    });
  });

  describe('criteria 7, 8: album cards and the owner toggle', () => {
    it('renders each card with the getCoinName title and a link to the coin page', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      const itemB = screen.getAllByTestId('set-album-item').find((i) => i.getAttribute('data-coin-id') === 'coin-b');
      expect(itemB).toBeDefined();
      expect(within(itemB as HTMLElement).getByTestId('coin-card-title')).toHaveTextContent(
        getCoinName(COIN_B).title,
      );
      expect(within(itemB as HTMLElement).getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/coin-b');
    });

    it('clicking a card check calls the single ownership mutation with the flipped state and the coin', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const bulkMutate = vi.fn();
      useBulkSetOwnershipMock.mockReturnValue({ mutate: bulkMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      const itemB = screen.getAllByTestId('set-album-item').find((i) => i.getAttribute('data-coin-id') === 'coin-b');
      await user.click(within(itemB as HTMLElement).getByTestId('status-toggle'));

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-b', owned: true, coin: COIN_B });
      expect(bulkMutate).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('toggling an owned coin sends owned: false', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      const itemA = screen.getAllByTestId('set-album-item').find((i) => i.getAttribute('data-coin-id') === 'coin-a');
      await user.click(within(itemA as HTMLElement).getByTestId('status-toggle'));

      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-a', owned: false, coin: COIN_A });
    });

    it('a list pill click calls the same single mutation', async () => {
      setUrl('/sets/set-1?view=list');
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });

      const rowC = screen.getAllByTestId('set-coin-row').find((r) => r.getAttribute('data-coin-id') === 'coin-c');
      await user.click(within(rowC as HTMLElement).getByTestId('status-toggle'));

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-c', owned: true, coin: COIN_C });
    });

    it('counts and cards update when the gaps are refetched', async () => {
      const { rerender, params } = renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });
      expect(within(groupFor(2025)).getByTestId('set-year-group-summary')).toHaveTextContent('1 of 2 owned');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_2025_DONE }));
      rerender(<SetEditorPage params={params} />);

      await waitFor(() => {
        expect(within(groupFor(2025)).getByTestId('set-year-group-summary')).toHaveTextContent('2 of 2 owned');
      });
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('50%');
      expect(within(groupFor(2025)).queryByTestId('set-year-group-mark-all')).not.toBeInTheDocument();
    });
  });

  describe('visitor', () => {
    it('renders cards as catalog links with no check and no ownership mutation', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
      screen.getAllByTestId('coin-card').forEach((card) => {
        expect(card).toHaveAttribute('data-state', 'visitor');
      });
      const firstLink = screen.getAllByTestId('coin-card-link')[0];
      firstLink.addEventListener('click', (e) => e.preventDefault());
      await user.click(firstLink);
      expect(ownershipMutate).not.toHaveBeenCalled();
    });

    it('renders List rows without toggles or menus for a visitor', async () => {
      setUrl('/sets/set-1?view=list');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });

      expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
      expect(screen.queryAllByTestId('coin-row-menu-trigger')).toHaveLength(0);
    });
  });

  describe('controls keep working in album view', () => {
    it('keeps Download and Print in the set menu, and the Missing count in the segments', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-grid').length).toBeGreaterThan(0);
      });

      await userEvent.setup().click(screen.getByTestId('set-editor-actions-trigger'));
      expect(screen.getByTestId('set-editor-download-missing')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-print-missing')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 3');
    });

    it('a fully owned set shows Missing 0 and no Mark all', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
      });

      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 0');
      expect(screen.queryAllByTestId('set-year-group-mark-all')).toHaveLength(0);
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('100%');
    });
  });
});
