/**
 * Tests for: use-catalog hooks
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: use-catalog hooks
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/lib/hooks/use-catalog.ts (MODIFY)
 *                   runs/run_20260731_132040/plan.md § Interface Contract → Hook: useMySubmissions (CREATE)
 * Covers criteria: #2 (from run_20260721_131640's prd.md), #3 (from run_20260725_140648's prd.md),
 *                  #6 (from run_20260731_132040's prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCatalog, useCoin, useMySubmissions, useSubmitCoin } from '@/lib/hooks/use-catalog';
import { getCatalog, getCoin, submitCoin } from '@/lib/catalog-api';

vi.mock('@/lib/catalog-api', () => ({
  getCatalog: vi.fn(),
  getCoin: vi.fn(),
  submitCoin: vi.fn(),
}));

const getCatalogMock = vi.mocked(getCatalog);
const getCoinMock = vi.mocked(getCoin);
const submitCoinMock = vi.mocked(submitCoin);

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('use-catalog hooks', () => {
  beforeEach(() => {
    getCatalogMock.mockReset();
    getCoinMock.mockReset();
    submitCoinMock.mockReset();
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

  describe('run_20260725_140648 criterion 3: useSubmitCoin wraps submitCoin', () => {
    it('calls submitCoin with the payload and exposes the resolved coin', async () => {
      const created = { id: 'new-1', status: 'pending' };
      submitCoinMock.mockResolvedValue(created as never);
      const payload = { country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 };

      const { result } = renderHook(() => useSubmitCoin(), { wrapper });
      result.current.mutate(payload);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(submitCoinMock).toHaveBeenCalledWith(payload);
      expect(result.current.data).toEqual(created);
    });

    it('surfaces an error state when submitCoin rejects (e.g. a 409 conflict)', async () => {
      submitCoinMock.mockRejectedValue(new Error('A coin with this natural key already exists'));

      const { result } = renderHook(() => useSubmitCoin(), { wrapper });
      result.current.mutate({ country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('does not call getCatalog on success — a pending coin must not trigger a catalog list refetch (criterion #8)', async () => {
      submitCoinMock.mockResolvedValue({ id: 'new-1', status: 'pending' } as never);

      const { result } = renderHook(() => useSubmitCoin(), { wrapper });
      result.current.mutate({ country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(getCatalogMock).not.toHaveBeenCalled();
    });
  });

  describe('run_20260731_132040 criterion 6: useMySubmissions wraps getCatalog with submittedByMe: true', () => {
    it('calls getCatalog with { submittedByMe: true } and exposes the resolved data', async () => {
      const page = {
        items: [
          { id: 'pending-1', status: 'pending' },
          { id: 'approved-1', status: 'approved' },
        ],
        page: 1,
        limit: 20,
        total: 2,
      };
      getCatalogMock.mockResolvedValue(page as never);

      const { result } = renderHook(() => useMySubmissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(page);
      });
      expect(getCatalogMock).toHaveBeenCalledWith({ submittedByMe: true });
    });

    it('surfaces an error state when getCatalog rejects', async () => {
      getCatalogMock.mockRejectedValue(new Error('network down'));

      const { result } = renderHook(() => useMySubmissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('uses a distinct query key from the plain catalog browse cache (["catalog", "mine"])', async () => {
      getCatalogMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 } as never);

      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      function localWrapper({ children }: { children: React.ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
      }

      renderHook(() => useMySubmissions(), { wrapper: localWrapper });

      await waitFor(() => expect(getCatalogMock).toHaveBeenCalledTimes(1));

      expect(queryClient.getQueryData(['catalog', 'mine'])).toEqual({ items: [], page: 1, limit: 20, total: 0 });
    });
  });
});
