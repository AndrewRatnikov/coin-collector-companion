/**
 * Tests for: useSetOwnership (optimistic version)
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Hook: useSetOwnership (modified)
 * Covers criteria: #14 (from prd.md): optimistic update, success, rollback on error
 *
 * A real QueryClient is seeded with setQueryData, and only the network wrapper
 * (@/lib/collection-api) is mocked. Each request is a deferred promise so the tests can look at
 * the caches while the request is still in flight.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin, GapViewResponse, OwnershipItem, PaginatedResponse } from '@coin-collector/shared';
import { useSetOwnership } from '@/lib/hooks/use-collection';
import { getCollection, setOwnership } from '@/lib/collection-api';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/collection-api', () => ({
  getCollection: vi.fn(),
  setOwnership: vi.fn(),
}));

const getCollectionMock = vi.mocked(getCollection);
const setOwnershipMock = vi.mocked(setOwnership);

function makeCoin(id: string, over: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year: 1909,
    mintMark: '',
    variety: '',
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
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...over,
  };
}

const COIN_1 = makeCoin('coin-1');
const COIN_2 = makeCoin('coin-2', { year: 1910 });

function makeGaps(setId: string, coins = [COIN_1, COIN_2], ownedIds: string[] = []): GapViewResponse {
  const slots = coins.map((coin, i) => ({
    id: `${setId}-slot-${i}`,
    position: i,
    coin,
    owned: ownedIds.includes(coin.id),
  }));
  const ownedCount = slots.filter((s) => s.owned).length;
  return {
    setId,
    ownedCount,
    totalCount: slots.length,
    completionPercent: Math.round((ownedCount / slots.length) * 100),
    slots,
  };
}

function makeCatalogPage(): PaginatedResponse<CatalogCoin> {
  return { items: [COIN_1, COIN_2], page: 1, limit: 20, total: 2 };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

describe('useSetOwnership: optimistic update', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
  });

  it('patches the collection cache before the request resolves, only for lists the coin matches', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], [] as OwnershipItem[]);
    queryClient.setQueryData(['collection', { country: 'USA' }], [] as OwnershipItem[]);
    queryClient.setQueryData(['collection', { country: 'Canada' }], [] as OwnershipItem[]);

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(1);
    });
    expect(setOwnershipMock).toHaveBeenCalledWith('coin-1', true);
    const all = queryClient.getQueryData<OwnershipItem[]>(['collection', {}]);
    expect(all?.[0]).toEqual({ coinId: 'coin-1', coin: COIN_1, ownedAt: expect.any(Date) });
    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', { country: 'USA' }])).toHaveLength(1);
    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', { country: 'Canada' }])).toEqual([]);
    expect(result.current.isPending).toBe(true);

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('removes the coin from the collection cache when it is marked missing', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(
      ['collection', {}],
      [
        { coinId: 'coin-1', coin: COIN_1, ownedAt: new Date('2026-01-02T00:00:00.000Z') },
        { coinId: 'coin-2', coin: COIN_2, ownedAt: new Date('2026-01-03T00:00:00.000Z') },
      ] as OwnershipItem[],
    );

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: false });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.map((i) => i.coinId)).toEqual(['coin-2']);
    });

    request.resolve({ coinId: 'coin-1', owned: false, ownedAt: null } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('takes the coin from a cached set when the variables carry none', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], [] as OwnershipItem[]);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps('set-1'));

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-2', owned: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(1);
    });
    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[0].coin).toEqual(COIN_2);

    request.resolve({ coinId: 'coin-2', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('patches every set gap-view cache that holds the coin and recounts each one', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const setOne = makeGaps('set-1');
    const setTwo = makeGaps('set-2', [COIN_1, COIN_2, makeCoin('coin-3')], ['coin-2']);
    const setThree = makeGaps('set-3', [COIN_2]);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], setOne);
    queryClient.setQueryData(['user-sets', 'set-2', 'gaps'], setTwo);
    queryClient.setQueryData(['user-sets', 'set-3', 'gaps'], setThree);

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(1);
    });
    const patchedOne = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps']);
    expect(patchedOne?.slots.find((s) => s.coin.id === 'coin-1')?.owned).toBe(true);
    expect(patchedOne?.completionPercent).toBe(50);

    const patchedTwo = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-2', 'gaps']);
    expect(patchedTwo?.ownedCount).toBe(2);
    expect(patchedTwo?.completionPercent).toBe(67);
    expect(patchedTwo?.slots.map((s) => s.owned)).toEqual([true, true, false]);

    // a set that does not contain the coin is untouched
    expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-3', 'gaps'])).toEqual(setThree);

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('removes the coin from hideOwned catalog lists only, leaving other catalog caches alone', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['catalog', { hideOwned: true }], makeCatalogPage());
    queryClient.setQueryData(['catalog', { hideOwned: false }], makeCatalogPage());
    queryClient.setQueryData(['catalog', { country: 'USA' }], makeCatalogPage());
    queryClient.setQueryData(['catalog', 'coin', 'coin-1'], COIN_1);
    queryClient.setQueryData(['catalog', 'mine'], makeCatalogPage());
    queryClient.setQueryData(['catalog', 'facets', ''], { countries: ['USA'], denominations: ['1 Cent'] });

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<PaginatedResponse<CatalogCoin>>(['catalog', { hideOwned: true }])?.items,
      ).toHaveLength(1);
    });
    const hidden = queryClient.getQueryData<PaginatedResponse<CatalogCoin>>(['catalog', { hideOwned: true }]);
    expect(hidden?.items.map((c) => c.id)).toEqual(['coin-2']);
    expect(hidden?.total).toBe(1);

    expect(queryClient.getQueryData(['catalog', { hideOwned: false }])).toEqual(makeCatalogPage());
    expect(queryClient.getQueryData(['catalog', { country: 'USA' }])).toEqual(makeCatalogPage());
    expect(queryClient.getQueryData(['catalog', 'coin', 'coin-1'])).toEqual(COIN_1);
    expect(queryClient.getQueryData(['catalog', 'mine'])).toEqual(makeCatalogPage());
    expect(queryClient.getQueryData(['catalog', 'facets', ''])).toEqual({
      countries: ['USA'],
      denominations: ['1 Cent'],
    });

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useSetOwnership: success', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
  });

  it('keeps the optimistic values in the caches after the request succeeds (until a refetch replaces them)', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], [] as OwnershipItem[]);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps('set-1'));

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(1);
    const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps']);
    expect(gaps?.ownedCount).toBe(1);
    expect(gaps?.slots.find((s) => s.coin.id === 'coin-1')?.owned).toBe(true);
    expect(result.current.failedCoinIds.has('coin-1')).toBe(false);
  });

  it('still invalidates the user-sets and collection prefixes and the hideOwned catalog lists on settle', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map(([filters]) => filters as { queryKey: unknown[]; predicate?: unknown });
    expect(calls.some((f) => f.queryKey[0] === 'user-sets')).toBe(true);
    expect(calls.some((f) => f.queryKey[0] === 'collection')).toBe(true);
    const catalogCall = calls.find((f) => f.queryKey[0] === 'catalog');
    expect(catalogCall).toBeDefined();
    expect(typeof catalogCall?.predicate).toBe('function');
  });

  it('limits the catalog invalidation to list queries with hideOwned on', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const catalogCall = invalidateSpy.mock.calls
      .map(([filters]) => filters as { queryKey: unknown[]; predicate?: (query: { queryKey: unknown[] }) => boolean })
      .find((f) => f.queryKey[0] === 'catalog');
    const predicate = catalogCall?.predicate;
    expect(predicate).toBeDefined();
    expect(predicate?.({ queryKey: ['catalog', { hideOwned: true }] })).toBe(true);
    expect(predicate?.({ queryKey: ['catalog', { hideOwned: false }] })).toBe(false);
    expect(predicate?.({ queryKey: ['catalog', { country: 'USA' }] })).toBe(false);
    expect(predicate?.({ queryKey: ['catalog', 'coin', 'coin-1'] })).toBe(false);
    expect(predicate?.({ queryKey: ['catalog', 'facets', ''] })).toBe(false);
  });

  it('calls the onSettled option with null and the variables after a success', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    const onSettled = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSetOwnership({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(null, { coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });
});

describe('useSetOwnership: rollback on error', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
  });

  it('restores the collection, gap-view and catalog caches and marks the coin failed', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const collectionBefore: OwnershipItem[] = [{ coinId: 'coin-2', coin: COIN_2, ownedAt: new Date('2026-01-02') }];
    const gapsBefore = makeGaps('set-1');
    const catalogBefore = makeCatalogPage();
    queryClient.setQueryData(['collection', {}], collectionBefore);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], gapsBefore);
    queryClient.setQueryData(['catalog', { hideOwned: true }], catalogBefore);

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(2);
    });
    expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(1);
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));

    request.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(['collection', {}])).toEqual(collectionBefore);
    expect(queryClient.getQueryData(['user-sets', 'set-1', 'gaps'])).toEqual(gapsBefore);
    expect(queryClient.getQueryData(['catalog', { hideOwned: true }])).toEqual(catalogBefore);
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));
  });

  it('restores a removed collection item when marking missing fails', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const before: OwnershipItem[] = [
      { coinId: 'coin-1', coin: COIN_1, ownedAt: new Date('2026-01-02') },
      { coinId: 'coin-2', coin: COIN_2, ownedAt: new Date('2026-01-03') },
    ];
    queryClient.setQueryData(['collection', {}], before);

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: false });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(1);
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));

    request.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.map((i) => i.coinId)).toEqual([
      'coin-1',
      'coin-2',
    ]);
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));
    expect(result.current.failedCoinIds.has('coin-2')).toBe(false);
  });

  it('calls the onSettled option with the error and the variables', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const onSettled = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSetOwnership({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true });
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));
    const error = new ApiError(500, 'Internal server error');
    request.reject(error);

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(error, { coinId: 'coin-1', owned: true });
    });
  });

  it('clears the failed mark when the same coin is toggled again', async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    setOwnershipMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));
    first.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));

    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true, coin: COIN_1 });
    });
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(false));

    second.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.failedCoinIds.has('coin-1')).toBe(false);
  });

  it('starts with an empty failedCoinIds set', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetOwnership(), { wrapper });
    expect(result.current.failedCoinIds.size).toBe(0);
  });
});
