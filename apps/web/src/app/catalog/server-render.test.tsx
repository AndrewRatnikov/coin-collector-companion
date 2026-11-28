/**
 * Tests for: /catalog server page (apps/web/src/app/catalog/page.tsx) and CatalogPageView initial data
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Page: CatalogPage,
 *                  Component: CatalogPageView, Module: server-catalog
 * Covers criteria: #11, #12, #13, #14, #15 (from prd.md)
 *
 * The page is built with renderToString and the catalog data hook is NOT mocked: the coin links must
 * be in the HTML without any client fetch. The API is mocked at the server helper (serverApiGet).
 * next/navigation's useSearchParams is mocked to the same params as the page's searchParams.
 * The client API module (getCatalog, getCatalogFacets) is mocked for the hydration and signed-in tests.
 *
 * CONTRACT_GAPs: none
 */

import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let searchParamsValue = new URLSearchParams();

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/server-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server-api')>()),
  serverApiGet: vi.fn(),
}));

vi.mock('@/lib/auth-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-token')>()),
  getStoredToken: vi.fn(),
}));

vi.mock('@/lib/catalog-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/catalog-api')>()),
  getCatalog: vi.fn(),
  getCatalogFacets: vi.fn(),
}));

vi.mock('@/components/catalog/submit-coin-form', () => ({
  default: () => null,
}));

vi.mock('@/components/catalog/submission-confirmation', () => ({
  default: () => null,
}));

import CatalogPage, { generateMetadata } from '@/app/catalog/page';
import { CatalogPageView } from '@/components/catalog/catalog-page-view';
import { QueryProvider } from '@/components/providers/query-provider';
import { getStoredToken } from '@/lib/auth-token';
import { getCatalog, getCatalogFacets } from '@/lib/catalog-api';
import { CATALOG_DESCRIPTION, CATALOG_TITLE } from '@/lib/catalog-seo';
import type { CatalogInitialPage } from '@/lib/catalog-view';
import { ServerApiError, serverApiGet } from '@/lib/server-api';
import { defaultOpenGraphImage, defaultTwitterImage } from '@/lib/set-page-seo';

const serverApiGetMock = vi.mocked(serverApiGet);
const getStoredTokenMock = vi.mocked(getStoredToken);
const getCatalogMock = vi.mocked(getCatalog);
const getCatalogFacetsMock = vi.mocked(getCatalogFacets);

const ORIGIN = 'https://site.example';

function makeCoin(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year: 1984,
    mintMark: '',
    variety: '',
    name: 'Lincoln Memorial Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    diameterMm: null,
    weightG: null,
    thicknessMm: null,
    material: null,
    mintage: null,
    isKeyDate: false,
    status: 'approved',
    submittedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function pageOf(items: unknown[], total: number, page = 1, limit = 20) {
  return { items, page, limit, total };
}

const PAGE_ONE = pageOf(
  [
    makeCoin('coin-1', { mintMark: 'D', variety: 'Type 2' }),
    makeCoin('coin-2', { year: 1958 }),
    makeCoin('coin-3', { year: 1959 }),
  ],
  30,
);

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  searchParamsValue = new URLSearchParams();
  serverApiGetMock.mockReset();
  getStoredTokenMock.mockReset();
  getStoredTokenMock.mockReturnValue(null);
  getCatalogMock.mockReset();
  getCatalogFacetsMock.mockReset();
  getCatalogFacetsMock.mockResolvedValue({ countries: ['USA'], denominations: ['1 Cent'] } as never);
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

type SearchParams = Record<string, string | string[] | undefined>;

function props(searchParams: SearchParams = {}) {
  return { searchParams: Promise.resolve(searchParams) };
}

function syncSearchParams(searchParams: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value !== undefined) params.append(key, value);
  }
  searchParamsValue = params;
}

async function buildTree(searchParams: SearchParams = {}) {
  syncSearchParams(searchParams);
  return <QueryProvider>{await CatalogPage(props(searchParams))}</QueryProvider>;
}

