/**
 * Tests for: use-collection-import hooks (usePreviewImport, useConfirmImport)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Web: use-collection-import.ts)
 * Covers criteria: #27 (cache invalidation), #3 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ImportConfirmResponse, ImportPreviewResponse } from '@coin-collector/shared';
import { confirmImport, previewImport } from '@/lib/collection-import-api';
import { useConfirmImport, usePreviewImport } from '@/lib/hooks/use-collection-import';

vi.mock('@/lib/collection-import-api', () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}));

const previewImportMock = vi.mocked(previewImport);
const confirmImportMock = vi.mocked(confirmImport);

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  return { queryClient, wrapper };
}

const PREVIEW_RESPONSE: ImportPreviewResponse = {
  headers: ['Year'],
  delimiter: ',',
  mapping: { year: 0 },
  rows: [],
  summary: {
    total: 0,
    matched: 0,
    alreadyOwned: 0,
    duplicateInFile: 0,
    ambiguous: 0,
    unmatched: 0,
    invalid: 0,
    toImport: 0,
  },
};

const CONFIRM_RESPONSE: ImportConfirmResponse = { requested: 1, created: 1, alreadyOwned: 0 };

describe('usePreviewImport', () => {
  beforeEach(() => {
    previewImportMock.mockReset();
    confirmImportMock.mockReset();
  });

  it('calls previewImport(file, mapping) and exposes the response', async () => {
    previewImportMock.mockResolvedValue(PREVIEW_RESPONSE);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePreviewImport(), { wrapper });
    const file = new File(['a'], 'a.csv', { type: 'text/csv' });
    const mapping = { year: 1, country: 0, denomination: 2 };

    await act(async () => {
      await result.current.mutateAsync({ file, mapping });
    });

    expect(previewImportMock).toHaveBeenCalledTimes(1);
    expect(previewImportMock).toHaveBeenCalledWith(file, mapping);
    await waitFor(() => {
      expect(result.current.data).toEqual(PREVIEW_RESPONSE);
    });
  });

  it('calls previewImport with no mapping for the first preview', async () => {
    previewImportMock.mockResolvedValue(PREVIEW_RESPONSE);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePreviewImport(), { wrapper });
    const file = new File(['b'], 'b.csv', { type: 'text/csv' });

    await act(async () => {
      await result.current.mutateAsync({ file });
    });

    expect(previewImportMock).toHaveBeenCalledWith(file, undefined);
  });

  it('surfaces a rejection as an error state', async () => {
    previewImportMock.mockRejectedValue(new Error('IMPORT_EMPTY'));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePreviewImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ file: new File([''], 'c.csv') }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('does not invalidate any query (preview is read-only)', async () => {
    previewImportMock.mockResolvedValue(PREVIEW_RESPONSE);
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => usePreviewImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ file: new File(['a'], 'a.csv') });
    });

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('useConfirmImport', () => {
  beforeEach(() => {
    previewImportMock.mockReset();
    confirmImportMock.mockReset();
  });

  it('calls confirmImport with the coin ids and exposes the response', async () => {
    confirmImportMock.mockResolvedValue(CONFIRM_RESPONSE);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(['coin-1', 'coin-2']);
    });

    expect(confirmImportMock).toHaveBeenCalledTimes(1);
    expect(confirmImportMock).toHaveBeenCalledWith(['coin-1', 'coin-2']);
    await waitFor(() => {
      expect(result.current.data).toEqual(CONFIRM_RESPONSE);
    });
  });

  it('invalidates collection, user-sets, public-sets and canonical-sets on success', async () => {
    confirmImportMock.mockResolvedValue(CONFIRM_RESPONSE);
    const { queryClient, wrapper } = makeWrapper();
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(['coin-1']);
    });

    const keys = spy.mock.calls.map(([filters]) => (filters as { queryKey?: unknown[] } | undefined)?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([['collection'], ['user-sets'], ['public-sets'], ['canonical-sets']]),
    );
  });

  it('marks cached collection, set gap and set queries as stale but leaves unrelated queries alone', async () => {
    confirmImportMock.mockResolvedValue(CONFIRM_RESPONSE);
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], []);
    queryClient.setQueryData(['user-sets', 'set-1', 'gaps'], {});
    queryClient.setQueryData(['public-sets', 'set-2'], {});
    queryClient.setQueryData(['canonical-sets', 'set-3'], {});
    queryClient.setQueryData(['catalog', {}], {});
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(['coin-1']);
    });

    expect(queryClient.getQueryState(['collection', {}])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['user-sets', 'set-1', 'gaps'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['public-sets', 'set-2'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['canonical-sets', 'set-3'])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(['catalog', {}])?.isInvalidated).toBe(false);
  });

  it('does not invalidate anything when the confirm request fails', async () => {
    confirmImportMock.mockRejectedValue(new Error('IMPORT_UNKNOWN_COIN'));
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['collection', {}], []);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useConfirmImport(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(['coin-1']).catch(() => undefined);
    });

    expect(spy).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(['collection', {}])?.isInvalidated).toBe(false);
  });
});
