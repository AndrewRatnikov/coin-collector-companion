/**
 * Tests for: /catalog/[coinId] server page (apps/web/src/app/catalog/[coinId]/page.tsx)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Page: CoinDetailPage,
 *                  Component: CoinDetailView, Component: CoinPageJsonLd, Module: server-catalog
 * Covers criteria: #1, #2, #3, #4, #4a, #5, #6, #7, #8, #9, #10, #15 (from prd.md)
 *
 * The page is built with renderToString and the data TanStack hooks are NOT mocked: the coin must be
 * in the HTML without any client fetch. The API is mocked at the server helper (serverApiGet), with
 * the real ServerApiError class, and routed by path (coin, checklist list, checklist details).
 * Only the collection and user-sets hooks are wrapped so the hydration test can give them an idle
 * result; every other test runs the real hooks. getStoredToken is wrapped the same way.
 *
 * CONTRACT_GAPs: none
 */

import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server-api')>()),
  serverApiGet: vi.fn(),
}));

vi.mock('@/lib/auth-token', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-token')>()),
  getStoredToken: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-collection')>();
  return { ...actual, useCollection: vi.fn(actual.useCollection) };
});

vi.mock('@/lib/hooks/use-user-sets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-user-sets')>();
  return { ...actual, useUserSets: vi.fn(actual.useUserSets) };
});

import CoinDetailPage, { generateMetadata } from '@/app/catalog/[coinId]/page';
import { QueryProvider } from '@/components/providers/query-provider';
import { getStoredToken } from '@/lib/auth-token';
import { COIN_FALLBACK_DESCRIPTION, COIN_FALLBACK_TITLE } from '@/lib/catalog-seo';
import { useCollection } from '@/lib/hooks/use-collection';
import { useUserSets } from '@/lib/hooks/use-user-sets';
import { ServerApiError, serverApiGet } from '@/lib/server-api';
import { defaultOpenGraphImage, defaultTwitterImage } from '@/lib/set-page-seo';

const serverApiGetMock = vi.mocked(serverApiGet);
const getStoredTokenMock = vi.mocked(getStoredToken);
const useCollectionMock = vi.mocked(useCollection);
const useUserSetsMock = vi.mocked(useUserSets);

const ORIGIN = 'https://site.example';
const ID = '7e57c011-0000-4000-8000-000000000001';
const SET_A = '7e57ca70-0000-4000-8000-000000000001';
const SET_B = '7e57ca70-0000-4000-8000-000000000002';
const SET_C = '7e57ca70-0000-4000-8000-000000000003';
const IMAGE = 'https://upload.wikimedia.org/vdb.jpg';

