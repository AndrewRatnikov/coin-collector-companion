/**
 * Tests for: use-canonical-sets hooks
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: use-canonical-sets hooks
 * Covers criteria: #7 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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
});
