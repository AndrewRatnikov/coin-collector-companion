/**
 * Tests for: useSetOwnership and useBulkSetOwnership analytics (coins_marked_owned)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * A real QueryClient; only the network wrapper (@/lib/collection-api) and track (@/lib/analytics) are
 * mocked. Requests are deferred promises so the tests can look at track while a request is in flight.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useBulkSetOwnership, useSetOwnership } from '@/lib/hooks/use-collection';
import { getCollection, setOwnership, setOwnershipBulk } from '@/lib/collection-api';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/collection-api', () => ({
  getCollection: vi.fn(),
  setOwnership: vi.fn(),
  setOwnershipBulk: vi.fn(),
}));

const trackMock = vi.mocked(track);
const getCollectionMock = vi.mocked(getCollection);
const setOwnershipMock = vi.mocked(setOwnership);
const setOwnershipBulkMock = vi.mocked(setOwnershipBulk);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

beforeEach(() => {
  trackMock.mockClear();
  getCollectionMock.mockReset();
  setOwnershipMock.mockReset();
  setOwnershipBulkMock.mockReset();
});

describe('useSetOwnership analytics', () => {
  it('tracks one toggle event after the request resolves, and not while it is pending', async () => {
    const request = deferred<never>();
    setOwnershipMock.mockReturnValue(request.promise);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true });
    });
    await waitFor(() => expect(setOwnershipMock).toHaveBeenCalledWith('coin-1', true));
    expect(result.current.isPending).toBe(true);
    expect(trackMock).not.toHaveBeenCalled();

    request.resolve({ coinId: 'coin-1', owned: true, ownedAt: new Date(), grade: null } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('coins_marked_owned', { via: 'toggle', count: 1 });
  });

  it('tracks nothing when a coin is marked missing', async () => {
    setOwnershipMock.mockResolvedValue({ coinId: 'coin-1', owned: false, ownedAt: null, grade: null } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the request fails and the optimistic change rolls back', async () => {
    setOwnershipMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinId: 'coin-1', owned: true });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe('useBulkSetOwnership analytics', () => {
  it('tracks the number of coins marked owned in one bulk call', async () => {
    const request = deferred<never>();
    setOwnershipBulkMock.mockReturnValue(request.promise);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2', 'coin-3'], owned: true });
    });
    await waitFor(() => expect(setOwnershipBulkMock).toHaveBeenCalledTimes(1));
    expect(trackMock).not.toHaveBeenCalled();

    request.resolve({ coinIds: ['coin-1', 'coin-2', 'coin-3'], owned: true } as never);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('coins_marked_owned', { via: 'bulk', count: 3 });
  });

  it('counts what was sent: two coins give count 2', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-1', 'coin-2'], owned: true } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).toHaveBeenCalledWith('coins_marked_owned', { via: 'bulk', count: 2 });
  });

  it('tracks nothing when marking coins missing', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: ['coin-2'], owned: false } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinIds: ['coin-2'], owned: false });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the request fails', async () => {
    setOwnershipBulkMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinIds: ['coin-1', 'coin-2'], owned: true });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing for an empty coin list', async () => {
    setOwnershipBulkMock.mockResolvedValue({ coinIds: [], owned: true } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useBulkSetOwnership(), { wrapper });

    act(() => {
      result.current.mutate({ coinIds: [], owned: true });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });
});
