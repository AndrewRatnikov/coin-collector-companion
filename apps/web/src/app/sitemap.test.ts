// @vitest-environment node
/**
 * Tests for: sitemap (apps/web/src/app/sitemap.ts)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Metadata route: sitemap
 *                   runs/run_20261127_133045/plan.md § Interface Contract → Sitemap (MODIFY)
 * Covers criteria: #6, #7, #8 (from run_20261127_065505's prd.md), #16 (from run_20261127_133045's prd.md)
 *
 * run_20261127_133045: coin list items now carry a status (as the API's list items do), and the sitemap
 * keeps only the approved ones. A new block returns pending and rejected items from the plain /catalog
 * list too and asserts that neither their ids nor their URLs appear.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-api', () => ({ serverApiGet: vi.fn() }));

import sitemap, { dynamic } from '@/app/sitemap';
import { serverApiGet } from '@/lib/server-api';

const getMock = vi.mocked(serverApiGet);
const ORIGIN = 'https://site.example';

function uuid(prefix: string, n: number) {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

const OWNER_SET_ID = uuid('0a4e0000', 1);

interface ListItem {
  id: string;
  updatedAt: string;
  status?: string;
}

interface World {
  coinTotal: number;
  publicTotal: number;
  checklists: { id: string; name: string; coinCount: number }[];
  /** Extra items the plain /catalog list returns on page 1 next to the approved coins. */
  extraCoinItems: ListItem[];
}

let world: World;

function paged(kind: 'coin' | 'set', total: number, page: number) {
  const prefix = kind === 'coin' ? 'c0111111' : 'a5e70000';
  const count = Math.max(0, Math.min(100, total - (page - 1) * 100));
  const items: ListItem[] = Array.from({ length: count }, (_, i) => {
    const n = (page - 1) * 100 + i + 1;
    const item: ListItem = {
      id: uuid(prefix, n),
      updatedAt: `2026-02-${String((n % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    };
    if (kind === 'coin') item.status = 'approved';
    return item;
  });
  return { items, page, limit: 100, total };
}

function dispatch(path: string): unknown {
  if (path === '/sets/canonical') {
    return world.checklists;
  }
  const url = new URL(path, 'http://x');
  const page = Number(url.searchParams.get('page'));
  if (url.pathname === '/sets') {
    // Owner-only list: must never reach the sitemap.
    return { items: [{ id: OWNER_SET_ID, updatedAt: '2026-03-01T10:00:00.000Z' }], page, limit: 100, total: 1 };
  }
  if (url.pathname.startsWith('/admin')) {
    return {
      items: [
        { id: uuid('9e4d0000', 1), updatedAt: '2026-03-01T10:00:00.000Z' },
        { id: uuid('4e1e0000', 1), updatedAt: '2026-03-01T10:00:00.000Z' },
      ],
      page,
      limit: 100,
      total: 2,
    };
  }
  if (url.pathname === '/sets/public') {
    return paged('set', world.publicTotal, page);
  }
  if (url.pathname === '/catalog') {
    if (url.searchParams.has('status') || url.searchParams.has('submittedByMe')) {
      const status = url.searchParams.get('status');
      const prefix = status === 'rejected' ? '4e1e0000' : '9e4d0000';
      return {
        items: [
          { id: uuid(prefix, 1), updatedAt: '2026-03-01T10:00:00.000Z', status: status ?? 'pending' },
          { id: uuid('4e1e0000', 2), updatedAt: '2026-03-01T10:00:00.000Z', status: 'rejected' },
        ],
        page,
        limit: 100,
        total: 2,
      };
    }
    const result = paged('coin', world.coinTotal, page);
    if (page === 1) result.items.push(...world.extraCoinItems);
    return result;
  }
  throw new Error(`unexpected path ${path}`);
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  world = {
    coinTotal: 3,
    publicTotal: 2,
    checklists: [
      { id: uuid('c4ec0000', 1), name: 'Lincoln Wheat Cents', coinCount: 150 },
      { id: uuid('c4ec0000', 2), name: 'Morgan Dollars', coinCount: 100 },
    ],
    extraCoinItems: [],
  };
  getMock.mockReset();
  getMock.mockImplementation(async (path: string) => dispatch(path) as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('sitemap module', () => {
  it('is force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });
});

describe('static entries', () => {
  it('lists the six static pages first, in order, url only', async () => {
    const entries = await sitemap();
    expect(entries.slice(0, 6)).toEqual([
      { url: `${ORIGIN}/` },
      { url: `${ORIGIN}/catalog` },
      { url: `${ORIGIN}/glossary` },
      { url: `${ORIGIN}/privacy` },
      { url: `${ORIGIN}/sets/canonical` },
      { url: `${ORIGIN}/sets/public` },
    ]);
  });

  it('uses the configured site origin', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example');
    const entries = await sitemap();
    expect(entries[0].url).toBe('https://other.example/');
    expect(entries.every((e) => e.url.startsWith('https://other.example/'))).toBe(true);
  });
});

describe('dynamic entries', () => {
  it('adds a checklist entry per curated checklist, without lastModified', async () => {
    const entries = await sitemap();
    const lists = entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/canonical/`));
    expect(lists).toEqual([
      { url: `${ORIGIN}/sets/canonical/${uuid('c4ec0000', 1)}` },
      { url: `${ORIGIN}/sets/canonical/${uuid('c4ec0000', 2)}` },
    ]);
  });

  it('adds public sets with lastModified from updatedAt', async () => {
    const entries = await sitemap();
    const sets = entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/public/`));
    expect(sets).toEqual([
      { url: `${ORIGIN}/sets/public/${uuid('a5e70000', 1)}`, lastModified: '2026-02-02T10:00:00.000Z' },
      { url: `${ORIGIN}/sets/public/${uuid('a5e70000', 2)}`, lastModified: '2026-02-03T10:00:00.000Z' },
    ]);
  });

  it('adds coins with lastModified from updatedAt', async () => {
    const entries = await sitemap();
    const coins = entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`));
    expect(coins).toEqual([
      { url: `${ORIGIN}/catalog/${uuid('c0111111', 1)}`, lastModified: '2026-02-02T10:00:00.000Z' },
      { url: `${ORIGIN}/catalog/${uuid('c0111111', 2)}`, lastModified: '2026-02-03T10:00:00.000Z' },
      { url: `${ORIGIN}/catalog/${uuid('c0111111', 3)}`, lastModified: '2026-02-04T10:00:00.000Z' },
    ]);
  });

  it('orders static, checklists, public sets, then coins', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    const first = (needle: string) => urls.findIndex((u) => u.includes(needle));
    expect(first('/sets/canonical/')).toBeGreaterThan(5);
    expect(first('/sets/public/')).toBeGreaterThan(first('/sets/canonical/'));
    expect(first('/catalog/')).toBeGreaterThan(first('/sets/public/'));
  });

  it('has no duplicate urls', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('exclusions', () => {
  it('contains only GET /sets/public sets and approved catalog coins', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    const forbidden = [
      OWNER_SET_ID,
      uuid('9e4d0000', 1),
      uuid('9e4d0000', 2),
      uuid('4e1e0000', 1),
      uuid('4e1e0000', 2),
    ];
    for (const id of forbidden) {
      expect(urls.some((u) => u.includes(id))).toBe(false);
    }
    expect(urls).not.toContain(`${ORIGIN}/sets/${OWNER_SET_ID}`);
    expect(urls.some((u) => u.includes(`/sets/${OWNER_SET_ID}`))).toBe(false);
    expect(urls).toContain(`${ORIGIN}/sets/public/${uuid('a5e70000', 1)}`);
    expect(urls).toContain(`${ORIGIN}/catalog/${uuid('c0111111', 1)}`);
  });
});

