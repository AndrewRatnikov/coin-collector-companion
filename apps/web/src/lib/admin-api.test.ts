/**
 * Tests for: admin-api
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → Web API module: admin-api (CREATE)
 * Covers criteria: #16, #17 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getAdminCoins, reviewCoin } from '@/lib/admin-api';

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

describe('admin-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getAdminCoins', () => {
    it('requests /admin/coins with no query string when no params are given', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);

      await getAdminCoins();

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/admin/coins')).toBe(true);
      expect(url).not.toContain('?');
    });

    it('includes every defined param in the query string', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);

      await getAdminCoins({ status: 'pending', page: 2, limit: 50 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/admin/coins?');
      expect(url).toContain('status=pending');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=50');
    });

    it('sends a different status value when asked (not a hard-coded pending)', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);

      await getAdminCoins({ status: 'rejected' });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('status=rejected');
      expect(url).not.toContain('status=pending');
    });

    it('omits undefined params from the query string', async () => {
      const fetchMock = stubFetchResolving(200, PAGE);

      await getAdminCoins({ status: undefined, limit: 10 });

      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).not.toContain('status=');
      expect(url).not.toContain('page=');
      expect(url).toContain('limit=10');
    });

    it('returns the paginated body as-is', async () => {
      const page = { items: [{ id: 'c1', possibleDuplicate: null }], page: 1, limit: 20, total: 1 };
      stubFetchResolving(200, page);

      await expect(getAdminCoins()).resolves.toEqual(page);
    });

    it('rejects with an ApiError carrying status 403 for a non-admin', async () => {
      stubFetchResolving(403, { message: 'Forbidden resource' });

      await expect(getAdminCoins()).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('reviewCoin', () => {
    it('sends PATCH /admin/coins/:id with the body as JSON', async () => {
      const fetchMock = stubFetchResolving(200, { id: 'coin-1', status: 'rejected' });
      const body = { status: 'rejected' as const, rejectionReason: 'Blurry photo' };

      await reviewCoin('coin-1', body);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/admin/coins/coin-1')).toBe(true);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual(body);
    });

    it('uses the given id in the path and the given body (a second combination differs)', async () => {
      const fetchMock = stubFetchResolving(200, { id: 'coin-2', status: 'approved' });
      const body = { status: 'approved' as const, name: 'Fixed Name', year: 1943 };

      await reviewCoin('coin-2', body);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/admin/coins/coin-2')).toBe(true);
      expect(url).not.toContain('coin-1');
      expect(JSON.parse(init.body as string)).toEqual(body);
    });

    it('returns the AdminCoin body as-is', async () => {
      const coin = { id: 'coin-1', status: 'approved', submitterEmail: 'a@example.com' };
      stubFetchResolving(200, coin);

      await expect(reviewCoin('coin-1', { status: 'approved' })).resolves.toEqual(coin);
    });

    it('rejects with an ApiError carrying status 409 for an already reviewed coin', async () => {
      stubFetchResolving(409, { message: 'This coin has already been reviewed' });

      await expect(reviewCoin('coin-1', { status: 'approved' })).rejects.toMatchObject({ status: 409 });
    });
  });
});
