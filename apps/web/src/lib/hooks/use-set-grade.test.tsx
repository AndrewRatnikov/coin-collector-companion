/**
 * Tests for: useSetGrade (optimistic grade save)
 * Contract source: runs/run_20261102_220909/plan.md § Interface Contract → Hook: useSetGrade
 * Covers criteria: #3, #4, #5, #11
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
import { useSetGrade } from '@/lib/hooks/use-collection';
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

function makeGaps(): GapViewResponse {
  return {
    setId: 'set-1',
    ownedCount: 1,
    totalCount: 2,
    completionPercent: 50,
    minGrade: null,
    slots: [
      { id: 's1', position: 0, coin: COIN_1, owned: true, grade: 'F' },
      { id: 's2', position: 1, coin: COIN_2, owned: false, grade: null },
    ],
  };
}

function makeCollection(): OwnershipItem[] {
  return [
    { coinId: 'coin-1', coin: COIN_1, ownedAt: new Date('2026-01-02'), grade: 'F' },
    { coinId: 'coin-2', coin: COIN_2, ownedAt: new Date('2026-01-03'), grade: 'G' },
  ];
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
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

beforeEach(() => {
  getCollectionMock.mockReset();
  setOwnershipMock.mockReset();
});

describe('useSetGrade: request', () => {
  it('calls setOwnership(coinId, true, grade) for a grade', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: 'VF' } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetGrade(), { wrapper });

    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'VF' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setOwnershipMock).toHaveBeenCalledWith('coin-1', true, 'VF');
  });

  it('passes null through to clear the grade', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-2', owned: true, ownedAt: new Date(), grade: null } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetGrade(), { wrapper });

    act(() => {
      result.current.mutate({ coinId: 'coin-2', grade: null });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(setOwnershipMock).toHaveBeenCalledWith('coin-2', true, null);
  });

  it('starts with an empty failedCoinIds set', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetGrade(), { wrapper });
    expect(result.current.failedCoinIds.size).toBe(0);
  });
});

describe('useSetGrade: optimistic patch', () => {
  it('patches the collection and gap caches before the request resolves', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], makeCollection());
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], makeGaps());

    const { result } = renderHook(() => useSetGrade(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'XF' });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[0].grade).toBe('XF');
    });
    const items = queryClient.getQueryData<OwnershipItem[]>(['collection', {}]);
    expect(items?.[1].grade).toBe('G');
    const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps']);
    expect(gaps?.slots[0].grade).toBe('XF');
    expect(gaps?.slots[1].grade).toBeNull();
    expect(gaps?.ownedCount).toBe(1);
    expect(gaps?.completionPercent).toBe(50);
    expect(result.current.isPending).toBe(true);

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: 'XF' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('clears the cached grade for null', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], makeCollection());

    const { result } = renderHook(() => useSetGrade(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-2', grade: null });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[1].grade).toBeNull();
    });
    expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[0].grade).toBe('F');

    request.resolve({ coinId: 'coin-2', owned: true, ownedAt: new Date(), grade: null } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('does not patch catalog lists', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { queryClient, wrapper } = makeWrapper();
    const page: PaginatedResponse<CatalogCoin> = { items: [COIN_1, COIN_2], page: 1, limit: 20, total: 2 };
    queryClient.setQueryData(['catalog', { hideOwned: true }], page);
    queryClient.setQueryData(['collection', {}], makeCollection());

    const { result } = renderHook(() => useSetGrade(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'AU' });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[0].grade).toBe('AU');
    });

    expect(queryClient.getQueryData(['catalog', { hideOwned: true }])).toBe(page);

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: 'AU' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('useSetGrade: settle', () => {
  it('invalidates user-sets and collection, then calls onSettled(null, variables)', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: 'VF' } as never);
    const onSettled = vi.fn();
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useSetGrade({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'VF' });
    });

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(null, { coinId: 'coin-1', grade: 'VF' });
    });
    expect(onSettled).toHaveBeenCalledTimes(1);
    const calls = invalidateSpy.mock.calls.map(([filters]) => filters as { queryKey: unknown[] });
    expect(calls.some((f) => f.queryKey[0] === 'user-sets')).toBe(true);
    expect(calls.some((f) => f.queryKey[0] === 'collection')).toBe(true);
  });
});

describe('useSetGrade: rollback on error', () => {
  it('restores the caches, marks the coin failed and reports the error', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const onSettled = vi.fn();
    const { queryClient, wrapper } = makeWrapper();
    const collectionBefore = makeCollection();
    const gapsBefore = makeGaps();
    queryClient.setQueryData(['collection', {}], collectionBefore);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], gapsBefore);

    const { result } = renderHook(() => useSetGrade({ onSettled }), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'UNC' });
    });
    await waitFor(() => {
      expect(queryClient.getQueryData<OwnershipItem[]>(['collection', {}])?.[0].grade).toBe('UNC');
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));

    const error = new ApiError(500, 'Internal server error');
    request.reject(error);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData(['collection', {}])).toEqual(collectionBefore);
    expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'set-1', 'gaps'])?.slots[0].grade).toBe('F');
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));
    expect(result.current.failedCoinIds.has('coin-2')).toBe(false);
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(error, { coinId: 'coin-1', grade: 'UNC' }));
  });

  it('clears the failed mark when the same coin is saved again', async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    setOwnershipMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSetGrade(), { wrapper });
    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'VF' });
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledTimes(1));
    first.reject(new ApiError(500, 'Internal server error'));
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(true));

    act(() => {
      result.current.mutate({ coinId: 'coin-1', grade: 'VF' });
    });
    await waitFor(() => expect(result.current.failedCoinIds.has('coin-1')).toBe(false));

    second.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: 'VF' } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
