/**
 * Tests for: SetEditorPage Album view edge cases (empty set, no double toggles)
 *
 * useSetOwnership is mocked so the test controls when each request settles: the mock
 * captures the hook-level onSettled the page passes in, and `settle()` fires it the way
 * TanStack Query does for every mutation (per-mutate() callbacks only fire for the
 * latest call, which is why the page uses the hook-level option).
 *
 * Mock setup mirrors sets/[id]/album-view.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SetEditorPage from '@/app/sets/[id]/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership, type UseSetOwnershipOptions } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { ApiError } from '@/lib/api-client';
import { setStoredToken } from '@/lib/auth-token';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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
const COIN_1 = BASE_COIN; // owned
const COIN_2 = { ...BASE_COIN, id: 'coin-2', variety: 'VDB' }; // missing
const COIN_3 = { ...BASE_COIN, id: 'coin-3', year: 1931, mintMark: 'S' }; // missing

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
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 3,
  completionPercent: 33,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false },
    { id: 'usc-3', position: 2, coin: COIN_3, owned: false },
  ],
};

const EMPTY_SET_DETAIL = { ...SET_DETAIL, coins: [] };
const EMPTY_GAPS = { setId: 'set-1', ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] };

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

function controllableOwnership() {
  const mutate = vi.fn();
  let hookOptions: UseSetOwnershipOptions = {};
  useSetOwnershipMock.mockImplementation((options?: UseSetOwnershipOptions) => {
    hookOptions = options ?? {};
    return { mutate, isPending: false } as never;
  });
  function settle(coinId: string, error: ApiError | null = null) {
    const call = mutate.mock.calls.find(([vars]) => vars.coinId === coinId);
    if (!call) throw new Error(`no ownership request for ${coinId}`);
    act(() => {
      hookOptions.onSettled?.(error, call[0]);
    });
  }
  return { mutate, settle };
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

function slotByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('set-album-slot').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no slot for ${coinId}`);
  return found;
}

describe('SetEditorPage: Album view edge cases', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/sets/set-1?view=album');
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

  describe('empty set', () => {
    beforeEach(() => {
      usePublicSetMock.mockReturnValue(queryResult({ data: EMPTY_SET_DETAIL }));
      useSetGapsMock.mockReturnValue(queryResult({ data: EMPTY_GAPS }));
    });

    it('shows the empty-state message and points the owner to Add coins, with no table', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-album-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
      expect(screen.getByTestId('set-album-empty-owner-hint')).toHaveTextContent('Use "Add coins" to start filling it.');
      expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-album-page')).not.toBeInTheDocument();
    });

    it('shows the empty-state message without the Add coins hint to another logged-in user', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-album-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
      expect(screen.queryByTestId('set-album-empty-owner-hint')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-toggle-add-coins')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
    });
  });

  describe('no double toggles', () => {
    it('a quick double click sends exactly one ownership request and marks the slot busy', async () => {
      const { mutate } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-slot')).toHaveLength(3);
      });

      await user.dblClick(slotByCoin('coin-2'));

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0][0]).toEqual({ coinId: 'coin-2', owned: true });
      expect(slotByCoin('coin-2')).toBeDisabled();
      expect(slotByCoin('coin-2')).toHaveAttribute('aria-busy', 'true');
    });

    it('while one slot is pending, another slot can still be toggled', async () => {
      const { mutate } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-slot')).toHaveLength(3);
      });

      await user.click(slotByCoin('coin-2'));
      expect(slotByCoin('coin-3')).toBeEnabled();
      expect(slotByCoin('coin-3')).not.toHaveAttribute('aria-busy');

      await user.click(slotByCoin('coin-3'));

      expect(mutate).toHaveBeenCalledTimes(2);
      expect(mutate.mock.calls[1][0]).toEqual({ coinId: 'coin-3', owned: true });
      expect(slotByCoin('coin-2')).toBeDisabled();
      expect(slotByCoin('coin-3')).toBeDisabled();
    });

    it('settling one request re-enables only that slot', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-slot')).toHaveLength(3);
      });

      await user.click(slotByCoin('coin-2'));
      await user.click(slotByCoin('coin-3'));
      settle('coin-2');

      expect(slotByCoin('coin-2')).toBeEnabled();
      expect(slotByCoin('coin-2')).not.toHaveAttribute('aria-busy');
      expect(slotByCoin('coin-3')).toBeDisabled();
      expect(slotByCoin('coin-3')).toHaveAttribute('aria-busy', 'true');
    });

    it('a failed toggle re-enables the slot, keeps its previous state and shows an error', async () => {
      const { mutate, settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-slot')).toHaveLength(3);
      });

      await user.click(slotByCoin('coin-2'));
      settle('coin-2', new ApiError(500, 'Internal server error'));

      expect(slotByCoin('coin-2')).toBeEnabled();
      expect(slotByCoin('coin-2')).not.toHaveAttribute('aria-busy');
      expect(slotByCoin('coin-2')).toHaveAttribute('data-owned', 'false');
      expect(screen.getByTestId('set-album-toggle-error')).toHaveTextContent(
        "Couldn't update this coin. Please try again.",
      );

      // The slot can be retried, and a new attempt clears the old error.
      await user.click(slotByCoin('coin-2'));
      expect(mutate).toHaveBeenCalledTimes(2);
      expect(screen.queryByTestId('set-album-toggle-error')).not.toBeInTheDocument();
    });

    it('a successful toggle shows no error', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-slot')).toHaveLength(3);
      });

      await user.click(slotByCoin('coin-2'));
      settle('coin-2');

      expect(slotByCoin('coin-2')).toBeEnabled();
      expect(screen.queryByTestId('set-album-toggle-error')).not.toBeInTheDocument();
    });
  });
});
