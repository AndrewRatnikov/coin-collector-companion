/**
 * Tests for: catalog-api
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: catalog-api
 * Covers criteria: #1 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getCatalog, getCoin } from '@/lib/catalog-api';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const PAGE = { items: [], page: 1, limit: 20, total: 0 };

describe('catalog-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 1: getCatalog calls GET /catalog', () => {
    it('requests /catalog with no query string when no filters are given', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/catalog');
      expect(url.endsWith('/catalog')).toBe(true);
    });

    it('includes every defined filter in the query string', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ country: 'USA', denomination: '1 Cent', name: 'Lincoln', yearMin: 1909, yearMax: 1958, page: 2, limit: 10 });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('country=USA');
      expect(url).toContain('denomination=1+Cent');
      expect(url).toContain('name=Lincoln');
      expect(url).toContain('yearMin=1909');
      expect(url).toContain('yearMax=1958');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
    });

    it('omits undefined and empty-string filters from the query string', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ country: '', denomination: undefined, name: 'Lincoln' });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('country=');
      expect(url).not.toContain('denomination=');
      expect(url).toContain('name=Lincoln');
    });

    it('returns the PaginatedResponse<CatalogCoin> body as-is', async () => {
      const page = { items: [{ id: 'c1' }], page: 1, limit: 20, total: 1 };
      stubFetchResolving(200, page);
      await expect(getCatalog()).resolves.toEqual(page);
    });
  });

  describe('criterion 1: getCoin calls GET /catalog/:id', () => {
    it('requests /catalog/:id with the given id', async () => {
      const coin = { id: 'coin-42', country: 'USA' };
      const fetchMock = stubFetchResolving(200, coin);
      await getCoin('coin-42');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/catalog/coin-42');
    });

    it('returns the CatalogCoin body as-is', async () => {
      const coin = { id: 'coin-42', country: 'USA' };
      stubFetchResolving(200, coin);
      await expect(getCoin('coin-42')).resolves.toEqual(coin);
    });

    it('propagates a rejection when the coin is not found', async () => {
      stubFetchResolving(404, { message: 'Not found' });
      await expect(getCoin('missing')).rejects.toThrow();
    });
  });
});
