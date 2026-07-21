/**
 * Tests for: use-catalog hooks
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: use-catalog hooks
 * Covers criteria: #2 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCatalog, useCoin } from '@/lib/hooks/use-catalog';
import { getCatalog, getCoin } from '@/lib/catalog-api';

vi.mock('@/lib/catalog-api', () => ({
  getCatalog: vi.fn(),
  getCoin: vi.fn(),
}));

const getCatalogMock = vi.mocked(getCatalog);
const getCoinMock = vi.mocked(getCoin);

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('use-catalog hooks', () => {
  beforeEach(() => {
    getCatalogMock.mockReset();
    getCoinMock.mockReset();
  });

  describe('criterion 2: useCatalog wraps getCatalog with the given filters', () => {
    it('calls getCatalog with the filters object and exposes the resolved data', async () => {
      const page = { items: [{ id: 'c1' }], page: 1, limit: 20, total: 1 };
      getCatalogMock.mockResolvedValue(page as never);

      const { result } = renderHook(() => useCatalog({ country: 'USA' }), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(page);
      });
      expect(getCatalogMock).toHaveBeenCalledWith({ country: 'USA' });
    });

    it('issues a separate underlying call when the filters object changes', async () => {
      getCatalogMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 } as never);

      const { rerender } = renderHook(({ filters }) => useCatalog(filters), {
        wrapper,
        initialProps: { filters: { country: 'USA' } },
      });

      await waitFor(() => expect(getCatalogMock).toHaveBeenCalledTimes(1));

      rerender({ filters: { country: 'Canada' } });

      await waitFor(() => expect(getCatalogMock).toHaveBeenCalledTimes(2));
      expect(getCatalogMock).toHaveBeenNthCalledWith(2, { country: 'Canada' });
    });

    it('surfaces an error state when getCatalog rejects', async () => {
      getCatalogMock.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useCatalog({}), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });
  });

  describe('criterion 2: useCoin wraps getCoin and is disabled for an empty id', () => {
    it('calls getCoin with the id and exposes the resolved coin', async () => {
      const coin = { id: 'coin-1', country: 'USA' };
      getCoinMock.mockResolvedValue(coin as never);

      const { result } = renderHook(() => useCoin('coin-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(coin);
      });
      expect(getCoinMock).toHaveBeenCalledWith('coin-1');
    });

    it('does not call getCoin when id is an empty string', async () => {
      renderHook(() => useCoin(''), { wrapper });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(getCoinMock).not.toHaveBeenCalled();
    });
  });
});
