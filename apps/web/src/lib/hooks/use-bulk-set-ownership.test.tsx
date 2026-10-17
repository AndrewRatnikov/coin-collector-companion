/**
 * Tests for: useBulkSetOwnership
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Hook: useBulkSetOwnership
 * Covers criteria: #6, #8, #10 (from prd.md): one request, optimistic patch for every id, rollback
 *
 * A real QueryClient is seeded with setQueryData, and only the network wrapper
 * (@/lib/collection-api) is mocked. Requests are deferred promises so the tests can look at the
 * caches while the request is in flight.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin, GapViewResponse, OwnershipItem, PaginatedResponse } from '@coin-collector/shared';
import { useBulkSetOwnership } from '@/lib/hooks/use-collection';
import { getCollection, setOwnership, setOwnershipBulk } from '@/lib/collection-api';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/collection-api', () => ({
  getCollection: vi.fn(),
  setOwnership: vi.fn(),
  setOwnershipBulk: vi.fn(),
}));

const getCollectionMock = vi.mocked(getCollection);
const setOwnershipMock = vi.mocked(setOwnership);
const setOwnershipBulkMock = vi.mocked(setOwnershipBulk);

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
const COIN_3 = makeCoin('coin-3', { year: 1911 });

function makeGaps(setId: string, coins: CatalogCoin[], ownedIds: string[] = []): GapViewResponse {
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
  return { items: [COIN_1, COIN_2, COIN_3], page: 1, limit: 20, total: 3 };
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

describe('useBulkSetOwnership: one request', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
    setOwnershipBulkMock.mockReset();
  });

  it('calls setOwnershipBulk exactly once with all ids and never the single-coin API', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-1', 'coin-2', 'coin-3'], owned: true });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2', 'coin-3'], owned: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setOwnershipBulkMock).toHaveBeenCalledTimes(1);
    expect(setOwnershipBulkMock).toHaveBeenCalledWith(['coin-1', 'coin-2', 'coin-3'], true);
    expect(setOwnershipMock).not.toHaveBeenCalled();
  });

  it('passes owned: false through', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-2'], owned: false });
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-2'], owned: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setOwnershipBulkMock).toHaveBeenCalledWith(['coin-2'], false);
  });
});

describe('useBulkSetOwnership: optimistic update', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
    setOwnershipBulkMock.mockReset();
  });

  it('marks every id owned in the gap view at once and recounts, before the request resolves', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps('set-1', [COIN_1, COIN_2, COIN_3]));

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-3'], owned: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(2);
    });
    const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps']);
    expect(gaps?.slots.map((s) => s.owned)).toEqual([true, false, true]);
    expect(gaps?.completionPercent).toBe(67);
    expect(result.current.isPending).toBe(true);

    request.resolve({ coinIds: ['coin-1', 'coin-3'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('marks ids missing and recounts down (different output from the owned case)', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(
      ['user-sets', 'set-1', 'gaps'],
      makeGaps('set-1', [COIN_1, COIN_2, COIN_3], ['coin-1', 'coin-2', 'coin-3']),
    );

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-2'], owned: false });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(2);
    });
    const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps']);
    expect(gaps?.slots.map((s) => s.owned)).toEqual([true, false, true]);
    expect(gaps?.completionPercent).toBe(67);

    request.resolve({ coinIds: ['coin-2'], owned: false } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('patches every set that holds any of the coins, and leaves other sets alone', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const other = makeGaps('set-3', [makeCoin('coin-9')]);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps('set-1', [COIN_1, COIN_2]));
    queryClient.setQueryData(['user-sets', 'set-2', 'gaps'], makeGaps('set-2', [COIN_2, COIN_3]));
    queryClient.setQueryData(['user-sets', 'set-3', 'gaps'], other);

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(2);
    });
    expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-2', 'gaps'])?.ownedCount).toBe(1);
    expect(queryClient.getQueryData(['user-sets', 'set-3', 'gaps'])).toEqual(other);

    request.resolve({ coinIds: ['coin-1', 'coin-2'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('adds every id to matching collection lists, using coins found in the cached gap view', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], [] as OwnershipItem[]);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps('set-1', [COIN_1, COIN_2, COIN_3]));

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])).toHaveLength(2);
    });
    expect(
      queryClient
        .getQueryData<OwnershipItem[]>(['collection', {}])
        ?.map((i) => i.coinId)
        .sort(),
    ).toEqual(['coin-1', 'coin-2']);

    request.resolve({ coinIds: ['coin-1', 'coin-2'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('removes every id from the collection list when marking missing', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(
      ['collection', {}],
      [
        { coinId: 'coin-1', coin: COIN_1, ownedAt: new Date('2026-01-02') },
        { coinId: 'coin-2', coin: COIN_2, ownedAt: new Date('2026-01-03') },
        { coinId: 'coin-3', coin: COIN_3, ownedAt: new Date('2026-01-04') },
      ] as OwnershipItem[],
    );

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-3'], owned: false });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.map((i) => i.coinId)).toEqual([
        'coin-2',
      ]);
    });

    request.resolve({ coinIds: ['coin-1', 'coin-3'], owned: false } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('removes the ids from hideOwned catalog lists only', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['catalog', { hideOwned: true }], makeCatalogPage());
    queryClient.setQueryData(['catalog', { hideOwned: false }], makeCatalogPage());

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });

    await waitFor(() => {
      expect(
        queryClient.getQueryData<PaginatedResponse<CatalogCoin>>(['catalog', { hideOwned: true }])?.items,
      ).toHaveLength(1);
    });
    const hidden = queryClient.getQueryData<PaginatedResponse<CatalogCoin>>(['catalog', { hideOwned: true }]);
    expect(hidden?.items.map((c) => c.id)).toEqual(['coin-3']);
    expect(queryClient.getQueryData(['catalog', { hideOwned: false }])).toEqual(makeCatalogPage());

    request.resolve({ coinIds: ['coin-1', 'coin-2'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useBulkSetOwnership: settle', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
    setOwnershipBulkMock.mockReset();
  });

  it('invalidates the user-sets and collection prefixes and the hideOwned catalog lists', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-1'], owned: true });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1'], owned: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calls = invalidateSpy.mock.calls.map(
      ([filters]) => filters as { queryKey: unknown[]; predicate?: (query: { queryKey: unknown[] }) => boolean },
    );
    expect(calls.some((f) => f.queryKey[0] === 'user-sets')).toBe(true);
    expect(calls.some((f) => f.queryKey[0] === 'collection')).toBe(true);
    const catalogCall = calls.find((f) => f.queryKey[0] === 'catalog');
    expect(catalogCall?.predicate?.({ queryKey: ['catalog', { hideOwned: true }] })).toBe(true);
    expect(catalogCall?.predicate?.({ queryKey: ['catalog', { hideOwned: false }] })).toBe(false);
  });

  it('calls the onSettled option with null and the variables after success', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-1', 'coin-2'], owned: true });
    const onSettled = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useBulkSetOwnership({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(null, { coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('starts with an empty failedCoinIds set', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    expect(result.current.failedCoinIds.size).toBe(0);
  });
});

describe('useBulkSetOwnership: rollback on error', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
    setOwnershipBulkMock.mockReset();
  });

  it('restores gap-view, collection and catalog caches and marks all ids failed', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const gapsBefore = makeGaps('set-1', [COIN_1, COIN_2, COIN_3]);
    const collectionBefore: OwnershipItem[] = [];
    const catalogBefore = makeCatalogPage();
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], gapsBefore);
    queryClient.setQueryData(['collection', {}], collectionBefore);
    queryClient.setQueryData(['catalog', { hideOwned: true }], catalogBefore);

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.ownedCount).toBe(2);
    });
    await waitFor(() => expect(setOwnershipBulkMock).toHaveBeenCalledTimes(1));

    request.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(['user-sets', 'set-1', 'gaps'])).toEqual(gapsBefore);
    expect(queryClient.getQueryData(['collection', {}])).toEqual(collectionBefore);
    expect(queryClient.getQueryData(['catalog', { hideOwned: true }])).toEqual(catalogBefore);
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));
    expect(result.current.failedCoinIds.has('coin-2')).toBe(true);
    expect(result.current.failedCoinIds.has('coin-3')).toBe(false);
  });

  it('calls the onSettled option with the error and the variables', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const onSettled = vi.fn();
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useBulkSetOwnership({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1'], owned: false });
    });
    await waitFor(() => expect(setOwnershipBulkMock).toHaveBeenCalledTimes(1));
    const error = new ApiError(500, 'Internal server error');
    request.reject(error);

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(error, { coinIds: ['coin-1'], owned: false });
    });
  });

  it('clears the failed marks for the ids when they are mutated again', async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    setOwnershipBulkMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    await waitFor(() => expect(setOwnershipBulkMock).toHaveBeenCalledTimes(1));
    first.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));

    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    await waitFor(() => expect(result.current.failedCoinIds.size).toBe(0));

    second.resolve({ coinIds: ['coin-1', 'coin-2'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
