/**
 * Tests for: use-user-sets hooks
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: use-user-sets.ts (MODIFY)
 * Extended by: runs/run_20261017_210503/plan.md § Interface Contract → Hooks in use-user-sets.ts
 *              runs/run_20261018_105617/plan.md § Interface Contract → Module: use-user-sets.ts (MODIFY)
 *              runs/run_20261103_192441/plan.md § Interface Contract → Hook: useUpdateSetMinGrade
 *              runs/run_20261109_220451/plan.md § Interface Contract → Hook: useCanonicalSetGaps
 * Covers criteria: #1, #2 (run_20260721_171115); #12 (run_20261017_210503); #3, #10 (run_20261018_105617);
 *                  #3, #9 (run_20261103_192441); #2 (run_20261109_220451)
 *
 * All earlier tests are kept unchanged. Added: optimistic remove in usePatchSetCoins, the extra
 * ['user-sets'] invalidation, useAddCoinsToSet, and useSetsSummary.
 * Fixture-only change (run_20261102_194108): slots gain `grade: null`, gap views and the SET literal
 * gain `minGrade: null`.
 * run_20261103_192441 adds useUpdateSetMinGrade (non-optimistic, pending until the gap view refetched).
 * run_20261109_220451 adds useCanonicalSetGaps (and getCanonicalSetGaps to the api mock factory).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin, GapViewResponse } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import {
  useAddCoinsToSet,
  useCanonicalSetGaps,
  useCreateSet,
  useDeleteSet,
  usePatchSetCoins,
  useRenameSet,
  useSetGaps,
  useSetsSummary,
  useUpdateSetMinGrade,
  useUserSets,
} from '@/lib/hooks/use-user-sets';
import {
  createSet,
  deleteSet,
  getCanonicalSetGaps,
  getSetGaps,
  getSetsSummary,
  getUserSets,
  patchSetCoins,
  renameSet,
  updateSetMinGrade,
} from '@/lib/user-sets-api';

vi.mock('@/lib/user-sets-api', () => ({
  getUserSets: vi.fn(),
  getSetsSummary: vi.fn(),
  createSet: vi.fn(),
  renameSet: vi.fn(),
  updateSetMinGrade: vi.fn(),
  deleteSet: vi.fn(),
  getSetGaps: vi.fn(),
  getCanonicalSetGaps: vi.fn(),
  patchSetCoins: vi.fn(),
}));

const getUserSetsMock = vi.mocked(getUserSets);
const getSetsSummaryMock = vi.mocked(getSetsSummary);
const createSetMock = vi.mocked(createSet);
const renameSetMock = vi.mocked(renameSet);
const updateSetMinGradeMock = vi.mocked(updateSetMinGrade);
const deleteSetMock = vi.mocked(deleteSet);
const getSetGapsMock = vi.mocked(getSetGaps);
const getCanonicalSetGapsMock = vi.mocked(getCanonicalSetGaps);
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
    grade: null,
  }));
  const ownedCount = slots.filter((s) => s.owned).length;
  return {
    setId,
    ownedCount,
    totalCount: slots.length,
    completionPercent: Math.round((ownedCount / slots.length) * 100),
    minGrade: null,
    slots,
  };
}

const SET = {
  id: 'u1',
  userId: 'user-1',
  name: 'My Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  minGrade: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('use-user-sets hooks', () => {
  beforeEach(() => {
    getUserSetsMock.mockReset();
    getSetsSummaryMock.mockReset();
    createSetMock.mockReset();
    renameSetMock.mockReset();
    updateSetMinGradeMock.mockReset();
    deleteSetMock.mockReset();
    getSetGapsMock.mockReset();
    getCanonicalSetGapsMock.mockReset();
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

  describe('run_20261018_105617 criterion 3/10: useSetsSummary wraps getSetsSummary under the user-sets key prefix', () => {
    const SUMMARY = {
      uniqueMissingCount: 6,
      collectionCount: 14,
      suggestedSet: { id: 'cs-1', name: 'Lincoln Cents', coinCount: 12, ownedCount: 3 },
    };

    it('calls getSetsSummary and exposes the resolved summary as data', async () => {
      getSetsSummaryMock.mockResolvedValue(SUMMARY as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetsSummary(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(SUMMARY);
      });
      expect(getSetsSummaryMock).toHaveBeenCalledTimes(1);
      expect(getUserSetsMock).not.toHaveBeenCalled();
    });

    it('stores the result under ["user-sets", "summary"], separate from the ["user-sets"] list', async () => {
      getSetsSummaryMock.mockResolvedValue(SUMMARY as never);
      getUserSetsMock.mockResolvedValue([SET] as never);
      const { queryClient, wrapper } = makeWrapper();

      const { result } = renderHook(() => ({ summary: useSetsSummary(), sets: useUserSets() }), { wrapper });

      await waitFor(() => {
        expect(result.current.summary.data).toEqual(SUMMARY);
        expect(result.current.sets.data).toEqual([SET]);
      });
      expect(queryClient.getQueryData(['user-sets', 'summary'])).toEqual(SUMMARY);
      expect(queryClient.getQueryData(['user-sets'])).toEqual([SET]);
    });

    it('refetches when the ["user-sets"] prefix is invalidated (how ownership changes refresh the dashboard)', async () => {
      getSetsSummaryMock.mockResolvedValueOnce(SUMMARY as never);
      getSetsSummaryMock.mockResolvedValueOnce({ ...SUMMARY, uniqueMissingCount: 5 } as never);
      const { queryClient, wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetsSummary(), { wrapper });
      await waitFor(() => {
        expect(result.current.data?.uniqueMissingCount).toBe(6);
      });

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['user-sets'] });
      });

      await waitFor(() => {
        expect(result.current.data?.uniqueMissingCount).toBe(5);
      });
      expect(getSetsSummaryMock).toHaveBeenCalledTimes(2);
    });

    it('exposes an error when getSetsSummary rejects', async () => {
      getSetsSummaryMock.mockRejectedValue(new ApiError(500, 'Internal server error'));
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useSetsSummary(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('criterion 2: useSetGaps wraps getSetGaps and is disabled for an empty id', () => {
    it('calls getSetGaps with the id and exposes the resolved GapViewResponse', async () => {
      const gaps = { setId: 'u1', ownedCount: 1, totalCount: 2, completionPercent: 50, minGrade: null, slots: [] };
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

  describe('run_20261109_220451 criterion 2: useCanonicalSetGaps wraps getCanonicalSetGaps', () => {
    it('calls getCanonicalSetGaps with the id and exposes the resolved GapViewResponse', async () => {
      const gaps = makeGaps('c1', ['coin-1']);
      getCanonicalSetGapsMock.mockResolvedValue(gaps);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useCanonicalSetGaps('c1'), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(gaps);
      });
      expect(getCanonicalSetGapsMock).toHaveBeenCalledTimes(1);
      expect(getCanonicalSetGapsMock).toHaveBeenCalledWith('c1');
      expect(getSetGapsMock).not.toHaveBeenCalled();
    });

    it('uses the id it is given', async () => {
      getCanonicalSetGapsMock.mockResolvedValue(makeGaps('c7', []));
      const { wrapper } = makeWrapper();

      renderHook(() => useCanonicalSetGaps('c7'), { wrapper });

      await waitFor(() => expect(getCanonicalSetGapsMock).toHaveBeenCalledWith('c7'));
      expect(getCanonicalSetGapsMock).not.toHaveBeenCalledWith('c1');
    });

    it('makes no request when enabled is false', async () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCanonicalSetGaps('c1', { enabled: false }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetGapsMock).not.toHaveBeenCalled();
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('starts requesting once enabled flips from false to true', async () => {
      getCanonicalSetGapsMock.mockResolvedValue(makeGaps('c1', ['coin-1', 'coin-2']));
      const { wrapper } = makeWrapper();
      const { result, rerender } = renderHook(({ enabled }) => useCanonicalSetGaps('c1', { enabled }), {
        wrapper,
        initialProps: { enabled: false },
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetGapsMock).not.toHaveBeenCalled();

      rerender({ enabled: true });

      await waitFor(() => expect(result.current.data?.ownedCount).toBe(2));
      expect(getCanonicalSetGapsMock).toHaveBeenCalledTimes(1);
    });

    it('makes no request for an empty id, even when enabled', async () => {
      const { wrapper } = makeWrapper();
      renderHook(() => useCanonicalSetGaps('', { enabled: true }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetGapsMock).not.toHaveBeenCalled();
    });

    it('is enabled by default when no options are passed', async () => {
      getCanonicalSetGapsMock.mockResolvedValue(makeGaps('c1', []));
      const { wrapper } = makeWrapper();

      renderHook(() => useCanonicalSetGaps('c1'), { wrapper });

      await waitFor(() => expect(getCanonicalSetGapsMock).toHaveBeenCalledTimes(1));
    });

    it('stores the result under ["user-sets", "canonical", id, "gaps"]', async () => {
      const gaps = makeGaps('c1', ['coin-1']);
      getCanonicalSetGapsMock.mockResolvedValue(gaps);
      const { queryClient, wrapper } = makeWrapper();

      const { result } = renderHook(() => useCanonicalSetGaps('c1'), { wrapper });

      await waitFor(() => expect(result.current.data).toEqual(gaps));
      expect(queryClient.getQueryData(['user-sets', 'canonical', 'c1', 'gaps'])).toEqual(gaps);
      expect(queryClient.getQueryData(['user-sets', 'c1', 'gaps'])).toBeUndefined();
    });

    it('refetches when the ["user-sets"] prefix is invalidated (how an ownership change refreshes the progress)', async () => {
      getCanonicalSetGapsMock.mockResolvedValueOnce(makeGaps('c1', ['coin-1']));
      getCanonicalSetGapsMock.mockResolvedValueOnce(makeGaps('c1', ['coin-1', 'coin-2']));
      const { queryClient, wrapper } = makeWrapper();

      const { result } = renderHook(() => useCanonicalSetGaps('c1'), { wrapper });
      await waitFor(() => expect(result.current.data?.ownedCount).toBe(1));

      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: ['user-sets'] });
      });

      await waitFor(() => expect(result.current.data?.ownedCount).toBe(2));
      expect(getCanonicalSetGapsMock).toHaveBeenCalledTimes(2);
    });

    it('exposes an error when getCanonicalSetGaps rejects', async () => {
      getCanonicalSetGapsMock.mockRejectedValue(new ApiError(500, 'Internal server error'));
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useCanonicalSetGaps('c1'), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
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

  describe('run_20261103_192441 criterion 2/3/9: useUpdateSetMinGrade', () => {
    it('calls updateSetMinGrade with the id and the grade code', async () => {
      updateSetMinGradeMock.mockResolvedValue({ ...SET, minGrade: 'VF' } as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'VF' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateSetMinGradeMock).toHaveBeenCalledTimes(1);
      expect(updateSetMinGradeMock).toHaveBeenCalledWith('u1', 'VF');
    });

    it('passes null through to clear the minimum grade, and uses the id it is given', async () => {
      updateSetMinGradeMock.mockResolvedValue(SET as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u9', minGrade: null });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(updateSetMinGradeMock).toHaveBeenCalledWith('u9', null);
    });

    it('invalidates ["user-sets"] and ["public-sets", id] on success', async () => {
      updateSetMinGradeMock.mockResolvedValue({ ...SET, minGrade: 'XF' } as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'XF' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['user-sets'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public-sets', 'u1'] });
    });

    it('invalidates the public-set key of the mutated id, not a fixed one', async () => {
      updateSetMinGradeMock.mockResolvedValue(SET as never);
      const { queryClient, wrapper } = makeWrapper();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u7', minGrade: 'G' });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['public-sets', 'u7'] });
      expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['public-sets', 'u1'] });
    });

    it('stays pending until the gap view has been refetched', async () => {
      const firstGaps = { ...makeGaps('u1', ['coin-1']), minGrade: null };
      const secondGaps = { ...makeGaps('u1', ['coin-1']), minGrade: 'VF' as const, upgradeCount: 1 };
      const refetch = deferred<GapViewResponse>();
      getSetGapsMock.mockResolvedValueOnce(firstGaps as never);
      getSetGapsMock.mockReturnValueOnce(refetch.promise as never);
      updateSetMinGradeMock.mockResolvedValue({ ...SET, minGrade: 'VF' } as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => ({ gaps: useSetGaps('u1'), save: useUpdateSetMinGrade() }), { wrapper });
      await waitFor(() => expect(result.current.gaps.data).toEqual(firstGaps));

      act(() => {
        result.current.save.mutate({ id: 'u1', minGrade: 'VF' });
      });

      // the PATCH has resolved and the refetch has started, but the mutation is not done yet
      await waitFor(() => expect(getSetGapsMock).toHaveBeenCalledTimes(2));
      expect(updateSetMinGradeMock).toHaveBeenCalledTimes(1);
      expect(result.current.save.isPending).toBe(true);
      expect(result.current.save.isSuccess).toBe(false);

      await act(async () => {
        refetch.resolve(secondGaps as never);
      });

      await waitFor(() => expect(result.current.save.isSuccess).toBe(true));
      expect(result.current.save.isPending).toBe(false);
      expect(result.current.gaps.data?.minGrade).toBe('VF');
    });

    it('exposes the variables while pending (the page shows the pending value from them)', async () => {
      const request = deferred<never>();
      updateSetMinGradeMock.mockReturnValue(request.promise);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'AU' });
      });

      await waitFor(() => expect(result.current.isPending).toBe(true));
      expect(result.current.variables).toEqual({ id: 'u1', minGrade: 'AU' });

      request.resolve(SET as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('is not optimistic: the cached gap view is untouched while the request is in flight', async () => {
      const request = deferred<never>();
      updateSetMinGradeMock.mockReturnValue(request.promise);
      const { queryClient, wrapper } = makeWrapper();
      const before = makeGaps('u1', ['coin-1']);
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], before);

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'VF' });
      });
      await waitFor(() => expect(updateSetMinGradeMock).toHaveBeenCalledTimes(1));

      expect(queryClient.getQueryData(['user-sets', 'u1', 'gaps'])).toEqual(before);

      request.resolve(SET as never);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it('on failure: surfaces the error, invalidates nothing and leaves the cached gap view as it was', async () => {
      updateSetMinGradeMock.mockRejectedValue(new ApiError(500, 'Internal server error'));
      const { queryClient, wrapper } = makeWrapper();
      const before = makeGaps('u1', ['coin-1']);
      queryClient.setQueryData(['user-sets', 'u1', 'gaps'], before);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'VF' });
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(invalidateSpy).not.toHaveBeenCalled();
      expect(queryClient.getQueryData(['user-sets', 'u1', 'gaps'])).toEqual(before);
      expect(result.current.isPending).toBe(false);
    });

    it('calls the per-call onError callback on failure and onSuccess on success', async () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useUpdateSetMinGrade(), { wrapper });

      updateSetMinGradeMock.mockRejectedValueOnce(new ApiError(403, 'Forbidden'));
      const onError = vi.fn();
      const onSuccess = vi.fn();
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'VF' }, { onError, onSuccess });
      });
      await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
      expect(onSuccess).not.toHaveBeenCalled();

      updateSetMinGradeMock.mockResolvedValueOnce({ ...SET, minGrade: 'VF' } as never);
      act(() => {
        result.current.mutate({ id: 'u1', minGrade: 'VF' }, { onError, onSuccess });
      });
      await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
      expect(onError).toHaveBeenCalledTimes(1);
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
