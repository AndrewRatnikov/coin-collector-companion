/**
 * Tests for: route 404 page of /catalog/[coinId] and CoinNotFoundView
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Route 404,
 *                  Component: CoinNotFoundView (CREATE)
 * Covers criteria: #4, #4a (from prd.md)
 *
 * The signed-in submitter flow: the server always 404s a non-approved coin, so the segment's
 * not-found view, after mount with a stored token, renders the existing client coin view for the
 * path's id. The data hooks are mocked at the module level, as in page.test.tsx next to this file.
 *
 * CONTRACT_GAPs: none
 */

import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin } from '@coin-collector/shared';
import CoinNotFound from '@/app/catalog/[coinId]/not-found';
import { ApiError } from '@/lib/api-client';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetGrade, useSetOwnership } from '@/lib/hooks/use-collection';
import { useAddCoinsToSet, useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { clearStoredToken, setStoredToken } from '@/lib/auth-token';

let pathname: string | null = '/catalog/7e57c011-0000-4000-8000-0000000009ff';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCoin: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
  useSetOwnership: vi.fn(),
  useSetGrade: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useUserSets: vi.fn(),
  useAddCoinsToSet: vi.fn(),
}));

vi.mock('@/lib/user-sets-api', () => ({
  getSetGaps: vi.fn(),
}));

const useCoinMock = vi.mocked(useCoin);
const useCollectionMock = vi.mocked(useCollection);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useSetGradeMock = vi.mocked(useSetGrade);
const useUserSetsMock = vi.mocked(useUserSets);
const useAddCoinsToSetMock = vi.mocked(useAddCoinsToSet);
const getSetGapsMock = vi.mocked(getSetGaps);

const PENDING_ID = '7e57c011-0000-4000-8000-0000000009ff';

const PENDING_COIN: CatalogCoin = {
  id: PENDING_ID,
  country: 'USA',
  denomination: '1 Cent',
  year: 1984,
  mintMark: 'D',
  variety: 'Type 2',
  name: 'Lincoln Memorial Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: null,
  mintage: null,
  isKeyDate: false,
  status: 'pending',
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as unknown as ReturnType<typeof useCoin>;
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <CoinNotFound />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  pathname = `/catalog/${PENDING_ID}`;
  [
    useCoinMock,
    useCollectionMock,
    useSetOwnershipMock,
    useSetGradeMock,
    useUserSetsMock,
    useAddCoinsToSetMock,
    getSetGapsMock,
  ].forEach((m) => m.mockReset());
  localStorage.clear();
  useCoinMock.mockReturnValue(queryResult());
  useCollectionMock.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<
    typeof useCollection
  >);
  useSetOwnershipMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    failedCoinIds: new Set<string>(),
  } as unknown as ReturnType<typeof useSetOwnership>);
  useSetGradeMock.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    failedCoinIds: new Set<string>(),
  } as unknown as ReturnType<typeof useSetGrade>);
  useUserSetsMock.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<
    typeof useUserSets
  >);
  useAddCoinsToSetMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useAddCoinsToSet>);
  getSetGapsMock.mockResolvedValue({
    setId: '',
    ownedCount: 0,
    totalCount: 0,
    completionPercent: 0,
    minGrade: null,
    slots: [],
  });
});

afterEach(() => {
  clearStoredToken();
  localStorage.clear();
});

describe('CoinNotFound (signed out)', () => {
  it('renders the coin not-found content inside the route main', () => {
    renderView();

    const main = screen.getByTestId('coin-not-found-page');
    expect(main.tagName).toBe('MAIN');
    const notFound = screen.getByTestId('not-found');
    expect(main).toContainElement(notFound);
    expect(notFound).toHaveAttribute('data-variant', 'coin');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This coin isn't in the catalog");
  });

  it('does not render the coin view or fetch the coin', () => {
    renderView();

    expect(screen.queryByTestId('coin-detail-page')).not.toBeInTheDocument();
    expect(useCoinMock).not.toHaveBeenCalled();
  });

  it('is not the checklist or set variant', () => {
    renderView();

    expect(screen.getByTestId('not-found')).not.toHaveAttribute('data-variant', 'checklist');
    expect(screen.getByTestId('not-found')).not.toHaveAttribute('data-variant', 'set');
  });
});

describe('CoinNotFound (signed-in submitter)', () => {
  it('renders the server HTML as the anonymous 404 even when a token is stored (the token is read after mount)', () => {
    setStoredToken('tok-abc');

    const html = renderToString(<CoinNotFound />);

    expect(html).toContain('coin-not-found-page');
    expect(html).not.toContain('coin-detail-page');
  });

  it('swaps in the coin view for the path id after mount and shows a pending coin with its badge', async () => {
    setStoredToken('tok-abc');
    useCoinMock.mockReturnValue(queryResult({ data: PENDING_COIN }));

    renderView();

    expect(await screen.findByTestId('coin-detail-page')).toBeInTheDocument();
    expect(await screen.findByTestId('coin-detail-pending-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('coin-not-found-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-label')).toHaveTextContent(/^Type 2$/);
    expect(useCoinMock.mock.calls.at(-1)?.[0]).toBe(PENDING_ID);
  });

  it('shows a rejected coin with the same badge', async () => {
    setStoredToken('tok-abc');
    useCoinMock.mockReturnValue(queryResult({ data: { ...PENDING_COIN, status: 'rejected' } }));

    renderView();

    expect(await screen.findByTestId('coin-detail-pending-badge')).toBeInTheDocument();
  });

  it('asks for the id in the current path (another path, another id)', async () => {
    setStoredToken('tok-abc');
    pathname = '/catalog/7e57c011-0000-4000-8000-0000000009aa';
    useCoinMock.mockReturnValue(queryResult({ data: { ...PENDING_COIN, id: '7e57c011-0000-4000-8000-0000000009aa' } }));

    renderView();

    await screen.findByTestId('coin-detail-page');
    expect(useCoinMock.mock.calls.at(-1)?.[0]).toBe('7e57c011-0000-4000-8000-0000000009aa');
  });

  it('does not pass server initial data to the client coin fetch', async () => {
    setStoredToken('tok-abc');
    useCoinMock.mockReturnValue(queryResult({ data: PENDING_COIN }));

    renderView();

    await screen.findByTestId('coin-detail-page');
    expect(useCoinMock.mock.calls.at(-1)?.[1]).toBeUndefined();
  });

  it.each([404, 400])(
    'shows the view\'s own not-found content for an unknown or malformed id (API %i)',
    async (status) => {
      setStoredToken('tok-abc');
      useCoinMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(status, 'x') }));

      renderView();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-page')).toBeInTheDocument();
      });
      expect(screen.getByTestId('not-found')).toHaveAttribute('data-variant', 'coin');
      expect(screen.queryByTestId('coin-detail-pending-badge')).not.toBeInTheDocument();
    },
  );

  it('stays on the 404 shell when the path has no single coin id segment', async () => {
    setStoredToken('tok-abc');
    pathname = '/catalog';

    renderView();

    await waitFor(() => {
      expect(screen.getByTestId('coin-not-found-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('coin-detail-page')).not.toBeInTheDocument();
  });

  it('stays on the 404 shell when the path is unknown (null)', async () => {
    setStoredToken('tok-abc');
    pathname = null;

    renderView();

    await waitFor(() => {
      expect(screen.getByTestId('coin-not-found-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('coin-detail-page')).not.toBeInTheDocument();
  });
});