describe('approved coins only (item 3.8)', () => {
  const PENDING_ID = uuid('9e4d0000', 9);
  const REJECTED_ID = uuid('4e1e0000', 9);

  function withNonApproved() {
    world.extraCoinItems = [
      { id: PENDING_ID, updatedAt: '2026-03-01T10:00:00.000Z', status: 'pending' },
      { id: REJECTED_ID, updatedAt: '2026-03-02T10:00:00.000Z', status: 'rejected' },
    ];
  }

  it('leaves out a pending and a rejected coin that the list returns, ids and URLs', async () => {
    withNonApproved();

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls.some((u) => u.includes(PENDING_ID))).toBe(false);
    expect(urls.some((u) => u.includes(REJECTED_ID))).toBe(false);
    expect(urls).not.toContain(`${ORIGIN}/catalog/${PENDING_ID}`);
    expect(urls).not.toContain(`${ORIGIN}/catalog/${REJECTED_ID}`);
  });

  it('keeps every approved coin next to the dropped ones', async () => {
    withNonApproved();

    const entries = await sitemap();

    const coins = entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`));
    expect(coins.map((e) => e.url)).toEqual([
      `${ORIGIN}/catalog/${uuid('c0111111', 1)}`,
      `${ORIGIN}/catalog/${uuid('c0111111', 2)}`,
      `${ORIGIN}/catalog/${uuid('c0111111', 3)}`,
    ]);
  });

  it('keeps an extra coin that is approved (the filter follows the status, not the position)', async () => {
    world.extraCoinItems = [{ id: PENDING_ID, updatedAt: '2026-03-01T10:00:00.000Z', status: 'approved' }];

    const urls = (await sitemap()).map((e) => e.url);

    expect(urls).toContain(`${ORIGIN}/catalog/${PENDING_ID}`);
  });

  it('adds no coin entry when the list returns only non-approved coins', async () => {
    world.coinTotal = 0;
    withNonApproved();

    const entries = await sitemap();

    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`))).toHaveLength(0);
  });

  it('never asks for non-approved coins', async () => {
    await sitemap();

    for (const [path] of getMock.mock.calls) {
      expect(path).not.toContain('status=');
      expect(path).not.toContain('submittedByMe');
    }
  });
});

