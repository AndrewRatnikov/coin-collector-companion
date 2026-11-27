/**
 * Tests for: use-canonical-sets hooks
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: use-canonical-sets hooks
 *                   runs/run_20261127_120807/plan.md § Interface Contract → Hooks (modified)
 * Covers criteria: #7 (from prd.md), #1 (from run_20261127_120807's prd.md: initialData, no refetch)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCanonicalSet, useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { getCanonicalSet, getCanonicalSets } from '@/lib/canonical-sets-api';

vi.mock('@/lib/canonical-sets-api', () => ({
  getCanonicalSets: vi.fn(),
  getCanonicalSet: vi.fn(),
}));

const getCanonicalSetsMock = vi.mocked(getCanonicalSets);
const getCanonicalSetMock = vi.mocked(getCanonicalSet);

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('use-canonical-sets hooks', () => {
  beforeEach(() => {
    getCanonicalSetsMock.mockReset();
    getCanonicalSetMock.mockReset();
  });

  describe('criterion 7: useCanonicalSets wraps getCanonicalSets', () => {
    it('exposes the resolved CanonicalSetSummary[] as data', async () => {
      const sets = [{ id: 's1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1' }];
      getCanonicalSetsMock.mockResolvedValue(sets as never);

      const { result } = renderHook(() => useCanonicalSets(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(sets);
      });
      expect(getCanonicalSetsMock).toHaveBeenCalledTimes(1);
    });

    it('surfaces an error state when getCanonicalSets rejects', async () => {
      getCanonicalSetsMock.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useCanonicalSets(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('criterion 7: useCanonicalSet wraps getCanonicalSet and is disabled for an empty id', () => {
    it('calls getCanonicalSet with the id and exposes the resolved detail', async () => {
      const detail = { id: 's1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1', coins: [] };
      getCanonicalSetMock.mockResolvedValue(detail as never);

      const { result } = renderHook(() => useCanonicalSet('s1'), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(detail);
      });
      expect(getCanonicalSetMock).toHaveBeenCalledWith('s1');
    });

    it('does not call getCanonicalSet when id is an empty string', async () => {
      renderHook(() => useCanonicalSet(''), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetMock).not.toHaveBeenCalled();
    });
  });

  describe('run_20261127_120807: initialData from the server render, no refetch', () => {
    const serverSets = [
      { id: 's1', name: 'Server list', description: null, source: 'seed-template', templateVersion: 'v1' },
    ];
    const serverDetail = {
      id: 's1',
      name: 'Server detail',
      description: null,
      source: 'seed-template',
      templateVersion: 'v1',
      coins: [],
    };

    it('useCanonicalSets returns the initial data immediately and never calls getCanonicalSets', async () => {
      getCanonicalSetsMock.mockResolvedValue([] as never);

      const { result } = renderHook(() => useCanonicalSets({ initialData: serverSets as never }), { wrapper });

      expect(result.current.data).toEqual(serverSets);
      expect(result.current.isLoading).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      act(() => {
        focusManager.setFocused(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetsMock).not.toHaveBeenCalled();
      expect(result.current.data).toEqual(serverSets);
    });

    it('useCanonicalSet returns the initial data immediately and never calls getCanonicalSet', async () => {
      getCanonicalSetMock.mockResolvedValue({ ...serverDetail, name: 'Fetched' } as never);

      const { result } = renderHook(() => useCanonicalSet('s1', { initialData: serverDetail as never }), {
        wrapper,
      });

      expect(result.current.data).toEqual(serverDetail);
      expect(result.current.isLoading).toBe(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
      act(() => {
        focusManager.setFocused(true);
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetMock).not.toHaveBeenCalled();
      expect(result.current.data?.name).toBe('Server detail');
    });

    it('without initialData the API functions are still called (the fallback is the existing query)', async () => {
      getCanonicalSetMock.mockResolvedValue({ ...serverDetail, name: 'Fetched' } as never);
      getCanonicalSetsMock.mockResolvedValue([] as never);

      const detail = renderHook(() => useCanonicalSet('s1', {}), { wrapper });
      const list = renderHook(() => useCanonicalSets({}), { wrapper });

      await waitFor(() => {
        expect(detail.result.current.data?.name).toBe('Fetched');
      });
      await waitFor(() => {
        expect(list.result.current.data).toEqual([]);
      });
      expect(getCanonicalSetMock).toHaveBeenCalledWith('s1');
      expect(getCanonicalSetsMock).toHaveBeenCalledTimes(1);
    });

    it('useCanonicalSet with initialData still stays disabled for an empty id', async () => {
      renderHook(() => useCanonicalSet('', { initialData: serverDetail as never }), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCanonicalSetMock).not.toHaveBeenCalled();
    });
  });
});
