/**
 * Tests for: PublicSetDetailPage coin row variety + link to the coin page
 * Contract source: runs/run_20261006_215558/plan.md § Interface Contract → Page: PublicSetDetailPage (modify)
 * Covers criteria: #1, #2, #3, #4 (status outside link), #5 (from run_20261006_215558's prd.md)
 *
 * Mock setup mirrors sets/public/[id]/page.test.tsx.
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

function publicSetResult(overrides: Partial<ReturnType<typeof usePublicSet>> = {}) {
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

const COIN_1 = { id: 'coin-1', country: 'USA', denomination: '1 Cent', year: 1909, mintMark: 'S', variety: 'VDB' };
const COIN_2 = { id: 'coin-2', country: 'USA', denomination: '1 Cent', year: 1958, mintMark: '', variety: '' };
const COIN_3 = {
  id: 'coin-3',
  country: 'USA',
  denomination: '1 Cent',
  year: 1955,
  mintMark: '',
  variety: 'Doubled Die Obverse',
};

// Render order by position: coin-1, coin-2, coin-3
const DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  coins: [
    { id: 'usc-3', position: 2, coin: COIN_3 },
    { id: 'usc-1', position: 0, coin: COIN_1 },
    { id: 'usc-2', position: 1, coin: COIN_2 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 3,
  completionPercent: 33,
  slots: [
    { id: 'usc-1', position: 0, coin: COIN_1, owned: true },
    { id: 'usc-2', position: 1, coin: COIN_2, owned: false },
    { id: 'usc-3', position: 2, coin: COIN_3, owned: false },
  ],
};

describe('PublicSetDetailPage: coin variety and link to coin page', () => {
  beforeEach(() => {
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useSetGapsMock.mockReturnValue(gapsResult());
    usePublicSetMock.mockReturnValue(publicSetResult({ data: DETAIL as never }));
  });

  async function getItems() {
    renderPage('set-1');
    await waitFor(() => {
      expect(screen.getAllByTestId('public-set-detail-coin-item')).toHaveLength(3);
    });
    return screen.getAllByTestId('public-set-detail-coin-item');
  }

  it('criterion 1/5: shows each coin variety verbatim in its own row', async () => {
    const items = await getItems();

    expect(within(items[0]).getByTestId('public-set-detail-coin-variety')).toHaveTextContent(/^VDB$/);
    expect(within(items[2]).getByTestId('public-set-detail-coin-variety')).toHaveTextContent(/^Doubled Die Obverse$/);
  });

  it('criterion 2/5: renders no variety element for the coin with an empty variety', async () => {
    const items = await getItems();

    expect(within(items[1]).queryByTestId('public-set-detail-coin-variety')).not.toBeInTheDocument();
    expect(within(items[1]).getByTestId('public-set-detail-coin-link').textContent).not.toMatch(/VDB|Doubled/);
  });

  it('criterion 3/5: each row has a link to /catalog/{coin.id} containing the label and variety', async () => {
    const items = await getItems();

    const link0 = within(items[0]).getByTestId('public-set-detail-coin-link');
    expect(link0.getAttribute('href')).toBe('/catalog/coin-1');
    expect(within(link0).getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
    expect(within(link0).getByTestId('public-set-detail-coin-variety')).toHaveTextContent('VDB');

    expect(within(items[1]).getByTestId('public-set-detail-coin-link').getAttribute('href')).toBe('/catalog/coin-2');
    expect(within(items[2]).getByTestId('public-set-detail-coin-link').getAttribute('href')).toBe('/catalog/coin-3');
  });

  it('criterion 4: the owned/missing status is rendered but not inside the link when logged in with gaps', async () => {
    getStoredTokenMock.mockReturnValue('tok-abc');
    useSetGapsMock.mockReturnValue(gapsResult({ data: GAPS as never, isSuccess: true }));
    const items = await getItems();

    const status0 = within(items[0]).getByTestId('public-set-detail-coin-status');
    const status1 = within(items[1]).getByTestId('public-set-detail-coin-status');
    expect(status0).toHaveTextContent('owned');
    expect(status1).toHaveTextContent('missing');
    expect(within(items[0]).getByTestId('public-set-detail-coin-link').contains(status0)).toBe(false);
    expect(within(items[1]).getByTestId('public-set-detail-coin-link').contains(status1)).toBe(false);
  });
});
