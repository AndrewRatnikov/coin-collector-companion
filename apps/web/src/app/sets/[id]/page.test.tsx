/**
 * Tests for: SetEditorPage
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Page: SetEditorPage (CREATE)
 *                   runs/run_20260722_121303/plan.md § Interface Contract → Modify: Loading-state fixes
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/sets/[id]/page.tsx — Set Editor
 * Covers criteria: #1, #3, #4, #5, #9 (from run_20260721_171115's prd.md), #1 (from
 *                  run_20260722_121303's prd.md), #12, #13 (from run_20260728_071525's prd.md)
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
 *
 * run_20260728_071525 replaces the separate rename-form (REMOVE set-editor-rename-form/
 * -rename-input/-rename-submit) with an inline-editable set-editor-name-input in the owner
 * branch (non-owners keep the unchanged, read-only set-editor-name heading); replaces the
 * flat set-editor-gap-grid item list with decade-grouped accordions (set-editor-decade-group/
 * -decade-toggle, default all-open) plus an all/missing toggle (set-editor-show-all-toggle/
 * -show-missing-toggle); and gates the existing add-coins panel behind a new
 * set-editor-toggle-add-coins button (pickerOpen, default false). The fixture data below
 * is deliberately richer than the prior run's (4 coins spanning 3 different decades, with
 * positions intentionally NOT in decade order) specifically to make decade-grouping and
 * decade-then-position sorting independently falsifiable — a 2-coin, single-decade fixture
 * could not distinguish "sorted by decade then position" from "sorted by position alone".
 *
 * CONTRACT_GAP:
 * - plan.md's set-editor-name-input bullet reads: "calls useRenameSet().mutate({id, name})
 *   on blur (or debounced change) when the value differs from the last-saved name" — it
 *   offers two alternative save triggers without picking one. This is the highest-risk
 *   ambiguity in the whole plan per the plan's own "Risks" section. Best-documented choice:
 *   this test file asserts the **blur** trigger only (deterministic in jsdom/vitest with no
 *   fake timers and no unstated debounce interval to guess at). If the Coder instead
 *   implements a debounced-change save with no blur handler at all, the two tests below
 *   ("calls useRenameSet().mutate on blur…" / "does not call … when unchanged") will fail
 *   even though a debounced-change implementation could still satisfy the same payload
 *   shape and PRD intent — reconcile by updating these two tests to fire/advance a debounce
 *   timer instead of `fireEvent.blur`, not by weakening the mutate-payload assertion itself.
 * - The decade-toggle's exact text format ("decade label e.g. '1910s' + owned/total summary")
 *   is not fully pinned down — no example string is given for the summary portion (e.g.
 *   "2/3" vs "2 of 3" vs "(2 owned)"). Tests below assert the decade label exactly (derived
 *   deterministically from `Math.floor(year / 10) * 10`) and only assert *some* digit is
 *   present in the toggle's text for the summary portion, rather than an exact format.
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
  year: 1909, // 1900s
  mintMark: 'S',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_2 = { ...COIN_1, id: 'coin-2', year: 1958 }; // 1950s
const COIN_3 = { ...COIN_1, id: 'coin-3', year: 1943 }; // 1940s
const COIN_4 = { ...COIN_1, id: 'coin-4', year: 1952 }; // 1950s (same decade as coin-2)

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 2, coin: COIN_1 },
    { id: 'usc-2', position: 0, coin: COIN_2 },
    { id: 'usc-3', position: 1, coin: COIN_3 },
    { id: 'usc-4', position: 3, coin: COIN_4 },
  ],
};

// Positions are deliberately scrambled relative to decade order: expected
// decade-then-position render order is coin-1 (1900s), coin-3 (1940s),
// coin-2 (1950s, position 0), coin-4 (1950s, position 3).
const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-4', position: 3, coin: COIN_4, owned: false },
    { id: 'usc-1', position: 2, coin: COIN_1, owned: true },
    { id: 'usc-2', position: 0, coin: COIN_2, owned: false },
    { id: 'usc-3', position: 1, coin: COIN_3, owned: false },
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

  describe('criterion 1: loading state uses a Skeleton and matches the page\'s own spacing', () => {
    it('renders a skeleton element within set-editor-loading, no literal "Loading…" text, and the set-editor-page wrapper carries the standard flex/gap/padding classes', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(queryResult({ isLoading: true }));
      const { container } = renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-loading')).toBeInTheDocument();
      });
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

      const page = screen.getByTestId('set-editor-page');
      expect(page).toHaveClass('flex');
      expect(page).toHaveClass('flex-col');
      expect(page).toHaveClass('gap-6');
      expect(page).toHaveClass('mx-auto');
      expect(page).toHaveClass('max-w-[1080px]');
    });
  });

  describe('criterion 4: renders completion % and the gap grid sorted by decade then position', () => {
    it('groups slots into decade accordions, ordered decade-ascending then position-ascending within a decade, regardless of API array order', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');

      const groups = screen.getAllByTestId('set-editor-decade-group');
      expect(groups).toHaveLength(3);
      const toggles = screen.getAllByTestId('set-editor-decade-toggle');
      expect(toggles[0]).toHaveTextContent('1900s');
      expect(toggles[1]).toHaveTextContent('1940s');
      expect(toggles[2]).toHaveTextContent('1950s');
      // Each decade-toggle shows some owned/total summary alongside the label
      // (exact copy format isn't pinned by the Interface Contract beyond "decade
      // label + owned/total summary" — asserting a digit is present is
      // sufficient to falsify a toggle that renders no summary at all).
      toggles.forEach((toggle) => expect(toggle.textContent).toMatch(/\d/));

      const items = screen.getAllByTestId('set-editor-gap-item');
      const statuses = screen.getAllByTestId('set-editor-gap-status');
      // Expected order: coin-1 (1900s), coin-3 (1940s), coin-2 (1950s, pos 0), coin-4 (1950s, pos 3)
      expect(items[0]).toHaveTextContent('Lincoln Wheat Cent'); // sanity: label renders at all
      expect(statuses[0]).toHaveTextContent('owned'); // coin-1
      expect(statuses[1]).toHaveTextContent('missing'); // coin-3
      expect(statuses[2]).toHaveTextContent('missing'); // coin-2
      expect(statuses[3]).toHaveTextContent('missing'); // coin-4
    });

    it('all decade groups are open by default (every item visible without any prior interaction)', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
      // No click on any set-editor-decade-toggle happened above — all 4 items are
      // already visible, proving the default collapsed-state map starts empty.
    });

    it('clicking a decade-toggle collapses that decade\'s items only; clicking again re-expands it', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
      const toggles = screen.getAllByTestId('set-editor-decade-toggle');
      await user.click(toggles[0]); // collapse 1900s (coin-1, the only slot in that decade)

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });

      await user.click(toggles[0]); // re-expand
      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
    });
  });

  describe('run_20260728_071525 criterion 12: all/missing-only toggle', () => {
    it('defaults to showing all coins, with the "All coins" toggle reflected as active via aria-pressed', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-show-all-toggle')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveTextContent('All coins');
      // 3 of the 4 slots are missing in the default fixture.
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveTextContent('3');
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveTextContent('missing');
    });

    it('clicking "missing" hides owned slots and any decade group left with zero slots', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(3);
      });
      // coin-1 (the only owned slot, and the only slot in the 1900s decade) is gone,
      // and its now-empty 1900s decade group is hidden entirely.
      expect(screen.getAllByTestId('set-editor-decade-group')).toHaveLength(2);
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'false');

      await user.click(screen.getByTestId('set-editor-show-all-toggle'));
      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-gap-item')).toHaveLength(4);
      });
      expect(screen.getAllByTestId('set-editor-decade-group')).toHaveLength(3);
    });
  });

  describe('criterion 5: non-owner (logged in, set not in useUserSets) sees a read-only view', () => {
    it('renders the read-only heading and gap grid but no edit controls', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name')).toHaveTextContent('My Wheat Cents');
      });
      expect(screen.queryByTestId('set-editor-name-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-toggle-owned-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-remove-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-delete-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-toggle-add-coins')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });
  });

  describe('run_20260728_071525 criterion 12: owner sees an inline-editable name input instead of the read-only heading', () => {
    it('renders set-editor-name-input with the set\'s current name, and no read-only set-editor-name heading', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name-input')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-name-input')).toHaveValue('My Wheat Cents');
      expect(screen.queryByTestId('set-editor-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-rename-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-rename-input')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-rename-submit')).not.toBeInTheDocument();
    });

    it('calls useRenameSet().mutate({ id, name }) on blur when the value has changed', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name-input')).toBeInTheDocument();
      });
      const input = screen.getByTestId('set-editor-name-input');
      // fireEvent.change replaces the controlled input's value in one synthetic event —
      // user.clear() + user.type() was tried first but appended rather than replaced
      // against this pre-populated controlled input in this jsdom+vitest setup
      // (documented gotcha, memory.md run_20260721_171115).
      fireEvent.change(input, { target: { value: 'Renamed Set' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(renameMutate).toHaveBeenCalledTimes(1);
      });
      expect(renameMutate.mock.calls[0][0]).toEqual({ id: 'set-1', name: 'Renamed Set' });
    });

    it('does not call useRenameSet().mutate on blur when the value is unchanged from the last-saved name', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-name-input')).toBeInTheDocument();
      });
      const input = screen.getByTestId('set-editor-name-input');
      fireEvent.blur(input);

      expect(renameMutate).not.toHaveBeenCalled();
    });
  });

  describe('criterion 4: owner view renders edit controls', () => {
    it('renders toggle-owned and remove on every gap item, plus delete and the add-coins toggle', async () => {
      setStoredToken('tok-abc');
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(4);
      });
      expect(screen.getAllByTestId('set-editor-remove-button')).toHaveLength(4);
      expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      // The add-coins panel is gated behind the toggle now — not shown until clicked.
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });

    it('toggling an unowned coin (coin-3, 1940s) calls useSetOwnership().mutate with owned: true (never a client-side flip)', async () => {
      setStoredToken('tok-abc');
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(4);
      });
      const toggles = screen.getAllByTestId('set-editor-toggle-owned-button');
      await user.click(toggles[1]); // decade-then-position order: [coin-1, coin-3, coin-2, coin-4]

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-3', owned: true });
    });

    it('toggling an owned coin (coin-1, 1900s) calls useSetOwnership().mutate with owned: false', async () => {
      setStoredToken('tok-abc');
      const ownershipMutate = vi.fn();
      useSetOwnershipMock.mockReturnValue({ mutate: ownershipMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-toggle-owned-button')).toHaveLength(4);
      });
      const toggles = screen.getAllByTestId('set-editor-toggle-owned-button');
      await user.click(toggles[0]); // coin-1

      expect(ownershipMutate).toHaveBeenCalledTimes(1);
      expect(ownershipMutate.mock.calls[0][0]).toEqual({ coinId: 'coin-1', owned: false });
    });

    it('removing a slot (coin-2, 1950s) calls usePatchSetCoins(id).mutate with { remove: [coinId] } — the catalog coin id, not the UserSetCoin row id', async () => {
      setStoredToken('tok-abc');
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getAllByTestId('set-editor-remove-button')).toHaveLength(4);
      });
      const removeButtons = screen.getAllByTestId('set-editor-remove-button');
      await user.click(removeButtons[2]); // coin-2

      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(patchMutate.mock.calls[0][0]).toEqual({ remove: ['coin-2'] });
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });

    it('clicking delete opens a confirmation dialog rather than deleting immediately', async () => {
      setStoredToken('tok-abc');
      const deleteMutate = vi.fn();
      useDeleteSetMock.mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('set-editor-delete-button'));

      expect(screen.getByTestId('set-editor-delete-confirm')).toBeInTheDocument();
      expect(deleteMutate).not.toHaveBeenCalled();
    });

    it('clicking cancel in the confirmation dialog closes it without deleting', async () => {
      setStoredToken('tok-abc');
      const deleteMutate = vi.fn();
      useDeleteSetMock.mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-delete-button'));
      await user.click(screen.getByTestId('set-editor-delete-confirm-cancel'));

      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();
      expect(deleteMutate).not.toHaveBeenCalled();
    });

    it('confirming in the dialog calls useDeleteSet().mutate with the id and redirects to /dashboard on success', async () => {
      setStoredToken('tok-abc');
      useDeleteSetMock.mockReturnValue(mutationMock({ resolvedValue: undefined }));
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-delete-button')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-delete-button'));
      await user.click(screen.getByTestId('set-editor-delete-confirm-confirm'));

      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('run_20260728_071525 criterion 12: add-coins panel is gated behind set-editor-toggle-add-coins', () => {
    it('shows the panel in a sheet only after clicking the toggle, and hides it again via the sheet close button', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('set-editor-toggle-add-coins'));
      expect(screen.getByTestId('sheet')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-add-coins-panel')).toBeInTheDocument();

      await user.click(screen.getByTestId('sheet-close'));
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });

    it('the Add coins panel filters via useCatalog and adding a result calls usePatchSetCoins(id).mutate with { add: [coin.id] }', async () => {
      setStoredToken('tok-abc');
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      const EXTRA_COIN = { ...COIN_1, id: 'coin-extra', year: 1972 };
      useCatalogMock.mockReturnValue(
        queryResult({ data: { items: [EXTRA_COIN], page: 1, limit: 20, total: 1 } }),
      );
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-toggle-add-coins'));

      expect(screen.getByTestId('set-editor-add-coins-panel')).toBeInTheDocument();
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
      expect(patchMutate.mock.calls[0][0]).toEqual({ add: ['coin-extra'] });
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });
  });
});
