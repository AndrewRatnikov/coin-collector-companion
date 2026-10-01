/**
 * Tests for: SetMissingPage
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Page (new): SetMissingPage
 * Covers criteria: #10, #11 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SetMissingPage from '@/app/sets/[id]/missing/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
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
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetMissingPage params={Promise.resolve({ id })} />);
}

const BASE_COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: 'VDB',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};
const COIN_OWNED = { ...BASE_COIN, id: 'coin-owned', name: 'Owned Coin', year: 1920 };
const COIN_A = { ...BASE_COIN, id: 'coin-a', name: 'Alpha Cent', year: 1958, isKeyDate: true };
const COIN_B = { ...BASE_COIN, id: 'coin-b', name: 'Bravo Cent', year: 1943 };
const COIN_C = { ...BASE_COIN, id: 'coin-c', name: 'Charlie Cent', year: 1952 };

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [],
};

// Slots deliberately out of position order; expected row order: A (0), B (1), C (3)
const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-c', position: 3, coin: COIN_C, owned: false },
    { id: 'usc-o', position: 2, coin: COIN_OWNED, owned: true },
    { id: 'usc-a', position: 0, coin: COIN_A, owned: false },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: false },
  ],
};

const GAPS_ALL_OWNED = {
  ...GAPS,
  ownedCount: 4,
  completionPercent: 100,
  slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
};

describe('SetMissingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('auth gating', () => {
    it('redirects to /login and renders no page when there is no token', async () => {
      renderPage();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('set-missing-page')).not.toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('renders the loading state inside the main root', async () => {
      setStoredToken('token');
      usePublicSetMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      expect(await screen.findByTestId('set-missing-loading')).toBeInTheDocument();
      expect(screen.getByTestId('set-missing-page').tagName).toBe('MAIN');
      expect(screen.queryByTestId('set-missing-table')).not.toBeInTheDocument();
    });

    it('renders the loading state while the gaps are loading', async () => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      expect(await screen.findByTestId('set-missing-loading')).toBeInTheDocument();
    });

    it('renders the error state with the editor error message', async () => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      const error = await screen.findByTestId('set-missing-error');
      expect(error).toBeInTheDocument();
      expect(error.textContent).not.toBe('');
      expect(screen.getByTestId('set-missing-page')).toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-table')).not.toBeInTheDocument();
    });
  });

  describe('criterion 10: loaded page', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('shows the set name as the title in an h1 inside main', async () => {
      renderPage();

      const title = await screen.findByTestId('set-missing-title');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveTextContent('My Wheat Cents');
      expect(screen.getByTestId('set-missing-page').tagName).toBe('MAIN');
    });

    it('shows the summary line from ownedCount, totalCount and completionPercent', async () => {
      renderPage();

      expect(await screen.findByTestId('set-missing-summary')).toHaveTextContent(/^1 of 4 owned \(25%\)$/);
    });

    it('changes the summary line when the counts change', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({ data: { ...GAPS, ownedCount: 3, totalCount: 10, completionPercent: 30 } }),
      );
      renderPage();

      expect(await screen.findByTestId('set-missing-summary')).toHaveTextContent(/^3 of 10 owned \(30%\)$/);
    });

    it("shows today's date with the Date label", async () => {
      renderPage();

      const date = await screen.findByTestId('set-missing-date');
      expect(date).toHaveTextContent('Date: October 1, 2026');
    });

    it('uses a different date when the system date differs', async () => {
      vi.setSystemTime(new Date(2027, 2, 15, 12, 0, 0));
      renderPage();

      expect(await screen.findByTestId('set-missing-date')).toHaveTextContent('Date: March 15, 2027');
    });

    it('renders only unowned coins, one row each, in ascending position order', async () => {
      renderPage();

      await screen.findByTestId('set-missing-table');
      const rows = screen.getAllByTestId('set-missing-row');
      expect(rows).toHaveLength(3);
      const names = screen.getAllByTestId('set-missing-cell-name').map((n) => n.textContent);
      expect(names).toEqual(['Alpha Cent', 'Bravo Cent', 'Charlie Cent']);
      expect(screen.queryByText('Owned Coin')).not.toBeInTheDocument();
      const years = screen.getAllByTestId('set-missing-cell-year').map((n) => n.textContent);
      expect(years).toEqual(['1958', '1943', '1952']);
    });

    it('renders the table headers', async () => {
      renderPage();

      const table = await screen.findByTestId('set-missing-table');
      expect(table.tagName).toBe('TABLE');
      const headers = within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent);
      for (const expected of ['Name', 'Country', 'Denomination', 'Year', 'Mint mark', 'Variety', 'Key date']) {
        expect(headers).toContain(expected);
      }
    });

    it('marks key-date coins visibly and only those', async () => {
      renderPage();

      await screen.findByTestId('set-missing-table');
      const rows = screen.getAllByTestId('set-missing-row');
      expect(rows.map((r) => r.getAttribute('data-key-date'))).toEqual(['true', 'false', 'false']);
      const badges = screen.getAllByTestId('set-missing-key-date');
      expect(badges).toHaveLength(1);
      expect(badges[0]).toHaveTextContent('★ Key date');
      expect(within(rows[0]).getByTestId('set-missing-key-date')).toBeInTheDocument();
      expect(within(rows[1]).queryByTestId('set-missing-key-date')).not.toBeInTheDocument();
      expect(within(rows[2]).queryByTestId('set-missing-key-date')).not.toBeInTheDocument();
    });

    it('shows the empty message and no table when nothing is missing', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      renderPage();

      expect(await screen.findByTestId('set-missing-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-table')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('set-missing-row')).toHaveLength(0);
    });

    it('does not show the empty message when something is missing', async () => {
      renderPage();

      await screen.findByTestId('set-missing-table');
      expect(screen.queryByTestId('set-missing-empty')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: print button', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('renders a Print button of type button', async () => {
      renderPage();

      const button = await screen.findByTestId('set-missing-print-button');
      expect(button).toHaveTextContent('Print');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('calls window.print exactly once per click', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderPage();

      const button = await screen.findByTestId('set-missing-print-button');
      expect(printSpy).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(1);
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(2);
    });
  });
});