function dom(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

async function renderContainer(searchParams: SearchParams = {}) {
  return dom(renderToString(await buildTree(searchParams)));
}

describe('/catalog server render with data (criteria 11 and 12)', () => {
  it('puts the first results page in the HTML as real coin links, with no client fetch', async () => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);

    const container = await renderContainer();

    expect(serverApiGetMock).toHaveBeenCalledTimes(1);
    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=1&limit=20', { revalidate: 3600 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(getCatalogMock).not.toHaveBeenCalled();
    expect(within(container).getByTestId('catalog-page')).toBeInTheDocument();
    expect(within(container).getByTestId('catalog-results')).toBeInTheDocument();
    const links = within(container).getAllByTestId('catalog-item-link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/catalog/coin-1', '/catalog/coin-2', '/catalog/coin-3']);
    expect(links.every((l) => l.tagName === 'A')).toBe(true);
    expect(within(container).getByTestId('catalog-count')).toHaveTextContent('30 coins');
    expect(within(container).queryByTestId('catalog-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-error')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-empty')).not.toBeInTheDocument();
  });

  it('renders another response (the HTML is derived from the data)', async () => {
    serverApiGetMock.mockResolvedValue(pageOf([makeCoin('coin-9', { name: 'Morgan Dollar', year: 1921 })], 1));

    const container = await renderContainer();

    expect(within(container).getAllByTestId('catalog-item-link').map((l) => l.getAttribute('href'))).toEqual([
      '/catalog/coin-9',
    ]);
    expect(within(container).getByTestId('catalog-count')).toHaveTextContent('1 coin');
    expect(container.innerHTML).not.toContain('/catalog/coin-1');
  });

  it('asks the API for the URL\'s filters, search, sort and page', async () => {
    serverApiGetMock.mockResolvedValue(pageOf([makeCoin('coin-21')], 30, 3));

    const container = await renderContainer({ page: '3', country: 'USA' });

    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=3&limit=20&country=USA', { revalidate: 3600 });
    expect(within(container).getAllByTestId('catalog-item-link').map((l) => l.getAttribute('href'))).toEqual([
      '/catalog/coin-21',
    ]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(container).getByTestId('catalog-filter-country-USA')).toBeChecked();
  });

  it.each([
    [{ name: 'wheat', sort: 'year_desc', yearMin: '1900', keyDateOnly: 'true' }, '/catalog?page=1&limit=20&name=wheat&yearMin=1900&keyDateOnly=true&sort=year_desc'],
    [{ denomination: ['1 Cent', '5 Cents'] }, '/catalog?page=1&limit=20&denomination=1+Cent&denomination=5+Cents'],
  ])('builds the API path for %j', async (searchParams, expectedPath) => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);

    await renderContainer(searchParams);

    expect(serverApiGetMock).toHaveBeenCalledWith(expectedPath, { revalidate: 3600 });
  });

  it.each([
    [{ utm_source: 'x' }],
    [{ sort: 'bogus' }],
    [{ page: 'abc' }],
    [{ page: '1' }],
  ])('renders page 1 for %j (unknown or invalid values parse to the defaults)', async (searchParams) => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);

    await renderContainer(searchParams);

    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=1&limit=20', { revalidate: 3600 });
  });

  it('never asks for hideOwned (the server page is anonymous)', async () => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);

    await renderContainer({ hideOwned: 'true' });

    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=1&limit=20', { revalidate: 3600 });
  });

  it('renders the existing empty state with HTTP 200 and no error for a page past the last one', async () => {
    serverApiGetMock.mockResolvedValue(pageOf([], 30, 9));

    const container = await renderContainer({ page: '9' });

    expect(serverApiGetMock).toHaveBeenCalledWith('/catalog?page=9&limit=20', { revalidate: 3600 });
    expect(within(container).getByTestId('catalog-empty')).toBeInTheDocument();
    expect(within(container).getByTestId('catalog-empty-clear')).toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-error')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-item-link')).not.toBeInTheDocument();
  });

  it('does not read the stored token while rendering and adds no signed-in elements', async () => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);
    getStoredTokenMock.mockReturnValue('tok-abc');

    const container = await renderContainer();

    expect(getStoredTokenMock).not.toHaveBeenCalled();
    expect(within(container).queryByTestId('catalog-item-ownership')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-filter-hide-owned')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-submit-coin-toggle')).not.toBeInTheDocument();
  });
});

describe('/catalog when the server helper fails', () => {
  it.each([
    ['a timeout', new ServerApiError('timeout', null, 'timed out')],
    ['a network error', new ServerApiError('network', null, 'down')],
    ['a 503', new ServerApiError('http', 503, 'down')],
    ['a 404', new ServerApiError('http', 404, 'nf')],
  ])('still renders (no 404) with the client loading path after %s', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    const container = await renderContainer();

    expect(within(container).getByTestId('catalog-page')).toBeInTheDocument();
    expect(within(container).getByTestId('catalog-loading')).toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-item-link')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('catalog-error')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('not-found')).not.toBeInTheDocument();
  });
});

