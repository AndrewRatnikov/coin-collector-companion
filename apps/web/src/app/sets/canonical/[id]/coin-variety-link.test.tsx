/**
 * Tests for: CanonicalSetDetailPage coin row variety + link to the coin page
 * Contract source: runs/run_20261006_215558/plan.md § Interface Contract → Page: CanonicalSetDetailPage (modify)
 * Covers criteria: #1, #2, #3, #5 (from run_20261006_215558's prd.md)
 *
 * Mock setup mirrors sets/canonical/[id]/page.test.tsx (Suspense around the page).
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import CanonicalSetDetailPage from '@/app/sets/canonical/[id]/page';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const getStoredTokenMock = vi.mocked(getStoredToken);

function queryResult(overrides: Partial<ReturnType<typeof useCanonicalSet>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCanonicalSet>;
}

function renderPage(id = 'set-1') {
  return render(
    <Suspense fallback={<div />}>
      <CanonicalSetDetailPage params={Promise.resolve({ id })} />
    </Suspense>,
  );
}

// Positions order: coin-1 (variety), coin-2 (empty), coin-3 (variety, different text)
const DETAIL = {
  id: 'set-1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [
    {
      id: 'usc-3',
      position: 2,
      coin: { id: 'coin-3', country: 'USA', denomination: '1 Cent', year: 1955, mintMark: '', variety: 'Doubled Die Obverse' },
    },
    {
      id: 'usc-1',
      position: 0,
      coin: { id: 'coin-1', country: 'USA', denomination: '1 Cent', year: 1909, mintMark: 'S', variety: 'VDB' },
    },
    {
      id: 'usc-2',
      position: 1,
      coin: { id: 'coin-2', country: 'USA', denomination: '1 Cent', year: 1958, mintMark: '', variety: '' },
    },
  ],
};

describe('CanonicalSetDetailPage: coin variety and link to coin page', () => {
  beforeEach(() => {
    useCanonicalSetMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
  });

  async function getItems() {
    renderPage('set-1');
    await waitFor(() => {
      expect(screen.getAllByTestId('canonical-set-coin-item')).toHaveLength(3);
    });
    return screen.getAllByTestId('canonical-set-coin-item');
  }

  it('criterion 1/5: shows each coin variety verbatim in its own row', async () => {
    const items = await getItems();

    expect(within(items[0]).getByTestId('canonical-set-coin-variety')).toHaveTextContent(/^VDB$/);
    expect(within(items[2]).getByTestId('canonical-set-coin-variety')).toHaveTextContent(/^Doubled Die Obverse$/);
  });

  it('criterion 2/5: renders no variety element for the coin with an empty variety', async () => {
    const items = await getItems();

    expect(within(items[1]).queryByTestId('canonical-set-coin-variety')).not.toBeInTheDocument();
    expect(within(items[1]).getByTestId('canonical-set-coin-link').textContent).not.toMatch(/VDB|Doubled/);
  });

  it('criterion 3/5: each row has a link to /catalog/{coin.id} containing the label and variety', async () => {
    const items = await getItems();

    const link0 = within(items[0]).getByTestId('canonical-set-coin-link');
    expect(link0.getAttribute('href')).toBe('/catalog/coin-1');
    expect(within(link0).getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
    expect(within(link0).getByTestId('canonical-set-coin-variety')).toHaveTextContent('VDB');

    expect(within(items[1]).getByTestId('canonical-set-coin-link').getAttribute('href')).toBe('/catalog/coin-2');
    expect(within(items[2]).getByTestId('canonical-set-coin-link').getAttribute('href')).toBe('/catalog/coin-3');
  });
});
