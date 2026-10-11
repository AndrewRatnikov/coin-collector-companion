/**
 * Tests for: catalog-api
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: catalog-api
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/lib/catalog-api.ts (MODIFY)
 *                   runs/run_20260731_132040/plan.md § Interface Contract → Type: CatalogFilters.submittedByMe (MODIFY)
 *                   runs/run_20261011_105146/plan.md § Interface Contract → Web API client: catalog-api.ts (MODIFY)
 * Covers criteria: #1 (from run_20260721_131640's prd.md), #3 (from run_20260725_140648's prd.md),
 *                  #1 (from run_20260731_132040's prd.md), #6 (from run_20261011_105146's prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getCatalog, getCatalogFacets, getCoin, submitCoin } from '@/lib/catalog-api';

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

  describe('run_20260731_132040 criterion 1: getCatalog with submittedByMe', () => {
    it('appends submittedByMe=true to the query string when set to true', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ submittedByMe: true });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('submittedByMe=true');
    });

    it('combines submittedByMe with other filters in the same query string', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ submittedByMe: true, country: 'USA', yearMin: 1909 });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('submittedByMe=true');
      expect(url).toContain('country=USA');
      expect(url).toContain('yearMin=1909');
    });

    it('omits submittedByMe from the query string when not provided', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ country: 'USA' });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('submittedByMe');
    });
  });

  describe('run_20261011_105146 criterion 6: getCatalog repeated denomination and new filters', () => {
    it('sends an array denomination as repeated params, in order', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ denomination: ['5 Kopiyok', '10 Hryvnias'] });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url, 'http://x').searchParams.getAll('denomination')).toEqual(['5 Kopiyok', '10 Hryvnias']);
    });

    it('sends a three-entry array as three params (not hard-coded to two)', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ denomination: ['a', 'b', 'c'] });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url, 'http://x').searchParams.getAll('denomination')).toEqual(['a', 'b', 'c']);
    });

    it('adds nothing for an empty denomination array', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ denomination: [], name: 'Lincoln' });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('denomination');
      expect(url).toContain('name=Lincoln');
    });

    it('skips empty strings inside a denomination array', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ denomination: ['Cent', ''] });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url, 'http://x').searchParams.getAll('denomination')).toEqual(['Cent']);
    });

    it('still sends a scalar denomination as a single param', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ denomination: 'Cent' });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url, 'http://x').searchParams.getAll('denomination')).toEqual(['Cent']);
    });

    it('sends keyDateOnly, hideOwned and sort when set', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ keyDateOnly: true, hideOwned: true, sort: 'year_desc' });
      const [url] = fetchMock.mock.calls[0] as [string];
      const params = new URL(url, 'http://x').searchParams;
      expect(params.get('keyDateOnly')).toBe('true');
      expect(params.get('hideOwned')).toBe('true');
      expect(params.get('sort')).toBe('year_desc');
    });

    it('omits keyDateOnly, hideOwned and sort when not provided', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);
      await getCatalog({ country: 'USA' });
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('keyDateOnly');
      expect(url).not.toContain('hideOwned');
      expect(url).not.toContain('sort');
    });
  });

  describe('run_20261011_105146 criterion 6: getCatalogFacets calls GET /catalog/facets', () => {
    const FACETS = { countries: ['Ukraine', 'USA'], denominations: ['5 Kopiyok'] };

    it('requests /catalog/facets with no query string when no country is given', async () => {
      const fetchMock = stubFetchResolving(200, FACETS);
      await getCatalogFacets();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/catalog/facets')).toBe(true);
    });

    it('requests /catalog/facets?country=Ukraine when a country is given', async () => {
      const fetchMock = stubFetchResolving(200, FACETS);
      await getCatalogFacets('Ukraine');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/catalog/facets?country=Ukraine')).toBe(true);
    });

    it('URL-encodes the country', async () => {
      const fetchMock = stubFetchResolving(200, FACETS);
      await getCatalogFacets('Sri Lanka & Co');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(new URL(url, 'http://x').searchParams.get('country')).toBe('Sri Lanka & Co');
    });

    it('treats an empty-string country as absent', async () => {
      const fetchMock = stubFetchResolving(200, FACETS);
      await getCatalogFacets('');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/catalog/facets')).toBe(true);
    });

    it('returns the CatalogFacets body as-is', async () => {
      stubFetchResolving(200, FACETS);
      await expect(getCatalogFacets()).resolves.toEqual(FACETS);
    });

    it('propagates a rejection on a server error', async () => {
      stubFetchResolving(500, { message: 'boom' });
      await expect(getCatalogFacets()).rejects.toThrow();
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

  describe('run_20260725_140648 criterion 3: submitCoin calls POST /catalog', () => {
    it('sends a POST request to /catalog with the payload as the JSON body', async () => {
      const fetchMock = stubFetchResolving(201, { id: 'new-1', status: 'pending' });
      const payload = { country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 };

      await submitCoin(payload);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/catalog')).toBe(true);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(payload);
    });

    it('returns the created CatalogCoin body as-is', async () => {
      const created = { id: 'new-1', status: 'pending', country: 'USA' };
      stubFetchResolving(201, created);

      await expect(
        submitCoin({ country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 }),
      ).resolves.toEqual(created);
    });

    it('propagates a rejection on a 409 conflict response', async () => {
      stubFetchResolving(409, { message: 'A coin with this natural key already exists' });

      await expect(
        submitCoin({ country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 }),
      ).rejects.toThrow();
    });
  });
});
