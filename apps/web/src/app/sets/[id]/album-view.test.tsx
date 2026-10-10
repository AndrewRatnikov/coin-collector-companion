/**
 * Tests for: SetEditorPage Album view wiring (view switch, ?view=album, counts after refetch, controls)
 * Contract source: runs/run_20261010_083926/plan.md § Interface Contract → Component: SetAlbum
 * (set-album-slot retargeted to set-album-card / set-album-card-link / set-album-card-check)
 * Covers criteria: #1, #2, #11, #12, #13, #18, #19 (page-level), #14, #15, #16 (card link, owner check)
 *
 * Mock setup mirrors sets/[id]/coin-variety-link.test.tsx (next/navigation mocked with only useRouter).
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetEditorPage from '@/app/sets/[id]/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership } from '@/lib/hooks/use-collection';
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
  useRenameSet: vi.fn(),
  useDeleteSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useSetOwnership: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const useUserSetsMock = vi.mocked(useUserSets);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useRenameSetMock = vi.mocked(useRenameSet);
const useDeleteSetMock = vi.mocked(useDeleteSet);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useCatalogMock = vi.mocked(useCatalog);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), isPending: false } as never;
}

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: 'Cent',
  year: 1909,
  mintMark: '',
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
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_1 = BASE_COIN; // 1909 '' (owned)
const COIN_2 = { ...BASE_COIN, id: 'coin-2', variety: 'VDB' }; // 1909 '' VDB (missing)
const COIN_3 = { ...BASE_COIN, id: 'coin-3', year: 1931, mintMark: 'S', isKeyDate: true }; // 1931 S (missing)
const COIN_4 = {
  ...BASE_COIN,
  id: 'coin-4',
  country: 'Ukraine',
  denomination: '1 Hryvnia',
  name: 'Commemorative',
  year: 2026,
}; // second series (missing)

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 0, coin: COIN_1 },
    { id: 'usc-2', position: 1, coin: COIN_2 },
    { id: 'usc-3', position: 2, coin: COIN_3 },
    { id: 'usc-4', position: 3, coin: COIN_4 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-3', position: 2, coin: COIN_3, owned: false },
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true },
    { id: 'usc-4', position: 3, coin: COIN_4, owned: false },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false },
  ],
};

// After the owner toggles coin-2 and the gaps are refetched
const GAPS_AFTER = {
  ...GAPS,
  ownedCount: 2,
  completionPercent: 50,
  slots: GAPS.slots.map((s) => (s.id === 'usc-2' ? { ...s, owned: true } : s)),
};

const MY_SETS = [
  {
    id: 'set-1',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
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

function cardByCoin(id: string): HTMLElement {
  const found = screen.getAllByTestId('set-album-card').find((el) => el.getAttribute('data-coin-id') === id);
  if (!found) throw new Error(`no card for ${id}`);
  return found;
}

describe('SetEditorPage: Album view', () => {
  beforeEach(() => {
    localStorage.clear();
    setUrl('/sets/set-1');
    pushMock.mockClear();
    replaceMock.mockClear();
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    useUserSetsMock.mockReset();
    usePatchSetCoinsMock.mockReset();
    useRenameSetMock.mockReset();
    useDeleteSetMock.mockReset();
    useSetOwnershipMock.mockReset();
    useCatalogMock.mockReset();

    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
    usePatchSetCoinsMock.mockReturnValue(mutationMock());
    useRenameSetMock.mockReturnValue(mutationMock());
    useDeleteSetMock.mockReturnValue(mutationMock());
    useSetOwnershipMock.mockReturnValue(mutationMock());
    useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
    setStoredToken('tok-abc');
  });

  describe('criterion 1: switch and default List view', () => {
    it('shows the switch next to All/Missing, with List pressed, and the list view by default', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-view-switch')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-gap-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('set-album')).not.toBeInTheDocument();
    });

    it('falls back to the list view for an invalid ?view value', async () => {
      setUrl('/sets/set-1?view=grid');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-gap-grid')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-album')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('criterion 2: view is kept in the URL', () => {
    it('opens the album view when loaded with ?view=album', async () => {
      setUrl('/sets/set-1?view=album');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-album')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-editor-gap-grid')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('selecting Album shows the album and writes ?view=album without a router navigation', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-gap-grid')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-view-album-toggle'));

      expect(screen.getByTestId('set-album')).toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-gap-grid')).not.toBeInTheDocument();
      expect(window.location.search).toBe('?view=album');
      expect(window.location.pathname).toBe('/sets/set-1');
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('switching back to List removes the view param and shows the list', async () => {
      setUrl('/sets/set-1?view=album');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-album')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));

      expect(screen.getByTestId('set-editor-gap-grid')).toBeInTheDocument();
      expect(screen.queryByTestId('set-album')).not.toBeInTheDocument();
      expect(window.location.search).toBe('');
    });

    it('preserves other query params when switching', async () => {
      setUrl('/sets/set-1?x=1');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-view-album-toggle')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-view-album-toggle'));
      expect(window.location.search).toBe('?x=1&view=album');

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));
      expect(window.location.search).toBe('?x=1');
    });

    it('keeps the Missing filter and the data when switching views', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-show-missing-toggle')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));
      await user.click(screen.getByTestId('set-editor-view-album-toggle'));

      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByTestId('set-album-card')).toHaveLength(4);

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');
    });
  });

  describe('album content from the gap data', () => {
    it('renders two pages (US and Ukrainian series) with their own counts, from scrambled slots', async () => {
      setUrl('/sets/set-1?view=album');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-page')).toHaveLength(2);
      });
      const pages = screen.getAllByTestId('set-album-page');
      expect(within(pages[0]).getByTestId('set-album-page-heading').textContent).toBe('Lincoln Wheat Cent · USA');
      expect(within(pages[0]).getByTestId('set-album-page-count').textContent).toBe('1 of 3 owned');
      expect(within(pages[1]).getByTestId('set-album-page-heading').textContent).toBe('Commemorative · Ukraine');
      expect(within(pages[1]).getByTestId('set-album-page-count').textContent).toBe('0 of 1 owned');
      expect(within(pages[0]).getAllByTestId('set-album-col-header').map((h) => h.getAttribute('data-mint-mark'))).toEqual(
        ['', 'S'],
      );
    });

    it('lays the Ukrainian (no mint mark) page out as a year grid, not a table', async () => {
      setUrl('/sets/set-1?view=album');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-page')).toHaveLength(2);
      });
      const [lincoln, ukraine] = screen.getAllByTestId('set-album-page');
      expect(within(lincoln).getByTestId('set-album-table')).toBeInTheDocument();
      expect(within(ukraine).queryByTestId('set-album-table')).not.toBeInTheDocument();
      expect(within(ukraine).getByTestId('set-album-year-group')).toHaveAttribute('data-year', '2026');
    });
  });

  describe('criterion 11: owner toggles and counts update after refetch', () => {
    it('clicking an album check button calls the ownership mutation for that coin', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      setUrl('/sets/set-1?view=album');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-card')).toHaveLength(4);
      });

      await user.click(within(cardByCoin('coin-2')).getByTestId('set-album-card-check'));

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-2', owned: true });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('card, page count, column footer and overall % update when the gaps are refetched', async () => {
      setUrl('/sets/set-1?view=album');
      const { rerender, params } = renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-page')).toHaveLength(2);
      });
      const firstPage = () => screen.getAllByTestId('set-album-page')[0];
      expect(within(firstPage()).getByTestId('set-album-page-count').textContent).toBe('1 of 3 owned');
      expect(within(firstPage()).getAllByTestId('set-album-col-footer')[0].textContent).toBe('1/2');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_AFTER }));
      rerender(<SetEditorPage params={params} />);

      await waitFor(() => {
        expect(within(firstPage()).getByTestId('set-album-page-count').textContent).toBe('2 of 3 owned');
      });
      expect(within(firstPage()).getAllByTestId('set-album-col-footer')[0].textContent).toBe('2/2');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('50%');
      expect(cardByCoin('coin-2')).toHaveAttribute('data-owned', 'true');
    });
  });

  describe('criterion 12: non-owner', () => {
    it('renders cards as catalog links, shows no check buttons and does not toggle ownership', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      setUrl('/sets/set-1?view=album');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-card')).toHaveLength(4);
      });

      expect(screen.queryByTestId('set-album-card-check')).not.toBeInTheDocument();
      const cards = screen.getAllByTestId('set-album-card');
      cards.forEach((card) => {
        const link = within(card).getByTestId('set-album-card-link');
        expect(link.tagName).toBe('A');
        expect(link).toHaveAttribute('href', `/catalog/${card.getAttribute('data-coin-id')}`);
      });
      const firstLink = within(cards[0]).getByTestId('set-album-card-link');
      firstLink.addEventListener('click', (e) => e.preventDefault());
      await user.click(firstLink);
      expect(ownershipMutate).not.toHaveBeenCalled();
    });
  });

  describe('criterion 13: controls keep working in album view', () => {
    it('shows All/Missing, Download, Print and the completion in album view', async () => {
      setUrl('/sets/set-1?view=album');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-album')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-show-all-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-download-missing')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-print-missing')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');
    });

    it('Missing keeps the full grid and mutes owned cards; All unmutes them', async () => {
      setUrl('/sets/set-1?view=album');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-card')).toHaveLength(4);
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.getAllByTestId('set-album-card')).toHaveLength(4);
      expect(cardByCoin('coin-1')).toHaveAttribute('data-muted', 'true');
      expect(cardByCoin('coin-2')).toHaveAttribute('data-muted', 'false');

      await user.click(screen.getByTestId('set-editor-show-all-toggle'));
      expect(cardByCoin('coin-1')).toHaveAttribute('data-muted', 'false');
    });
  });
});
