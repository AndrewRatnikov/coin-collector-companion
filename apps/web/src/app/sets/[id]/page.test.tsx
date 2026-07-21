/**
 * Tests for: SetEditorPage
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Page: SetEditorPage (CREATE)
 * Covers criteria: #1, #3, #4, #5, #9 (from prd.md)
 *
 * Unwraps `params` via the useEffect/useState pattern already used by
 * sets/canonical/[id]/page.tsx and sets/public/[id]/page.tsx (documented gotcha:
 * React's use() inside <Suspense> never re-renders on resolution in this repo's
 * jsdom+vitest setup) — no <Suspense> boundary needed around renderPage() below.
 *
 * Mutation hooks are mocked with both an auto-invoked onSuccess/onError callback
 * (mirroring sets/new/page.test.tsx's makeMutationMock convention) so the test
 * asserts observable results (mutate call args, router.push) rather than pinning
 * down exactly how the Coder wires the callback.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function mutationMock({ resolvedValue, rejectedValue }: { resolvedValue?: unknown; rejectedValue?: Error } = {}) {
  const mutate = vi.fn(
    (_vars: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) opts?.onError?.(rejectedValue);
      else opts?.onSuccess?.(resolvedValue);
    },
  );
  return { mutate, isPending: false } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

const COIN_1 = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_2 = { ...COIN_1, id: 'coin-2', year: 1958, mintMark: '' };
const COIN_3 = { ...COIN_1, id: 'coin-3', year: 1943, mintMark: '' };

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-2', position: 1, coin: COIN_2 },
    { id: 'usc-1', position: 0, coin: COIN_1 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 2,
  completionPercent: 50,
  slots: [
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false },
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true },
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

function setDefaultMocks() {
  usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
  useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
  useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
  usePatchSetCoinsMock.mockReturnValue(mutationMock());
  useRenameSetMock.mockReturnValue(mutationMock());
  useDeleteSetMock.mockReturnValue(mutationMock());
  useSetOwnershipMock.mockReturnValue(mutationMock());
  useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
}

describe('SetEditorPage', () => {
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
    setDefaultMocks();
  });

  describe('auth gating', () => {
    it('does not render set-editor-page and redirects to /login when no token is present', async () => {
      renderPage();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('set-editor-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4/5: loading and error states', () => {
    it('renders set-editor-loading while usePublicSet is loading', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-loading')).toBeInTheDocument();
      });
    });

    it('renders set-editor-loading while useSetGaps is loading', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-loading')).toBeInTheDocument();
      });
    });

    it('renders set-editor-error when usePublicSet fails', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-error')).toBeInTheDocument();
      });
    });

    it('renders set-editor-error when useSetGaps fails', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 4: renders name, completion %, and the gap grid sorted by position', () => {
    it('sorts slots ascending by position regardless of API array order, and shows owned/missing status', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name')).toHaveTextContent('My Wheat Cents');
      });
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('50%');

      const items = screen.getAllByTestId('set-editor-gap-item');
      expect(items).toHaveLength(2);
      const statuses = screen.getAllByTestId('set-editor-gap-status');
      expect(statuses[0]).toHaveTextContent('owned'); // position 0 = coin-1, owned: true
      expect(statuses[1]).toHaveTextContent('missing'); // position 1 = coin-2, owned: false
    });
  });

  describe('criterion 5: non-owner (logged in, set not in useUserSets) sees a read-only view', () => {
    it('renders the gap grid but no edit controls', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-editor-toggle-owned-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-remove-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-rename-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-delete-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: owner view renders edit controls', () => {
    it('renders toggle-owned, remove, rename, delete, and add-coins controls when the set is in useUserSets', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(2);
      });
      expect(screen.getAllByTestId('set-editor-remove-button')).toHaveLength(2);
      expect(screen.getByTestId('set-editor-rename-form')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-add-coins-panel')).toBeInTheDocument();
    });

    it('toggling an unowned coin calls useSetOwnership().mutate with the target coinId and owned: true (never a client-side flip)', async () => {
      setStoredToken('tok-abc');
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(2);
      });
      const toggles = screen.getAllByTestId('set-editor-toggle-owned-button');
      await user.click(toggles[1]); // position 1 = coin-2, currently owned: false

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-2', owned: true });
    });

    it('toggling an owned coin calls useSetOwnership().mutate with owned: false', async () => {
      setStoredToken('tok-abc');
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(2);
      });
      const toggles = screen.getAllByTestId('set-editor-toggle-owned-button');
      await user.click(toggles[0]); // position 0 = coin-1, currently owned: true

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-1', owned: false });
    });

    it('removing a slot calls usePatchSetCoins(id).mutate with { remove: [coinId] } — the catalog coin id, not the UserSetCoin row id', async () => {
      setStoredToken('tok-abc');
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-remove-button')).toHaveLength(2);
      });
      const removeButtons = screen.getAllByTestId('set-editor-remove-button');
      await user.click(removeButtons[1]); // position 1 = coin-2

      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(patchMutate.mock.calls[0][0]).toEqual({ remove: ['coin-2'] });
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });

    it('renaming submits the new name via useRenameSet().mutate with { id, name }', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-rename-input')).toBeInTheDocument();
      });
      // fireEvent.change replaces the controlled input's value in one synthetic event —
      // user.clear() + user.type() was tried first but appended rather than replaced
      // against this pre-populated controlled input in this jsdom+vitest setup
      // (received "My Wheat CentsRenamed Set" instead of "Renamed Set" — a test-simulation
      // artifact, not an implementation bug, confirmed against the sandbox run).
      fireEvent.change(screen.getByTestId('set-editor-rename-input'), { target: { value: 'Renamed Set' } });
      await user.click(screen.getByTestId('set-editor-rename-submit'));

      expect(renameMutate).toHaveBeenCalledTimes(1);
      expect(renameMutate.mock.calls[0][0]).toEqual({ id: 'set-1', name: 'Renamed Set' });
    });

    it('deleting calls useDeleteSet().mutate with the id and redirects to /dashboard on success', async () => {
      setStoredToken('tok-abc');
      useDeleteSetMock.mockReturnValue(mutationMock({ resolvedValue: undefined }));
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-delete-button'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('the Add coins panel filters via useCatalog and adding a result calls usePatchSetCoins(id).mutate with { add: [coin.id] }', async () => {
      setStoredToken('tok-abc');
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      useCatalogMock.mockReturnValue(
        queryResult({ data: { items: [COIN_3], page: 1, limit: 20, total: 1 } }),
      );
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-add-coins-panel')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-add-coins-filter-form')).toBeInTheDocument();

      const initialCallArgs = useCatalogMock.mock.calls[useCatalogMock.mock.calls.length - 1][0] as {
        country?: string;
      };
      expect(initialCallArgs.country).toBeUndefined();

      await user.type(screen.getByTestId('set-editor-add-coins-filter-country'), 'USA');
      await user.click(screen.getByTestId('set-editor-add-coins-filter-submit'));

      await waitFor(() => {
        const lastCallArgs = useCatalogMock.mock.calls[useCatalogMock.mock.calls.length - 1][0] as {
          country?: string;
        };
        expect(lastCallArgs.country).toBe('USA');
      });

      const addButtons = screen.getAllByTestId('set-editor-add-coins-add-button');
      await user.click(addButtons[0]);

      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(patchMutate.mock.calls[0][0]).toEqual({ add: ['coin-3'] });
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });
  });
});
