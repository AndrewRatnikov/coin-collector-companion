/**
 * Tests for: NewSetPage
 * Contract source: runs/run_20260728_071525/plan.md § Interface Contract →
 *   `apps/web/src/app/sets/new/page.tsx`
 * Covers criteria: #11 (from prd.md), plus #13/#14 (real data preserved / existing
 *   coverage updated, not regressed)
 *
 * CONTRACT_GAP:
 * - plan.md's "ADD hooks" bullet for this file only names `useCanonicalSet` /
 *   `usePublicSet` / `usePatchSetCoins`. It does not name a hook for the new
 *   `set-new-picker-results`/`set-new-picker-item` catalogue list, even though a
 *   `<CatalogFilterForm testIdPrefix="set-new-picker">` clearly needs a catalogue
 *   query to power it. The Set Editor's own Interface Contract block (same file,
 *   same run) describes a structurally identical CatalogFilterForm + results-list +
 *   add-button pattern powered by `useCatalog(addCoinsFilters)` — the only
 *   catalogue-listing hook that exists in this codebase (`@/lib/hooks/use-catalog`).
 *   Best-documented choice: this test file mocks `useCatalog` from that same real,
 *   existing module for the New Set picker, by analogy with the Set Editor block,
 *   rather than inventing a new hook name. If the Coder wires the picker to
 *   something else, this is the first thing to reconcile.
 * - The plan's "Behavior" bullet literally reads `usePatchSetCoins(result.id).mutate({
 *   add: idsToAdd, remove: idsToRemove })` — it does not say whether an empty
 *   `remove`/`add` array is omitted from the payload or included as `[]`. Tests
 *   below assert the literal `{ add: [...], remove: [...] }` two-key shape (matching
 *   the plan's exact wording), including empty-array cases, rather than guessing at
 *   an omit-when-empty convention the contract doesn't state.
 *
 * useCreateSet/usePatchSetCoins are each mocked with both `mutate` (callback-style)
 * and `mutateAsync` (promise-style) wired to the same resolved/rejected outcome,
 * since the Interface Contract's Behavior bullet doesn't pin down which TanStack
 * Query calling convention the Coder uses — only the observable result (mutate call
 * args, router.push call, or inline error text) is asserted here. This mirrors the
 * existing `makeCreateSetMock` convention already established in this file.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { formatCoinLabel } from '@coin-collector/shared';
import NewSetPage from '@/app/sets/new/page';
import { useCreateSet, usePatchSetCoins } from '@/lib/hooks/use-user-sets';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useCreateSet: vi.fn(),
  usePatchSetCoins: vi.fn(),
}));

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const useCreateSetMock = vi.mocked(useCreateSet);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);
const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const usePublicSetsMock = vi.mocked(usePublicSets);
const usePublicSetMock = vi.mocked(usePublicSet);
const useCatalogMock = vi.mocked(useCatalog);

const baseCoin = {
  country: 'USA',
  denomination: '1 Cent',
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  status: 'approved' as const,
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

// The two coins already in canonical set c2 ("baseline" of a clone).
const COIN_A = { ...baseCoin, id: 'coin-a', year: 1909, mintMark: 'S' };
const COIN_B = { ...baseCoin, id: 'coin-b', year: 1943 };
// Coins available from the catalogue picker, not yet in any set.
const COIN_D = { ...baseCoin, id: 'coin-d', year: 1955 };
const COIN_E = { ...baseCoin, id: 'coin-e', year: 1958 };

const CANONICAL_SETS = [
  { id: 'c1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1' },
  { id: 'c2', name: 'Lincoln Wheat Cent Key Dates', description: null, source: 'seed-template', templateVersion: 'v1' },
];

const CANONICAL_SET_DETAIL_C2 = {
  id: 'c2',
  name: 'Lincoln Wheat Cent Key Dates',
  description: null,
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [
    { id: 'csc-1', position: 0, coin: COIN_A },
    { id: 'csc-2', position: 1, coin: COIN_B },
  ],
};

const PUBLIC_SETS_PAGE = {
  items: [
    {
      id: 'u1',
      userId: 'user-2',
      name: "Bob's Set",
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
};

const NEW_SET = {
  id: 'new-set-1',
  userId: 'user-1',
  name: 'My New Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const EMPTY_CATALOG_PAGE = { items: [], page: 1, limit: 20, total: 0 };
const CATALOG_PAGE_DE = { items: [COIN_D, COIN_E], page: 1, limit: 20, total: 2 };

function makeMutationMock<T>({
  resolvedValue,
  rejectedValue,
}: {
  resolvedValue?: T;
  rejectedValue?: Error;
} = {}) {
  const mutateAsync = vi.fn(async () => {
    if (rejectedValue) throw rejectedValue;
    return resolvedValue;
  });
  const mutate = vi.fn(
    (_body: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) {
        opts?.onError?.(rejectedValue);
      } else {
        opts?.onSuccess?.(resolvedValue);
      }
    },
  );
  return { mutate, mutateAsync, isPending: false };
}

/** Find a repeated-testid row by substring of its text content — robust to nested markup. */
function findRowByText(testId: string, text: string) {
  const rows = screen.getAllByTestId(testId);
  const match = rows.find((row) => row.textContent?.includes(text));
  if (!match) throw new Error(`No row with testId ${testId} found containing "${text}"`);
  return match;
}

