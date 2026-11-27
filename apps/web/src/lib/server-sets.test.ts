// @vitest-environment node
/**
 * Tests for: server-only set loaders (apps/web/src/lib/server-sets.ts)
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Module: server-sets (server-only)
 * Covers criteria: #1, #7, #8 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server-api')>()),
  serverApiGet: vi.fn(),
}));

import { ServerApiError, serverApiGet } from '@/lib/server-api';
import { loadCanonicalSet, loadCanonicalSets, loadPublicSet } from '@/lib/server-sets';

const serverApiGetMock = vi.mocked(serverApiGet);

const CANONICAL_LIST = [{ id: 'c1', name: 'Lincoln', description: null, source: 'seed-template', templateVersion: 'v1' }];
const CANONICAL_DETAIL = { ...CANONICAL_LIST[0], coins: [] };
const PUBLIC_DETAIL = { id: 'p1', userId: 'u1', name: 'Mine', coins: [] };

beforeEach(() => {
  serverApiGetMock.mockReset();
});

describe('server-sets source', () => {
  const source = readFileSync(resolve(__dirname, 'server-sets.ts'), 'utf8');

  it('starts with the server-only import', () => {
    expect(source.split('\n')[0]).toBe("import 'server-only';");
  });

  it('never mentions credentials, cookies or authorization headers', () => {
    expect(source).not.toMatch(/Authorization|Cookie|credentials/);
  });
});

describe('loadCanonicalSets', () => {
  it('calls GET /sets/canonical once with a one-hour revalidate and returns ok data', async () => {
    serverApiGetMock.mockResolvedValue(CANONICAL_LIST);

    const result = await loadCanonicalSets();

    expect(result).toEqual({ status: 'ok', data: CANONICAL_LIST });
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
    expect(serverApiGetMock).toHaveBeenCalledWith('/sets/canonical', { revalidate: 3600 });
  });

  it.each([
    ['a 404', new ServerApiError('http', 404, 'nf')],
    ['a 400', new ServerApiError('http', 400, 'bad')],
    ['a 500', new ServerApiError('http', 500, 'boom')],
    ['a timeout', new ServerApiError('timeout', null, 't')],
    ['a network error', new ServerApiError('network', null, 'n')],
    ['a config error', new ServerApiError('config', null, 'c')],
    ['a plain Error', new Error('x')],
  ])('maps %s to unavailable (the list never 404s) and does not throw', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    await expect(loadCanonicalSets()).resolves.toEqual({ status: 'unavailable' });
  });
});

describe.each([
  ['loadCanonicalSet', loadCanonicalSet, '/sets/canonical', CANONICAL_DETAIL],
  ['loadPublicSet', loadPublicSet, '/sets/public', PUBLIC_DETAIL],
] as const)('%s', (_name, loader, base, detail) => {
  it('calls GET {base}/{id} once with a one-hour revalidate and returns ok data', async () => {
    serverApiGetMock.mockResolvedValue(detail);

    const result = await loader('abc-123');

    expect(result).toEqual({ status: 'ok', data: detail });
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
    expect(serverApiGetMock).toHaveBeenCalledWith(`${base}/abc-123`, { revalidate: 3600 });
  });

  it('encodes the id in the path', async () => {
    serverApiGetMock.mockResolvedValue(detail);

    await loader('a/b c?d');

    expect(serverApiGetMock).toHaveBeenCalledWith(`${base}/a%2Fb%20c%3Fd`, { revalidate: 3600 });
  });

  it.each([404, 400])('maps an http %i to not-found', async (status) => {
    serverApiGetMock.mockRejectedValue(new ServerApiError('http', status, 'x'));

    await expect(loader(`id-${status}`)).resolves.toEqual({ status: 'not-found' });
  });

  it.each([
    ['500', new ServerApiError('http', 500, 'boom')],
    ['503', new ServerApiError('http', 503, 'down')],
    ['403', new ServerApiError('http', 403, 'no')],
    ['timeout', new ServerApiError('timeout', null, 't')],
    ['network', new ServerApiError('network', null, 'n')],
    ['config', new ServerApiError('config', null, 'c')],
    ['a plain Error', new Error('x')],
  ])('maps %s to unavailable and does not throw', async (label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    await expect(loader(`id-${label}`)).resolves.toEqual({ status: 'unavailable' });
  });
});
