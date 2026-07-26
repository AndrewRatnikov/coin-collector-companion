/**
 * Tests for: SubmissionConfirmation
 * Contract source: runs/run_20260725_140648/plan.md § Interface Contract → Frontend — SubmissionConfirmation (CREATE)
 * Covers criteria: #6 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useUserSets/useCreateSet/usePatchSetCoins are mocked entirely (from
 * @/lib/hooks/use-user-sets), and patchSetCoins (the plain API function used for the
 * "create a new set and add this coin" chained flow — see plan.md's Approach/Risks for why
 * this deliberately does NOT go through the usePatchSetCoins hook) is mocked from
 * @/lib/user-sets-api. No real network call anywhere in this file.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmissionConfirmation from '@/components/catalog/submission-confirmation';
import { useCreateSet, usePatchSetCoins, useUserSets } from '@/lib/hooks/use-user-sets';
import { patchSetCoins } from '@/lib/user-sets-api';

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
  useCreateSet: vi.fn(),
  usePatchSetCoins: vi.fn(),
}));

vi.mock('@/lib/user-sets-api', () => ({
  patchSetCoins: vi.fn(),
}));

const useUserSetsMock = vi.mocked(useUserSets);
const useCreateSetMock = vi.mocked(useCreateSet);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const patchSetCoinsMock = vi.mocked(patchSetCoins);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function mutationMock({ resolvedValue, rejectedValue }: { resolvedValue?: unknown; rejectedValue?: unknown } = {}) {
  const mutate = vi.fn(
    (_vars: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) opts?.onError?.(rejectedValue);
      else opts?.onSuccess?.(resolvedValue);
    },
  );
  return { mutate, isPending: false } as never;
}

const COIN = {
  id: 'coin-new-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1900,
  mintMark: '',
  variety: '',
  name: 'Indian Head Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  status: 'pending',
  submittedAt: new Date('2026-07-25T00:00:00.000Z'),
  createdAt: new Date('2026-07-25T00:00:00.000Z'),
  updatedAt: new Date('2026-07-25T00:00:00.000Z'),
};

const EXISTING_SETS = [
  { id: 'set-1', userId: 'user-1', name: 'My Wheat Cents', clonedFromCanonicalId: null, clonedFromUserSetId: null, createdAt: new Date(), updatedAt: new Date() },
  { id: 'set-2', userId: 'user-1', name: 'Indian Heads', clonedFromCanonicalId: null, clonedFromUserSetId: null, createdAt: new Date(), updatedAt: new Date() },
];

describe('SubmissionConfirmation', () => {
  beforeEach(() => {
    useUserSetsMock.mockReset();
    useCreateSetMock.mockReset();
    usePatchSetCoinsMock.mockReset();
    patchSetCoinsMock.mockReset();
  });

  describe('loading', () => {
    it('renders submission-confirmation-loading while useUserSets is loading', () => {
      useUserSetsMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<SubmissionConfirmation coin={COIN as never} />);

      expect(screen.getByTestId('submission-confirmation-loading')).toBeInTheDocument();
    });
  });

  describe('criterion 6: existing sets — one row per set with an add button', () => {
    it('renders one submission-confirmation-set-item per set with its name', () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: EXISTING_SETS }));
      usePatchSetCoinsMock.mockReturnValue(mutationMock());
      render(<SubmissionConfirmation coin={COIN as never} />);

      const items = screen.getAllByTestId('submission-confirmation-set-item');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('My Wheat Cents');
      expect(items[1]).toHaveTextContent('Indian Heads');
      expect(screen.queryByTestId('submission-confirmation-create-set-form')).not.toBeInTheDocument();
    });

    it('clicking a set\'s add button calls usePatchSetCoins(set.id).mutate with { add: [coin.id] }', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: EXISTING_SETS }));
      const patchMutate = vi.fn();
      usePatchSetCoinsMock.mockReturnValue({ mutate: patchMutate, isPending: false } as never);
      const user = userEvent.setup();
      render(<SubmissionConfirmation coin={COIN as never} />);

      const buttons = screen.getAllByTestId('submission-confirmation-add-to-set-button');
      await user.click(buttons[1]); // Indian Heads (set-2)

      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-2');
      expect(patchMutate).toHaveBeenCalledTimes(1);
      expect(patchMutate.mock.calls[0][0]).toEqual({ add: ['coin-new-1'] });
    });

    it('shows a view-set link to the target set after a successful add', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: EXISTING_SETS }));
      usePatchSetCoinsMock.mockReturnValue(mutationMock({ resolvedValue: [{ id: 'usc-1' }] }));
      const user = userEvent.setup();
      render(<SubmissionConfirmation coin={COIN as never} />);

      await user.click(screen.getAllByTestId('submission-confirmation-add-to-set-button')[0]);

      await waitFor(() => {
        const link = screen.getByTestId('submission-confirmation-view-set-link');
        expect(link.getAttribute('href')).toBe('/sets/set-1');
      });
    });
  });

  describe('criterion 6: no existing sets — create-a-set mini form', () => {
    it('renders the create-set form instead of any set-item rows when useUserSets resolves to an empty list', () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      useCreateSetMock.mockReturnValue(mutationMock());
      render(<SubmissionConfirmation coin={COIN as never} />);

      expect(screen.getByTestId('submission-confirmation-create-set-form')).toBeInTheDocument();
      expect(screen.queryByTestId('submission-confirmation-set-item')).not.toBeInTheDocument();
    });

    it('submitting the mini form creates the set, then chains a direct patchSetCoins call with the new set id (not usePatchSetCoins)', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      const newSet = { id: 'set-brand-new', userId: 'user-1', name: 'New coins', clonedFromCanonicalId: null, clonedFromUserSetId: null, createdAt: new Date(), updatedAt: new Date() };
      useCreateSetMock.mockReturnValue(mutationMock({ resolvedValue: newSet }));
      patchSetCoinsMock.mockResolvedValue([{ id: 'usc-9', userSetId: 'set-brand-new', coinId: 'coin-new-1', position: 0 }]);
      const user = userEvent.setup();
      render(<SubmissionConfirmation coin={COIN as never} />);

      await user.type(screen.getByTestId('submission-confirmation-create-set-name-input'), 'New coins');
      await user.click(screen.getByTestId('submission-confirmation-create-set-submit'));

      await waitFor(() => {
        expect(patchSetCoinsMock).toHaveBeenCalledWith('set-brand-new', { add: ['coin-new-1'] });
      });
    });

    it('shows a view-set link to the newly created set once the chained patchSetCoins call resolves', async () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: [] }));
      const newSet = { id: 'set-brand-new', userId: 'user-1', name: 'New coins', clonedFromCanonicalId: null, clonedFromUserSetId: null, createdAt: new Date(), updatedAt: new Date() };
      useCreateSetMock.mockReturnValue(mutationMock({ resolvedValue: newSet }));
      patchSetCoinsMock.mockResolvedValue([{ id: 'usc-9', userSetId: 'set-brand-new', coinId: 'coin-new-1', position: 0 }]);
      const user = userEvent.setup();
      render(<SubmissionConfirmation coin={COIN as never} />);

      await user.type(screen.getByTestId('submission-confirmation-create-set-name-input'), 'New coins');
      await user.click(screen.getByTestId('submission-confirmation-create-set-submit'));

      await waitFor(() => {
        const link = screen.getByTestId('submission-confirmation-view-set-link');
        expect(link.getAttribute('href')).toBe('/sets/set-brand-new');
      });
    });
  });

  describe('root wrapper', () => {
    it('renders the submission-confirmation root element', () => {
      useUserSetsMock.mockReturnValue(queryResult({ data: EXISTING_SETS }));
      usePatchSetCoinsMock.mockReturnValue(mutationMock());
      render(<SubmissionConfirmation coin={COIN as never} />);

      expect(screen.getByTestId('submission-confirmation')).toBeInTheDocument();
    });
  });
});
