/**
 * Tests for: SetEditorPage bulk actions: Mark all + undo, Select mode, Remove + undo, Add to another set
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Page: SetEditorPage (MODIFY),
 *                  § Behaviour the tests pin
 * Covers criteria: #6, #8, #9, #10 (web side: one bulk mutate call), #12, #14 (mobile ⋯ items)
 *
 * Mutation hooks are mocked as `mutate(variables, options)`. The page shows its toast from the call's
 * `options.onSuccess`, and updates pending / failed / live state from the hook-level `onSettled(error,
 * variables)` it passes to useSetOwnership / useBulkSetOwnership. Both are captured here and fired by hand
 * (`succeed()`, `settleBulk()`). The real UndoToastProvider is mounted by the page, so toasts are read from
 * the DOM and Undo is clicked.
 *
 * jsdom loads no CSS: the mobile-only (⋯ menu) and desktop-only (Select button, per-year Mark all)
 * elements are all present, so tests use the specific testids.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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
import {
  useBulkSetOwnership,
  useSetOwnership,
  type UseBulkSetOwnershipOptions,
  type UseSetOwnershipOptions,
} from '@/lib/hooks/use-collection';
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
const COIN_A = BASE_COIN; // 2025 Donetsk, owned
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

// Array order d, a, c, b: not position order, so "position order" in the expectations is falsifiable.
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
  {
    id: 'set-2',
    userId: 'user-1',
    name: 'Lincoln Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  },
];

type Mutate = ReturnType<typeof vi.fn>;

interface Harness {
  single: Mutate;
  bulk: Mutate;
  patch: Mutate;
  addToSet: Mutate;
  settleSingle: (coinId: string, error?: ApiError | null) => void;
  settleBulk: (variables: { coinIds: string[]; owned: boolean }, error?: ApiError | null) => void;
}

function installMocks(): Harness {
  const single = vi.fn();
  const bulk = vi.fn();
  const patch = vi.fn();
  const addToSet = vi.fn();
  let singleOptions: UseSetOwnershipOptions = {};
  let bulkOptions: UseBulkSetOwnershipOptions = {};

  useSetOwnershipMock.mockImplementation((options?: UseSetOwnershipOptions) => {
    singleOptions = options ?? {};
    return { mutate: single, isPending: false } as never;
  });
  useBulkSetOwnershipMock.mockImplementation((options?: UseBulkSetOwnershipOptions) => {
    bulkOptions = options ?? {};
    return { mutate: bulk, isPending: false } as never;
  });
  usePatchSetCoinsMock.mockReturnValue({ mutate: patch, isPending: false } as never);
  useAddCoinsToSetMock.mockReturnValue({ mutate: addToSet, isPending: false } as never);

  return {
    single,
    bulk,
    patch,
    addToSet,
    settleSingle(coinId, error = null) {
      const call = single.mock.calls.find(([vars]) => vars.coinId === coinId);
      if (!call) throw new Error(`no ownership request for ${coinId}`);
      act(() => {
        singleOptions.onSettled?.(error, call[0]);
      });
    },
    settleBulk(variables, error = null) {
      act(() => {
        bulkOptions.onSettled?.(error, variables);
      });
    },
  };
}

/** Fires the per-call onSuccess the page passed to mutate(), the way TanStack Query would. */
function succeed(mutate: Mutate, callIndex = 0) {
  const options = mutate.mock.calls[callIndex]?.[1] as { onSuccess?: (data: unknown) => void } | undefined;
  if (!options?.onSuccess) throw new Error('mutate() was called without an onSuccess option');
  act(() => {
    options.onSuccess?.({});
  });
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

function groupFor(year: number): HTMLElement {
  const found = screen.getAllByTestId('set-year-group').find((el) => el.getAttribute('data-year') === String(year));
  if (!found) throw new Error(`no group for ${year}`);
  return found;
}

function cardByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('coin-card').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no card for ${coinId}`);
  return found;
}

function rowByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('set-coin-row').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no row for ${coinId}`);
  return found;
}

async function waitForGroups() {
  await waitFor(() => {
    expect(screen.getAllByTestId('set-year-group')).toHaveLength(2);
  });
}

