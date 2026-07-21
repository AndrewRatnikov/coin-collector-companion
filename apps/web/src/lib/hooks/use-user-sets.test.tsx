/**
 * Tests for: use-user-sets hooks
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Module: use-user-sets hooks
 * Covers criteria: #3 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateSet, useDeleteSet, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { createSet, deleteSet, getSetGaps, getUserSets, renameSet } from '@/lib/user-sets-api';

vi.mock('@/lib/user-sets-api', () => ({
  getUserSets: vi.fn(),
  createSet: vi.fn(),
  renameSet: vi.fn(),
  deleteSet: vi.fn(),
  getSetGaps: vi.fn(),
}));

const getUserSetsMock = vi.mocked(getUserSets);
const createSetMock = vi.mocked(createSet);
const renameSetMock = vi.mocked(renameSet);
const deleteSetMock = vi.mocked(deleteSet);
const getSetGapsMock = vi.mocked(getSetGaps);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
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
  });

  describe('criterion 3: useUserSets wraps getUserSets', () => {
    it('exposes the resolved UserSetSummary[] as data', async () => {
      getUserSetsMock.mockResolvedValue([SET] as never);
      const { wrapper } = makeWrapper();

      const { result } = renderHook(() => useUserSets(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual([SET]);
      });
      expect(getUserSetsMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('criterion 3: useSetGaps wraps getSetGaps and is disabled for an empty id', () => {
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

  describe('criterion 3: useCreateSet invalidates user-sets on success', () => {
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

  describe('criterion 3: useRenameSet invalidates user-sets on success', () => {
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

  describe('criterion 3: useDeleteSet invalidates user-sets on success', () => {
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
});
