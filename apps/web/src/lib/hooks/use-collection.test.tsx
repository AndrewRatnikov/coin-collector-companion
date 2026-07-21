/**
 * Tests for: use-collection hooks
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: use-collection.ts (CREATE)
 * Covers criteria: #3, #6, #8 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { getCollection, setOwnership } from '@/lib/collection-api';

vi.mock('@/lib/collection-api', () => ({
  getCollection: vi.fn(),
  setOwnership: vi.fn(),
}));

const getCollectionMock = vi.mocked(getCollection);
const setOwnershipMock = vi.mocked(setOwnership);

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
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const OWNERSHIP_ITEM = { coinId: 'coin-1', coin: COIN, ownedAt: new Date('2026-01-02T00:00:00.000Z') };

describe('use-collection hooks', () => {
  beforeEach(() => {
    getCollectionMock.mockReset();
    setOwnershipMock.mockReset();
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
});
