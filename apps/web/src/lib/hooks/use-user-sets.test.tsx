/**
 * Tests for: use-user-sets hooks
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: use-user-sets.ts (MODIFY)
 * Extended by: runs/run_20261017_210503/plan.md § Interface Contract → Hooks in use-user-sets.ts
 * Covers criteria: #1, #2 (run_20260721_171115); #12 (run_20261017_210503)
 *
 * All earlier tests are kept unchanged. Added: optimistic remove in usePatchSetCoins, the extra
 * ['user-sets'] invalidation, and useAddCoinsToSet.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin, GapViewResponse } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import {
  useAddCoinsToSet,
  useCreateSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import { createSet, deleteSet, getSetGaps, getUserSets, patchSetCoins, renameSet } from '@/lib/user-sets-api';

vi.mock('@/lib/user-sets-api', () => ({
  getUserSets: vi.fn(),
  createSet: vi.fn(),
  renameSet: vi.fn(),
  deleteSet: vi.fn(),
  getSetGaps: vi.fn(),
  patchSetCoins: vi.fn(),
}));

const getUserSetsMock = vi.mocked(getUserSets);
const createSetMock = vi.mocked(createSet);
const renameSetMock = vi.mocked(renameSet);
const deleteSetMock = vi.mocked(deleteSet);
const getSetGapsMock = vi.mocked(getSetGaps);
const patchSetCoinsMock = vi.mocked(patchSetCoins);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
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

function makeCoin(id: string, year: number): CatalogCoin {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year,
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
  };
}

function makeGaps(setId: string, ownedIds: string[]): GapViewResponse {
  const coins = [makeCoin('coin-1', 1909), makeCoin('coin-2', 1910), makeCoin('coin-3', 1911)];
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

const SET = {
  id: 'u1',
  userId: 'user-1',
  name: 'My Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('use-user-sets hooks', () => {
  beforeEach(() => {
    getUserSetsMock.mockReset();
    createSetMock.mockReset();
    renameSetMock.mockReset();
    deleteSetMock.mockReset();
    getSetGapsMock.mockReset();
    patchSetCoinsMock.mockReset();
  });

  describe('criterion 1/2: useUserSets wraps getUserSets', () => {
    it('exposes the resolved UserSetSummary[] as data', async () => {
      getUserSetsMock.mockResolvedValue([SET] as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useUserSets(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual([SET]);
      });
      expect(getUserSetsMock).toHaveBeenCalledTimes(1);
    });

    it('does not call getUserSets when enabled is false', async () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useUserSets({ enabled: false }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getUserSetsMock).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('criterion 2: useSetGaps wraps getSetGaps and is disabled for an empty id', () => {
    it('calls getSetGaps with the id and exposes the resolved GapViewResponse', async () => {
      const gaps = { setId: 'u1', ownedCount: 1, totalCount: 2, completionPercent: 50, slots: [] };
      getSetGapsMock.mockResolvedValue(gaps as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetGaps('u1'), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(gaps);
      });
      expect(getSetGapsMock).toHaveBeenCalledWith('u1');
    });

    it('does not call getSetGaps when id is an empty string', async () => {
      const { wrapper } = makeWrapper();
      renderHook(() => useSetGaps(''), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getSetGapsMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 1/2: useCreateSet invalidates user-sets on success', () => {
    it('calls createSet and invalidates the user-sets query', async () => {
      createSetMock.mockResolvedValue(SET as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateSet(), { wrapper });
      result.current.mutate({ name: 'My Set' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(createSetMock).toHaveBeenCalledWith({ name: 'My Set' });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
    });
  });

  describe('criterion 1/2: useRenameSet invalidates user-sets on success', () => {
    it('calls renameSet with id and name, and invalidates the user-sets query', async () => {
      renameSetMock.mockResolvedValue(SET as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useRenameSet(), { wrapper });
      result.current.mutate({ id: 'u1', name: 'Renamed' });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(renameSetMock).toHaveBeenCalledWith('u1', 'Renamed');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
    });
  });

  describe('criterion 1/2: useDeleteSet invalidates user-sets on success', () => {
    it('calls deleteSet with the id and invalidates the user-sets query', async () => {
      deleteSetMock.mockResolvedValue(undefined as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useDeleteSet(), { wrapper });
      result.current.mutate('u1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(deleteSetMock).toHaveBeenCalledWith('u1');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
    });
  });

  describe('criterion 1: usePatchSetCoins invalidates the set gap-view and public-set-detail queries on success', () => {
    it('calls patchSetCoins with the setId and body', async () => {
      const coins = [{ id: 'usc-1', userSetId: 'u1', coinId: 'coin-1', position: 0 }];
      patchSetCoinsMock.mockResolvedValue(coins as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      result.current.mutate({ add: ['coin-1'] });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(patchSetCoinsMock).toHaveBeenCalledWith('u1', { add: ['coin-1'] });
    });

    it('invalidates ["user-sets", setId, "gaps"] and ["public-sets", setId] on success', async () => {
      patchSetCoinsMock.mockResolvedValue([] as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      result.current.mutate({ remove: ['coin-2'] });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets', 'u1', 'gaps'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public-sets', 'u1'] });
    });

    it('also invalidates ["user-sets"] after a success', async () => {
      patchSetCoinsMock.mockResolvedValue([] as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      result.current.mutate({ add: ['coin-1'] });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
    });
  });

  describe('criterion 12: usePatchSetCoins removes optimistically', () => {
    it('drops the removed slot from the gap view and recounts before the request resolves', async () => {
      const request = deferred<never>();
      patchSetCoinsMock.mockReturnValue(request.promise);
      const { queryClient, wrapper } = makeWrapper();
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], makeGaps('u1', ['coin-1']));

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      act(() => {
        result.current.mutate({ remove: ['coin-2'] });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'u1', 'gaps'])?.totalCount).toBe(2);
      });
      const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'u1', 'gaps']);
      expect(gaps?.slots.map((s) => s.coin.id)).toEqual(['coin-1', 'coin-3']);
      expect(gaps?.ownedCount).toBe(1);
      expect(gaps?.completionPercent).toBe(50);

      request.resolve([] as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('recounts the owned total when an owned coin is removed (different result from removing a missing one)', async () => {
      const request = deferred<never>();
      patchSetCoinsMock.mockReturnValue(request.promise);
      const { queryClient, wrapper } = makeWrapper();
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], makeGaps('u1', ['coin-1']));

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      act(() => {
        result.current.mutate({ remove: ['coin-1'] });
      });

      await waitFor(() => {
        expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'u1', 'gaps'])?.totalCount).toBe(2);
      });
      const gaps = queryClient.getQueryData<GapViewResponse>(['user-sets', 'u1', 'gaps']);
      expect(gaps?.ownedCount).toBe(0);
      expect(gaps?.completionPercent).toBe(0);

      request.resolve([] as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('restores the gap view if the request fails', async () => {
      const request = deferred<never>();
      patchSetCoinsMock.mockReturnValue(request.promise);
      const { queryClient, wrapper } = makeWrapper();
      const before = makeGaps('u1', ['coin-1']);
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], before);

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      act(() => {
        result.current.mutate({ remove: ['coin-2'] });
      });
      await waitFor(() => {
        expect(queryClient.getQueryData<GapViewResponse>(['user-sets', 'u1', 'gaps'])?.totalCount).toBe(2);
      });

      request.reject(new ApiError(500, 'Internal server error'));
      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(queryClient.getQueryData(['user-sets', 'u1', 'gaps'])).toEqual(before);
    });

    it('does not patch the gap view for an add (add stays non-optimistic)', async () => {
      const request = deferred<never>();
      patchSetCoinsMock.mockReturnValue(request.promise);
      const { queryClient, wrapper } = makeWrapper();
      const before = makeGaps('u1', []);
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], before);

      const { result } = renderHook(() => usePatchSetCoins('u1'), { wrapper });
      act(() => {
        result.current.mutate({ add: ['coin-9'] });
      });
      await waitFor(() => expect(patchSetCoinsMock).toHaveBeenCalledTimes(1));

      expect(queryClient.getQueryData(['user-sets', 'u1', 'gaps'])).toEqual(before);

      request.resolve([] as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe('criterion 12: useAddCoinsToSet', () => {
    it('calls patchSetCoins with the target setId and { add: coinIds }', async () => {
      patchSetCoinsMock.mockResolvedValue([] as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useAddCoinsToSet(), { wrapper });
      act(() => {
        result.current.mutate({ setId: 'u2', coinIds: ['coin-1', 'coin-2'] });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(patchSetCoinsMock).toHaveBeenCalledTimes(1);
      expect(patchSetCoinsMock).toHaveBeenCalledWith('u2', { add: ['coin-1', 'coin-2'] });
    });

    it('invalidates the target set gap view and public-set detail on success', async () => {
      patchSetCoinsMock.mockResolvedValue([] as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useAddCoinsToSet(), { wrapper });
      act(() => {
        result.current.mutate({ setId: 'u3', coinIds: ['coin-1'] });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets', 'u3', 'gaps'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public-sets', 'u3'] });
    });
  });
});
