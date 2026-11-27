// @vitest-environment node
/**
 * Tests for: server-only catalog loaders (apps/web/src/lib/server-catalog.ts)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Module: server-catalog (CREATE)
 * Covers criteria: #2, #4, #4a, #5, #11 (from prd.md)
 *
 * serverApiGet is mocked and routed by path (the real ServerApiError class is kept).
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
import { loadCatalogPage, loadCoin, loadCoinChecklists } from '@/lib/server-catalog';

const serverApiGetMock = vi.mocked(serverApiGet);

const ID = '7e57c011-0000-4000-8000-000000000001';
const SET_A = '7e57ca70-0000-4000-8000-000000000001';
const SET_B = '7e57ca70-0000-4000-8000-000000000002';
const SET_C = '7e57ca70-0000-4000-8000-000000000003';

function coinData(overrides: Record<string, unknown> = {}) {
  return { id: ID, country: 'USA', denomination: '1 Cent', year: 1909, status: 'approved', ...overrides };
}

function slot(coinId: string, position: number) {
  return { id: `slot-${coinId}-${position}`, position, coin: { id: coinId, year: 1909 } };
}

function detail(id: string, name: string, coinIds: string[]) {
  return {
    id,
    name,
    description: null,
    source: 'seed-template',
    templateVersion: 'v1',
    coins: coinIds.map((c, i) => slot(c, i)),
  };
}

function summary(id: string, name: string) {
  return { id, name, description: null, source: 'seed-template', templateVersion: 'v1' };
}

beforeEach(() => {
  serverApiGetMock.mockReset();
});

describe('server-catalog source', () => {
  const source = readFileSync(resolve(__dirname, 'server-catalog.ts'), 'utf8');

  it('starts with the server-only import', () => {
    expect(source.split('\n')[0]).toBe("import 'server-only';");
  });

  it('never mentions credentials, cookies or authorization headers', () => {
    expect(source).not.toMatch(/Authorization|Cookie|credentials/);
  });
});

describe('loadCoin', () => {
  it('calls GET /catalog/{id} once with a one-day revalidate and returns the approved coin', async () => {
    serverApiGetMock.mockResolvedValue(coinData());

    const result = await loadCoin(ID);

    expect(result).toEqual({ status: 'ok', data: coinData() });
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
    expect(serverApiGetMock).toHaveBeenCalledWith(`/catalog/${ID}`, { revalidate: 86400 });
  });

  it('returns whatever the API sent (another coin, another data)', async () => {
    const other = coinData({ id: '7e57c011-0000-4000-8000-000000000002', year: 1955 });
    serverApiGetMock.mockResolvedValue(other);

    await expect(loadCoin('7e57c011-0000-4000-8000-000000000002')).resolves.toEqual({ status: 'ok', data: other });
  });

  it.each([[''], ['not-a-uuid'], ['coin-1'], ['7e57c011-0000-4000-8000-00000000000'], ['../etc/passwd']])(
    'maps the malformed id %j to not-found with no API call',
    async (id) => {
      await expect(loadCoin(id)).resolves.toEqual({ status: 'not-found' });
      expect(serverApiGetMock).not.toHaveBeenCalled();
    },
  );

  it.each([404, 400])('maps an http %i to not-found', async (status) => {
    serverApiGetMock.mockRejectedValue(new ServerApiError('http', status, 'x'));

    await expect(loadCoin(ID)).resolves.toEqual({ status: 'not-found' });
  });

  it.each([
    ['500', new ServerApiError('http', 500, 'boom')],
    ['503', new ServerApiError('http', 503, 'down')],
    ['403', new ServerApiError('http', 403, 'no')],
    ['timeout', new ServerApiError('timeout', null, 't')],
    ['network', new ServerApiError('network', null, 'n')],
    ['config', new ServerApiError('config', null, 'c')],
    ['a plain Error', new Error('x')],
  ])('maps %s to unavailable and does not throw', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    await expect(loadCoin(ID)).resolves.toEqual({ status: 'unavailable' });
  });

  it.each(['pending', 'rejected'])('maps a %s coin to not-found (its data is never returned)', async (status) => {
    serverApiGetMock.mockResolvedValue(coinData({ status, variety: 'SecretVariety' }));

    const result = await loadCoin(ID);

    expect(result).toEqual({ status: 'not-found' });
    expect(JSON.stringify(result)).not.toContain('SecretVariety');
  });
});

describe('loadCoinChecklists', () => {
  function route(options: {
    list?: unknown;
    details?: Record<string, unknown>;
    failList?: Error;
    failDetails?: Record<string, Error>;
  }) {
    serverApiGetMock.mockImplementation(async (path: string) => {
      if (path === '/sets/canonical') {
        if (options.failList) throw options.failList;
        return options.list as never;
      }
      const id = path.replace('/sets/canonical/', '');
      if (options.failDetails?.[id]) throw options.failDetails[id];
      return options.details?.[id] as never;
    });
  }

  const LIST = [summary(SET_A, 'Lincoln Wheat Cents'), summary(SET_B, 'Morgan Dollars'), summary(SET_C, 'Key Dates')];
  const DETAILS = {
    [SET_A]: detail(SET_A, 'Lincoln Wheat Cents', ['other-1', ID]),
    [SET_B]: detail(SET_B, 'Morgan Dollars', ['other-2']),
    [SET_C]: detail(SET_C, 'Key Dates', [ID]),
  };

  it('returns the checklists that contain the coin, in list order', async () => {
    route({ list: LIST, details: DETAILS });

    await expect(loadCoinChecklists(ID)).resolves.toEqual([
      { id: SET_A, name: 'Lincoln Wheat Cents' },
      { id: SET_C, name: 'Key Dates' },
    ]);
  });

  it('follows the coin id (another coin, another result)', async () => {
    route({ list: LIST, details: DETAILS });

    await expect(loadCoinChecklists('other-2')).resolves.toEqual([{ id: SET_B, name: 'Morgan Dollars' }]);
    await expect(loadCoinChecklists('in-no-checklist')).resolves.toEqual([]);
  });

  it('reads the list and every detail with a one-hour revalidate', async () => {
    route({ list: LIST, details: DETAILS });

    await loadCoinChecklists(ID);

    expect(serverApiGetMock).toHaveBeenCalledWith('/sets/canonical', { revalidate: 3600 });
    for (const id of [SET_A, SET_B, SET_C]) {
      expect(serverApiGetMock).toHaveBeenCalledWith(`/sets/canonical/${id}`, { revalidate: 3600 });
    }
    expect(serverApiGetMock).toHaveBeenCalledTimes(4);
  });

  it('returns an empty list when there are no checklists', async () => {
    route({ list: [], details: {} });

    await expect(loadCoinChecklists(ID)).resolves.toEqual([]);
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 500', new ServerApiError('http', 500, 'boom')],
    ['a timeout', new ServerApiError('timeout', null, 't')],
    ['a plain Error', new Error('x')],
  ])('returns [] without detail calls when the list fails with %s', async (_label, error) => {
    route({ failList: error });

    await expect(loadCoinChecklists(ID)).resolves.toEqual([]);
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a timeout', new ServerApiError('timeout', null, 't')],
    ['a 404', new ServerApiError('http', 404, 'nf')],
    ['a plain Error', new Error('x')],
  ])('leaves out a checklist whose detail fails with %s and keeps the others', async (_label, error) => {
    route({ list: LIST, details: DETAILS, failDetails: { [SET_A]: error } });

    await expect(loadCoinChecklists(ID)).resolves.toEqual([{ id: SET_C, name: 'Key Dates' }]);
  });

  it('returns [] when every detail fails', async () => {
    const error = new ServerApiError('timeout', null, 't');
    route({ list: LIST, details: DETAILS, failDetails: { [SET_A]: error, [SET_B]: error, [SET_C]: error } });

    await expect(loadCoinChecklists(ID)).resolves.toEqual([]);
  });
});

describe('loadCatalogPage', () => {
  const PAGE = { items: [{ id: 'c1' }], page: 1, limit: 20, total: 1 };

  it('calls GET /catalog with the query string and a one-hour revalidate', async () => {
    serverApiGetMock.mockResolvedValue(PAGE);

    const result = await loadCatalogPage({ page: 1, limit: 20 });

    expect(result).toEqual({ status: 'ok', data: PAGE });
    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=1&limit=20', { revalidate: 3600 });
  });

  it('builds the path from the filters (a different filter set gives a different path)', async () => {
    serverApiGetMock.mockResolvedValue(PAGE);

    await loadCatalogPage({ page: 3, limit: 20, country: 'USA', denomination: ['1 Cent', '5 Cents'] });

    expect(serverApiGetMock).toHaveBeenCalledWith(
      '/catalog?page=3&limit=20&country=USA&denomination=1+Cent&denomination=5+Cents',
      { revalidate: 3600 },
    );
  });

  it('calls /catalog alone for no filters', async () => {
    serverApiGetMock.mockResolvedValue(PAGE);

    await loadCatalogPage({});

    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog', { revalidate: 3600 });
  });

  it.each([
    ['a 404', new ServerApiError('http', 404, 'nf')],
    ['a 400', new ServerApiError('http', 400, 'bad')],
    ['a 500', new ServerApiError('http', 500, 'boom')],
    ['a timeout', new ServerApiError('timeout', null, 't')],
    ['a network error', new ServerApiError('network', null, 'n')],
    ['a plain Error', new Error('x')],
  ])('maps %s to unavailable (never not-found) and does not throw', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    await expect(loadCatalogPage({ page: 1, limit: 20 })).resolves.toEqual({ status: 'unavailable' });
  });
});
