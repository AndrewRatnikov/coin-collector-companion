/**
 * Tests for: user-sets-api
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Module: user-sets-api
 * Covers criteria: #1 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { createSet, deleteSet, getSetGaps, getUserSets, renameSet } from '@/lib/user-sets-api';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const SUMMARY = {
  id: 'u1',
  userId: 'user-1',
  name: 'My Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('user-sets-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 1: getUserSets calls GET /sets and returns a plain array', () => {
    it('requests /sets', async () => {
      const fetchMock = stubFetchResolving(200, []);
      await getUserSets();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets')).toBe(true);
    });

    it('returns the raw UserSetSummary[] body, not a PaginatedResponse wrapper', async () => {
      const sets = [SUMMARY];
      stubFetchResolving(200, sets);
      const result = await getUserSets();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(sets);
    });
  });

  describe('criterion 1: createSet calls POST /sets with the request body', () => {
    it('sends a blank-set body and returns the created set', async () => {
      const fetchMock = stubFetchResolving(200, SUMMARY);
      const result = await createSet({ name: 'My Set' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/sets')).toBe(true);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'My Set' });
      expect(result).toEqual(SUMMARY);
    });

    it('sends a cloneFrom payload when provided', async () => {
      const fetchMock = stubFetchResolving(200, SUMMARY);
      await createSet({ name: 'Cloned', cloneFrom: { type: 'canonical', id: 'c1' } });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        name: 'Cloned',
        cloneFrom: { type: 'canonical', id: 'c1' },
      });
    });

    it('propagates a rejection on a validation error', async () => {
      stubFetchResolving(400, { message: ['name should not be empty'] });
      await expect(createSet({ name: '' })).rejects.toThrow();
    });
  });

  describe('criterion 1: renameSet calls PATCH /sets/:id with { name }', () => {
    it('sends the new name and returns the updated set', async () => {
      const updated = { ...SUMMARY, name: 'Renamed' };
      const fetchMock = stubFetchResolving(200, updated);
      const result = await renameSet('u1', 'Renamed');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/sets/u1')).toBe(true);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ name: 'Renamed' });
      expect(result).toEqual(updated);
    });
  });

  describe('criterion 1: deleteSet calls DELETE /sets/:id', () => {
    it('sends a DELETE request for the given id', async () => {
      const fetchMock = stubFetchResolving(204, null);
      await deleteSet('u1');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/sets/u1')).toBe(true);
      expect(init.method).toBe('DELETE');
    });
  });

  describe('criterion 1: getSetGaps calls GET /sets/:id/gaps', () => {
    it('requests /sets/:id/gaps and returns the GapViewResponse body', async () => {
      const gaps = { setId: 'u1', ownedCount: 1, totalCount: 2, completionPercent: 50, slots: [] };
      const fetchMock = stubFetchResolving(200, gaps);
      const result = await getSetGaps('u1');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/u1/gaps')).toBe(true);
      expect(result).toEqual(gaps);
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(500, { message: 'Internal error' });
      await expect(getSetGaps('u1')).rejects.toThrow();
    });
  });
});
