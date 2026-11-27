/**
 * Tests for: use-public-sets hooks
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Module: use-public-sets hooks
 *                   runs/run_20261127_120807/plan.md § Interface Contract → Hooks (modified)
 * Covers criteria: #3 (from prd.md), #1 (from run_20261127_120807's prd.md: initialData, no refetch)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePublicSet, usePublicSets } from '@/lib/hooks/use-public-sets';
import { getPublicSet, getPublicSets } from '@/lib/public-sets-api';

vi.mock('@/lib/public-sets-api', () => ({
  getPublicSets: vi.fn(),
  getPublicSet: vi.fn(),
}));

const getPublicSetsMock = vi.mocked(getPublicSets);
const getPublicSetMock = vi.mocked(getPublicSet);

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('use-public-sets hooks', () => {
  beforeEach(() => {
    getPublicSetsMock.mockReset();
    getPublicSetMock.mockReset();
  });

  describe('criterion 3: usePublicSets wraps getPublicSets', () => {
    it('exposes the resolved PaginatedResponse as data and passes filters through', async () => {
      const body = { items: [], page: 1, limit: 20, total: 0 };
      getPublicSetsMock.mockResolvedValue(body as never);

      const { result } = renderHook(() => usePublicSets({ page: 1, limit: 20 }), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(body);
      });
      expect(getPublicSetsMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  describe('criterion 3: usePublicSet wraps getPublicSet and is disabled for an empty id', () => {
    it('calls getPublicSet with the id and exposes the resolved detail', async () => {
      const detail = {
        id: 'u1',
        userId: 'user-1',
        name: 'Public Set',
        clonedFromCanonicalId: null,
        clonedFromUserSetId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        coins: [],
      };
      getPublicSetMock.mockResolvedValue(detail as never);

      const { result } = renderHook(() => usePublicSet('u1'), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(detail);
      });
      expect(getPublicSetMock).toHaveBeenCalledWith('u1');
    });

    it('does not call getPublicSet when id is an empty string', async () => {
      renderHook(() => usePublicSet(''), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getPublicSetMock).not.toHaveBeenCalled();
    });
  });

  describe('run_20261127_120807: usePublicSet initialData from the server render, no refetch', () => {
    const serverDetail = {
      id: 'u1',
      userId: 'user-1',
      name: 'Server set',
      clonedFromCanonicalId: null,
      clonedFromUserSetId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      coins: [],
    };

    it('returns the initial data immediately and never calls getPublicSet, also after a window focus', async () => {
      getPublicSetMock.mockResolvedValue({ ...serverDetail, name: 'Fetched' } as never);

      const { result } = renderHook(() => usePublicSet('u1', { initialData: serverDetail as never }), { wrapper });

      expect(result.current.data).toEqual(serverDetail);
      expect(result.current.isLoading).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      act(() => {
        focusManager.setFocused(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getPublicSetMock).not.toHaveBeenCalled();
      expect(result.current.data?.name).toBe('Server set');
    });

    it('without initialData the API function is still called (the fallback is the existing query)', async () => {
      getPublicSetMock.mockResolvedValue({ ...serverDetail, name: 'Fetched' } as never);

      const { result } = renderHook(() => usePublicSet('u1', {}), { wrapper });

      await waitFor(() => {
        expect(result.current.data?.name).toBe('Fetched');
      });
      expect(getPublicSetMock).toHaveBeenCalledWith('u1');
    });

    it('with initialData it still stays disabled for an empty id', async () => {
      renderHook(() => usePublicSet('', { initialData: serverDetail as never }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getPublicSetMock).not.toHaveBeenCalled();
    });
  });
});
