/**
 * Tests for: collection-api
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: collection-api.ts (CREATE)
 * Covers criteria: #6 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getCollection, setOwnership } from '@/lib/collection-api';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const COIN = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const OWNERSHIP_ITEM = {
  coinId: 'coin-1',
  coin: COIN,
  ownedAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('collection-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 6: getCollection calls GET /collection and returns OwnershipItem[]', () => {
    it('requests /collection with no query string when no filters are given', async () => {
      const fetchMock = stubFetchResolving(200, []);
      await getCollection();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/collection')).toBe(true);
    });

    it('includes country and year in the query string when provided', async () => {
      const fetchMock = stubFetchResolving(200, [OWNERSHIP_ITEM]);
      await getCollection({ country: 'USA', year: 1909 });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('country=USA');
      expect(url).toContain('year=1909');
    });

    it('omits empty/undefined filter values from the query string', async () => {
      const fetchMock = stubFetchResolving(200, []);
      await getCollection({ country: '', year: undefined });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/collection')).toBe(true);
    });

    it('returns the raw OwnershipItem[] body', async () => {
      stubFetchResolving(200, [OWNERSHIP_ITEM]);
      await expect(getCollection()).resolves.toEqual([OWNERSHIP_ITEM]);
    });
  });

  describe('criterion 6: setOwnership calls PATCH /collection/:coinId with { owned }', () => {
    it('sends owned: true and returns the SetOwnershipResponse', async () => {
      const response = { coinId: 'coin-1', owned: true, ownedAt: '2026-01-02T00:00:00.000Z' };
      const fetchMock = stubFetchResolving(200, response);
      const result = await setOwnership('coin-1', true);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/collection/coin-1')).toBe(true);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ owned: true });
      expect(result).toEqual(response);
    });

    it('sends owned: false explicitly (never a client-side toggle)', async () => {
      const fetchMock = stubFetchResolving(200, { coinId: 'coin-1', owned: false, ownedAt: null });
      await setOwnership('coin-1', false);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ owned: false });
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(404, { message: 'Coin not found' });
      await expect(setOwnership('missing', true)).rejects.toThrow();
    });
  });
});
