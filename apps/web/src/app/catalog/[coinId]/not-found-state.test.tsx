/**
 * Tests for: CoinDetailPage not-found state
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Detail pages (modified)
 * Covers criteria: #7, #11, #12
 *
 * Mock setup mirrors page.test.tsx (Suspense + QueryClientProvider, mocked hooks).
 *
 * CONTRACT_GAPS: none
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CoinDetailPage from '@/app/catalog/[coinId]/page';
import { ApiError } from '@/lib/api-client';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetGrade, useSetOwnership } from '@/lib/hooks/use-collection';
import { useAddCoinsToSet, useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';
import type { CatalogCoin } from '@coin-collector/shared';

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

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCoinMock = vi.mocked(useCoin);
const useCollectionMock = vi.mocked(useCollection);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useSetGradeMock = vi.mocked(useSetGrade);
const useUserSetsMock = vi.mocked(useUserSets);
const useAddCoinsToSetMock = vi.mocked(useAddCoinsToSet);
const getSetGapsMock = vi.mocked(getSetGaps);
const getStoredTokenMock = vi.mocked(getStoredToken);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as unknown as ReturnType<typeof useCoin>;
}

function renderPage(coinId = 'coin-1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div />}>
        <CoinDetailPage params={Promise.resolve({ coinId })} />
      </Suspense>
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

const COIN: CatalogCoin = {
  id: 'coin-1',
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
  status: 'approved',
  submittedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const USER_SETS = [
  {
    id: 'set-a',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    minGrade: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('CoinDetailPage: not-found state', () => {
  beforeEach(() => {
    [
      useCoinMock,
      useCollectionMock,
      useSetOwnershipMock,
      useSetGradeMock,
      useUserSetsMock,
      useAddCoinsToSetMock,
      getSetGapsMock,
      getStoredTokenMock,
    ].forEach((m) => m.mockReset());

    getStoredTokenMock.mockReturnValue(null);
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

  it.each([404, 400])('shows the coin not-found state for an ApiError %i', async (status) => {
    useCoinMock.mockReturnValue(queryResult({ isError: true, error: new ApiError(status, 'x') }));
    renderPage();

    const notFound = await screen.findByTestId('not-found');
    expect(notFound).toHaveAttribute('data-variant', 'coin');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This coin isn't in the catalog");
    expect(screen.queryByTestId('coin-detail-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-page')).toContainElement(notFound);
  });

  it.each([
    ['a 500 ApiError', new ApiError(500, 'boom')],
    ['a 401 ApiError', new ApiError(401, 'nope')],
    ['a plain network Error', new Error('Failed to fetch')],
  ])('keeps the existing error UI for %s', async (_label, error) => {
    useCoinMock.mockReturnValue(queryResult({ isError: true, error }));
    renderPage();

    expect(await screen.findByTestId('coin-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('keeps the existing error UI when isError is true and there is no error object', async () => {
    useCoinMock.mockReturnValue(queryResult({ isError: true }));
    renderPage();

    expect(await screen.findByTestId('coin-detail-error')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
  });

  it('does not show not-found when the coin loads but a secondary gaps query fails with 404', async () => {
    getStoredTokenMock.mockReturnValue('tok-abc');
    useUserSetsMock.mockReturnValue({ data: USER_SETS, isLoading: false, isError: false } as unknown as ReturnType<
      typeof useUserSets
    >);
    getSetGapsMock.mockRejectedValue(new ApiError(404, 'Not Found'));
    useCoinMock.mockReturnValue(queryResult({ data: COIN }));
    const { queryClient } = renderPage();

    expect(await screen.findByTestId('coin-detail-label')).toBeInTheDocument();
    await waitFor(() => {
      expect(queryClient.getQueryState(['user-sets', 'set-a', 'gaps'])?.status).toBe('error');
    });
    expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
    expect(screen.queryByTestId('not-found')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-detail-error')).not.toBeInTheDocument();
  });
});