describe('SetEditorPage: bulk actions', () => {
  let h: Harness;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/sets/set-1');
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
    useRenameSetMock.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    useDeleteSetMock.mockReturnValue({ mutate: vi.fn(), isPending: false } as never);
    useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
    h = installMocks();
    setStoredToken('tok-abc');
  });

  describe('criterion 6: Mark all for a year', () => {
    it('sends one bulk request with that year’s missing ids in position order, and never the single mutation', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));

      expect(h.bulk).toHaveBeenCalledTimes(1);
      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-c', 'coin-d'], owned: true });
      expect(h.bulk.mock.calls[0][1]).toEqual(expect.objectContaining({ onSuccess: expect.any(Function) }));
      expect(h.single).not.toHaveBeenCalled();
    });

    it('applies at once, with no confirmation dialog', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));

      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(h.bulk).toHaveBeenCalledTimes(1);
    });

    it('sends only the other year’s ids for the other group (different input, different ids)', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(groupFor(2025)).getByTestId('set-year-group-mark-all'));

      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-b'], owned: true });
    });

    it('shows the year toast with the count, and the singular for one coin', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));
      succeed(h.bulk, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 2 coins from 2026 as owned.');

      await user.click(within(groupFor(2025)).getByTestId('set-year-group-mark-all'));
      succeed(h.bulk, 1);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 1 coin from 2025 as owned.');
    });

    it('Undo marks exactly those coins missing again with one bulk request', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));
      succeed(h.bulk, 0);

      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk).toHaveBeenCalledTimes(2);
      expect(h.bulk.mock.calls[1][0]).toEqual({ coinIds: ['coin-c', 'coin-d'], owned: false });
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('never moves focus into the toast', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));
      succeed(h.bulk, 0);

      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();
      expect(screen.getByTestId('undo-toast').contains(document.activeElement)).toBe(false);
    });

    it('marks the affected cards pending while the request runs, and idle once it settles', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));

      expect(cardByCoin('coin-c')).toHaveAttribute('data-status', 'pending');
      expect(cardByCoin('coin-d')).toHaveAttribute('data-status', 'pending');
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'idle');

      h.settleBulk({ coinIds: ['coin-c', 'coin-d'], owned: true });

      expect(cardByCoin('coin-c')).toHaveAttribute('data-status', 'idle');
      expect(cardByCoin('coin-d')).toHaveAttribute('data-status', 'idle');
    });

    it('marks every affected card failed when the bulk request fails, and announces the count', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));

      h.settleBulk({ coinIds: ['coin-c', 'coin-d'], owned: true }, new ApiError(500, 'Internal server error'));

      expect(cardByCoin('coin-c')).toHaveAttribute('data-status', 'failed');
      expect(cardByCoin('coin-d')).toHaveAttribute('data-status', 'failed');
      expect(screen.getByTestId('set-editor-live').textContent).toMatch(/^Couldn.t save 2 coins\. Try again\.$/);
    });

    it('announces the singular when one coin fails', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(within(groupFor(2025)).getByTestId('set-year-group-mark-all'));

      h.settleBulk({ coinIds: ['coin-b'], owned: true }, new ApiError(500, 'Internal server error'));

      expect(screen.getByTestId('set-editor-live').textContent).toMatch(/^Couldn.t save 1 coin\. Try again\.$/);
    });

    it('leaves out coins that are pending from the year’s Mark all, and shrinks its count', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(within(cardByCoin('coin-c')).getByTestId('status-toggle'));
      expect(h.single).toHaveBeenCalledTimes(1);
      expect(within(groupFor(2026)).getByTestId('set-year-group-mark-all')).toHaveTextContent('Mark 1 as owned');

      await user.click(within(groupFor(2026)).getByTestId('set-year-group-mark-all'));

      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-d'], owned: true });
    });
  });

  describe('criterion 14: Select and Mark all from the ⋯ menu (mobile items)', () => {
    it('the menu Mark all marks every idle missing coin of the whole set in one request', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      expect(screen.getByTestId('set-editor-mark-all-item')).toHaveTextContent('Mark all 3 as owned');
      await user.click(screen.getByTestId('set-editor-mark-all-item'));

      expect(h.bulk).toHaveBeenCalledTimes(1);
      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-b', 'coin-c', 'coin-d'], owned: true });
      expect(h.single).not.toHaveBeenCalled();
    });

    it('its toast says "Marked 3 coins as owned." and Undo reverses exactly those coins', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      await user.click(screen.getByTestId('set-editor-mark-all-item'));

      succeed(h.bulk, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 3 coins as owned.');
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk.mock.calls[1][0]).toEqual({ coinIds: ['coin-b', 'coin-c', 'coin-d'], owned: false });
    });

    it('the menu Select coins item enters select mode', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      await user.click(screen.getByTestId('set-editor-select-item'));

      expect(screen.getByTestId('set-editor-select-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('selection-bar')).toBeInTheDocument();
    });

    it('the menu has no Select coins item in List view, and Mark all is disabled for a complete set', async () => {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      const user = userEvent.setup();
      const { unmount } = renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      expect(screen.queryByTestId('set-editor-select-item')).not.toBeInTheDocument();
      unmount();

      useSetGapsMock.mockReturnValue(
        queryResult({
          data: {
            ...GAPS,
            ownedCount: 4,
            completionPercent: 100,
            slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
          },
        }),
      );
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      expect(screen.getByTestId('set-editor-mark-all-item')).toBeDisabled();
    });
  });

  describe('criterion 9: Select mode', () => {
    async function enterSelect() {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();
      await user.click(screen.getByTestId('set-editor-select-toggle'));
      return user;
    }

    it('turns the toggle into "Done selecting", shows the hint and the action bar with nothing selected', async () => {
      await enterSelect();

      const toggle = screen.getByTestId('set-editor-select-toggle');
      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(toggle).toHaveTextContent('Done selecting');
      expect(screen.getByTestId('set-editor-select-hint')).toHaveTextContent(
        'Tap coins to select them, then mark them all at once.',
      );
      expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('0 selected');
      expect(screen.getByTestId('selection-bar-mark-owned')).toBeDisabled();
      expect(screen.getByTestId('selection-bar-mark-missing')).toBeDisabled();
    });

    it('hides the checks and the per-year Mark all, and makes each card a select button', async () => {
      await enterSelect();

      expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
      expect(screen.queryAllByTestId('set-year-group-mark-all')).toHaveLength(0);
      expect(screen.getAllByTestId('coin-card-select')).toHaveLength(4);
    });

    it('is absent outside select mode', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForGroups();

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-select-hint')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-select-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('set-editor-select-toggle')).toHaveTextContent('Select');
      await user.click(screen.getByTestId('set-editor-select-toggle'));
      expect(screen.getByTestId('selection-bar')).toBeInTheDocument();
    });

    it('selects and unselects cards and counts them', async () => {
      const user = await enterSelect();

      await user.click(within(cardByCoin('coin-c')).getByTestId('coin-card-select'));
      expect(cardByCoin('coin-c')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('1 selected');
      expect(screen.getByTestId('selection-bar-mark-owned')).toBeEnabled();

      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));
      expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('2 selected');

      await user.click(within(cardByCoin('coin-c')).getByTestId('coin-card-select'));
      expect(cardByCoin('coin-c')).toHaveAttribute('data-selected', 'false');
      expect(cardByCoin('coin-b')).toHaveAttribute('data-selected', 'true');
      expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('1 selected');
    });

    it('Mark owned sends one bulk request with the selected ids in click order and leaves select mode', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-d')).getByTestId('coin-card-select'));
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));

      await user.click(screen.getByTestId('selection-bar-mark-owned'));

      expect(h.bulk).toHaveBeenCalledTimes(1);
      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-d', 'coin-b'], owned: true });
      expect(h.bulk.mock.calls[0][1]).toEqual(expect.objectContaining({ onSuccess: expect.any(Function) }));
      expect(h.single).not.toHaveBeenCalled();
      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-select-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows "Marked N coins as owned." and Undo restores exactly the coins that were missing', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-d')).getByTestId('coin-card-select'));
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));
      await user.click(screen.getByTestId('selection-bar-mark-owned'));

      succeed(h.bulk, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 2 coins as owned.');
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk).toHaveBeenCalledTimes(2);
      expect(h.bulk.mock.calls[1][0]).toEqual({ coinIds: ['coin-d', 'coin-b'], owned: false });
    });

    it('Undo only reverts the coins that actually changed when an already-owned coin was selected too', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-a')).getByTestId('coin-card-select')); // already owned
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select')); // missing
      await user.click(screen.getByTestId('selection-bar-mark-owned'));

      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-a', 'coin-b'], owned: true });
      succeed(h.bulk, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 2 coins as owned.');
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk.mock.calls[1][0]).toEqual({ coinIds: ['coin-b'], owned: false });
    });

    it('Undo does nothing when no selected coin actually changed', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-a')).getByTestId('coin-card-select')); // already owned
      await user.click(screen.getByTestId('selection-bar-mark-owned'));

      succeed(h.bulk, 0);
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk).toHaveBeenCalledTimes(1);
    });

    it('Mark missing sends owned: false, words the toast "as missing", and Undo re-owns the changed coins', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-a')).getByTestId('coin-card-select')); // owned
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select')); // missing
      await user.click(screen.getByTestId('selection-bar-mark-missing'));

      expect(h.bulk.mock.calls[0][0]).toEqual({ coinIds: ['coin-a', 'coin-b'], owned: false });
      succeed(h.bulk, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 2 coins as missing.');
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.bulk.mock.calls[1][0]).toEqual({ coinIds: ['coin-a'], owned: true });
    });

    it('uses the singular toast for one selected coin', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-a')).getByTestId('coin-card-select'));
      await user.click(screen.getByTestId('selection-bar-mark-missing'));

      succeed(h.bulk, 0);

      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked 1 coin as missing.');
    });

    it('Cancel leaves select mode and changes nothing', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));

      await user.click(screen.getByTestId('selection-bar-cancel'));

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      expect(h.bulk).not.toHaveBeenCalled();
      expect(h.single).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('status-toggle').length).toBeGreaterThan(0);
    });

    it('Escape leaves select mode and changes nothing', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-select-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(h.bulk).not.toHaveBeenCalled();
    });

    it('Done selecting leaves select mode, and re-entering starts with nothing selected', async () => {
      const user = await enterSelect();
      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-select'));

      await user.click(screen.getByTestId('set-editor-select-toggle'));
      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('set-editor-select-toggle'));

      expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('0 selected');
      expect(cardByCoin('coin-b')).toHaveAttribute('data-selected', 'false');
    });

    it('switching to List leaves select mode', async () => {
      const user = await enterSelect();

      await user.click(screen.getByTestId('set-editor-view-list-toggle'));

      expect(screen.queryByTestId('selection-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-select-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-select-hint')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
    });
  });

  describe('criterion 12: Remove from set', () => {
    async function openRowMenu(coinId: string) {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });
      await user.click(within(rowByCoin(coinId)).getByTestId('coin-row-menu-trigger'));
      return user;
    }

    it('calls usePatchSetCoins(id).mutate({ remove: [coinId] }) with no dialog', async () => {
      const user = await openRowMenu('coin-b');

      await user.click(screen.getByTestId('coin-row-menu-remove'));

      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
      expect(h.patch).toHaveBeenCalledTimes(1);
      expect(h.patch.mock.calls[0][0]).toEqual({ remove: ['coin-b'] });
      expect(h.patch.mock.calls[0][1]).toEqual(expect.objectContaining({ onSuccess: expect.any(Function) }));
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();
    });

    it('targets the coin of the row whose menu was used', async () => {
      const user = await openRowMenu('coin-d');

      await user.click(screen.getByTestId('coin-row-menu-remove'));

      expect(h.patch.mock.calls[0][0]).toEqual({ remove: ['coin-d'] });
    });

    it('shows "Removed {title} from this set." and Undo re-adds the coin with the existing add API', async () => {
      const user = await openRowMenu('coin-b');
      await user.click(screen.getByTestId('coin-row-menu-remove'));

      succeed(h.patch, 0);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Removed Luhansk Oblast from this set.');
      await user.click(screen.getByTestId('undo-toast-undo'));

      expect(h.patch).toHaveBeenCalledTimes(2);
      expect(h.patch.mock.calls[1][0]).toEqual({ add: ['coin-b'] });
    });

    it('announces a failed removal in the live region', async () => {
      const user = await openRowMenu('coin-b');
      await user.click(screen.getByTestId('coin-row-menu-remove'));

      const options = h.patch.mock.calls[0][1] as { onError?: (error: unknown) => void };
      act(() => {
        options.onError?.(new ApiError(500, 'Internal server error'));
      });

      expect(screen.getByTestId('set-editor-live').textContent).toMatch(
        /^Couldn.t remove Luhansk Oblast\. Try again\.$/,
      );
    });
  });

  describe('criterion 12: Add to another set', () => {
    async function openSetsPanel(coinId: string) {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });
      await user.click(within(rowByCoin(coinId)).getByTestId('coin-row-menu-trigger'));
      await user.click(screen.getByTestId('coin-row-menu-add-to-set'));
      return user;
    }

    it('lists the user’s other sets only, not the current one', async () => {
      await openSetsPanel('coin-b');

      expect(screen.getAllByTestId('coin-row-menu-set-item').map((i) => i.textContent)).toEqual(['Lincoln Cents']);
    });

    it('choosing a set calls useAddCoinsToSet().mutate({ setId, coinIds: [coinId] })', async () => {
      const user = await openSetsPanel('coin-b');

      await user.click(screen.getByTestId('coin-row-menu-set-item'));

      expect(h.addToSet).toHaveBeenCalledTimes(1);
      expect(h.addToSet.mock.calls[0][0]).toEqual({ setId: 'set-2', coinIds: ['coin-b'] });
      expect(h.patch).not.toHaveBeenCalled();
    });

    it('announces the addition once it succeeds', async () => {
      const user = await openSetsPanel('coin-c');
      await user.click(screen.getByTestId('coin-row-menu-set-item'));

      succeed(h.addToSet, 0);

      expect(screen.getByTestId('set-editor-live').textContent).toBe('Added Odesa Oblast to Lincoln Cents.');
    });

    it('shows the "no other sets" item when the user has only this set', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [MY_SETS[0]] }));
      await openSetsPanel('coin-b');

      expect(screen.getByTestId('coin-row-menu-no-sets')).toBeInTheDocument();
      expect(screen.queryByTestId('coin-row-menu-set-item')).not.toBeInTheDocument();
    });
  });
});
