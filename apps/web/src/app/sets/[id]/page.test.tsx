/**
 * Tests for: SetEditorPage (Phase 4 redesign): header, loading/error, rename, delete, add sheet, visitor
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Page: SetEditorPage (MODIFY)
 * Earlier contracts kept: runs/run_20260721_171115, run_20260722_121303, run_20260728_071525,
 *                         run_20261011_095624, run_20261017_142658
 * Covers criteria: #1, #2, #3, #4, #15, #16 (run_20261017_210503) plus the delete, rename and add-coins
 *                  behaviour that earlier runs pinned and this run keeps.
 *
 * run_20261017_210503 intentionally drops what is gone: decade accordions, per-row Mark owned / Remove
 * buttons, the owner's always-on name input (now behind Rename), "All coins · N" labels and the /sets
 * breadcrumb. Behaviour that stays (delete dialog, CSV controls live in missing-export.test.tsx, Add
 * coins sheet, blur-to-save rename) keeps its assertions.
 *
 * Unwraps `params` via the useEffect/useState pattern (documented gotcha: use() in Suspense never
 * re-renders in this repo's jsdom+vitest setup), so no <Suspense> is needed around renderPage().
 *
 * Mutation mocks auto-invoke onSuccess/onError, mirroring sets/new/page.test.tsx.
 *
 * Rename is saved on blur (and on Enter); Escape cancels. These are the plan's rules.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const COIN_A = BASE_COIN; // 2025 owned
const COIN_B = { ...BASE_COIN, id: 'coin-b', variety: 'We Are Strong. We Are Together: Luhansk Oblast' }; // 2025
const COIN_C = { ...BASE_COIN, id: 'coin-c', year: 2026, variety: 'We Are Strong. We Are Together: Odesa Oblast' };
const COIN_D = { ...BASE_COIN, id: 'coin-d', year: 2026, variety: 'We Are Strong. We Are Together: Kyiv Oblast' };

const SET_NAME = 'We Are Strong. We Are Together';

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: SET_NAME,
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

// Positions scrambled relative to array order so year/position ordering is falsifiable.
const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-c', position: 2, coin: COIN_C, owned: false },
    { id: 'usc-a', position: 0, coin: COIN_A, owned: true },
    { id: 'usc-d', position: 3, coin: COIN_D, owned: false },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: false },
  ],
};

const GAPS_NONE_OWNED = {
  ...GAPS,
  ownedCount: 0,
  completionPercent: 0,
  slots: GAPS.slots.map((s) => ({ ...s, owned: false })),
};

const GAPS_TWO_OWNED = {
  ...GAPS,
  ownedCount: 2,
  completionPercent: 50,
  slots: GAPS.slots.map((s) => ({ ...s, owned: s.id === 'usc-a' || s.id === 'usc-b' })),
};

const MY_SETS = [
  {
    id: 'set-1',
    userId: 'user-1',
    name: SET_NAME,
    clonedFromCanonicalId: 'canon-1',
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

function setUrl(path: string) {
  window.history.replaceState(null, '', path);
}

function setDefaultMocks() {
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
}

function setWith(overrides: { name?: string; coins?: typeof SET_DETAIL.coins; kind?: Record<string, string | null> }) {
  return {
    ...SET_DETAIL,
    ...(overrides.name ? { name: overrides.name } : {}),
    ...(overrides.kind ?? {}),
  };
}

async function waitForPage() {
  await waitFor(() => {
    expect(screen.getByTestId('set-editor-name')).toBeInTheDocument();
  });
}

describe('SetEditorPage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
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

  describe('criterion 15: loading and error states', () => {
    it('renders set-editor-loading with skeletons and aria-busy while usePublicSet is loading', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-loading')).toBeInTheDocument();
      });
      const loading = screen.getByTestId('set-editor-loading');
      expect(loading).toHaveAttribute('aria-busy', 'true');
      // title, subtitle, toolbar and five card placeholders
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(5);
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-page')).toBeInTheDocument();
    });

    it('renders set-editor-loading while useSetGaps is loading', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-loading')).toBeInTheDocument();
      });
    });

    it('renders a danger alert with title, body and a retry button when usePublicSet fails', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-error')).toBeInTheDocument();
      });
      const alert = screen.getByTestId('set-editor-error');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(alert.textContent).toMatch(/We couldn.t load this set\./);
      expect(alert).toHaveTextContent('Check your connection and try again.');
      expect(screen.getByTestId('set-editor-error-retry')).toHaveTextContent('Try again');
    });

    it('renders the same alert when useSetGaps fails', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-error-retry')).toBeInTheDocument();
    });

    it('Try again refetches both the set query and the gaps query', async () => {
      setStoredToken('tok-abc');
      const refetchSet = vi.fn();
      const refetchGaps = vi.fn();
      usePublicSetMock.mockReturnValue(queryResult({ isError: true, refetch: refetchSet }));
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS, refetch: refetchGaps }));
      const user = userEvent.setup();
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-error-retry')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-error-retry'));

      expect(refetchSet).toHaveBeenCalledTimes(1);
      expect(refetchGaps).toHaveBeenCalledTimes(1);
    });
  });

  describe('criterion 2: header, breadcrumb, title and subtitle', () => {
    it('shows "‹ My sets" linking to /dashboard for the owner', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      const crumb = screen.getByTestId('set-editor-breadcrumb');
      expect(crumb).toHaveTextContent('‹ My sets');
      expect(crumb).toHaveAttribute('href', '/dashboard');
    });

    it('shows "‹ Public sets" linking to /sets/public for a visitor', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitForPage();

      const crumb = screen.getByTestId('set-editor-breadcrumb');
      expect(crumb).toHaveTextContent('‹ Public sets');
      expect(crumb).toHaveAttribute('href', '/sets/public');
    });

    it('renders the title as a plain h1 with the full set name, for the owner too (no input)', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      const h1 = screen.getByTestId('set-editor-name');
      expect(h1.tagName).toBe('H1');
      expect(h1).toHaveTextContent(SET_NAME);
      expect(screen.queryByTestId('set-editor-name-input')).not.toBeInTheDocument();
    });

    it('never truncates a very long title: full text present and no truncate class', async () => {
      setStoredToken('tok-abc');
      const longName = 'The Very Long Title of a Collector Set That Must Wrap Onto Several Lines at 390 Pixels Wide';
      usePublicSetMock.mockReturnValue(queryResult({ data: setWith({ name: longName }) }));
      renderPage();
      await waitForPage();

      const h1 = screen.getByTestId('set-editor-name');
      expect(h1.textContent).toBe(longName);
      expect(h1.className).not.toContain('truncate');
      expect(h1.className).not.toContain('overflow-hidden');
    });

    it('shows the shared-parts subtitle for a curated set', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-subtitle').textContent).toBe(
        'Curated checklist · Ukraine · 10 Hryvnias · 2025–2026',
      );
      const years = screen.getByTestId('set-editor-subtitle-years');
      expect(years).toHaveTextContent('2025–2026');
      expect(years.className).toContain('font-mono');
    });

    it('uses the kind label for a copied set and a custom set', async () => {
      setStoredToken('tok-abc');
      usePublicSetMock.mockReturnValue(
        queryResult({ data: setWith({ kind: { clonedFromCanonicalId: null, clonedFromUserSetId: 'set-9' } }) }),
      );
      const { unmount } = renderPage();
      await waitForPage();
      expect(screen.getByTestId('set-editor-subtitle').textContent).toMatch(/^Copied set · /);
      unmount();

      usePublicSetMock.mockReturnValue(
        queryResult({ data: setWith({ kind: { clonedFromCanonicalId: null, clonedFromUserSetId: null } }) }),
      );
      renderPage();
      await waitForPage();
      expect(screen.getByTestId('set-editor-subtitle').textContent).toMatch(/^Custom set · /);
    });

    it('omits parts that vary across the set', async () => {
      setStoredToken('tok-abc');
      const mixed = {
        ...GAPS,
        slots: GAPS.slots.map((s) =>
          s.id === 'usc-d' ? { ...s, coin: { ...COIN_D, country: 'Poland', denomination: '5 Zlotych' } } : s,
        ),
      };
      useSetGapsMock.mockReturnValue(queryResult({ data: mixed }));
      renderPage();
      await waitForPage();

      const text = screen.getByTestId('set-editor-subtitle').textContent ?? '';
      expect(text).not.toContain('Ukraine');
      expect(text).not.toContain('Poland');
      expect(text).not.toContain('Hryvnias');
      expect(text).toContain('Curated checklist');
      expect(text).toContain('2025–2026');
    });

    it('shows one year for a single-year set', async () => {
      setStoredToken('tok-abc');
      const oneYear = {
        ...GAPS,
        slots: GAPS.slots.map((s) => ({ ...s, coin: { ...s.coin, year: 2025 } })),
      };
      useSetGapsMock.mockReturnValue(queryResult({ data: oneYear }));
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-subtitle-years').textContent).toBe('2025');
      expect(screen.getByTestId('set-editor-subtitle').textContent).toBe(
        'Curated checklist · Ukraine · 10 Hryvnias · 2025',
      );
    });
  });

  describe('criterion 3: progress block', () => {
    it('shows "N of M owned" with the exact plain text, following the data', async () => {
      setStoredToken('tok-abc');
      const { unmount } = renderPage();
      await waitForPage();
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('1 of 4 owned');
      unmount();

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_TWO_OWNED }));
      renderPage();
      await waitForPage();
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('2 of 4 owned');
    });

    it('shows the percentage in mono tabular-nums and a progressbar with the same value', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      const completion = screen.getByTestId('set-editor-completion');
      expect(completion).toHaveTextContent('25%');
      expect(completion.className).toContain('font-mono');
      expect(completion.className).toContain('tabular-nums');
      expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '25');
      expect(screen.getByTestId('set-editor-progress')).toContainElement(screen.getByTestId('set-editor-owned-count'));
    });

    it('updates the numbers at once when the gaps data changes', async () => {
      setStoredToken('tok-abc');
      const { rerender } = renderPage();
      await waitForPage();
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('25%');

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_TWO_OWNED }));
      rerender(<SetEditorPage params={Promise.resolve({ id: 'set-1' })} />);

      await waitFor(() => {
        expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('50%');
      });
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('2 of 4 owned');
    });
  });

  describe('criterion 1: Show segments', () => {
    it('shows "All 4" and "Missing 3" with All pressed by default', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-show-all-toggle').textContent).toBe('All 4');
      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 3');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-missing-toggle')).toHaveAttribute('aria-pressed', 'false');
    });

    it('the Missing count follows the data', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_TWO_OWNED }));
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 2');
    });
  });

  describe('criterion 4: toolbar', () => {
    it('gives the owner Select (album), Add coins and the set menu', async () => {
      setStoredToken('tok-abc');
      renderPage();
      await waitForPage();

      const select = screen.getByTestId('set-editor-select-toggle');
      expect(select).toHaveTextContent('Select');
      expect(select).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Add coins' })).toBe(screen.getByTestId('set-editor-toggle-add-coins'));
      expect(screen.getByTestId('set-editor-actions-trigger')).toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });

    it('hides Select in List view', async () => {
      setStoredToken('tok-abc');
      setUrl('/sets/set-1?view=list');
      renderPage();
      await waitForPage();

      expect(screen.queryByTestId('set-editor-select-toggle')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-editor-toggle-add-coins')).toBeInTheDocument();
    });

    it('gives a visitor no Select, no Add coins and no set menu', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitForPage();

      expect(screen.queryByTestId('set-editor-select-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-toggle-add-coins')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-actions-trigger')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-download-missing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-delete-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-add-coins-panel')).not.toBeInTheDocument();
    });

    it('gives a visitor the coins without owner controls', async () => {
      setStoredToken('tok-abc');
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      expect(screen.queryAllByTestId('status-toggle')).toHaveLength(0);
      expect(screen.getByTestId('set-editor-name').tagName).toBe('H1');
    });

    it('closes the actions menu on Escape and returns focus to its trigger', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const trigger = screen.getByTestId('set-editor-actions-trigger');
      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  describe('rename (behind the ⋯ menu)', () => {
    async function startRename() {
      const user = userEvent.setup();
      renderPage();
      await waitForPage();
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      await user.click(screen.getByTestId('set-editor-rename-item'));
      return user;
    }

    it('swaps the h1 text for a focused input holding the whole name, selected', async () => {
      setStoredToken('tok-abc');
      await startRename();

      const input = await screen.findByTestId<HTMLInputElement>('set-editor-name-input');
      expect(input).toHaveValue(SET_NAME);
      expect(input.closest('h1')).not.toBeNull();
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(SET_NAME.length);
      expect(screen.queryByTestId('set-editor-actions-menu')).not.toBeInTheDocument();
    });

    it('calls useRenameSet().mutate({ id, name }) on blur when the value has changed', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      await startRename();

      const input = await screen.findByTestId('set-editor-name-input');
      // fireEvent.change replaces a controlled input's value in one event (user.clear + type appends here)
      fireEvent.change(input, { target: { value: 'Renamed Set' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(renameMutate).toHaveBeenCalledTimes(1);
      });
      expect(renameMutate.mock.calls[0][0]).toEqual({ id: 'set-1', name: 'Renamed Set' });
    });

    it('does not call mutate on blur when the value is unchanged', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      await startRename();

      fireEvent.blur(await screen.findByTestId('set-editor-name-input'));

      expect(renameMutate).not.toHaveBeenCalled();
    });

    it('saves on Enter when the value has changed', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      await startRename();

      const input = await screen.findByTestId('set-editor-name-input');
      fireEvent.change(input, { target: { value: 'Entered Name' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(renameMutate).toHaveBeenCalled();
      });
      expect(renameMutate.mock.calls[0][0]).toEqual({ id: 'set-1', name: 'Entered Name' });
    });

    it('cancels on Escape: no mutate, the input goes away and the old name stays', async () => {
      setStoredToken('tok-abc');
      const renameMutate = vi.fn();
      useRenameSetMock.mockReturnValue({ mutate: renameMutate, isPending: false } as never);
      await startRename();

      const input = await screen.findByTestId('set-editor-name-input');
      fireEvent.change(input, { target: { value: 'Discarded' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('set-editor-name-input')).not.toBeInTheDocument();
      });
      expect(renameMutate).not.toHaveBeenCalled();
      expect(screen.getByTestId('set-editor-name')).toHaveTextContent(SET_NAME);
    });
  });

  describe('delete', () => {
    async function openDeleteDialog() {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-actions-trigger')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      await user.click(screen.getByTestId('set-editor-delete-button'));
      return user;
    }

    it('clicking delete opens a confirmation dialog rather than deleting immediately', async () => {
      setStoredToken('tok-abc');
      const deleteMutate = vi.fn();
      useDeleteSetMock.mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
      await openDeleteDialog();

      expect(screen.getByTestId('set-editor-delete-confirm')).toBeInTheDocument();
      expect(deleteMutate).not.toHaveBeenCalled();
    });

    it('shows the set name, the coin count and the safe-collection note', async () => {
      setStoredToken('tok-abc');
      await openDeleteDialog();

      const dialog = screen.getByTestId('set-editor-delete-confirm');
      expect(dialog).toHaveTextContent(`Delete “${SET_NAME}”?`);
      expect(dialog).toHaveTextContent('list of 4 coins');
      expect(dialog).toHaveTextContent('Your collection is safe');
    });

    it('renders the dialog in the danger variant', async () => {
      setStoredToken('tok-abc');
      await openDeleteDialog();

      expect(screen.getByTestId('set-editor-delete-confirm-panel')).toHaveAttribute('data-variant', 'danger');
      expect(screen.getByTestId('set-editor-delete-confirm-panel')).toHaveAttribute('role', 'alertdialog');
      expect(screen.getByTestId('set-editor-delete-confirm-confirm').className).toContain('bg-danger');
    });

    it('the safe note follows the owned count and is omitted when nothing is owned', async () => {
      setStoredToken('tok-abc');
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_TWO_OWNED }));
      const view = renderPage();
      const user = userEvent.setup();
      await waitFor(() => {
        expect(screen.getByTestId('set-editor-actions-trigger')).toBeInTheDocument();
      });
      await user.click(screen.getByTestId('set-editor-actions-trigger'));
      await user.click(screen.getByTestId('set-editor-delete-button'));
      expect(screen.getByTestId('set-editor-delete-confirm-safe')).toHaveTextContent(
        /^Your collection is safe: the 2 coins/,
      );
      view.unmount();

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_NONE_OWNED }));
      await openDeleteDialog();
      expect(screen.getByTestId('set-editor-delete-confirm')).toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-delete-confirm-safe')).not.toBeInTheDocument();
    });

    it('clicking cancel closes the dialog without deleting', async () => {
      setStoredToken('tok-abc');
      const deleteMutate = vi.fn();
      useDeleteSetMock.mockReturnValue({ mutate: deleteMutate, isPending: false } as never);
      const user = await openDeleteDialog();

      await user.click(screen.getByTestId('set-editor-delete-confirm-cancel'));

      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();
      expect(deleteMutate).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
    });

    it('confirming calls useDeleteSet().mutate with the id, stores the notice and goes to /dashboard', async () => {
      setStoredToken('tok-abc');
      const deleteHook = mutationMock({ resolvedValue: undefined });
      useDeleteSetMock.mockReturnValue(deleteHook);
      const user = await openDeleteDialog();

      await user.click(screen.getByTestId('set-editor-delete-confirm-confirm'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
      expect((deleteHook as unknown as { mutate: ReturnType<typeof vi.fn> }).mutate.mock.calls[0][0]).toBe('set-1');
      expect(sessionStorage.getItem('ccc-set-deleted')).toBe(SET_NAME);
      expect(screen.queryByTestId('set-editor-delete-confirm')).not.toBeInTheDocument();
    });

    it('does not set the notice flag or navigate when the delete fails', async () => {
      setStoredToken('tok-abc');
      useDeleteSetMock.mockReturnValue(mutationMock({ rejectedValue: new Error('boom') }));
      const user = await openDeleteDialog();

      await user.click(screen.getByTestId('set-editor-delete-confirm-confirm'));

      expect(sessionStorage.getItem('ccc-set-deleted')).toBeNull();
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  describe('Add coins sheet (unchanged picker)', () => {
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

    it('filters via useCatalog and adding a result calls usePatchSetCoins(id).mutate with { add: [coin.id] }', async () => {
      setStoredToken('tok-abc');
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      const EXTRA_COIN = { ...BASE_COIN, id: 'coin-extra', year: 1972 };
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [EXTRA_COIN], page: 1, limit: 20, total: 1 } }));
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

      await user.type(screen.getByTestId('set-editor-add-coins-filter-country'), 'Ukraine');
      await user.click(screen.getByTestId('set-editor-add-coins-filter-submit'));

      await waitFor(() => {
        const lastCallArgs = useCatalogMock.mock.calls[useCatalogMock.mock.calls.length - 1][0] as {
          country?: string;
        };
        expect(lastCallArgs.country).toBe('Ukraine');
      });

      const addButtons = screen.getAllByTestId('set-editor-add-coins-add-button');
      await user.click(addButtons[0]);

      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(patchMutate.mock.calls[0][0]).toEqual({ add: ['coin-extra'] });
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });
  });
});
