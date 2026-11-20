/**
 * Tests for: NewSetPage analytics (set_created, set_cloned)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #10 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The mocking setup mirrors page.test.tsx next to this file: the create hook calls onSuccess or
 * onError synchronously from mutate. track is mocked, so nothing is sent anywhere.
 * 'filter' and 'manual' are never emitted by this flow (plan D4), so only 'blank' is asserted.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewSetPage from '@/app/sets/new/page';
import { useCreateSet, usePatchSetCoins } from '@/lib/hooks/use-user-sets';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { setStoredToken } from '@/lib/auth-token';
import { track } from '@/lib/analytics';

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
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

const trackMock = vi.mocked(track);
const useCreateSetMock = vi.mocked(useCreateSet);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);
const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const usePublicSetsMock = vi.mocked(usePublicSets);
const usePublicSetMock = vi.mocked(usePublicSet);

const baseCoin = {
  country: 'USA',
  denomination: '1 Cent',
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null as string | null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'approved' as const,
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const COIN_A = { ...baseCoin, id: 'coin-a', year: 1909, mintMark: 'S' };
const COIN_B = { ...baseCoin, id: 'coin-b', year: 1943 };

const CANONICAL_SETS = [
  {
    id: 'c1',
    name: 'Lincoln Wheat Cents',
    description: 'Every wheat cent from 1909 to 1958',
    source: 'seed-template',
    templateVersion: 'v1',
    coinCount: 12,
  },
  {
    id: 'c2',
    name: 'Lincoln Wheat Cent Key Dates',
    description: null,
    source: 'seed-template',
    templateVersion: 'v1',
    coinCount: 2,
  },
];

const CANONICAL_DETAIL_C2 = {
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

const PUBLIC_ITEMS = [
  {
    id: 'u1',
    userId: 'user-2',
    name: "Bob's Set",
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    coinCount: 42,
  },
];

const PUBLIC_DETAIL_U1 = {
  id: 'u1',
  userId: 'user-2',
  name: "Bob's Set",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 0, coin: { ...baseCoin, id: 'coin-p1', year: 1960 } },
    { id: 'usc-2', position: 1, coin: { ...baseCoin, id: 'coin-p2', year: 1970 } },
    { id: 'usc-3', position: 2, coin: { ...baseCoin, id: 'coin-p3', year: 1980 } },
  ],
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

const IDLE = { data: undefined, isLoading: false, isError: false };

function loaded(data: unknown) {
  return { data, isLoading: false, isError: false };
}

function makeMutationMock({ resolvedValue, rejectedValue }: { resolvedValue?: unknown; rejectedValue?: Error } = {}) {
  const mutate = vi.fn(
    (_body: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) {
        opts?.onError?.(rejectedValue);
      } else {
        opts?.onSuccess?.(resolvedValue);
      }
    },
  );
  return { mutate, isPending: false };
}

function mockCanonicalDetails(byId: Record<string, unknown>) {
  useCanonicalSetMock.mockImplementation(((id: string) => (id in byId ? byId[id] : IDLE)) as never);
}

function mockPublicDetails(byId: Record<string, unknown>) {
  usePublicSetMock.mockImplementation(((id: string) => (id in byId ? byId[id] : IDLE)) as never);
}

async function renderPage() {
  render(<NewSetPage />);
  await waitFor(() => expect(screen.getByTestId('set-new-page')).toBeInTheDocument());
}

function findCardByText(testId: string, text: string) {
  const match = screen.getAllByTestId(testId).find((el) => el.textContent?.includes(text));
  if (!match) throw new Error(`No ${testId} containing "${text}"`);
  return match;
}

const nameInput = () => screen.getByTestId<HTMLInputElement>('set-new-name-input');

describe('NewSetPage analytics', () => {
  beforeEach(() => {
    localStorage.clear();
    setStoredToken('tok-abc');
    pushMock.mockClear();
    trackMock.mockClear();
    searchParamsValue = new URLSearchParams();
    useCreateSetMock.mockReset();
    usePatchSetCoinsMock.mockReset();
    useCanonicalSetsMock.mockReset();
    useCanonicalSetMock.mockReset();
    usePublicSetsMock.mockReset();
    usePublicSetMock.mockReset();

    useCanonicalSetsMock.mockReturnValue(loaded(CANONICAL_SETS) as never);
    useCanonicalSetMock.mockReturnValue(IDLE as never);
    usePublicSetsMock.mockReturnValue(loaded({ items: PUBLIC_ITEMS, page: 1, limit: 100, total: 1 }) as never);
    usePublicSetMock.mockReturnValue(IDLE as never);
    useCreateSetMock.mockReturnValue(makeMutationMock({ resolvedValue: NEW_SET }) as never);
  });

  describe('blank set', () => {
    async function submitBlank() {
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-blank'));
      await user.click(screen.getByTestId('set-new-continue'));
      await user.type(nameInput(), 'My Private Collection');
      await user.click(screen.getByTestId('set-new-submit'));
    }

    it('tracks set_created with method blank and no coins, once, on success', async () => {
      await submitBlank();

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1'));
      expect(trackMock).toHaveBeenCalledTimes(1);
      expect(trackMock).toHaveBeenCalledWith('set_created', { method: 'blank', coin_count: 0 });
    });

    it('never puts the set name in the event', async () => {
      await submitBlank();

      await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
      expect(JSON.stringify(trackMock.mock.calls)).not.toContain('Private');
    });

    it('tracks nothing when the create call fails', async () => {
      useCreateSetMock.mockReturnValue(makeMutationMock({ rejectedValue: new Error('Name already in use') }) as never);

      await submitBlank();

      expect(await screen.findByTestId('set-new-error')).toBeInTheDocument();
      expect(pushMock).not.toHaveBeenCalled();
      expect(trackMock).not.toHaveBeenCalled();
    });
  });

  describe('canonical clone', () => {
    it('tracks set_cloned with source canonical and the detail coin count', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      const user = userEvent.setup();
      await renderPage();
      fireEvent.change(nameInput(), { target: { value: 'My Wheat Cents' } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/sets/new-set-1'));
      expect(trackMock).toHaveBeenCalledTimes(1);
      expect(trackMock).toHaveBeenCalledWith('set_cloned', { source: 'canonical', coin_count: 2 });
      expect(trackMock).not.toHaveBeenCalledWith('set_created', expect.anything());
    });

    it('falls back to the list coinCount when the detail has not loaded (12 for c1)', async () => {
      const user = userEvent.setup();
      await renderPage();
      await user.click(findCardByText('set-new-canonical-card', 'Lincoln Wheat Cents'));
      fireEvent.change(nameInput(), { target: { value: 'Copy' } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
      expect(trackMock).toHaveBeenCalledWith('set_cloned', { source: 'canonical', coin_count: 12 });
    });

    it('tracks nothing when the create call fails', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=canonical&cloneFromId=c2');
      mockCanonicalDetails({ c2: loaded(CANONICAL_DETAIL_C2) });
      useCreateSetMock.mockReturnValue(makeMutationMock({ rejectedValue: new Error('nope') }) as never);
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-submit'));

      expect(await screen.findByTestId('set-new-error')).toBeInTheDocument();
      expect(trackMock).not.toHaveBeenCalled();
    });
  });

  describe('public clone', () => {
    it('tracks set_cloned with source public and the detail coin count, via the picker', async () => {
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      const user = userEvent.setup();
      await renderPage();
      await user.click(screen.getByTestId('set-new-option-public'));
      await user.click(findCardByText('set-new-public-card', "Bob's Set"));
      fireEvent.change(nameInput(), { target: { value: 'My copy' } });

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
      expect(trackMock).toHaveBeenCalledWith('set_cloned', { source: 'public', coin_count: 3 });
    });

    it('tracks the same event when entered from a cloneFrom=user link', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-submit'));

      await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
      expect(trackMock).toHaveBeenCalledWith('set_cloned', { source: 'public', coin_count: 3 });
    });

    it('tracks nothing when the create call fails', async () => {
      searchParamsValue = new URLSearchParams('cloneFrom=user&cloneFromId=u1');
      mockPublicDetails({ u1: loaded(PUBLIC_DETAIL_U1) });
      useCreateSetMock.mockReturnValue(makeMutationMock({ rejectedValue: new Error('nope') }) as never);
      const user = userEvent.setup();
      await renderPage();

      await user.click(screen.getByTestId('set-new-submit'));

      expect(await screen.findByTestId('set-new-error')).toBeInTheDocument();
      expect(trackMock).not.toHaveBeenCalled();
    });
  });
});