describe('NewSetPage', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('tok-abc');
    pushMock.mockClear();
    searchParamsValue = new URLSearchParams();
    useCreateSetMock.mockReset();
    usePatchSetCoinsMock.mockReset();
    useCanonicalSetsMock.mockReset();
    useCanonicalSetMock.mockReset();
    usePublicSetsMock.mockReset();
    usePublicSetMock.mockReset();
    useCatalogMock.mockReset();

    useCanonicalSetsMock.mockReturnValue({ data: CANONICAL_SETS, isLoading: false, isError: false } as never);
    useCanonicalSetMock.mockReturnValue({ data: undefined, isLoading: false, isError: false } as never);
    usePublicSetsMock.mockReturnValue({ data: PUBLIC_SETS_PAGE, isLoading: false, isError: false } as never);
    usePublicSetMock.mockReturnValue({ data: undefined, isLoading: false, isError: false } as never);
    useCreateSetMock.mockReturnValue(makeMutationMock({ resolvedValue: NEW_SET }) as never);
    usePatchSetCoinsMock.mockReturnValue(makeMutationMock({ resolvedValue: [] }) as never);
    useCatalogMock.mockReturnValue({ data: EMPTY_CATALOG_PAGE, isLoading: false, isError: false } as never);
  });

  describe('rendering', () => {
    it('renders the page root, name input, mode selector, submit button, and empty pending list, defaulting to blank mode with no query params', async () => {
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-page')).toBeInTheDocument();
      });
      expect(screen.getByTestId('set-new-name-input')).toBeInTheDocument();
      expect(screen.getByTestId('set-new-mode-blank')).toBeChecked();
      expect(screen.getByTestId('set-new-mode-canonical')).not.toBeChecked();
      expect(screen.getByTestId('set-new-mode-public')).not.toBeChecked();
      expect(screen.getByTestId('set-new-submit')).toBeInTheDocument();
      // Removed per contract: native selects no longer exist anywhere.
      expect(screen.queryByTestId('set-new-canonical-select')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-new-public-select')).not.toBeInTheDocument();
      // Blank mode: no source list shown.
      expect(screen.queryByTestId('set-new-source-list')).not.toBeInTheDocument();
      // Pending "in this set" list starts empty in blank mode.
      expect(screen.getByTestId('set-new-in-set-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('set-new-in-set-item')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: source picker list replaces native selects', () => {
    it('shows a set-new-source-item per canonical set only when canonical mode is selected', async () => {
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.click(screen.getByTestId('set-new-mode-canonical'));

      await waitFor(() => {
        expect(screen.getByTestId('set-new-source-list')).toBeInTheDocument();
      });
      const items = screen.getAllByTestId('set-new-source-item');
      expect(items).toHaveLength(2);
      expect(items.some((el) => el.textContent?.includes('Lincoln Wheat Cents'))).toBe(true);
      expect(items.some((el) => el.textContent?.includes('Lincoln Wheat Cent Key Dates'))).toBe(true);
    });

    it('shows a set-new-source-item per public set only when public mode is selected', async () => {
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.click(screen.getByTestId('set-new-mode-public'));

      await waitFor(() => {
        expect(screen.getByTestId('set-new-source-list')).toBeInTheDocument();
      });
      const items = screen.getAllByTestId('set-new-source-item');
      expect(items).toHaveLength(1);
      expect(items[0].textContent).toContain("Bob's Set");
    });
  });

  describe('criterion 11: pre-selects the clone source from CTA query params', () => {
    it('defaults to canonical mode with the matching source-item marked selected when cloneFrom=canonical', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-mode-canonical')).toBeChecked();
      });
      const selected = findRowByText('set-new-source-item', 'Lincoln Wheat Cent Key Dates');
      expect(selected).toHaveAttribute('aria-pressed', 'true');
      const notSelected = findRowByText('set-new-source-item', 'Lincoln Wheat Cents');
      expect(notSelected).not.toHaveAttribute('aria-pressed', 'true');
    });

    it('defaults to public mode with the matching source-item marked selected when cloneFrom=user', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      render(<NewSetPage />);

      await waitFor(() => {
        expect(screen.getByTestId('set-new-mode-public')).toBeChecked();
      });
      const selected = findRowByText('set-new-source-item', "Bob's Set");
      expect(selected).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('criterion 11: clicking a source item selects it and pre-fills the pending list from its full coin set', () => {
    it('selecting a canonical source marks it pressed and seeds set-new-in-set-item with its coins once the detail hook resolves', async () => {
      useCanonicalSetMock.mockReturnValue({ data: CANONICAL_SET_DETAIL_C2, isLoading: false, isError: false } as never);
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.click(screen.getByTestId('set-new-mode-canonical'));
      await waitFor(() => expect(screen.getByTestId('set-new-source-list')).toBeInTheDocument());

      const row = findRowByText('set-new-source-item', 'Lincoln Wheat Cent Key Dates');
      await user.click(row);

      expect(row).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => {
        expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(2);
      });
      expect(screen.queryByTestId('set-new-in-set-empty')).not.toBeInTheDocument();
      const pendingText = screen.getAllByTestId('set-new-in-set-item').map((el) => el.textContent).join('|');
      expect(pendingText).toContain(formatCoinLabel(COIN_A));
      expect(pendingText).toContain(formatCoinLabel(COIN_B));
      // useCanonicalSet must actually be invoked with the picked source's id.
      expect(useCanonicalSetMock.mock.calls.some((call) => call[0] === 'c2')).toBe(true);
    });
  });

  describe('criterion 11: catalogue picker add/remove', () => {
    it('adding a coin from the picker appends it to the pending list and removes it from the picker results', async () => {
      useCatalogMock.mockReturnValue({ data: CATALOG_PAGE_DE, isLoading: false, isError: false } as never);
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-picker-panel')).toBeInTheDocument());
      expect(screen.getByTestId('set-new-picker-results')).toBeInTheDocument();
      expect(screen.getAllByTestId('set-new-picker-item')).toHaveLength(2);

      const pickerRow = findRowByText('set-new-picker-item', formatCoinLabel(COIN_D));
      await user.click(within(pickerRow).getByTestId('set-new-picker-add-button'));

      await waitFor(() => {
        expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(1);
      });
      expect(screen.getByTestId('set-new-in-set-item').textContent).toContain(formatCoinLabel(COIN_D));
      // Already-picked coin is excluded from the picker's own results list.
      expect(screen.getAllByTestId('set-new-picker-item')).toHaveLength(1);
      expect(screen.queryByText(formatCoinLabel(COIN_D))).not.toBeInTheDocument();
    });

    it('removing a coin from the pending list takes it back off and shows the empty state again', async () => {
      useCatalogMock.mockReturnValue({ data: CATALOG_PAGE_DE, isLoading: false, isError: false } as never);
      const user = userEvent.setup();
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-picker-panel')).toBeInTheDocument());

      const pickerRow = findRowByText('set-new-picker-item', formatCoinLabel(COIN_D));
      await user.click(within(pickerRow).getByTestId('set-new-picker-add-button'));
      await waitFor(() => expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(1));

      const pendingRow = screen.getByTestId('set-new-in-set-item');
      await user.click(within(pendingRow).getByTestId('set-new-in-set-remove-button'));

      await waitFor(() => {
        expect(screen.getByTestId('set-new-in-set-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('set-new-in-set-item')).not.toBeInTheDocument();
    });
  });

  describe('criterion 10/12: submitting blank mode with no picked coins creates a plain set, no follow-up patch', () => {
    it('calls the create mutation with just { name }, never calls usePatchSetCoins, and redirects to the new set page', async () => {
      const user = userEvent.setup();
      const createSetMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, mutateAsync: vi.fn(), isPending: false } as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.type(screen.getByTestId('set-new-name-input'), 'My New Set');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const calledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(calledWith).toEqual({ name: 'My New Set' });
      expect(patchMutate).not.toHaveBeenCalled();
    });
  });

  describe('criterion 11/12: submitting blank mode with picked coins does an add-only follow-up patch', () => {
    it('calls create with { name }, then usePatchSetCoins(newId).mutate with { add: [...], remove: [] }, before navigating', async () => {
      useCatalogMock.mockReturnValue({ data: CATALOG_PAGE_DE, isLoading: false, isError: false } as never);
      const user = userEvent.setup();
      const createSetMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      const patchMock = makeMutationMock({ resolvedValue: [] });
      usePatchSetCoinsMock.mockReturnValue(patchMock as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-picker-panel')).toBeInTheDocument());

      const pickerRow = findRowByText('set-new-picker-item', formatCoinLabel(COIN_D));
      await user.click(within(pickerRow).getByTestId('set-new-picker-add-button'));
      await waitFor(() => expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(1));

      await user.type(screen.getByTestId('set-new-name-input'), 'Blank Set With Coins');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const createCalledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(createCalledWith).toEqual({ name: 'Blank Set With Coins' });
      expect(usePatchSetCoinsMock.mock.calls.some((call) => call[0] === 'new-set-1')).toBe(true);
      const patchCalledWith = (patchMock.mutate.mock.calls[0] ?? patchMock.mutateAsync.mock.calls[0])?.[0];
      expect(patchCalledWith).toEqual({ add: ['coin-d'], remove: [] });
    });
  });

  describe('criterion 10/12: submitting canonical-clone mode with an edited pending list does a two-step create-then-patch', () => {
    it('sends the canonical cloneFrom payload, then patches only the net diff (added + removed) against the baseline, navigating only after both resolve', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      useCanonicalSetMock.mockReturnValue({ data: CANONICAL_SET_DETAIL_C2, isLoading: false, isError: false } as never);
      useCatalogMock.mockReturnValue({ data: CATALOG_PAGE_DE, isLoading: false, isError: false } as never);
      const user = userEvent.setup();
      const createSetMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      const patchMock = makeMutationMock({ resolvedValue: [] });
      usePatchSetCoinsMock.mockReturnValue(patchMock as never);
      render(<NewSetPage />);

      // Baseline (coin-a, coin-b) pre-filled from the clone source.
      await waitFor(() => expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(2));

      // Remove coin-a from the pending list.
      const coinARow = findRowByText('set-new-in-set-item', formatCoinLabel(COIN_A));
      await user.click(within(coinARow).getByTestId('set-new-in-set-remove-button'));
      await waitFor(() => expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(1));

      // Add coin-d from the catalogue picker.
      const pickerRow = findRowByText('set-new-picker-item', formatCoinLabel(COIN_D));
      await user.click(within(pickerRow).getByTestId('set-new-picker-add-button'));
      await waitFor(() => expect(screen.getAllByTestId('set-new-in-set-item')).toHaveLength(2));

      await user.type(screen.getByTestId('set-new-name-input'), 'My Wheat Cents (edited)');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });

      const createCalledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(createCalledWith).toEqual({
        name: 'My Wheat Cents (edited)',
        cloneFrom: { type: 'canonical', id: 'c2' },
      });

      expect(usePatchSetCoinsMock.mock.calls.some((call) => call[0] === 'new-set-1')).toBe(true);
      const patchCalledWith = (patchMock.mutate.mock.calls[0] ?? patchMock.mutateAsync.mock.calls[0])?.[0];
      expect(patchCalledWith).toEqual({ add: ['coin-d'], remove: ['coin-a'] });

      // Navigation must happen only after the patch call, not before/instead of it.
      const patchCallOrder =
        patchMock.mutate.mock.invocationCallOrder[0] ?? patchMock.mutateAsync.mock.invocationCallOrder[0];
      const pushCallOrder = pushMock.mock.invocationCallOrder[0];
      expect(patchCallOrder).toBeLessThan(pushCallOrder);
    });
  });

  describe('criterion 10/12: submitting public-clone mode sends the selected public source', () => {
    it('calls the create mutation with a user cloneFrom payload and redirects', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      usePublicSetMock.mockReturnValue({
        data: { ...PUBLIC_SETS_PAGE.items[0], coins: [] },
        isLoading: false,
        isError: false,
      } as never);
      const user = userEvent.setup();
      const createSetMock = makeMutationMock({ resolvedValue: NEW_SET });
      useCreateSetMock.mockReturnValue(createSetMock as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-mode-public')).toBeChecked());

      await user.type(screen.getByTestId('set-new-name-input'), "My Clone of Bob's Set");
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1');
      });
      const calledWith = (createSetMock.mutate.mock.calls[0] ?? createSetMock.mutateAsync.mock.calls[0])?.[0];
      expect(calledWith).toEqual({ name: "My Clone of Bob's Set", cloneFrom: { type: 'user', id: 'u1' } });
    });
  });

  describe('criterion 13: creation failure surfaces inline, without navigating away or patching', () => {
    it('renders the error message from the failed mutation, does not redirect, and never calls usePatchSetCoins', async () => {
      const user = userEvent.setup();
      const failingMock = makeMutationMock({ rejectedValue: new Error('Name already in use') });
      useCreateSetMock.mockReturnValue(failingMock as never);
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, mutateAsync: vi.fn(), isPending: false } as never);
      render(<NewSetPage />);
      await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());

      await user.type(screen.getByTestId('set-new-name-input'), 'Duplicate Name');
      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('set-new-error')).toHaveTextContent('Name already in use');
      });
      expect(pushMock).not.toHaveBeenCalled();
      expect(patchMutate).not.toHaveBeenCalled();
    });
  });
});
