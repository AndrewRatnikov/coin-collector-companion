/**
 * Tests for: collection-import-api (previewImport, confirmImport) and the apiFetch FormData change
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Web: collection-import-api.ts)
 *                   and § Web item 1 (api-client.ts: no JSON Content-Type for FormData bodies);
 *                   runs/run_20261104_064643/plan.md § Interface Contract (Web: lib/collection-import-api.ts)
 * Covers criteria: #1, #3, #6, #9 (from runs/run_20261005_212015/prd.md); #8, #10, #11 (from runs/run_20261104_064643/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * fetch is stubbed with vi.stubGlobal (see vitest.setup.ts); no network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImportConfirmResponse, ImportPreviewResponse } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { setStoredToken } from '@/lib/auth-token';
import { confirmImport, previewImport } from '@/lib/collection-import-api';

const PREVIEW_RESPONSE: ImportPreviewResponse = {
  headers: ['Year', 'Country', 'Denomination'],
  delimiter: ',',
  mapping: { year: 0, country: 1, denomination: 2 },
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
  warnings: [],
};

const CONFIRM_RESPONSE: ImportConfirmResponse = { requested: 2, created: 1, alreadyOwned: 1 };

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function csvFile(name = 'coins.csv') {
  return new File(['Year,Country,Denomination\n1950,USA,Cent\n'], name, { type: 'text/csv' });
}

describe('collection-import-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('previewImport', () => {
    it('POSTs the file as multipart FormData to /collection/import/preview and returns the body', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      const file = csvFile();

      const result = await previewImport(file);

      expect(result).toEqual(PREVIEW_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/collection/import/preview')).toBe(true);
      expect(init.method).toBe('POST');
      expect(init.body).toBeInstanceOf(FormData);
      const form = init.body as FormData;
      const sent = form.get('file');
      expect(sent).toBeInstanceOf(File);
      expect((sent as File).name).toBe('coins.csv');
    });

    it('sends the file name and bytes it was given (different files, different payloads)', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile('other.csv'));
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(((init.body as FormData).get('file') as File).name).toBe('other.csv');
    });

    it('omits the mapping field when no mapping is given', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile());
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((init.body as FormData).has('mapping')).toBe(false);
    });

    it('adds the mapping as a JSON string when one is given', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile(), { year: 2, country: 0, denomination: 1, mintMark: 3 });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const raw = (init.body as FormData).get('mapping');
      expect(typeof raw).toBe('string');
      expect(JSON.parse(raw as string)).toEqual({ year: 2, country: 0, denomination: 1, mintMark: 3 });
    });

    it('sends the grade column in the mapping JSON', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile(), { year: 2, country: 0, denomination: 1, grade: 4 });
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const raw = (init.body as FormData).get('mapping');
      expect(JSON.parse(raw as string)).toEqual({ year: 2, country: 0, denomination: 1, grade: 4 });
    });

    it('returns rows with their grade and the warnings list from the server', async () => {
      const withGrades: ImportPreviewResponse = {
        ...PREVIEW_RESPONSE,
        warnings: [{ line: 4, code: 'grade_not_recognised', value: 'AG' }],
      };
      stubFetchResolving(200, withGrades);
      const result = await previewImport(csvFile());
      expect(result.warnings).toEqual([{ line: 4, code: 'grade_not_recognised', value: 'AG' }]);
    });

    it('does not set a Content-Type header (the browser must add the multipart boundary)', async () => {
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile());
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    });

    it('still attaches the bearer token', async () => {
      setStoredToken('tok-abc');
      const fetchMock = stubFetchResolving(200, PREVIEW_RESPONSE);
      await previewImport(csvFile());
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok-abc');
    });

    it('keeps the multipart exception on the refresh-and-retry path after a 401', async () => {
      setStoredToken('old-token');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: 'new-token' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => PREVIEW_RESPONSE });
      vi.stubGlobal('fetch', fetchMock);

      const result = await previewImport(csvFile());

      expect(result).toEqual(PREVIEW_RESPONSE);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      const [retryUrl, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      expect(retryUrl.endsWith('/collection/import/preview')).toBe(true);
      expect(retryInit.body).toBeInstanceOf(FormData);
      const headers = new Headers(retryInit.headers);
      expect(headers.has('Content-Type')).toBe(false);
      expect(headers.get('Authorization')).toBe('Bearer new-token');
    });

    it('rejects with an ApiError carrying the status and the server message', async () => {
      stubFetchResolving(400, { message: 'IMPORT_NOT_UTF8' });
      const error = await previewImport(csvFile()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(400);
      expect((error as ApiError).message).toBe('IMPORT_NOT_UTF8');
    });

    it('rejects with status 413 for an oversized upload', async () => {
      stubFetchResolving(413, { message: 'File too large' });
      const error = await previewImport(csvFile()).catch((e: unknown) => e);
      expect((error as ApiError).status).toBe(413);
    });
  });

  describe('confirmImport', () => {
    it('POSTs { coinIds } as JSON to /collection/import/confirm and returns the body', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);

      const result = await confirmImport(['coin-1', 'coin-2']);

      expect(result).toEqual(CONFIRM_RESPONSE);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/collection/import/confirm')).toBe(true);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ coinIds: ['coin-1', 'coin-2'] });
    });

    it('sends exactly the ids it is given', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);
      await confirmImport(['only-one']);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({ coinIds: ['only-one'] });
    });

    it('sends a body without a grades key when grades is omitted or empty', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);
      await confirmImport(['coin-1']);
      await confirmImport(['coin-1'], []);
      const [, first] = fetchMock.mock.calls[0] as [string, RequestInit];
      const [, second] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(first.body).toBe(JSON.stringify({ coinIds: ['coin-1'] }));
      expect(second.body).toBe(JSON.stringify({ coinIds: ['coin-1'] }));
      expect(JSON.parse(second.body as string)).not.toHaveProperty('grades');
    });

    it('sends { coinIds, grades } when grades are given', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);

      await confirmImport(['coin-1', 'coin-2'], [{ coinId: 'coin-2', grade: 'VF' }]);

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url.endsWith('/collection/import/confirm')).toBe(true);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({
        coinIds: ['coin-1', 'coin-2'],
        grades: [{ coinId: 'coin-2', grade: 'VF' }],
      });
    });

    it('sends exactly the grades it is given (different grades, different payloads)', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);

      await confirmImport(
        ['coin-1', 'coin-2'],
        [
          { coinId: 'coin-1', grade: 'G' },
          { coinId: 'coin-2', grade: 'UNC' },
        ],
      );

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string).grades).toEqual([
        { coinId: 'coin-1', grade: 'G' },
        { coinId: 'coin-2', grade: 'UNC' },
      ]);
    });

    it('sets Content-Type: application/json (unchanged apiFetch behaviour for JSON bodies)', async () => {
      const fetchMock = stubFetchResolving(200, CONFIRM_RESPONSE);
      await confirmImport(['coin-1']);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    });

    it('rejects with an ApiError for IMPORT_UNKNOWN_COIN', async () => {
      stubFetchResolving(400, { message: 'IMPORT_UNKNOWN_COIN' });
      const error = await confirmImport(['coin-1']).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('IMPORT_UNKNOWN_COIN');
    });

    it('rejects with an ApiError for IMPORT_INVALID_GRADES', async () => {
      stubFetchResolving(400, { message: 'IMPORT_INVALID_GRADES' });
      const error = await confirmImport(['coin-1'], [{ coinId: 'coin-9', grade: 'F' }]).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('IMPORT_INVALID_GRADES');
    });
  });
});