describe('API calls (approved coins and public sets only)', () => {
  it('calls only the public list endpoints, with one argument and page-then-limit queries', async () => {
    await sitemap();
    const calls = getMock.mock.calls;
    for (const call of calls) {
      expect(call).toHaveLength(1);
    }
    const paths = calls.map((c) => c[0]);
    expect(paths).toContain('/sets/canonical');
    expect(paths).toContain('/sets/public?page=1&limit=100');
    expect(paths).toContain('/catalog?page=1&limit=100');
    for (const path of paths) {
      expect(path).not.toMatch(/^\/admin/);
      expect(path).not.toContain('submittedByMe');
      expect(path).not.toMatch(/^\/sets(\?|$|\/(?!canonical|public))/);
    }
  });
});

describe('paging', () => {
  it('requests one page when total is 0 and adds no entries', async () => {
    world.coinTotal = 0;
    world.publicTotal = 0;
    const entries = await sitemap();
    const paths = getMock.mock.calls.map((c) => c[0]);
    expect(paths.filter((p) => p.startsWith('/catalog'))).toEqual(['/catalog?page=1&limit=100']);
    expect(paths.filter((p) => p.startsWith('/sets/public'))).toEqual(['/sets/public?page=1&limit=100']);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`))).toHaveLength(0);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/public/`))).toHaveLength(0);
  });

  it('requests two pages for 150 coins and returns 150 entries in order', async () => {
    world.coinTotal = 150;
    const entries = await sitemap();
    const paths = getMock.mock.calls.map((c) => c[0]).filter((p) => p.startsWith('/catalog'));
    expect(paths.sort()).toEqual(['/catalog?page=1&limit=100', '/catalog?page=2&limit=100']);
    const coins = entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`));
    expect(coins).toHaveLength(150);
    expect(coins[0].url).toBe(`${ORIGIN}/catalog/${uuid('c0111111', 1)}`);
    expect(coins[100].url).toBe(`${ORIGIN}/catalog/${uuid('c0111111', 101)}`);
    expect(coins[149].url).toBe(`${ORIGIN}/catalog/${uuid('c0111111', 150)}`);
  });

  it('requests exactly one page for exactly 100 coins', async () => {
    world.coinTotal = 100;
    await sitemap();
    const paths = getMock.mock.calls.map((c) => c[0]).filter((p) => p.startsWith('/catalog'));
    expect(paths).toEqual(['/catalog?page=1&limit=100']);
  });

  it('pages public sets too', async () => {
    world.publicTotal = 205;
    const entries = await sitemap();
    const paths = getMock.mock.calls.map((c) => c[0]).filter((p) => p.startsWith('/sets/public'));
    expect(paths.sort()).toEqual([
      '/sets/public?page=1&limit=100',
      '/sets/public?page=2&limit=100',
      '/sets/public?page=3&limit=100',
    ]);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/public/`))).toHaveLength(205);
  });

});

describe('failure handling', () => {
  it('keeps static entries and the other groups when the coin list fails', async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path.startsWith('/catalog')) {
        throw new Error('timeout');
      }
      return dispatch(path) as never;
    });
    const entries = await sitemap();
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`))).toHaveLength(0);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/canonical/`))).toHaveLength(2);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/public/`))).toHaveLength(2);
    expect(entries.slice(0, 6)).toHaveLength(6);
  });

  it('drops a whole group when a later page fails (all or nothing)', async () => {
    world.coinTotal = 250;
    getMock.mockImplementation(async (path: string) => {
      if (path === '/catalog?page=3&limit=100') {
        throw new Error('boom');
      }
      return dispatch(path) as never;
    });
    const entries = await sitemap();
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`))).toHaveLength(0);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/public/`))).toHaveLength(2);
  });

  it('drops only the checklists when that call fails', async () => {
    getMock.mockImplementation(async (path: string) => {
      if (path === '/sets/canonical') {
        throw new Error('down');
      }
      return dispatch(path) as never;
    });
    const entries = await sitemap();
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/sets/canonical/`))).toHaveLength(0);
    expect(entries.filter((e) => e.url.startsWith(`${ORIGIN}/catalog/`))).toHaveLength(3);
  });

  it('never throws, even when every call fails', async () => {
    getMock.mockRejectedValue(new Error('api asleep'));
    const entries = await sitemap();
    expect(entries.map((e) => e.url)).toEqual([
      `${ORIGIN}/`,
      `${ORIGIN}/catalog`,
      `${ORIGIN}/glossary`,
      `${ORIGIN}/privacy`,
      `${ORIGIN}/sets/canonical`,
      `${ORIGIN}/sets/public`,
    ]);
  });

  it('does not reuse a degraded result on the next call', async () => {
    getMock.mockRejectedValueOnce(new Error('first call fails'));
    getMock.mockRejectedValueOnce(new Error('first call fails'));
    getMock.mockRejectedValueOnce(new Error('first call fails'));
    const degraded = await sitemap();
    expect(degraded).toHaveLength(6);
    getMock.mockImplementation(async (path: string) => dispatch(path) as never);
    const healthy = await sitemap();
    expect(healthy).toHaveLength(6 + 2 + 2 + 3);
  });
});
