/**
 * Tests for: use-collection hooks
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: use-collection.ts (CREATE)
 *                   runs/run_20261018_105617/plan.md § Interface Contract → Module: use-collection.ts (unchanged)
 * Covers criteria: #3, #6, #8 (from prd.md); #10 (from run_20261018_105617's prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useBulkSetOwnership, useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
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

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

const COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const OWNERSHIP_ITEM = { coinId: 'coin-1', coin: COIN, ownedAt: new Date('2026-01-02T00:00:00.000Z') };

describe('use-collection hooks', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
    setOwnershipBulkMock.mockReset();
  });

  describe('criterion 6: useCollection wraps getCollection', () => {
    it('calls getCollection with the given filters and exposes the resolved data', async () => {
      getCollectionMock.mockResolvedValue([OWNERSHIP_ITEM] as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useCollection({ country: 'USA' }), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual([OWNERSHIP_ITEM]);
      });
      expect(getCollectionMock).toHaveBeenCalledWith({ country: 'USA' });
    });

    it('calls getCollection with no filters when none are given', async () => {
      getCollectionMock.mockResolvedValue([] as never);
      const { wrapper } = makeWrapper();

      renderHook(() => useCollection(), { wrapper });

      await waitFor(() => {
        expect(getCollectionMock).toHaveBeenCalledWith({});
      });
    });

    it('does not call getCollection when enabled is false', async () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCollection({}, { enabled: false }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCollectionMock).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('criterion 3/8: useSetOwnership calls setOwnership with an explicit owned value and invalidates both the user-sets and collection query prefixes', () => {
    it('calls setOwnership with { coinId, owned } exactly as given', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetOwnership(), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(setOwnershipMock).toHaveBeenCalledWith('coin-1', true);
    });

    it('invalidates the ["user-sets"] prefix on success (so every mounted set gap-view refetches, not just one)', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: false, ownedAt: null } as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSetOwnership(), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: false });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
    });

    it('invalidates the ["collection"] prefix on success', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useSetOwnership(), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['collection'] });
    });
  });

  describe('run_20261018_105617 criterion 10: ownership changes refresh the My sets queries', () => {
    const LIST = [{ id: 'set-1', ownedCount: 1, totalCount: 3, firstMissing: 'Odesa Oblast' }];
    const SUMMARY = { uniqueMissingCount: 2, collectionCount: 1, suggestedSet: null };

    it('marks both the ["user-sets"] list and the ["user-sets", "summary"] query invalidated after a toggle', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
      const { queryClient, wrapper } = makeWrapper();
      queryClient.setQueryData(['user-sets'], LIST);
      queryClient.setQueryData(['user-sets', 'summary'], SUMMARY);
      expect(queryClient.getQueryState(['user-sets'])?.isInvalidated).toBe(false);
      expect(queryClient.getQueryState(['user-sets', 'summary'])?.isInvalidated).toBe(false);

      const { result } = renderHook(() => useSetOwnership(), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(queryClient.getQueryState(['user-sets'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['user-sets', 'summary'])?.isInvalidated).toBe(true);
    });

    it('refetches active list and summary queries after a toggle', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
      const { wrapper } = makeWrapper();
      const listFn = vi.fn().mockResolvedValue(LIST);
      const summaryFn = vi.fn().mockResolvedValue(SUMMARY);

      // Both queries are mounted, as on the dashboard.
      const { result } = renderHook(
        () => ({
          list: useQuery({ queryKey: ['user-sets'], queryFn: listFn }),
          summary: useQuery({ queryKey: ['user-sets', 'summary'], queryFn: summaryFn }),
          ownership: useSetOwnership(),
        }),
        { wrapper },
      );
      await waitFor(() => {
        expect(result.current.list.isSuccess).toBe(true);
        expect(result.current.summary.isSuccess).toBe(true);
      });
      expect(listFn).toHaveBeenCalledTimes(1);
      expect(summaryFn).toHaveBeenCalledTimes(1);

      result.current.ownership.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(result.current.ownership.isSuccess).toBe(true);
      });
      expect(listFn).toHaveBeenCalledTimes(2);
      expect(summaryFn).toHaveBeenCalledTimes(2);
    });

    it('does not patch the summary as a gap view during the optimistic step', async () => {
      let finish!: () => void;
      setOwnershipMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = () => resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
          }),
      );
      const { queryClient, wrapper } = makeWrapper();
      queryClient.setQueryData(['user-sets', 'summary'], SUMMARY);

      const { result } = renderHook(() => useSetOwnership(), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(setOwnershipMock).toHaveBeenCalled();
      });
      expect(queryClient.getQueryData(['user-sets', 'summary'])).toEqual(SUMMARY);

      finish();
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });

    it('also invalidates both queries after a bulk change', async () => {
      setOwnershipBulkMock.mockResolvedValue({ updated: 2 } as never);
      const { queryClient, wrapper } = makeWrapper();
      queryClient.setQueryData(['user-sets'], LIST);
      queryClient.setQueryData(['user-sets', 'summary'], SUMMARY);

      const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(setOwnershipBulkMock).toHaveBeenCalledWith(['coin-1', 'coin-2'], true);
      expect(queryClient.getQueryState(['user-sets'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['user-sets', 'summary'])?.isInvalidated).toBe(true);
    });
  });

  describe('onSettled option', () => {
    it('fires for every concurrent mutation with its own variables, not just the latest', async () => {
      let rejectFirst!: (err: unknown) => void;
      setOwnershipMock
        .mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)))
        .mockResolvedValueOnce({ coinId: 'coin-2', owned: true, ownedAt: new Date() } as never);
      const onSettled = vi.fn();
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetOwnership({ onSettled }), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });
      result.current.mutate({ coinId: 'coin-2', owned: true });

      await waitFor(() => {
        expect(onSettled).toHaveBeenCalledWith(null, { coinId: 'coin-2', owned: true });
      });
      const error = new ApiError(500, 'Internal server error');
      rejectFirst(error);
      await waitFor(() => {
        expect(onSettled).toHaveBeenCalledWith(error, { coinId: 'coin-1', owned: true });
      });
      expect(onSettled).toHaveBeenCalledTimes(2);
    });

    it('fires only after the invalidated queries have refetched', async () => {
      setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: true, ownedAt: new Date() } as never);
      const { queryClient, wrapper } = makeWrapper();
      let finishRefetch!: () => void;
      vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(
        (filters) =>
          new Promise<void>((resolve) => {
            if ((filters as { queryKey: string[] }).queryKey[0] === 'user-sets') finishRefetch = resolve;
            else resolve();
          }),
      );
      const onSettled = vi.fn();

      const { result } = renderHook(() => useSetOwnership({ onSettled }), { wrapper });
      result.current.mutate({ coinId: 'coin-1', owned: true });

      await waitFor(() => {
        expect(finishRefetch).toBeDefined();
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onSettled).not.toHaveBeenCalled();

      finishRefetch();
      await waitFor(() => {
        expect(onSettled).toHaveBeenCalledWith(null, { coinId: 'coin-1', owned: true });
      });
    });
  });
});
