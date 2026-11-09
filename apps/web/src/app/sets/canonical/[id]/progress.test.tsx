/**
 * Tests for: CanonicalSetDetailPage, signed-in progress, marks, grade chips and clone label
 * Contract source: runs/run_20261109_220451/plan.md § Interface Contract → Page: CanonicalSetDetailPage
 * Covers criteria: #3, #4, #5, #6, #7, #8, #9, #11, #12 (from run_20261109_220451's prd.md)
 *
 * Mock setup mirrors page.test.tsx (Suspense around the page; no QueryClientProvider, so the gaps
 * hook is mocked). Signed in/out comes from the mocked getStoredToken, read in an effect, so
 * assertions use waitFor / findBy.
 *
 * CONTRACT_GAPS: none
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import CanonicalSetDetailPage from '@/app/sets/canonical/[id]/page';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { useCanonicalSetGaps } from '@/lib/hooks/use-user-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useCanonicalSetGaps: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const useCanonicalSetGapsMock = vi.mocked(useCanonicalSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function setResult(overrides: Partial<ReturnType<typeof useCanonicalSet>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCanonicalSet>;
}

function gapsResult(overrides: Partial<ReturnType<typeof useCanonicalSetGaps>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    isSuccess: false,
    ...overrides,
  } as ReturnType<typeof useCanonicalSetGaps>;
}

function renderPage(id = 'set-1') {
  return render(
    <Suspense fallback={<div />}>
      <CanonicalSetDetailPage params={Promise.resolve({ id })} />
    </Suspense>,
  );
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

// Positions: coin-1, coin-2, coin-3
const DETAIL = {
  id: 'set-1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
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

function signIn() {
  getStoredTokenMock.mockReturnValue('tok-abc');
}

describe('CanonicalSetDetailPage: your own progress', () => {
  beforeEach(() => {
    useCanonicalSetMock.mockReset();
    useCanonicalSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useCanonicalSetMock.mockReturnValue(setResult({ data: DETAIL as never }));
    useCanonicalSetGapsMock.mockReturnValue(gapsResult());
  });

  describe('criterion 3: signed out', () => {
    it('shows no progress block, no marks, no chips and no skeleton, even if the hook returned data', async () => {
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findAllByTestId('canonical-set-coin-item');
      expect(screen.queryByTestId('canonical-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-coin-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-coin-grade')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('asks for no gaps (the hook is only ever called with enabled: false)', async () => {
      renderPage('set-1');

      await screen.findAllByTestId('canonical-set-coin-item');
      expect(useCanonicalSetGapsMock).toHaveBeenCalledWith('set-1', { enabled: false });
      const enabledCalls = useCanonicalSetGapsMock.mock.calls.filter(([, options]) => options?.enabled === true);
      expect(enabledCalls).toHaveLength(0);
    });

    it('has no clone CTA at all (the page is unchanged for visitors)', async () => {
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findAllByTestId('canonical-set-coin-item');
      expect(screen.queryByTestId('canonical-set-clone-cta')).not.toBeInTheDocument();
    });
  });

  describe('criterion 2/4: signed in, the progress block', () => {
    it('enables the gaps hook for the set id once signed in', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await waitFor(() => {
        expect(useCanonicalSetGapsMock).toHaveBeenCalledWith('set-1', { enabled: true });
      });
    });

    it('shows "You own X of Y", the percent and the progress bar from the gaps response', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('canonical-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 2 of 3');
      expect(screen.getByTestId('canonical-set-detail-completion')).toHaveTextContent('67%');
      expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '67');
    });

    it('shows other numbers for another response (derived, not hardcoded)', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      const owned = await screen.findByTestId('canonical-set-detail-owned-count');
      expect(owned.textContent).toBe('You own 0 of 3');
      expect(screen.getByTestId('canonical-set-detail-completion')).toHaveTextContent('0%');
      expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '0');
    });

    it('keeps the title and description on the page next to the progress block', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      expect(screen.getByTestId('canonical-set-detail-name')).toHaveTextContent('Lincoln Wheat Cents');
      expect(screen.getByTestId('canonical-set-detail-description')).toHaveTextContent('Every wheat cent year');
    });
  });

  describe('criterion 5: no upgrade count and no upgrade state', () => {
    it('renders no upgrade count, badge or upgrade text', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      expect(screen.queryByTestId('set-editor-upgrade-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('upgrade-badge')).not.toBeInTheDocument();
      expect(screen.queryByText(/upgrade/i)).not.toBeInTheDocument();
    });
  });

  describe('criterion 6: loading', () => {
    it('shows the progress skeleton instead of the block while gaps load', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      const loading = await screen.findByTestId('canonical-set-detail-progress-loading');
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByTestId('canonical-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-coin-mark')).not.toBeInTheDocument();
    });

    it('keeps the old clone label while loading', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      const cta = await screen.findByTestId('canonical-set-clone-cta');
      expect(cta).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 7: error', () => {
    it('renders the page as today: no progress, no skeleton, no marks, no banner', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-clone-cta');
      expect(screen.getAllByTestId('canonical-set-coin-item')).toHaveLength(3);
      expect(screen.queryByTestId('canonical-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-coin-mark')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-detail-error')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps the old clone label', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isError: true }));
      renderPage('set-1');

      expect(await screen.findByTestId('canonical-set-clone-cta')).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 8: a set with 0 coins', () => {
    it('hides the progress block, even when gaps report a total of 0', async () => {
      signIn();
      useCanonicalSetMock.mockReturnValue(setResult({ data: EMPTY_DETAIL as never }));
      useCanonicalSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      await screen.findByTestId('canonical-set-clone-cta');
      expect(screen.queryByTestId('canonical-set-detail-progress')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-coin-mark')).not.toBeInTheDocument();
    });

    it('shows no skeleton either while gaps load', async () => {
      signIn();
      useCanonicalSetMock.mockReturnValue(setResult({ data: EMPTY_DETAIL as never }));
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ isLoading: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-clone-cta');
      expect(screen.queryByTestId('canonical-set-detail-progress-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('canonical-set-detail-progress')).not.toBeInTheDocument();
    });

    it('keeps the old clone label', async () => {
      signIn();
      useCanonicalSetMock.mockReturnValue(setResult({ data: EMPTY_DETAIL as never }));
      useCanonicalSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      expect(await screen.findByTestId('canonical-set-clone-cta')).toHaveTextContent('Clone into my sets');
    });
  });

  describe('criterion 9: marks and grade chips', () => {
    it('marks every coin owned or missing, with text, outside the coin link', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      const items = screen.getAllByTestId('canonical-set-coin-item');
      expect(items).toHaveLength(3);

      const marks = items.map((item) => within(item).getByTestId('canonical-set-coin-mark'));
      expect(marks[0]).toHaveAttribute('data-owned', 'true');
      expect(marks[0]).toHaveTextContent('Owned');
      expect(marks[1]).toHaveAttribute('data-owned', 'false');
      expect(marks[1]).toHaveTextContent('Missing');
      expect(marks[2]).toHaveAttribute('data-owned', 'true');
      expect(marks[2]).toHaveTextContent('Owned');

      items.forEach((item, index) => {
        expect(within(item).getByTestId('canonical-set-coin-link').contains(marks[index])).toBe(false);
      });
    });

    it('shows the grade chip only on an owned coin that has a grade', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      const items = screen.getAllByTestId('canonical-set-coin-item');

      const chip = within(items[0]).getByTestId('canonical-set-coin-grade');
      expect(chip).toHaveAttribute('data-grade', 'VF');
      expect(within(items[0]).getByTestId('canonical-set-coin-link').contains(chip)).toBe(false);
      expect(within(items[1]).queryByTestId('canonical-set-coin-grade')).not.toBeInTheDocument();
      expect(within(items[2]).queryByTestId('canonical-set-coin-grade')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('canonical-set-coin-grade')).toHaveLength(1);
    });

    it('shows no chip on a missing coin even if the slot carries a grade', async () => {
      signIn();
      const odd = {
        ...GAPS,
        slots: GAPS.slots.map((slot) => (slot.id === 'usc-2' ? { ...slot, grade: 'F' } : slot)),
      };
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: odd as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      const items = screen.getAllByTestId('canonical-set-coin-item');
      expect(within(items[1]).queryByTestId('canonical-set-coin-grade')).not.toBeInTheDocument();
    });

    it('marks every row Missing, with no chips, when nothing is owned', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      const marks = screen.getAllByTestId('canonical-set-coin-mark');
      expect(marks).toHaveLength(3);
      marks.forEach((mark) => {
        expect(mark).toHaveAttribute('data-owned', 'false');
        expect(mark).toHaveTextContent('Missing');
      });
      expect(screen.queryByTestId('canonical-set-coin-grade')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: clone label', () => {
    it('says how many coins are already owned when at least one is', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 1, totalCount: 2, completionPercent: 50 } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      const cta = await screen.findByTestId('canonical-set-clone-cta');
      await waitFor(() => {
        expect(cta).toHaveTextContent('Start this set · 1 of 2 already owned');
      });
      expect(cta.getAttribute('href')).toBe('/sets/new?cloneFrom=canonical&cloneFromId=set-1');
    });

    it('uses the numbers of the response (another fixture, another label)', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(
        gapsResult({
          data: { ...GAPS, ownedCount: 3, totalCount: 3, completionPercent: 100 } as never,
          isSuccess: true,
        }),
      );
      renderPage('set-1');

      const cta = await screen.findByTestId('canonical-set-clone-cta');
      await waitFor(() => {
        expect(cta).toHaveTextContent('Start this set · 3 of 3 already owned');
      });
      expect(cta).not.toHaveTextContent('1 of 2');
    });

    it('keeps today\'s label and the same link when nothing is owned', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: NONE_OWNED_GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      const cta = screen.getByTestId('canonical-set-clone-cta');
      expect(cta).toHaveTextContent('Clone into my sets');
      expect(cta).not.toHaveTextContent('already owned');
      expect(cta.getAttribute('href')).toBe('/sets/new?cloneFrom=canonical&cloneFromId=set-1');
    });
  });

  describe('criterion 12: read-only', () => {
    it('renders no ownership toggles, row menus, selection bar or Missing filter', async () => {
      signIn();
      useCanonicalSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
      renderPage('set-1');

      await screen.findByTestId('canonical-set-detail-progress');
      expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });
});
