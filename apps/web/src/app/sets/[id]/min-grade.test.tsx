/**
 * Tests for: SetEditorPage, set minimum grade and upgrades (coin grades, Phase 3 of 4)
 * Contract source: runs/run_20261103_192441/plan.md § Interface Contract → Page: SetEditorPage (MODIFY)
 * Covers criteria: #1, #2, #3, #6, #7, #8, #10, #11
 *
 * The page reads only the API's needsUpgrade / upgradeCount / minGrade. Mutation is mocked; the mock calls
 * the per-call onSuccess / onError callbacks, as the other page tests do.
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
  useUpdateSetMinGrade,
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
  useUpdateSetMinGrade: vi.fn(),
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
const useUpdateSetMinGradeMock = vi.mocked(useUpdateSetMinGrade);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useBulkSetOwnershipMock = vi.mocked(useBulkSetOwnership);
const useCollectionMock = vi.mocked(useCollection);
const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function plainMutation() {
  return { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as never;
}

function minGradeMutation({
  fail = false,
  isPending = false,
  variables,
}: { fail?: boolean; isPending?: boolean; variables?: unknown } = {}) {
  const mutate = vi.fn(
    (_vars: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (fail) opts?.onError?.(new Error('boom'));
      else opts?.onSuccess?.(undefined);
    },
  );
  return { hook: { mutate, isPending, variables } as never, mutate };
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
  variety: 'Donetsk Oblast',
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
const COIN_A = BASE_COIN;
const COIN_B = { ...BASE_COIN, id: 'coin-b', variety: 'Luhansk Oblast' };
const COIN_C = { ...BASE_COIN, id: 'coin-c', year: 2026, variety: 'Odesa Oblast' };
const COIN_D = { ...BASE_COIN, id: 'coin-d', year: 2026, variety: 'Kyiv Oblast' };

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

// a, b owned and need an upgrade; c owned and fine; d missing.
const GAPS_WITH_MIN = {
  setId: 'set-1',
  ownedCount: 3,
  totalCount: 4,
  completionPercent: 75,
  minGrade: 'VF',
  upgradeCount: 2,
  slots: [
    { id: 'usc-a', position: 0, coin: COIN_A, owned: true, needsUpgrade: true },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: true, needsUpgrade: true },
    { id: 'usc-c', position: 2, coin: COIN_C, owned: true, needsUpgrade: false },
    { id: 'usc-d', position: 3, coin: COIN_D, owned: false },
  ],
};

// Owned coins all meet the minimum: count is 0 and shown.
const GAPS_ZERO_UPGRADES = {
  ...GAPS_WITH_MIN,
  upgradeCount: 0,
  slots: GAPS_WITH_MIN.slots.map((s) => ({ ...s, ...(s.owned ? { needsUpgrade: false } : {}) })),
};

// minGrade null: the API sends neither upgradeCount nor needsUpgrade.
const GAPS_NO_MIN = {
  setId: 'set-1',
  ownedCount: 3,
  totalCount: 4,
  completionPercent: 75,
  minGrade: null,
  slots: GAPS_WITH_MIN.slots.map((s) => ({ id: s.id, position: s.position, coin: s.coin, owned: s.owned })),
};

function setDefaultMocks() {
  usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
  useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_WITH_MIN }));
  useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
  usePatchSetCoinsMock.mockReturnValue(plainMutation());
  useAddCoinsToSetMock.mockReturnValue(plainMutation());
  useRenameSetMock.mockReturnValue(plainMutation());
  useDeleteSetMock.mockReturnValue(plainMutation());
  useUpdateSetMinGradeMock.mockReturnValue(minGradeMutation().hook);
  useSetOwnershipMock.mockReturnValue(plainMutation());
  useBulkSetOwnershipMock.mockReturnValue(plainMutation());
  useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
  useCatalogFacetsMock.mockReturnValue(queryResult({ data: { countries: [], denominations: [] } }));
  useCollectionMock.mockReturnValue(queryResult({ data: [] }));
}

async function waitForPage() {
  await waitFor(() => {
    expect(screen.getByTestId('set-editor-name')).toBeInTheDocument();
  });
}

async function openMenuSelect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('set-editor-actions-trigger'));
  return screen.getByTestId<HTMLSelectElement>('set-editor-min-grade-select');
}

describe('SetEditorPage: set minimum grade and upgrades', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState(null, '', '/sets/set-1');
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
      useUpdateSetMinGradeMock,
      useSetOwnershipMock,
      useBulkSetOwnershipMock,
      useCollectionMock,
      useCatalogMock,
      useCatalogFacetsMock,
    ].forEach((m) => m.mockReset());
    setDefaultMocks();
    setStoredToken('tok-abc');
  });

  describe('criterion 7: header upgrade count', () => {
    it('shows the count from upgradeCount next to the completion, which stays unchanged', async () => {
      renderPage();
      await waitForPage();

      const count = screen.getByTestId('set-editor-upgrade-count');
      expect(count).toHaveTextContent('2');
      expect(count).toHaveTextContent('to upgrade');
      expect(screen.getByTestId('set-editor-progress')).toContainElement(count);
      expect(screen.getByTestId('set-editor-completion')).toHaveTextContent('75%');
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('3 of 4 owned');
    });

    it('follows the data: a different upgradeCount shows a different number', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: { ...GAPS_WITH_MIN, upgradeCount: 3 } }));
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-upgrade-count')).toHaveTextContent('3 to upgrade');
    });

    it('shows 0 when upgradeCount is 0, not nothing', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ZERO_UPGRADES }));
      renderPage();
      await waitForPage();

      expect(screen.getByTestId('set-editor-upgrade-count')).toHaveTextContent('0 to upgrade');
    });

    it('is absent when the set has no minimum grade (criterion 11)', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_NO_MIN }));
      renderPage();
      await waitForPage();

      expect(screen.queryByTestId('set-editor-upgrade-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-show-upgrade-toggle')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('coin-card-upgrade')).toHaveLength(0);
      expect(screen.getByTestId('set-editor-show-all-toggle').textContent).toBe('All 4');
      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 1');
    });
  });

  describe('criterion 5/6: Upgrade states on the page', () => {
    it('shows an Upgrade badge on exactly the cards flagged needsUpgrade, which stay owned', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      expect(screen.getAllByTestId('coin-card-upgrade')).toHaveLength(2);
      const flagged = screen.getAllByTestId('coin-card').filter((c) => c.getAttribute('data-upgrade') === 'true');
      expect(flagged).toHaveLength(2);
      flagged.forEach((card) => {
        expect(card).toHaveAttribute('data-state', 'owned');
      });
      expect(screen.getByTestId('set-editor-show-missing-toggle').textContent).toBe('Missing 1');
    });

    it('shows row badges in the list view', async () => {
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });

      expect(screen.getAllByTestId('set-coin-row-upgrade')).toHaveLength(2);
    });
  });

  describe('criterion 8: Needs upgrade filter', () => {
    it('shows the third segment with the count, not pressed by default', async () => {
      renderPage();
      await waitForPage();

      const toggle = screen.getByTestId('set-editor-show-upgrade-toggle');
      expect(toggle).toHaveTextContent('Needs upgrade');
      expect(toggle).toHaveTextContent('2');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows only the flagged coins when selected, and All / Missing restore their own views', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      await user.click(screen.getByTestId('set-editor-show-upgrade-toggle'));
      expect(screen.getByTestId('set-editor-show-upgrade-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(2);
      expect(screen.getAllByTestId('coin-card-upgrade')).toHaveLength(2);
      // counts of the header are unchanged by the filter
      expect(screen.getByTestId('set-editor-owned-count').textContent).toBe('3 of 4 owned');

      await user.click(screen.getByTestId('set-editor-show-missing-toggle'));
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(1);
      expect(screen.queryAllByTestId('coin-card-upgrade')).toHaveLength(0);

      await user.click(screen.getByTestId('set-editor-show-all-toggle'));
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
    });

    it('with 0 upgrades the toggle shows 0 and selecting it shows the empty state with a way back', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ZERO_UPGRADES }));
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const toggle = screen.getByTestId('set-editor-show-upgrade-toggle');
      expect(toggle).toHaveTextContent('0');
      await user.click(toggle);

      const empty = screen.getByTestId('set-editor-upgrade-empty');
      expect(empty).toHaveTextContent('No coins need an upgrade.');
      expect(screen.queryAllByTestId('set-album-item')).toHaveLength(0);

      await user.click(screen.getByTestId('set-editor-upgrade-show-all'));
      expect(screen.queryByTestId('set-editor-upgrade-empty')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'true');
    });

    it('falls back to All when the minimum is cleared while the filter is active', async () => {
      const user = userEvent.setup();
      const { rerender } = renderPage();
      await waitForPage();
      await user.click(screen.getByTestId('set-editor-show-upgrade-toggle'));
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(2);

      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_NO_MIN }));
      rerender(<SetEditorPage params={Promise.resolve({ id: 'set-1' })} />);

      await waitFor(() => {
        expect(screen.queryByTestId('set-editor-show-upgrade-toggle')).not.toBeInTheDocument();
      });
      expect(screen.getByTestId('set-editor-show-all-toggle')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
    });
  });

  describe('criteria 1-3: the Minimum grade select in the menu', () => {
    it('is preselected from gaps.minGrade and has 8 options in order (None, then the 7 codes)', async () => {
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const select = await openMenuSelect(user);
      expect(select).toHaveValue('VF');
      expect(screen.getByLabelText('Minimum grade')).toBe(select);
      const values = within(select)
        .getAllByRole('option')
        .map((o) => o.getAttribute('value'));
      expect(values).toEqual(['', 'G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC']);
    });

    it('preselects None when the set has no minimum', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_NO_MIN }));
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      expect(await openMenuSelect(user)).toHaveValue('');
    });

    it('picking VF calls mutate with { id, minGrade: "VF" } and announces it on success', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_NO_MIN }));
      const { hook, mutate } = minGradeMutation();
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const select = await openMenuSelect(user);
      fireEvent.change(select, { target: { value: 'VF' } });

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0][0]).toEqual({ id: 'set-1', minGrade: 'VF' });
      expect(screen.getByTestId('set-editor-live')).toHaveTextContent(/Minimum grade set to .*VF/);
      expect(screen.queryByTestId('set-editor-min-grade-error')).not.toBeInTheDocument();
    });

    it('picking a different grade sends that grade (not a fixed value)', async () => {
      const { hook, mutate } = minGradeMutation();
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      fireEvent.change(await openMenuSelect(user), { target: { value: 'AU' } });

      expect(mutate.mock.calls[0][0]).toEqual({ id: 'set-1', minGrade: 'AU' });
    });

    it('picking None calls mutate with { id, minGrade: null } and announces it was cleared', async () => {
      const { hook, mutate } = minGradeMutation();
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      fireEvent.change(await openMenuSelect(user), { target: { value: '' } });

      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0][0]).toEqual({ id: 'set-1', minGrade: null });
      expect(screen.getByTestId('set-editor-live')).toHaveTextContent('Minimum grade cleared.');
    });

    it('shows the error and leaves the select on the saved value when the save fails', async () => {
      const { hook, mutate } = minGradeMutation({ fail: true });
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const select = await openMenuSelect(user);
      fireEvent.change(select, { target: { value: 'UNC' } });

      expect(mutate).toHaveBeenCalledTimes(1);
      const alert = await screen.findByTestId('set-editor-min-grade-error');
      expect(alert).toHaveAttribute('role', 'alert');
      expect(screen.getByTestId<HTMLSelectElement>('set-editor-min-grade-select')).toHaveValue('VF');
      expect(screen.getByTestId('set-editor-live')).not.toHaveTextContent(/Minimum grade set to/);
    });

    it('clears the error on the next attempt', async () => {
      const failing = minGradeMutation({ fail: true });
      useUpdateSetMinGradeMock.mockReturnValue(failing.hook);
      const user = userEvent.setup();
      const { rerender } = renderPage();
      await waitForPage();
      fireEvent.change(await openMenuSelect(user), { target: { value: 'UNC' } });
      await screen.findByTestId('set-editor-min-grade-error');

      const working = minGradeMutation();
      useUpdateSetMinGradeMock.mockReturnValue(working.hook);
      rerender(<SetEditorPage params={Promise.resolve({ id: 'set-1' })} />);
      fireEvent.change(screen.getByTestId('set-editor-min-grade-select'), { target: { value: 'AU' } });

      await waitFor(() => {
        expect(screen.queryByTestId('set-editor-min-grade-error')).not.toBeInTheDocument();
      });
      expect(working.mutate).toHaveBeenCalledTimes(1);
    });

    it('shows the pending value and aria-busy while the save is in flight', async () => {
      const { hook } = minGradeMutation({ isPending: true, variables: { id: 'set-1', minGrade: 'XF' } });
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      const select = await openMenuSelect(user);
      expect(select).toHaveValue('XF');
      expect(select).toHaveAttribute('aria-busy', 'true');
    });

    it('does not mutate when the same grade is picked again', async () => {
      const { hook, mutate } = minGradeMutation({ isPending: true, variables: { id: 'set-1', minGrade: 'XF' } });
      useUpdateSetMinGradeMock.mockReturnValue(hook);
      const user = userEvent.setup();
      renderPage();
      await waitForPage();

      fireEvent.change(await openMenuSelect(user), { target: { value: 'XF' } });

      expect(mutate).not.toHaveBeenCalled();
    });
  });

  describe('criterion 10: visitors see none of it', () => {
    it('hides count, segment, menu and badges even when the response carries the fields', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-album-item')).toHaveLength(4);
      });

      expect(screen.queryByTestId('set-editor-upgrade-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-show-upgrade-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-actions-trigger')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-min-grade-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-editor-min-grade-error')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('coin-card-upgrade')).toHaveLength(0);
    });

    it('hides the row badges in the list view for a visitor', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      window.history.replaceState(null, '', '/sets/set-1?view=list');
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByTestId('set-coin-row')).toHaveLength(4);
      });

      expect(screen.queryAllByTestId('set-coin-row-upgrade')).toHaveLength(0);
    });
  });
});
