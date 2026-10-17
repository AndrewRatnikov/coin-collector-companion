/**
 * Tests for: CanonicalSetDetailPage coin row variety + link to the coin page
 * Contract source: runs/run_20261006_215558/plan.md § Interface Contract → Page: CanonicalSetDetailPage (modify)
 *                   runs/run_20261017_142658/plan.md § Approach §3 (variety is now carried by the title and eyebrow)
 * Covers criteria: #1, #2, #3, #5 (from run_20261006_215558's prd.md), #6 (from run_20261017_142658's prd.md)
 *
 * Mock setup mirrors sets/canonical/[id]/page.test.tsx (Suspense around the page).
 *
 * run_20261017_142658: the raw-variety line (canonical-set-coin-variety) is removed. The variety now shows
 * as the getCoinName title, with the coin's type name as the eyebrow, inside the same link to the coin page.
 * The coin fixtures carry the name and isKeyDate fields that getCoinName reads.
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
      coin: {
        id: 'coin-3',
        country: 'USA',
        denomination: '1 Cent',
        year: 1955,
        mintMark: '',
        variety: 'Doubled Die Obverse',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
    },
    {
      id: 'usc-1',
      position: 0,
      coin: {
        id: 'coin-1',
        country: 'USA',
        denomination: '1 Cent',
        year: 1909,
        mintMark: 'S',
        variety: 'VDB',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
    },
    {
      id: 'usc-2',
      position: 1,
      coin: {
        id: 'coin-2',
        country: 'USA',
        denomination: '1 Cent',
        year: 1958,
        mintMark: '',
        variety: '',
        name: 'Lincoln Wheat Cent',
        isKeyDate: false,
      },
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

  it('criterion 1/5: shows each coin variety verbatim as the title of its own row, with the type name as eyebrow', async () => {
    const items = await getItems();

    expect(within(items[0]).getByTestId('canonical-set-coin-title')).toHaveTextContent(/^VDB$/);
    expect(within(items[0]).getByTestId('canonical-set-coin-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    expect(within(items[2]).getByTestId('canonical-set-coin-title')).toHaveTextContent(/^Doubled Die Obverse$/);
    expect(within(items[2]).getByTestId('canonical-set-coin-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
  });

  it('criterion 2/5: the coin with an empty variety is titled by its type name, with no eyebrow and no variety text', async () => {
    const items = await getItems();

    expect(within(items[1]).getByTestId('canonical-set-coin-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    expect(within(items[1]).queryByTestId('canonical-set-coin-eyebrow')).not.toBeInTheDocument();
    expect(within(items[1]).getByTestId('canonical-set-coin-link').textContent).not.toMatch(/VDB|Doubled/);
  });

  it('the raw variety line is gone from every row', async () => {
    const items = await getItems();

    items.forEach((item) => {
      expect(within(item).queryByTestId('canonical-set-coin-variety')).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId('canonical-set-coin-variety')).not.toBeInTheDocument();
  });

  it('criterion 3/5: each row has a link to /catalog/{coin.id} containing the eyebrow, title and subtitle', async () => {
    const items = await getItems();

    const link0 = within(items[0]).getByTestId('canonical-set-coin-link');
    expect(link0.getAttribute('href')).toBe('/catalog/coin-1');
    expect(within(link0).getByTestId('canonical-set-coin-eyebrow')).toHaveTextContent('Lincoln Wheat Cent');
    expect(within(link0).getByTestId('canonical-set-coin-title')).toHaveTextContent('VDB');
    expect(within(link0).getByTestId('canonical-set-coin-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1909-S$/);

    const link2 = within(items[2]).getByTestId('canonical-set-coin-link');
    expect(within(link2).getByTestId('canonical-set-coin-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1955$/);

    expect(within(items[1]).getByTestId('canonical-set-coin-link').getAttribute('href')).toBe('/catalog/coin-2');
    expect(within(items[2]).getByTestId('canonical-set-coin-link').getAttribute('href')).toBe('/catalog/coin-3');
  });
});
