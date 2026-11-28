/**
 * Tests for: useCatalog and useCoin initialData options (apps/web/src/lib/hooks/use-catalog.ts)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Hooks: use-catalog (MODIFY)
 * Covers criteria: #3, #12 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCatalog, useCoin } from '@/lib/hooks/use-catalog';
import { getCatalog, getCoin } from '@/lib/catalog-api';

vi.mock('@/lib/catalog-api', () => ({
  getCatalog: vi.fn(),
  getCatalogFacets: vi.fn(),
  getCoin: vi.fn(),
  submitCoin: vi.fn(),
}));

const getCatalogMock = vi.mocked(getCatalog);
const getCoinMock = vi.mocked(getCoin);

const FILTERS = { page: 1, limit: 20 };
const SERVER_PAGE = { items: [{ id: 'c1' }], page: 1, limit: 20, total: 1 };
const SERVER_COIN = { id: 'coin-1', name: 'Server coin' };

let queryClient: QueryClient;

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  act(() => {
    focusManager.setFocused(true);
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  getCatalogMock.mockReset();
  getCoinMock.mockReset();
});

describe('useCatalog with initialData', () => {
  it('returns the initial data immediately and never calls getCatalog, even after a window focus', async () => {
    getCatalogMock.mockResolvedValue({ items: [], page: 1, limit: 20, total: 0 } as never);

    const { result } = renderHook(() => useCatalog(FILTERS, { initialData: SERVER_PAGE as never }), { wrapper });

    expect(result.current.data).toEqual(SERVER_PAGE);
    expect(result.current.isLoading).toBe(false);
    await settle();
    expect(getCatalogMock).not.toHaveBeenCalled();
    expect(result.current.data).toEqual(SERVER_PAGE);
  });

  it('keeps the query key (the server page sits under [catalog, filters])', () => {
    renderHook(() => useCatalog(FILTERS, { initialData: SERVER_PAGE as never }), { wrapper });

    expect(queryClient.getQueryData(['catalog', FILTERS])).toEqual(SERVER_PAGE);
  });

  it('reflects other initial data (not hard-coded)', () => {
    const other = { items: [{ id: 'c9' }, { id: 'c8' }], page: 2, limit: 20, total: 22 };

    const { result } = renderHook(() => useCatalog({ page: 2, limit: 20 }, { initialData: other as never }), {
      wrapper,
    });

    expect(result.current.data).toEqual(other);
  });

  it.each([
    ['no options', undefined],
    ['empty options', {}],
    ['initialData: undefined', { initialData: undefined }],
  ])('fetches as before with %s', async (_label, options) => {
    getCatalogMock.mockResolvedValue(SERVER_PAGE as never);

    const { result } = renderHook(() => useCatalog(FILTERS, options), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual(SERVER_PAGE);
    });
    expect(getCatalogMock).toHaveBeenCalledTimes(1);
    expect(getCatalogMock).toHaveBeenCalledWith(FILTERS);
  });

  it('still fetches other filters (initial data belongs to its own key only)', async () => {
    getCatalogMock.mockResolvedValue({ items: [{ id: 'c2' }], page: 2, limit: 20, total: 21 } as never);

    const { result, rerender } = renderHook(
      ({ filters }: { filters: { page: number; limit: number } }) =>
        useCatalog(filters, filters.page === 1 ? { initialData: SERVER_PAGE as never } : undefined),
      { wrapper, initialProps: { filters: FILTERS } },
    );
    expect(result.current.data).toEqual(SERVER_PAGE);

    rerender({ filters: { page: 2, limit: 20 } });

    await waitFor(() => {
      expect(getCatalogMock).toHaveBeenCalledWith({ page: 2, limit: 20 });
    });
    await waitFor(() => {
      expect(result.current.data).toMatchObject({ page: 2 });
    });
  });
});

describe('useCoin with initialData', () => {
  it('returns the initial data immediately and never calls getCoin, even after a window focus', async () => {
    getCoinMock.mockResolvedValue({ ...SERVER_COIN, name: 'Fetched' } as never);

    const { result } = renderHook(() => useCoin('coin-1', { initialData: SERVER_COIN as never }), { wrapper });

    expect(result.current.data).toEqual(SERVER_COIN);
    expect(result.current.isLoading).toBe(false);
    await settle();
    expect(getCoinMock).not.toHaveBeenCalled();
    expect(result.current.data).toMatchObject({ name: 'Server coin' });
  });

  it('keeps the query key', () => {
    renderHook(() => useCoin('coin-1', { initialData: SERVER_COIN as never }), { wrapper });

    expect(queryClient.getQueryData(['catalog', 'coin', 'coin-1'])).toEqual(SERVER_COIN);
  });

  it.each([
    ['no options', undefined],
    ['empty options', {}],
  ])('fetches as before with %s', async (_label, options) => {
    getCoinMock.mockResolvedValue({ ...SERVER_COIN, name: 'Fetched' } as never);

    const { result } = renderHook(() => useCoin('coin-1', options), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toMatchObject({ name: 'Fetched' });
    });
    expect(getCoinMock).toHaveBeenCalledWith('coin-1');
  });

  it('stays disabled for an empty id even with initial data', async () => {
    renderHook(() => useCoin('', { initialData: SERVER_COIN as never }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getCoinMock).not.toHaveBeenCalled();
  });
});
