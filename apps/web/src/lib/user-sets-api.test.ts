/**
 * Tests for: user-sets-api
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Module: user-sets-api.ts (MODIFY)
 *                   runs/run_20261018_105617/plan.md § Interface Contract → Module: user-sets-api.ts (MODIFY)
 *                   runs/run_20261103_192441/plan.md § Interface Contract → Module: user-sets-api (MODIFY)
 *                   runs/run_20261109_220451/plan.md § Interface Contract → Function: getCanonicalSetGaps
 * Covers criteria: #1 (from prd.md); #2, #3 (from run_20261018_105617's prd.md);
 *                  #2 (run_20261103_192441: updateSetMinGrade payloads, untranslated codes);
 *                  #2 (run_20261109_220451: getCanonicalSetGaps)
 *
 * This file supersedes the prior run's version of the same file, adding
 * patchSetCoins coverage alongside the existing getUserSets/createSet/renameSet/
 * deleteSet/getSetGaps tests (all unchanged from before), and getSetsSummary.
 * run_20261103_192441 adds updateSetMinGrade.
 * run_20261109_220451 adds getCanonicalSetGaps.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import {
  createSet,
  deleteSet,
  getCanonicalSetGaps,
  getSetGaps,
  getSetsSummary,
  getUserSets,
  patchSetCoins,
  renameSet,
  updateSetMinGrade,
} from '@/lib/user-sets-api';

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

    it('passes the progress fields (ownedCount, totalCount, firstMissing) through unchanged', async () => {
      const sets = [{ ...SUMMARY, ownedCount: 3, totalCount: 8, firstMissing: 'Odesa Oblast' }];
      stubFetchResolving(200, sets);
      const result = await getUserSets();
      expect(result[0].ownedCount).toBe(3);
      expect(result[0].totalCount).toBe(8);
      expect(result[0].firstMissing).toBe('Odesa Oblast');
    });
  });

  describe('run_20261018_105617 criterion 3: getSetsSummary calls GET /sets/summary', () => {
    it('requests /sets/summary with a single argument and returns the summary body', async () => {
      const body = {
        uniqueMissingCount: 4,
        collectionCount: 21,
        suggestedSet: { id: 'cs-1', name: 'Lincoln Cents', coinCount: 12, ownedCount: 3 },
      };
      const fetchMock = stubFetchResolving(200, body);
      const result = await getSetsSummary();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/summary')).toBe(true);
      expect(result).toEqual(body);
    });

    it('does not request the plain /sets list', async () => {
      const fetchMock = stubFetchResolving(200, { uniqueMissingCount: 0, collectionCount: 0, suggestedSet: null });
      await getSetsSummary();
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets')).toBe(false);
    });

    it('returns a null suggestedSet as null', async () => {
      stubFetchResolving(200, { uniqueMissingCount: 0, collectionCount: 5, suggestedSet: null });
      const result = await getSetsSummary();
      expect(result.suggestedSet).toBeNull();
      expect(result.collectionCount).toBe(5);
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(500, { message: 'Internal error' });
      await expect(getSetsSummary()).rejects.toThrow();
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

    it('still sends { name } only (no minGrade key)', async () => {
      const fetchMock = stubFetchResolving(200, SUMMARY);
      await renameSet('u1', 'Renamed');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(Object.keys(JSON.parse(init.body as string) as object)).toEqual(['name']);
    });
  });

  describe('run_20261103_192441 criterion 2: updateSetMinGrade calls PATCH /sets/:id with { minGrade }', () => {
    it('sends the neutral grade code and returns the updated set', async () => {
      const updated = { ...SUMMARY, minGrade: 'VF' };
      const fetchMock = stubFetchResolving(200, updated);
      const result = await updateSetMinGrade('u1', 'VF');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/sets/u1')).toBe(true);
      expect(init.method).toBe('PATCH');
      expect(init.body).toBe('{"minGrade":"VF"}');
      expect(result).toEqual(updated);
    });

    it('sends a different code for a different grade', async () => {
      const fetchMock = stubFetchResolving(200, { ...SUMMARY, minGrade: 'UNC' });
      await updateSetMinGrade('u1', 'UNC');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ minGrade: 'UNC' });
    });

    it('sends null (not a missing key) to clear the minimum grade', async () => {
      const fetchMock = stubFetchResolving(200, { ...SUMMARY, minGrade: null });
      await updateSetMinGrade('u1', null);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.body).toBe('{"minGrade":null}');
    });

    it('targets the id it is given', async () => {
      const fetchMock = stubFetchResolving(200, SUMMARY);
      await updateSetMinGrade('other-set', 'AU');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/other-set')).toBe(true);
      expect(url.endsWith('/sets/u1')).toBe(false);
    });

    it('sends only the minGrade key', async () => {
      const fetchMock = stubFetchResolving(200, SUMMARY);
      await updateSetMinGrade('u1', 'F');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(Object.keys(JSON.parse(init.body as string) as object)).toEqual(['minGrade']);
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(403, { message: 'Forbidden' });
      await expect(updateSetMinGrade('u1', 'VF')).rejects.toThrow();
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

  describe('run_20261109_220451 criterion 2: getCanonicalSetGaps calls GET /sets/canonical/:id/gaps', () => {
    it('requests /sets/canonical/:id/gaps with a plain GET and returns the GapViewResponse body', async () => {
      const gaps = {
        setId: 'c1',
        ownedCount: 2,
        totalCount: 4,
        completionPercent: 50,
        minGrade: null,
        slots: [],
      };
      const fetchMock = stubFetchResolving(200, gaps);
      const result = await getCanonicalSetGaps('c1');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit | undefined];
      expect(url.endsWith('/sets/canonical/c1/gaps')).toBe(true);
      expect(init?.method ?? 'GET').toBe('GET');
      expect(init?.body).toBeUndefined();
      expect(result).toEqual(gaps);
    });

    it('targets the id it is given and not the owned-set gaps route', async () => {
      const fetchMock = stubFetchResolving(200, { setId: 'c9', ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] });
      await getCanonicalSetGaps('c9');
      const [url] = fetchMock.mock.calls[0] as [string];
      expect(url.endsWith('/sets/canonical/c9/gaps')).toBe(true);
      expect(url.endsWith('/sets/c9/gaps')).toBe(false);
      expect(url.endsWith('/sets/canonical/c1/gaps')).toBe(false);
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(404, { message: 'Not found' });
      await expect(getCanonicalSetGaps('c1')).rejects.toThrow();
    });
  });

  describe('criterion 1: patchSetCoins calls PATCH /sets/:id/coins with { add, remove }', () => {
    it('sends an add-only body and returns the resulting UserSetCoinSummary[]', async () => {
      const resultBody = [{ id: 'usc-1', userSetId: 'u1', coinId: 'coin-1', position: 0 }];
      const fetchMock = stubFetchResolving(200, resultBody);
      const result = await patchSetCoins('u1', { add: ['coin-1'] });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/sets/u1/coins')).toBe(true);
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({ add: ['coin-1'] });
      expect(result).toEqual(resultBody);
    });

    it('sends a remove-only body', async () => {
      const fetchMock = stubFetchResolving(200, []);
      await patchSetCoins('u1', { remove: ['coin-2'] });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ remove: ['coin-2'] });
    });

    it('propagates a rejection when the request fails', async () => {
      stubFetchResolving(403, { message: 'Forbidden' });
      await expect(patchSetCoins('u1', { add: ['coin-1'] })).rejects.toThrow();
    });
  });
});
