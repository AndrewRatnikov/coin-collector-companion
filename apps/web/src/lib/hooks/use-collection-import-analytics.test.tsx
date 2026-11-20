/**
 * Tests for: useConfirmImport analytics (coins_marked_owned via import)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #11 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { confirmImport } from '@/lib/collection-import-api';
import { useConfirmImport } from '@/lib/hooks/use-collection-import';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

vi.mock('@/lib/collection-import-api', () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}));

const trackMock = vi.mocked(track);
const confirmImportMock = vi.mocked(confirmImport);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { wrapper };
}

describe('useConfirmImport analytics', () => {
  beforeEach(() => {
    trackMock.mockClear();
    confirmImportMock.mockReset();
  });

  it('tracks the number of rows actually created', async () => {
    confirmImportMock.mockResolvedValue({ requested: 4, created: 3, alreadyOwned: 1 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ coinIds: ['c1', 'c2', 'c3', 'c4'] });
    });

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('coins_marked_owned', { via: 'import', count: 3 });
  });

  it('uses the response count, not the request size', async () => {
    confirmImportMock.mockResolvedValue({ requested: 2, created: 2, alreadyOwned: 0 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ coinIds: ['c1', 'c2'] });
    });

    expect(trackMock).toHaveBeenCalledWith('coins_marked_owned', { via: 'import', count: 2 });
  });

  it('tracks nothing when no coin was created', async () => {
    confirmImportMock.mockResolvedValue({ requested: 2, created: 0, alreadyOwned: 2 });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ coinIds: ['c1', 'c2'] });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the import fails', async () => {
    confirmImportMock.mockRejectedValue(new ApiError(500, 'boom'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ coinIds: ['c1'] }).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(trackMock).not.toHaveBeenCalled();
  });
});
