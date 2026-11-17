/**
 * Tests for: CoinDetailPage (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors catalog/[coinId]/page.test.tsx. useSlowLoading is deliberately not mocked.
 * The params Promise is created once per test and reused on rerender (use() suspends on a new Promise).
 *
 * CONTRACT_GAPs: none
 */

import { Suspense } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin } from '@coin-collector/shared';
import CoinDetailPage from '@/app/catalog/[coinId]/page';
import { useCoin } from '@/lib/hooks/use-catalog';
import { useCollection, useSetGrade, useSetOwnership } from '@/lib/hooks/use-collection';
import { useAddCoinsToSet, useUserSets } from '@/lib/hooks/use-user-sets';
import { getSetGaps } from '@/lib/user-sets-api';
import { getStoredToken } from '@/lib/auth-token';

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

function queryResult(overrides: Partial<ReturnType<typeof useCoin>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCoin>;
}

function collectionResult(overrides: Partial<ReturnType<typeof useCollection>> = {}) {
  return { data: [], isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCollection>;
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

async function flushParams() {
  for (let i = 0; i < 3; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

function setup() {
  const params = Promise.resolve({ coinId: 'coin-1' });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = () => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div />}>
        <CoinDetailPage params={params} />
      </Suspense>
    </QueryClientProvider>
  );
  return { view: render(ui()), ui };
}

describe('CoinDetailPage: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCoinMock.mockReset();
    useCollectionMock.mockReset();
    useSetOwnershipMock.mockReset();
    useSetGradeMock.mockReset();
    useUserSetsMock.mockReset();
    useAddCoinsToSetMock.mockReset();
    getSetGapsMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
    useCollectionMock.mockReturnValue(collectionResult());
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
    useUserSetsMock.mockReturnValue({ data: [], isLoading: false, isError: false } as unknown as ReturnType<typeof useUserSets>);
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
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s inside the loading block, and gone once the coin resolves', async () => {
    useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();

    expect(screen.getByTestId('coin-detail-loading')).toBeInTheDocument();
    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    const notice = screen.getByTestId('server-waking-notice');
    expect(notice).toHaveTextContent('Waking the server.');
    expect(screen.getByTestId('coin-detail-loading')).toContainElement(notice);

    useCoinMock.mockReturnValue(queryResult({ data: COIN }));
    view.rerender(ui());
    await flushParams();

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-detail-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
  });

  it('never appears when the coin resolves before 3 s', async () => {
    useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
    const { view, ui } = setup();
    await flushParams();
    advance(2000);

    useCoinMock.mockReturnValue(queryResult({ data: COIN }));
    view.rerender(ui());
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('is not driven by a secondary query: the coin is there and the collection is still loading', async () => {
    useCoinMock.mockReturnValue(queryResult({ data: COIN }));
    useCollectionMock.mockReturnValue(collectionResult({ data: undefined, isLoading: true }));
    setup();
    await flushParams();

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
