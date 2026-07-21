/**
 * Tests for: public-sets-api
 * Contract source: runs/run_20260721_161448/plan.md § Interface Contract → Module: public-sets-api
 * Covers criteria: #2 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getPublicSet, getPublicSets } from '@/lib/public-sets-api';

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
  name: 'Public Set',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('public-sets-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 2: getPublicSets calls GET /sets/public and returns a PaginatedResponse', () => {
    it('requests /sets/public with no query string when no filters are given', async () => {
      const fetchMock = stubFetchResolving(200, { items: [], page: 1, limit: 20, total: 0 });
      await getPublicSets();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/public')).toBe(true);
    });

    it('includes page/limit in the query string when provided', async () => {
      const fetchMock = stubFetchResolving(200, { items: [], page: 2, limit: 10, total: 15 });
      await getPublicSets({ page: 2, limit: 10 });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
    });

    it('returns the PaginatedResponse<UserSetSummary> body', async () => {
      const body = { items: [SUMMARY], page: 1, limit: 20, total: 1 };
      stubFetchResolving(200, body);
      await expect(getPublicSets()).resolves.toEqual(body);
    });
  });

  describe('criterion 2: getPublicSet calls GET /sets/public/:id', () => {
    it('requests /sets/public/:id with the given id', async () => {
      const detail = { ...SUMMARY, coins: [] };
      const fetchMock = stubFetchResolving(200, detail);
      await getPublicSet('u1');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/public/u1')).toBe(true);
    });

    it('returns the UserSetDetail body including its coins array', async () => {
      const detail = {
        ...SUMMARY,
        coins: [{ id: 'usc-1', position: 0, coin: { id: 'coin-1' } }],
      };
      stubFetchResolving(200, detail);
      await expect(getPublicSet('u1')).resolves.toEqual(detail);
    });

    it('propagates a rejection when the public set is not found', async () => {
      stubFetchResolving(404, { message: 'Not found' });
      await expect(getPublicSet('missing')).rejects.toThrow();
    });
  });
});