function makeCoin(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    country: 'USA',
    denomination: '1 Cent',
    year: 1909,
    mintMark: 'S',
    variety: 'VDB',
    name: 'Lincoln Wheat Cent',
    imageUrl: IMAGE,
    imageSource: 'Wikimedia Commons',
    imageLicense: 'CC BY-SA 4.0',
    diameterMm: 19.05,
    weightG: 3.11,
    thicknessMm: 1.55,
    material: 'Bronze',
    mintage: 484000,
    isKeyDate: true,
    status: 'approved',
    submittedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const KEY_DATE = makeCoin();

const PLAIN = makeCoin({
  year: 1984,
  mintMark: 'D',
  variety: 'Type 2',
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
});

function slot(coinId: string, position: number) {
  return { id: `slot-${position}`, position, coin: { id: coinId, year: 1909 } };
}

function summary(id: string, name: string) {
  return { id, name, description: null, source: 'seed-template', templateVersion: 'v1' };
}

function detail(id: string, name: string, coinIds: string[]) {
  return { ...summary(id, name), coins: coinIds.map((c, i) => slot(c, i)) };
}

const LIST = [
  summary(SET_A, 'Lincoln Wheat Cents'),
  summary(SET_B, 'Morgan Dollars'),
  summary(SET_C, 'Lincoln Wheat Cent Key Dates'),
];

interface Api {
  coin?: unknown;
  coinError?: Error;
  list?: unknown;
  listError?: Error;
  details?: Record<string, unknown>;
  detailErrors?: Record<string, Error>;
}

function mockApi(api: Api) {
  const details = api.details ?? {
    [SET_A]: detail(SET_A, 'Lincoln Wheat Cents', ['other', ID]),
    [SET_B]: detail(SET_B, 'Morgan Dollars', ['other']),
    [SET_C]: detail(SET_C, 'Lincoln Wheat Cent Key Dates', [ID]),
  };
  serverApiGetMock.mockImplementation(async (path: string) => {
    if (path.startsWith('/catalog/')) {
      if (api.coinError) throw api.coinError;
      return (api.coin ?? KEY_DATE) as never;
    }
    if (path === '/sets/canonical') {
      if (api.listError) throw api.listError;
      return (api.list ?? LIST) as never;
    }
    const setId = path.replace('/sets/canonical/', '');
    if (api.detailErrors?.[setId]) throw api.detailErrors[setId];
    return details[setId] as never;
  });
}

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  serverApiGetMock.mockReset();
  getStoredTokenMock.mockReset();
  getStoredTokenMock.mockReturnValue(null);
  useCollectionMock.mockReset();
  useUserSetsMock.mockReset();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function params(coinId = ID) {
  return { params: Promise.resolve({ coinId }) };
}

async function buildTree(coinId = ID) {
  return <QueryProvider>{await CoinDetailPage(params(coinId))}</QueryProvider>;
}

function dom(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

async function renderContainer(coinId = ID) {
  return dom(renderToString(await buildTree(coinId)));
}

function jsonLd(container: HTMLElement, testId: string) {
  const script = within(container).getByTestId(testId);
  expect(script.tagName).toBe('SCRIPT');
  expect(script).toHaveAttribute('type', 'application/ld+json');
  return JSON.parse(script.textContent ?? '');
}

describe('/catalog/[coinId] server render with data (criteria 1 and 3)', () => {
  it('puts the name block, specs, mintage, key-date flag, image and attribution in the HTML with no client fetch', async () => {
    mockApi({});

    const container = await renderContainer();

    expect(serverApiGetMock).toHaveBeenCalledWith(`/catalog/${ID}`, { revalidate: 86400 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(container).getByTestId('coin-detail-page')).toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-error')).not.toBeInTheDocument();

    expect(within(container).getByTestId('coin-detail-label')).toHaveTextContent(/^1909-S VDB$/);
    expect(within(container).getByTestId('coin-detail-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    expect(within(container).getByTestId('coin-detail-subtitle')).toHaveTextContent(/^USA · 1 Cent$/);
    const country = within(container).getByTestId('coin-detail-breadcrumb-country');
    expect(country).toHaveTextContent('USA');
    expect(country.getAttribute('href')).toBe('/catalog?country=USA');
    expect(within(container).getByTestId('coin-detail-breadcrumb-series')).toHaveTextContent('Lincoln Wheat Cent');

    expect(within(container).getByTestId('coin-detail-mint-mark')).toHaveTextContent('S');
    expect(within(container).getByTestId('coin-detail-diameter')).toHaveTextContent('19.05 mm');
    expect(within(container).getByTestId('coin-detail-weight')).toHaveTextContent('3.11 g');
    expect(within(container).getByTestId('coin-detail-thickness')).toHaveTextContent('1.55 mm');
    expect(within(container).getByTestId('coin-detail-material')).toHaveTextContent('Bronze');
    expect(within(container).getByTestId('coin-detail-mintage')).toHaveTextContent('484,000');

    expect(within(container).getByTestId('coin-detail-key-date-badge')).toHaveTextContent('Key date');
    expect(within(container).getByTestId('coin-detail-image')).toBeInTheDocument();
    const attribution = within(container).getByTestId('coin-detail-attribution');
    expect(attribution).toHaveTextContent('Wikimedia Commons');
    expect(attribution).toHaveTextContent('CC BY-SA 4.0');
    expect(within(container).queryByTestId('coin-detail-plate-caption')).not.toBeInTheDocument();
  });

  it('renders another coin from another response (the HTML is derived from the data)', async () => {
    mockApi({ coin: PLAIN });

    const container = await renderContainer();

    expect(within(container).getByTestId('coin-detail-label')).toHaveTextContent(/^Type 2$/);
    expect(within(container).getByTestId('coin-detail-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1984-D$/);
    expect(within(container).getByTestId('coin-detail-mint-mark')).toHaveTextContent('D');
    expect(within(container).getByTestId('coin-detail-mintage')).toHaveTextContent('Not recorded');
    expect(within(container).queryByTestId('coin-detail-key-date-badge')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-attribution')).not.toBeInTheDocument();
    expect(within(container).getByTestId('coin-detail-plate-caption')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('484,000');
    expect(container.innerHTML).not.toContain('Wikimedia Commons');
  });

  it('is the anonymous view: it does not read the token and adds no signed-in elements', async () => {
    mockApi({});
    getStoredTokenMock.mockReturnValue('tok-abc');

    const container = await renderContainer();

    expect(getStoredTokenMock).not.toHaveBeenCalled();
    expect(within(container).getByTestId('coin-detail-login-prompt')).toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-ownership-panel')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-mobile-bar')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-grade-select')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-add-to-set')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-sets')).not.toBeInTheDocument();
    expect(within(container).getByTestId('coin-detail-plate')).toHaveAttribute('data-owned', 'false');
  });

  it('does not render the pending badge for an approved coin', async () => {
    mockApi({});

    const container = await renderContainer();

    expect(within(container).queryByTestId('coin-detail-pending-badge')).not.toBeInTheDocument();
  });
});

describe('/catalog/[coinId] checklists that contain the coin (criterion 2)', () => {
  it('links every checklist whose slots include the coin, in list order, and no other', async () => {
    mockApi({});

    const container = await renderContainer();

    expect(serverApiGetMock).toHaveBeenCalledWith('/sets/canonical', { revalidate: 3600 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const section = within(container).getByTestId('coin-detail-checklists');
    expect(within(section).getByRole('heading', { name: 'In checklists' })).toBeInTheDocument();
    expect(within(section).getByTestId('coin-detail-checklists-list')).toBeInTheDocument();
    expect(within(section).getAllByTestId('coin-detail-checklist-item')).toHaveLength(2);
    const links = within(section).getAllByTestId('coin-detail-checklist-link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([`/sets/canonical/${SET_A}`, `/sets/canonical/${SET_C}`]);
    expect(links.map((l) => l.textContent)).toEqual(['Lincoln Wheat Cents', 'Lincoln Wheat Cent Key Dates']);
    expect(section.textContent).not.toContain('Morgan Dollars');
  });

  it('comes after the specifications table', async () => {
    mockApi({});

    const container = await renderContainer();

    const specs = within(container).getByTestId('coin-detail-specs');
    const section = within(container).getByTestId('coin-detail-checklists');
    expect(specs.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lists different checklists for a different coin (not hard-coded)', async () => {
    mockApi({
      coin: makeCoin({ id: '7e57c011-0000-4000-8000-000000000002' }),
      details: {
        [SET_A]: detail(SET_A, 'Lincoln Wheat Cents', ['other']),
        [SET_B]: detail(SET_B, 'Morgan Dollars', ['7e57c011-0000-4000-8000-000000000002']),
        [SET_C]: detail(SET_C, 'Lincoln Wheat Cent Key Dates', ['other']),
      },
    });

    const container = await renderContainer('7e57c011-0000-4000-8000-000000000002');

    const links = within(container).getAllByTestId('coin-detail-checklist-link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([`/sets/canonical/${SET_B}`]);
    expect(links[0]).toHaveTextContent('Morgan Dollars');
  });

  it('renders no section, heading or links for a coin that is in no checklist', async () => {
    mockApi({
      details: {
        [SET_A]: detail(SET_A, 'Lincoln Wheat Cents', ['other']),
        [SET_B]: detail(SET_B, 'Morgan Dollars', ['other']),
        [SET_C]: detail(SET_C, 'Lincoln Wheat Cent Key Dates', ['other']),
      },
    });

    const container = await renderContainer();

    expect(within(container).getByTestId('coin-detail-label')).toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-checklists')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-checklist-link')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toContain('In checklists');
  });

  it('lists only the checklists that loaded when one lookup fails, and still renders the coin with no fallback', async () => {
    mockApi({ detailErrors: { [SET_A]: new ServerApiError('timeout', null, 'timed out') } });

    const container = await renderContainer();

    const links = within(container).getAllByTestId('coin-detail-checklist-link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([`/sets/canonical/${SET_C}`]);
    expect(within(container).getByTestId('coin-detail-label')).toHaveTextContent('1909-S VDB');
    expect(within(container).queryByTestId('coin-detail-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-error')).not.toBeInTheDocument();
    expect(within(container).getByTestId('coin-breadcrumb-json-ld')).toBeInTheDocument();
  });

  it.each([
    ['the list call fails', { listError: new ServerApiError('http', 503, 'down') }],
    [
      'every detail call fails',
      {
        detailErrors: {
          [SET_A]: new ServerApiError('timeout', null, 't'),
          [SET_B]: new ServerApiError('timeout', null, 't'),
          [SET_C]: new ServerApiError('timeout', null, 't'),
        },
      },
    ],
  ])('renders the coin and no checklist section when %s', async (_label, api) => {
    mockApi(api);

    const container = await renderContainer();

    expect(within(container).getByTestId('coin-detail-label')).toHaveTextContent('1909-S VDB');
    expect(within(container).queryByTestId('coin-detail-checklists')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-error')).not.toBeInTheDocument();
  });
});

describe('/catalog/[coinId] JSON-LD (criterion 10)', () => {
  it('adds BreadcrumbList and Thing JSON-LD that parse with the exact fields', async () => {
    mockApi({});

    const container = await renderContainer();

    expect(jsonLd(container, 'coin-breadcrumb-json-ld')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Catalog', item: `${ORIGIN}/catalog` },
        { '@type': 'ListItem', position: 2, name: 'USA', item: `${ORIGIN}/catalog?country=USA` },
        {
          '@type': 'ListItem',
          position: 3,
          name: '1 Cent',
          item: `${ORIGIN}/catalog?country=USA&denomination=1+Cent`,
        },
        { '@type': 'ListItem', position: 4, name: '1909-S VDB', item: `${ORIGIN}/catalog/${ID}` },
      ],
    });
    expect(jsonLd(container, 'coin-thing-json-ld')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Thing',
      name: 'Lincoln Wheat Cent · 1909-S VDB · USA · 1 Cent',
      url: `${ORIGIN}/catalog/${ID}`,
      image: IMAGE,
      additionalProperty: [
        { '@type': 'PropertyValue', name: 'Year', value: 1909 },
        { '@type': 'PropertyValue', name: 'Mint mark', value: 'S' },
        { '@type': 'PropertyValue', name: 'Variety', value: 'VDB' },
        { '@type': 'PropertyValue', name: 'Mintage', value: 484000 },
        { '@type': 'PropertyValue', name: 'Composition', value: 'Bronze' },
        { '@type': 'PropertyValue', name: 'Diameter', value: 19.05, unitCode: 'MMT', unitText: 'mm' },
        { '@type': 'PropertyValue', name: 'Weight', value: 3.11, unitCode: 'GRM', unitText: 'g' },
      ],
    });
  });

  it('has no image and only known properties for a coin without a licensed image or specs', async () => {
    mockApi({ coin: PLAIN });

    const container = await renderContainer();

    const thing = jsonLd(container, 'coin-thing-json-ld');
    expect(thing).not.toHaveProperty('image');
    expect(thing.additionalProperty.map((p: { name: string }) => p.name)).toEqual(['Year', 'Mint mark', 'Variety']);
  });

  it('carries no Product, offers, rating or review data', async () => {
    mockApi({});

    const container = await renderContainer();

    const text =
      within(container).getByTestId('coin-breadcrumb-json-ld').textContent +
      within(container).getByTestId('coin-thing-json-ld').textContent;
    expect(text).not.toMatch(/Product|offers|aggregateRating|review/i);
  });
});

describe('/catalog/[coinId] generateMetadata (criteria 6 to 9)', () => {
  it('returns the title, description, canonical URL, Open Graph and Twitter for a key date with a licensed image', async () => {
    mockApi({});

    const meta = await generateMetadata(params());

    expect(serverApiGetMock).toHaveBeenCalledWith(`/catalog/${ID}`, { revalidate: 86400 });
    expect(meta.title).toBe('1909-S VDB · USA · 1 Cent · Coin Companion');
    expect(meta.description).toBe('1909-S VDB, USA, 1 Cent. Mintage: 484,000. Composition: Bronze. Diameter: 19.05 mm.');
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog/${ID}`);
    expect(meta.openGraph).toEqual({
      title: '1909-S VDB · USA · 1 Cent · Coin Companion',
      description: '1909-S VDB, USA, 1 Cent. Mintage: 484,000. Composition: Bronze. Diameter: 19.05 mm.',
      url: `${ORIGIN}/catalog/${ID}`,
      type: 'website',
      images: [{ url: IMAGE, alt: '1909-S VDB' }],
    });
    expect(meta.twitter).toMatchObject({ card: 'summary', images: [{ url: IMAGE, alt: '1909-S VDB' }] });
    expect(meta).not.toHaveProperty('robots');
  });

  it('follows the coin: another title and description, and the site default image without a licensed one', async () => {
    mockApi({ coin: PLAIN });

    const meta = await generateMetadata(params());

    expect(meta.title).toBe('1984-D Type 2 · USA · 1 Cent · Coin Companion');
    expect(meta.description).toBe('1984-D Type 2, USA, 1 Cent.');
    expect(meta.openGraph).toMatchObject({ images: [defaultOpenGraphImage(ORIGIN)] });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', images: [defaultTwitterImage(ORIGIN)] });
  });

  it('uses the default image when the image has no license', async () => {
    mockApi({ coin: makeCoin({ imageLicense: null }) });

    const meta = await generateMetadata(params());

    expect(meta.openGraph).toMatchObject({ images: [defaultOpenGraphImage(ORIGIN)] });
    expect(JSON.stringify(meta)).not.toContain(IMAGE);
  });

  it.each([404, 400])('returns the fixed noindex fallback for an API %i', async (status) => {
    mockApi({ coinError: new ServerApiError('http', status, 'x') });

    const meta = await generateMetadata(params());

    expect(meta.title).toBe(COIN_FALLBACK_TITLE);
    expect(meta.description).toBe(COIN_FALLBACK_DESCRIPTION);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/catalog/${ID}`);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it.each(['pending', 'rejected'])('returns the noindex fallback for a %s coin and never names it', async (status) => {
    mockApi({ coin: makeCoin({ status, variety: 'SecretVariety' }) });

    const meta = await generateMetadata(params());

    expect(meta.title).toBe(COIN_FALLBACK_TITLE);
    expect(meta.robots).toEqual({ index: false, follow: false });
    expect(JSON.stringify(meta)).not.toContain('SecretVariety');
  });

  it('returns the noindex fallback for a malformed id without calling the API', async () => {
    mockApi({});

    const meta = await generateMetadata(params('not-a-uuid'));

    expect(serverApiGetMock).not.toHaveBeenCalled();
    expect(meta.title).toBe(COIN_FALLBACK_TITLE);
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it.each([
    ['a timeout', new ServerApiError('timeout', null, 't')],
    ['a 500', new ServerApiError('http', 500, 'boom')],
    ['a network error', new ServerApiError('network', null, 'n')],
  ])('returns the fallback without a robots key and does not throw after %s', async (_label, error) => {
    mockApi({ coinError: error });

    const meta = await generateMetadata(params());

    expect(meta.title).toBe(COIN_FALLBACK_TITLE);
    expect(meta.description).toBe(COIN_FALLBACK_DESCRIPTION);
    expect(meta).not.toHaveProperty('robots');
  });
});

describe('/catalog/[coinId] not found (criteria 4 and 4a)', () => {
  it('rejects with the Next 404 error for a non-UUID id and never calls the API', async () => {
    mockApi({});

    await expect(CoinDetailPage(params('not-a-uuid'))).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
    expect(serverApiGetMock).not.toHaveBeenCalled();
  });

  it.each([404, 400])('rejects with the Next 404 error for an API %i', async (status) => {
    mockApi({ coinError: new ServerApiError('http', status, 'x') });

    await expect(CoinDetailPage(params())).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  });

  it.each(['pending', 'rejected'])('rejects with the Next 404 error for a %s coin', async (status) => {
    mockApi({ coin: makeCoin({ status, variety: 'SecretVariety' }) });

    await expect(CoinDetailPage(params())).rejects.toMatchObject({ digest: 'NEXT_HTTP_ERROR_FALLBACK;404' });
  });

  it('does not 404 for an approved coin', async () => {
    mockApi({});

    await expect(CoinDetailPage(params())).resolves.toBeDefined();
  });
});

describe('/catalog/[coinId] when the coin cannot be loaded (criterion 5)', () => {
  it.each([
    ['a timeout', new ServerApiError('timeout', null, 'timed out')],
    ['a network error', new ServerApiError('network', null, 'down')],
    ['a 503', new ServerApiError('http', 503, 'down')],
    ['a 500', new ServerApiError('http', 500, 'boom')],
  ])('still renders with the client loading path after %s, with no coin data or JSON-LD', async (_label, error) => {
    mockApi({ coinError: error });

    const container = await renderContainer();

    expect(within(container).getByTestId('coin-detail-page')).toBeInTheDocument();
    expect(within(container).getByTestId('coin-detail-loading')).toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-label')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-specs')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-checklists')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('not-found')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-error')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-breadcrumb-json-ld')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('coin-thing-json-ld')).not.toBeInTheDocument();
  });
});

describe('/catalog/[coinId] hydration with a stored token (criterion 3)', () => {
  it('hydrates the server HTML with no mismatch warning, then attaches the ownership panel after mount', async () => {
    mockApi({});
    const tree = await buildTree();

    getStoredTokenMock.mockReturnValue(null);
    const html = renderToString(tree);
    expect(html).not.toContain('coin-detail-ownership-panel');
    expect(html).toContain('coin-detail-login-prompt');

    getStoredTokenMock.mockReturnValue('tok-abc');
    useCollectionMock.mockImplementation(
      () => ({ data: [], isLoading: false, isError: false }) as unknown as ReturnType<typeof useCollection>,
    );
    useUserSetsMock.mockImplementation(
      () => ({ data: [], isLoading: false, isError: false }) as unknown as ReturnType<typeof useUserSets>,
    );
    const container = dom(html);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(within(container).getByTestId('coin-detail-ownership-panel')).toBeInTheDocument();
    expect(within(container).queryByTestId('coin-detail-login-prompt')).not.toBeInTheDocument();
    expect(within(container).getByTestId('coin-detail-label')).toHaveTextContent('1909-S VDB');
    expect(within(container).getAllByTestId('coin-detail-checklist-link')).toHaveLength(2);
  });
});
