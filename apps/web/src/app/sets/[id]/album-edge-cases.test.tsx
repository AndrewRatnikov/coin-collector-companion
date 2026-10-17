/**
 * Tests for: SetEditorPage edge cases: pending / failed / retry, live region, empty set, complete state
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Page: SetEditorPage (MODIFY),
 *                  § Behaviour the tests pin
 * Covers criteria: #3, #8, #13, #17 (page-level)
 *
 * Replaces the previous run's version (set-album-* testids, set-album-toggle-error, set-album-all-owned).
 * Failures now show on the card (data-status="failed" + Retry), on the list row (failed subtitle) and in the
 * polite live region set-editor-live.
 *
 * useSetOwnership is mocked so the test controls when each request settles: the mock captures the hook-level
 * onSettled the page passes in, and `settle()` fires it the way TanStack Query does for every mutation
 * (per-mutate() callbacks only fire for the latest call, which is why the page uses the hook-level option).
 * The gap data is a fixed mock, so after a failed settle `slot.owned` still has its previous value, just as
 * after a real rollback.
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
const COIN_A = BASE_COIN; // Donetsk, owned
const COIN_B = { ...BASE_COIN, id: 'coin-b', variety: 'We Are Strong. We Are Together: Luhansk Oblast' };
const COIN_C = { ...BASE_COIN, id: 'coin-c', year: 2026, variety: 'We Are Strong. We Are Together: Odesa Oblast' };

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
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 3,
  completionPercent: 33,
  slots: [
    { id: 'usc-a', position: 0, coin: COIN_A, owned: true },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: false },
    { id: 'usc-c', position: 2, coin: COIN_C, owned: false },
  ],
};

// What the optimistic patch would produce for coin-b while its request is in flight
const GAPS_B_OPTIMISTIC = {
  ...GAPS,
  ownedCount: 2,
  completionPercent: 67,
  slots: GAPS.slots.map((s) => (s.id === 'usc-b' ? { ...s, owned: true } : s)),
};

const GAPS_ALL_OWNED = {
  ...GAPS,
  ownedCount: 3,
  completionPercent: 100,
  slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
};

const EMPTY_SET_DETAIL = { ...SET_DETAIL, coins: [] };
const EMPTY_GAPS = { setId: 'set-1', ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] };

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
  const params = Promise.resolve({ id });
  const utils = render(<SetEditorPage params={params} />);
  return { ...utils, params };
}

function cardByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('coin-card').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no card for ${coinId}`);
  return found;
}

function checkByCoin(coinId: string): HTMLElement {
  return within(cardByCoin(coinId)).getByTestId('status-toggle');
}

function queryCardByCoin(coinId: string): HTMLElement | undefined {
  return screen.queryAllByTestId('coin-card').find((el) => el.getAttribute('data-coin-id') === coinId);
}

async function waitForCards(count = 3) {
  await waitFor(() => {
    expect(screen.getAllByTestId('coin-card')).toHaveLength(count);
  });
}

describe('SetEditorPage: edge cases', () => {
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
    usePatchSetCoinsMock.mockReturnValue(mutationMock());
    useAddCoinsToSetMock.mockReturnValue(mutationMock());
    useRenameSetMock.mockReturnValue(mutationMock());
    useDeleteSetMock.mockReturnValue(mutationMock());
    useSetOwnershipMock.mockReturnValue(mutationMock());
    useBulkSetOwnershipMock.mockReturnValue(mutationMock());
    useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
    setStoredToken('tok-abc');
  });

  describe('empty set', () => {
    beforeEach(() => {
      usePublicSetMock.mockReturnValue(queryResult({ data: EMPTY_SET_DETAIL }));
      useSetGapsMock.mockReturnValue(queryResult({ data: EMPTY_GAPS }));
    });

    it('shows the empty message and points the owner to Add coins, with no groups', async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-empty')).toHaveTextContent('This set has no coins yet.');
      expect(screen.getByTestId('set-editor-empty-owner-hint')).toHaveTextContent('Use "Add coins" to start filling it.');
      expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-groups')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-year-group')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-complete-empty')).not.toBeInTheDocument();
    });

    it('shows the empty message without the Add coins hint to another logged-in user', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-empty')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-empty')).toHaveTextContent('This set has no coins yet.');
      expect(screen.queryByTestId('set-editor-empty-owner-hint')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-toggle-add-coins')).not.toBeInTheDocument();
    });
  });

  describe('criterion 13: Missing filter with nothing missing', () => {
    it('shows the complete state with a Complete badge, the message and Show all coins', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      const user = userEvent.setup();
      renderPage();
      await waitForCards();
      expect(screen.queryByTestId('set-editor-complete-empty')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      const box = screen.getByTestId('set-editor-complete-empty');
      expect(within(box).getByTestId('badge')).toHaveAttribute('data-variant', 'complete');
      expect(box).toHaveTextContent('Nothing missing. This set is complete.');
      expect(within(box).getByTestId('set-editor-show-all-coins')).toHaveTextContent('Show all coins');
      expect(screen.queryByTestId('coin-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-groups')).not.toBeInTheDocument();
    });

    it('Show all coins switches back to All and shows the cards', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      const user = userEvent.setup();
      renderPage();
      await waitForCards();
      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      await user.click(screen.getByTestId('set-editor-show-all-coins'));

      expect(screen.queryByTestId('set-editor-complete-empty')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('coin-card')).toHaveLength(3);
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('does not show the complete state for a set with missing coins', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.queryByTestId('set-editor-complete-empty')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('coin-card')).toHaveLength(2);
    });

    it('shows the complete state when a refetch makes the last missing coin owned while Missing is on', async () => {
      const user = userEvent.setup();
      const { rerender, params } = renderPage();
      await waitForCards();
      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));
      expect(screen.getAllByTestId('coin-card')).toHaveLength(2);

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      rerender(<SetEditorPage params={params} />);

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-complete-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-card')).not.toBeInTheDocument();
    });

    it('the complete state also works in List view', async () => {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      expect(screen.getByTestId('set-editor-complete-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('set-coin-row')).not.toBeInTheDocument();
    });
  });

  describe('Missing filter keeps busy coins visible until they settle', () => {
    it('keeps a pending coin that is now optimistically owned, and drops it once it settles', async () => {
      const { mutate, settle } = controllableOwnership();
      const user = userEvent.setup();
      const { rerender, params } = renderPage();
      await waitForCards();
      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));
      expect(queryCardByCoin('coin-b')).toBeDefined();

      await user.click(checkByCoin('coin-b'));
      expect(mutate).toHaveBeenCalledTimes(1);

      // the optimistic cache patch makes coin-b owned while the request is in flight
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_B_OPTIMISTIC }));
      rerender(<SetEditorPage params={params} />);
      expect(queryCardByCoin('coin-b')).toBeDefined();
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'pending');

      settle('coin-b');
      await waitFor(() => {
        expect(queryCardByCoin('coin-b')).toBeUndefined();
      });
      expect(queryCardByCoin('coin-c')).toBeDefined();
    });
  });

  describe('check does not navigate', () => {
    it('clicking the check toggles ownership and never clicks through to the card link', async () => {
      const { mutate } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();
      const link = within(cardByCoin('coin-b')).getByTestId('coin-card-link');
      const linkClicked = vi.fn((e: Event) => e.preventDefault()); // keep jsdom from navigating
      link.addEventListener('click', linkClicked);

      await user.click(checkByCoin('coin-b'));

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0][0]).toEqual({ coinId: 'coin-b', owned: true, coin: COIN_B });
      expect(linkClicked).not.toHaveBeenCalled();
      expect(link).toHaveAttribute('href', '/catalog/coin-b');
    });
  });

  describe('criterion 8: pending, no double toggles', () => {
    it('a quick double click sends exactly one request and marks the card pending and the check busy', async () => {
      const { mutate } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.dblClick(checkByCoin('coin-b'));

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0][0]).toEqual({ coinId: 'coin-b', owned: true, coin: COIN_B });
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'pending');
      expect(checkByCoin('coin-b')).toBeDisabled();
      expect(checkByCoin('coin-b')).toHaveAttribute('aria-busy', 'true');
    });

    it('while one card is pending, another card can still be toggled', async () => {
      const { mutate } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(checkByCoin('coin-b'));
      expect(checkByCoin('coin-c')).toBeEnabled();
      expect(cardByCoin('coin-c')).toHaveAttribute('data-status', 'idle');

      await user.click(checkByCoin('coin-c'));

      expect(mutate).toHaveBeenCalledTimes(2);
      expect(mutate.mock.calls[1][0]).toEqual({ coinId: 'coin-c', owned: true, coin: COIN_C });
      expect(checkByCoin('coin-b')).toBeDisabled();
      expect(checkByCoin('coin-c')).toBeDisabled();
    });

    it('settling one request re-enables only that check', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(checkByCoin('coin-b'));
      await user.click(checkByCoin('coin-c'));
      settle('coin-b');

      expect(checkByCoin('coin-b')).toBeEnabled();
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'idle');
      expect(checkByCoin('coin-c')).toBeDisabled();
      expect(cardByCoin('coin-c')).toHaveAttribute('data-status', 'pending');
    });

    it('List rows show the same pending state', async () => {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });

      const row = screen.getAllByTestId('set-coin-row').find((r) => r.getAttribute('data-coin-id') === 'coin-b');
      await user.click(within(row as HTMLElement).getByTestId('status-toggle'));

      expect(row).toHaveAttribute('data-status', 'pending');
      expect(within(row as HTMLElement).getByTestId('status-toggle')).toBeDisabled();
    });
  });

  describe('criterion 8: failure, retry and the live region', () => {
    it('has one polite live region that is screen-reader only and starts empty', async () => {
      renderPage();
      await waitForCards();

      const live = screen.getByTestId('set-editor-live');
      expect(live).toHaveAttribute('role', 'status');
      expect(live).toHaveAttribute('aria-live', 'polite');
      expect(live.className).toContain('sr-only');
      expect(live.textContent).toBe('');
    });

    it('a failed toggle shows the card as failed with Retry and announces it', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(checkByCoin('coin-b'));
      settle('coin-b', new ApiError(500, 'Internal server error'));

      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'failed');
      expect(within(cardByCoin('coin-b')).getByTestId('coin-card-retry')).toBeInTheDocument();
      expect(cardByCoin('coin-b')).toHaveAttribute('data-state', 'missing');
      expect(screen.getByTestId('set-editor-live').textContent).toMatch(
        /^Couldn.t save Luhansk Oblast\. Try again\.$/,
      );
      expect(within(cardByCoin('coin-c')).queryByTestId('coin-card-retry')).not.toBeInTheDocument();
    });

    it('Retry repeats the intended change on the same coin and clears the failed state', async () => {
      const { mutate, settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();
      await user.click(checkByCoin('coin-b'));
      settle('coin-b', new ApiError(500, 'Internal server error'));

      await user.click(within(cardByCoin('coin-b')).getByTestId('coin-card-retry'));

      expect(mutate).toHaveBeenCalledTimes(2);
      expect(mutate.mock.calls[1][0]).toEqual({ coinId: 'coin-b', owned: true, coin: COIN_B });
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'pending');
      expect(within(cardByCoin('coin-b')).queryByTestId('coin-card-retry')).not.toBeInTheDocument();
    });

    it('a successful toggle announces the new state and shows no failure', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(checkByCoin('coin-b'));
      settle('coin-b');

      expect(screen.getByTestId('set-editor-live').textContent).toBe('Luhansk Oblast marked as owned.');
      expect(cardByCoin('coin-b')).toHaveAttribute('data-status', 'idle');
      expect(within(cardByCoin('coin-b')).queryByTestId('coin-card-retry')).not.toBeInTheDocument();
    });

    it('announces "marked as missing" when an owned coin is toggled off', async () => {
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitForCards();

      await user.click(checkByCoin('coin-a'));
      settle('coin-a');

      expect(screen.getByTestId('set-editor-live').textContent).toBe('Donetsk Oblast marked as missing.');
    });

    it('a failed List row shows the failed subtitle and tint', async () => {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      const { settle } = controllableOwnership();
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(3);
      });
      const row = () =>
        screen.getAllByTestId('set-coin-row').find((r) => r.getAttribute('data-coin-id') === 'coin-b') as HTMLElement;

      await user.click(within(row()).getByTestId('status-toggle'));
      settle('coin-b', new ApiError(500, 'Internal server error'));

      expect(row()).toHaveAttribute('data-status', 'failed');
      expect(row().className).toContain('bg-danger-bg');
      expect(within(row()).getByTestId('set-coin-row-subtitle').textContent).toMatch(
        /^Couldn.t save\. Check your connection\.$/,
      );
    });
  });

  describe('criterion 3: the progress follows the gap data immediately', () => {
    it('shows the optimistic counts as soon as the gaps change, before any settle', async () => {
      controllableOwnership();
      const user = userEvent.setup();
      const { rerender, params } = renderPage();
      await waitForCards();
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('1 of 3 owned');

      await user.click(checkByCoin('coin-b'));
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_B_OPTIMISTIC }));
      rerender(<SetEditorPage params={params} />);

      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('2 of 3 owned');
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('67%');
      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 1');
    });
  });
});
