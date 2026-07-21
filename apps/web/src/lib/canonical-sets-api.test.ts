/**
 * Tests for: canonical-sets-api
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Module: canonical-sets-api
 * Covers criteria: #6 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { getCanonicalSet, getCanonicalSets } from '@/lib/canonical-sets-api';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('canonical-sets-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 6: getCanonicalSets calls GET /sets/canonical and returns a plain array', () => {
    it('requests /sets/canonical', async () => {
      const fetchMock = stubFetchResolving(200, []);
      await getCanonicalSets();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/sets/canonical');
      expect(url.endsWith('/sets/canonical')).toBe(true);
    });

    it('returns the raw CanonicalSetSummary[] body, not a PaginatedResponse wrapper', async () => {
      const sets = [
        { id: 's1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1' },
      ];
      stubFetchResolving(200, sets);
      const result = await getCanonicalSets();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(sets);
    });
  });

  describe('criterion 6: getCanonicalSet calls GET /sets/canonical/:id', () => {
    it('requests /sets/canonical/:id with the given id', async () => {
      const detail = { id: 's1', name: 'Lincoln Wheat Cents', description: null, source: 'seed-template', templateVersion: 'v1', coins: [] };
      const fetchMock = stubFetchResolving(200, detail);
      await getCanonicalSet('s1');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url).toContain('/sets/canonical/s1');
    });

    it('returns the CanonicalSetDetail body including its coins array', async () => {
      const detail = {
        id: 's1',
        name: 'Lincoln Wheat Cents',
        description: null,
        source: 'seed-template',
        templateVersion: 'v1',
        coins: [{ id: 'usc-1', position: 0, coin: { id: 'coin-1' } }],
      };
      stubFetchResolving(200, detail);
      await expect(getCanonicalSet('s1')).resolves.toEqual(detail);
    });

    it('propagates a rejection when the canonical set is not found', async () => {
      stubFetchResolving(404, { message: 'Not found' });
      await expect(getCanonicalSet('missing')).rejects.toThrow();
    });
  });
});
