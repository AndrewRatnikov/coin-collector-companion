/**
 * Tests for: SetEditorPage list-row name block + link to the coin page
 * Contract source: runs/run_20261006_215558/plan.md § Interface Contract → Page: SetEditorPage (modify)
 *                   runs/run_20261017_142658/plan.md § Approach §3 (variety is carried by the title and eyebrow)
 *                   runs/run_20261017_210503/plan.md § Interface Contract → Component: SetCoinList
 *                   runs/run_20261018_161537/plan.md § Interface Contract → Component: AddCoinsSheet
 * Covers criteria: #1, #2, #3, #4 (run_20261006_215558), #6 (run_20261017_142658), #11 (run_20261017_210503),
 *                  #7 (run_20261018_161537)
 *
 * run_20261017_210503: the set-editor-gap-* rows are gone. The same expectations (variety as the title, type name
 * as the eyebrow, no stray separator, link to /catalog/{id}, controls outside the link) now target the
 * set-coin-row-* testids in List view (?view=list).
 *
 * run_20261018_161537: the Add-coins picker block now targets the AddCoinsSheet rows
 * (add-coins-row-title / add-coins-row-subtitle) with the same expectations. Opening the sheet needs
 * useCatalogFacets, useCollection and a usePatchSetCoins mock with mutateAsync.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
import { useBulkSetOwnership, useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
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
  useCollection: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
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
const useCollectionMock = vi.mocked(useCollection);
const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(() => Promise.resolve(undefined)), isPending: false } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'DDO',
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
// Year-then-position order: coin-1 (1909), coin-3 (1943), coin-2 (1958)
const COIN_1 = BASE_COIN;
const COIN_3 = { ...BASE_COIN, id: 'coin-3', year: 1943, variety: '' };
const COIN_2 = { ...BASE_COIN, id: 'coin-2', year: 1958, variety: 'Doubled Die Reverse' };

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
    { id: 'usc-3', position: 1, coin: COIN_3 },
    { id: 'usc-2', position: 2, coin: COIN_2 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 3,
  completionPercent: 33,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true },
    { id: 'usc-3', position: 1, coin: COIN_3, owned: false },
    { id: 'usc-2', position: 2, coin: COIN_2, owned: false },
  ],
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

describe('SetEditorPage: coin variety and link to coin page (List view)', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/sets/set-1?view=list');
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
      useCollectionMock,
      useCatalogMock,
      useCatalogFacetsMock,
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
    useCatalogFacetsMock.mockReturnValue(queryResult({ data: { countries: [], denominations: [] } }));
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    setStoredToken('tok-abc');
  });

  describe('criterion 1: variety shown when non-empty', () => {
    it('shows each coin variety verbatim as the title of its own row, with the type name as eyebrow', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      const rows = screen.getAllByTestId('set-coin-row');

      expect(within(rows[0]).getByTestId('set-coin-row-title')).toHaveTextContent(/^DDO$/);
      expect(within(rows[0]).getByTestId('set-coin-row-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(rows[2]).getByTestId('set-coin-row-title')).toHaveTextContent(/^Doubled Die Reverse$/);
      expect(within(rows[2]).getByTestId('set-coin-row-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    });
  });

  describe('criterion 2: nothing rendered for an empty variety', () => {
    it('titles the coin whose variety is empty by its type name, with no eyebrow and no variety text', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      const rows = screen.getAllByTestId('set-coin-row');

      expect(within(rows[1]).queryByTestId('set-coin-row-eyebrow')).not.toBeInTheDocument();
      expect(within(rows[1]).getByTestId('set-coin-row-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(rows[1]).getByTestId('set-coin-row-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1943-S$/);
      expect(rows[1].textContent).not.toMatch(/DDO|Doubled/);
    });
  });

  describe('criterion 3: the coin title is a link to /catalog/{coin.id}', () => {
    it('gives each row a link with its own coin id in the href', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      const rows = screen.getAllByTestId('set-coin-row');

      expect(within(rows[0]).getByTestId('set-coin-row-link').getAttribute('href')).toBe('/catalog/coin-1');
      expect(within(rows[1]).getByTestId('set-coin-row-link').getAttribute('href')).toBe('/catalog/coin-3');
      expect(within(rows[2]).getByTestId('set-coin-row-link').getAttribute('href')).toBe('/catalog/coin-2');
    });

    it('keeps the title inside the link and shows the collector notation in the year cell', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      const rows = screen.getAllByTestId('set-coin-row');
      const link = within(rows[0]).getByTestId('set-coin-row-link');

      expect(within(link).getByTestId('set-coin-row-title')).toHaveTextContent('DDO');
      expect(within(rows[0]).getByTestId('set-coin-row-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1909-S$/);
      expect(within(rows[0]).getByTestId('set-coin-row-year').textContent).toBe('1909-S');
      expect(within(rows[2]).getByTestId('set-coin-row-year').textContent).toBe('1958-S');
    });
  });

  describe('criterion 4: the status pill and the row menu are not part of the link and still work', () => {
    it('does not nest the pill or the ⋯ trigger inside the link', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });

      screen.getAllByTestId('set-coin-row').forEach((row) => {
        const link = within(row).getByTestId('set-coin-row-link');
        expect(link.contains(within(row).getByTestId('status-toggle'))).toBe(false);
        expect(link.contains(within(row).getByTestId('coin-row-menu-trigger'))).toBe(false);
      });
    });

    it('clicking the pill still calls the ownership mutation for that coin', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      await user.click(within(screen.getAllByTestId('set-coin-row')[1]).getByTestId('status-toggle')); // coin-3, unowned

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-3', owned: true, coin: COIN_3 });
    });
  });

  describe('run_20261017_142658 / run_20261018_161537: Add-coins sheet rows use the name block', () => {
    it('shows the getCoinName title and subtitle for each catalog result, and the old label text is gone', async () => {
      const donetsk = {
        ...BASE_COIN,
        id: 'coin-donetsk',
        country: 'Ukraine',
        denomination: '10 Hryvnias',
        year: 2025,
        mintMark: '',
        variety: 'We Are Strong. We Are Together: Donetsk Oblast',
        name: 'Ukraine Commemorative 10 Hryvnias',
      };
      useCatalogMock.mockReturnValue(
        queryResult({ data: { items: [BASE_COIN, donetsk], page: 1, limit: 20, total: 2 } }),
      );
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-toggle-add-coins'));

      const results = screen.getByTestId('add-coins-results');
      const rows = within(results).getAllByTestId('add-coins-row');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByTestId('add-coins-row-title')).toHaveTextContent(/^DDO$/);
      expect(within(rows[0]).getByTestId('add-coins-row-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1909-S$/);
      expect(within(rows[1]).getByTestId('add-coins-row-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(rows[1]).getByTestId('add-coins-row-subtitle')).toHaveTextContent(
        /^Ukraine · 10 Hryvnias · 2025$/,
      );
      expect(results).not.toHaveTextContent('USA 1 Cent (1909 S)');
    });
  });
});