describe('/catalog generateMetadata (criteria 13 and 14)', () => {
  it('returns the catalog title, description, self canonical, Open Graph and Twitter with the default images', async () => {
    const meta = await generateMetadata(props());

    expect(meta.title).toBe(CATALOG_TITLE);
    expect(meta.description).toBe(CATALOG_DESCRIPTION);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
    expect(meta.openGraph).toEqual({
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      url: `${ORIGIN}/catalog`,
      type: 'website',
      images: [defaultOpenGraphImage(ORIGIN)],
    });
    expect(meta.twitter).toEqual({
      card: 'summary_large_image',
      title: CATALOG_TITLE,
      description: CATALOG_DESCRIPTION,
      images: [defaultTwitterImage(ORIGIN)],
    });
    expect(meta).not.toHaveProperty('robots');
    expect(serverApiGetMock).not.toHaveBeenCalled();
  });

  it.each([
    [{}],
    [{ utm_source: 'x' }],
    [{ sort: 'bogus' }],
    [{ page: '1' }],
    [{ page: 'abc' }],
    [{ sort: 'year_asc' }],
    [{ country: '' }],
    [{ utm_source: 'x', sort: 'bogus', page: '1' }],
  ])('is indexable (no robots key) for %j', async (searchParams) => {
    const meta = await generateMetadata(props(searchParams));

    expect(meta).not.toHaveProperty('robots');
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
  });

  it.each([
    [{ country: 'USA' }],
    [{ denomination: ['1 Cent', '5 Cents'] }],
    [{ name: 'wheat' }],
    [{ yearMin: '1900' }],
    [{ keyDateOnly: 'true' }],
    [{ sort: 'year_desc' }],
    [{ page: '2' }],
    [{ utm_source: 'x', country: 'USA' }],
  ])('is noindex,follow with the plain canonical for %j', async (searchParams) => {
    const meta = await generateMetadata(props(searchParams));

    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog`);
    expect(meta.openGraph).toMatchObject({ url: `${ORIGIN}/catalog` });
  });
});

describe('CatalogPage hydration with a stored token (criterion 12)', () => {
  it('hydrates the server HTML with no mismatch warning, then shows the ownership badges after one refetch', async () => {
    serverApiGetMock.mockResolvedValue(PAGE_ONE);
    const tree = await buildTree();

    getStoredTokenMock.mockReturnValue(null);
    const html = renderToString(tree);
    expect(html).not.toContain('catalog-item-ownership');

    getStoredTokenMock.mockReturnValue('tok-abc');
    getCatalogMock.mockResolvedValue(
      pageOf(
        [
          makeCoin('coin-1', { mintMark: 'D', variety: 'Type 2', owned: true, inSetsCount: 2 }),
          makeCoin('coin-2', { year: 1958, owned: false, inSetsCount: 0 }),
          makeCoin('coin-3', { year: 1959, owned: false, inSetsCount: 0 }),
        ],
        30,
      ) as never,
    );
    const container = dom(html);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(onRecoverableError).not.toHaveBeenCalled();
    const wrapper = await within(container).findByTestId('catalog-item-ownership');
    expect(wrapper).toHaveTextContent('✓ Owned');
    expect(wrapper).toHaveTextContent('In 2 sets');
    expect(getCatalogMock).toHaveBeenCalledTimes(1);
    expect(getCatalogMock).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(within(container).getAllByTestId('catalog-item-link')).toHaveLength(3);
  });
});

describe('CatalogPageView with server initial data (criterion 12)', () => {
  const FILTERS = { page: 1, limit: 20 };
  const INITIAL: CatalogInitialPage = { filters: FILTERS, data: PAGE_ONE as never };

  function renderView(initialCatalog: CatalogInitialPage | null = INITIAL) {
    return render(
      <QueryProvider>
        <CatalogPageView initialCatalog={initialCatalog ?? undefined} />
      </QueryProvider>,
    );
  }

  it('shows the server page at once and fetches nothing when signed out', async () => {
    renderView();

    expect(screen.getAllByTestId('catalog-item-link')).toHaveLength(3);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getCatalogMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('catalog-item-ownership')).not.toBeInTheDocument();
  });

  it('refetches exactly once when a stored token is found, and keeps showing the server page until it arrives', async () => {
    getStoredTokenMock.mockReturnValue('tok-abc');
    let resolveCatalog: (value: never) => void = () => undefined;
    getCatalogMock.mockReturnValue(new Promise((resolve) => (resolveCatalog = resolve)) as never);

    renderView();

    await waitFor(() => {
      expect(getCatalogMock).toHaveBeenCalledTimes(1);
    });
    expect(getCatalogMock).toHaveBeenCalledWith(FILTERS);
    expect(screen.getAllByTestId('catalog-item-link')).toHaveLength(3);
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();

    await act(async () => {
      resolveCatalog(
        pageOf([makeCoin('coin-1', { owned: true, inSetsCount: 1 })], 30) as never,
      );
    });

    expect(await screen.findByTestId('catalog-item-ownership')).toHaveTextContent('In 1 set');
    expect(getCatalogMock).toHaveBeenCalledTimes(1);
  });

  it('does not use the server page for other filters, and fetches those instead', async () => {
    searchParamsValue = new URLSearchParams('country=USA');
    getCatalogMock.mockReturnValue(new Promise(() => undefined) as never);

    renderView();

    await waitFor(() => {
      expect(getCatalogMock).toHaveBeenCalledTimes(1);
    });
    expect(getCatalogMock).toHaveBeenCalledWith({ page: 1, limit: 20, country: 'USA' });
    expect(screen.queryByTestId('catalog-item-link')).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
  });

  it('fetches normally without initial data', async () => {
    getCatalogMock.mockResolvedValue(pageOf([makeCoin('coin-7')], 1) as never);

    renderView(null);

    await waitFor(() => {
      expect(screen.getAllByTestId('catalog-item-link').map((l) => l.getAttribute('href'))).toEqual(['/catalog/coin-7']);
    });
    expect(getCatalogMock).toHaveBeenCalledTimes(1);
  });
});
