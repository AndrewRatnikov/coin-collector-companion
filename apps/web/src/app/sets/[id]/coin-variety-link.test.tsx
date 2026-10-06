/**
 * Tests for: SetEditorPage coin row variety + link to the coin page
 * Contract source: runs/run_20261006_215558/plan.md § Interface Contract → Page: SetEditorPage (modify)
 * Covers criteria: #1, #2, #3, #4 (from run_20261006_215558's prd.md)
 *
 * Mock setup mirrors sets/[id]/page.test.tsx.
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

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909, // 1900s
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
// Decade-then-position order: coin-1 (1900s), coin-3 (1940s), coin-2 (1950s)
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

describe('SetEditorPage: coin variety and link to coin page', () => {
  beforeEach(() => {
    localStorage.clear();
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

  describe('criterion 1: variety shown when non-empty', () => {
    it('shows each coin variety verbatim in set-editor-gap-variety inside its own row', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      const items = screen.getAllByTestId('set-editor-gap-item');

      expect(within(items[0]).getByTestId('set-editor-gap-variety')).toHaveTextContent(/^DDO$/);
      expect(within(items[2]).getByTestId('set-editor-gap-variety')).toHaveTextContent(/^Doubled Die Reverse$/);
    });
  });

  describe('criterion 2: nothing rendered for an empty variety', () => {
    it('renders no variety element in the row of the coin whose variety is empty', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      const items = screen.getAllByTestId('set-editor-gap-item');

      expect(within(items[1]).queryByTestId('set-editor-gap-variety')).not.toBeInTheDocument();
      // The link text for the plain coin is only the name and label, no stray separator
      const link = within(items[1]).getByTestId('set-editor-gap-coin-link');
      expect(link).toHaveTextContent('Lincoln Wheat Cent');
      expect(link).toHaveTextContent('USA 1 Cent (1943 S)');
      expect(link.textContent).not.toMatch(/DDO|Doubled/);
      expect(link.textContent).not.toMatch(/[-,/|·]\s*$/);
    });
  });

  describe('criterion 3: the coin label is a link to /catalog/{coin.id}', () => {
    it('gives each row a link with its own coin id in the href', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      const items = screen.getAllByTestId('set-editor-gap-item');

      expect(within(items[0]).getByTestId('set-editor-gap-coin-link').getAttribute('href')).toBe('/catalog/coin-1');
      expect(within(items[1]).getByTestId('set-editor-gap-coin-link').getAttribute('href')).toBe('/catalog/coin-3');
      expect(within(items[2]).getByTestId('set-editor-gap-coin-link').getAttribute('href')).toBe('/catalog/coin-2');
    });

    it('keeps the label text and the variety inside the link', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      const items = screen.getAllByTestId('set-editor-gap-item');
      const link = within(items[0]).getByTestId('set-editor-gap-coin-link');

      expect(within(link).getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
      expect(within(link).getByTestId('set-editor-gap-variety')).toHaveTextContent('DDO');
    });
  });

  describe('criterion 4: status and owner buttons are not part of the link and still work', () => {
    it('does not nest the status, toggle-owned or remove controls inside the link', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      const items = screen.getAllByTestId('set-editor-gap-item');

      items.forEach((item) => {
        const link = within(item).getByTestId('set-editor-gap-coin-link');
        expect(link.contains(within(item).getByTestId('set-editor-gap-status'))).toBe(false);
        expect(link.contains(within(item).getByTestId('set-editor-toggle-owned-button'))).toBe(false);
        expect(link.contains(within(item).getByTestId('set-editor-remove-button'))).toBe(false);
      });
    });

    it('clicking toggle-owned still calls the ownership mutation for that coin', async () => {
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(3);
      });
      await user.click(screen.getAllByTestId('set-editor-toggle-owned-button')[1]); // coin-3, unowned

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-3', owned: true });
    });
  });
});
