/**
 * Tests for: PublicSetDetailPage, signed-in progress, marks, grade chips and clone label
 * Contract source: runs/run_20261109_220451/plan.md § Interface Contract → Page: PublicSetDetailPage
 * Covers criteria: #3, #4, #5, #6, #7, #8, #9, #10, #11, #12 (from run_20261109_220451's prd.md)
 *
 * Mock setup mirrors page.test.tsx. The page keeps using useSetGaps (the caller's own ownership);
 * the set owner's minGrade / upgradeCount / needsUpgrade in that response must be ignored.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import PublicSetDetailPage from '@/app/sets/public/[id]/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function setResult(overrides: Partial<ReturnType<typeof usePublicSet>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof usePublicSet>;
}

function gapsResult(overrides: Partial<ReturnType<typeof useSetGaps>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useSetGaps>;
}

function renderPage(id = 'set-1') {
  return render(<PublicSetDetailPage params={Promise.resolve({ id })} />);
}

function makeCoin(id: string, year: number) {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    isKeyDate: false,
  };
}

const COIN_1 = makeCoin('coin-1', 1909);
const COIN_2 = makeCoin('coin-2', 1910);
const COIN_3 = makeCoin('coin-3', 1911);

const DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  coins: [
    { id: 'usc-1', position: 0, coin: COIN_1 },
    { id: 'usc-2', position: 1, coin: COIN_2 },
    { id: 'usc-3', position: 2, coin: COIN_3 },
  ],
};

const EMPTY_DETAIL = { ...DETAIL, coins: [] };

// coin-1 owned with grade VF, coin-2 missing, coin-3 owned without a grade
const GAPS = {
  setId: 'set-1',
  ownedCount: 2,
  totalCount: 3,
  completionPercent: 67,
  minGrade: null,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true, grade: 'VF' },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false, grade: null },
    { id: 'usc-3', position: 2, coin: COIN_3, owned: true, grade: null },
  ],
};

const NONE_OWNED_GAPS = {
  ...GAPS,
  ownedCount: 0,
  completionPercent: 0,
  slots: GAPS.slots.map((slot) => ({ ...slot, owned: false, grade: null })),
};

// The set owner's goal: the viewer's response also carries it, and the page must not show it.
const OWNER_GOAL_GAPS = {
  ...GAPS,
  minGrade: 'VF',
  upgradeCount: 1,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true, grade: 'G', needsUpgrade: true },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false, grade: null, needsUpgrade: false },
    { id: 'usc-3', position: 2, coin: COIN_3, owned: true, grade: 'XF', needsUpgrade: false },
  ],
};

function signIn() {
  getStoredTokenMock.mockReturnValue('tok-abc');
}

describe('PublicSetDetailPage: your own progress', () => {
  beforeEach(() => {
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    usePublicSetMock.mockReturnValue(setResult({ data: DETAIL as never }));
    useSetGapsMock.mockReturnValue(gapsResult());
  });

  describe('criterion 3: signed out', () => {
    it('shows no progress block, no marks, no chips and no skeleton, even if the hook returned data', async () => {
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findAllByTestId('public-set-detail-coin-item');
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-grade')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('asks for no gaps (the hook only ever gets an empty id) and shows no CTA', async () => {
      renderPage('set-1');

      await screen.findAllByTestId('public-set-detail-coin-item');
      expect(useSetGapsMock).toHaveBeenCalledWith('');
      expect(useSetGapsMock).not.toHaveBeenCalledWith('set-1');
      expect(screen.queryByTestId('public-set-clone-cta')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: signed in, the progress block', () => {
    it('asks for the gaps of the set id once signed in', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(useSetGapsMock).toHaveBeenCalledWith('set-1');
      });
    });

    it('shows "You own X of Y", the percent and the progress bar from the gaps response', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('public-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 2 of 3');
      expect(screen.getByTestId('public-set-detail-completion')).toHaveTextContent('67%');
      expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '67');
    });

    it('shows other numbers for another response', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('public-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 0 of 3');
      expect(screen.getByTestId('public-set-detail-completion')).toHaveTextContent('0%');
    });

    it('keeps the set name on the page', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      expect(screen.getByTestId('public-set-detail-name')).toHaveTextContent("Alice's Wheat Cents");
    });
  });

  describe('criterion 10: the old overlap line and plain labels are gone', () => {
    it('renders neither the overlap line nor the status span', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      expect(screen.queryByTestId('public-set-detail-overlap')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-status')).not.toBeInTheDocument();
      expect(screen.queryByText(/You already own/)).not.toBeInTheDocument();
    });
  });

  describe('criterion 5: the set owner\'s minimum grade is ignored', () => {
    it('shows no upgrade count, badge or upgrade text even when the response carries minGrade VF and upgrades', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: OWNER_GOAL_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      expect(screen.queryByTestId('set-editor-upgrade-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();
      // the owner's goal (VF) is not shown anywhere; the slots carry only the viewer's own G and XF
      expect(screen.queryByText(/VF/)).not.toBeInTheDocument();
    });

    it('still shows owned/missing marks and the viewer\'s own grade chips, with the numbers unchanged', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: OWNER_GOAL_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('public-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 2 of 3');
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      expect(within(items[0]).getByTestId('public-set-detail-coin-mark')).toHaveAttribute('data-owned', 'true');
      expect(within(items[0]).getByTestId('public-set-detail-coin-grade')).toHaveAttribute('data-grade', 'G');
      expect(within(items[1]).getByTestId('public-set-detail-coin-mark')).toHaveAttribute('data-owned', 'false');
      expect(within(items[2]).getByTestId('public-set-detail-coin-grade')).toHaveAttribute('data-grade', 'XF');
    });
  });

  describe('criterion 6: loading', () => {
    it('shows the progress skeleton instead of the block while gaps load', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      const loading = await screen.findByTestId('public-set-detail-progress-loading');
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
    });

    it('keeps the old clone label while loading', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      expect(await screen.findByTestId('public-set-clone-cta')).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 7: error', () => {
    it('renders the page as today: no progress, no skeleton, no marks, no banner', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-clone-cta');
      expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(3);
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-error')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the old clone label', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      expect(await screen.findByTestId('public-set-clone-cta')).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 8: a set with 0 coins', () => {
    it('hides the progress block and the skeleton', async () => {
      signIn();
      usePublicSetMock.mockReturnValue(setResult({ data: EMPTY_DETAIL as never }));
      useSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-clone-cta');
      expect(screen.queryByTestId('public-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
    });

    it('hides the progress block when gaps report a total of 0, and keeps the old clone label', async () => {
      signIn();
      usePublicSetMock.mockReturnValue(setResult({ data: EMPTY_DETAIL as never }));
      useSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      const cta = await screen.findByTestId('public-set-clone-cta');
      expect(screen.queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
      expect(cta).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 9: marks and grade chips', () => {
    it('marks every coin owned or missing, with text, outside the coin link', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      const items = screen.getAllByTestId('public-set-detail-coin-item');
      expect(items).toHaveLength(3);

      const marks = items.map((item) => within(item).getByTestId('public-set-detail-coin-mark'));
      expect(marks[0]).toHaveAttribute('data-owned', 'true');
      expect(marks[0]).toHaveTextContent('Owned');
      expect(marks[1]).toHaveAttribute('data-owned', 'false');
      expect(marks[1]).toHaveTextContent('Missing');
      expect(marks[2]).toHaveAttribute('data-owned', 'true');
      expect(marks[2]).toHaveTextContent('Owned');

      items.forEach((item, index) => {
        expect(within(item).getByTestId('public-set-detail-coin-link').contains(marks[index])).toBe(false);
      });
    });

    it('shows the grade chip only on an owned coin that has a grade', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      const items = screen.getAllByTestId('public-set-detail-coin-item');

      const chip = within(items[0]).getByTestId('public-set-detail-coin-grade');
      expect(chip).toHaveAttribute('data-grade', 'VF');
      expect(within(items[0]).getByTestId('public-set-detail-coin-link').contains(chip)).toBe(false);
      expect(within(items[1]).queryByTestId('public-set-detail-coin-grade')).not.toBeInTheDocument();
      expect(within(items[2]).queryByTestId('public-set-detail-coin-grade')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('public-set-detail-coin-grade')).toHaveLength(1);
    });

    it('marks every row Missing, with no chips, when nothing is owned', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      const marks = screen.getAllByTestId('public-set-detail-coin-mark');
      expect(marks).toHaveLength(3);
      marks.forEach((mark) => {
        expect(mark).toHaveAttribute('data-owned', 'false');
        expect(mark).toHaveTextContent('Missing');
      });
      expect(screen.queryByTestId('public-set-detail-coin-grade')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: clone label', () => {
    it('says how many coins are already owned when at least one is', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 1, totalCount: 2, completionPercent: 50 } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      const cta = await screen.findByTestId('public-set-clone-cta');
      await waitFor(() => {
        expect(cta).toHaveTextContent('Start this set · 1 of 2 already owned');
      });
      expect(cta.getAttribute('href')).toBe('/sets/new?cloneFrom=user&cloneFromId=set-1');
    });

    it('uses the numbers of the response (another fixture, another label)', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 3, totalCount: 3, completionPercent: 100 } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      const cta = await screen.findByTestId('public-set-clone-cta');
      await waitFor(() => {
        expect(cta).toHaveTextContent('Start this set · 3 of 3 already owned');
      });
      expect(cta).not.toHaveTextContent('1 of 2');
    });

    it('keeps today\'s label and the same link when nothing is owned', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      const cta = screen.getByTestId('public-set-clone-cta');
      expect(cta).toHaveTextContent('Clone into my sets');
      expect(cta).not.toHaveTextContent('already owned');
      expect(cta.getAttribute('href')).toBe('/sets/new?cloneFrom=user&cloneFromId=set-1');
    });
  });

  describe('criterion 12: read-only', () => {
    it('renders no ownership toggles, row menus or selection controls', async () => {
      signIn();
      useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('public-set-detail-progress');
      expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });
});
