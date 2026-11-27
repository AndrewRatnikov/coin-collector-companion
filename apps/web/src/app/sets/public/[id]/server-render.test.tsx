/**
 * Tests for: /sets/public/[id] server page (apps/web/src/app/sets/public/[id]/page.tsx)
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Pages (server components),
 *                  § Module: server-sets, § Components: set-page JSON-LD
 * Covers criteria: #1, #3, #4, #5, #6, #7, #8, #9 (from prd.md)
 *
 * The page is built with renderToString and the data TanStack hooks are NOT mocked: the coin rows have to
 * be in the HTML without any client fetch. The API is mocked at the server helper (serverApiGet), with
 * the real ServerApiError class. Only the gaps hook is wrapped so the hydration test can give it an idle
 * result; every other test runs the real hook. getStoredToken is wrapped the same way.
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

vi.mock('@/lib/hooks/use-user-sets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-user-sets')>();
  return { ...actual, useSetGaps: vi.fn(actual.useSetGaps) };
});

import PublicSetDetailPage, { generateMetadata } from '@/app/sets/public/[id]/page';
import { QueryProvider } from '@/components/providers/query-provider';
import { getStoredToken } from '@/lib/auth-token';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { ServerApiError, serverApiGet } from '@/lib/server-api';

const serverApiGetMock = vi.mocked(serverApiGet);
const getStoredTokenMock = vi.mocked(getStoredToken);
const useSetGapsMock = vi.mocked(useSetGaps);

const ORIGIN = 'https://site.example';
const ID = '7e575e70-0000-4000-8000-000000000001';

function coin(id: string, year: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    isKeyDate: false,
    ...extra,
  };
}

// API order differs from position order on purpose.
const SET = {
  id: ID,
  userId: 'user-1',
  name: "Alice's Wheat Cents",
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: '2026-11-01T10:00:00.000Z',
  updatedAt: '2026-11-02T10:00:00.000Z',
  coins: [
    { id: 'usc-3', position: 2, coin: coin('coin-3', 1955, { variety: 'Doubled Die Obverse' }) },
    { id: 'usc-1', position: 0, coin: coin('coin-1', 1909, { mintMark: 'S', variety: 'VDB' }) },
    { id: 'usc-2', position: 1, coin: coin('coin-2', 1958) },
  ],
};

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  serverApiGetMock.mockReset();
  getStoredTokenMock.mockReset();
  getStoredTokenMock.mockReturnValue(null);
  useSetGapsMock.mockReset();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

function params(id = ID) {
  return { params: Promise.resolve({ id }) };
}

async function buildTree(id = ID) {
  return <QueryProvider>{await PublicSetDetailPage(params(id))}</QueryProvider>;
}

function dom(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

async function renderContainer(id = ID) {
  return dom(renderToString(await buildTree(id)));
}

function jsonLd(container: HTMLElement, testId: string) {
  const script = within(container).getByTestId(testId);
  expect(script.tagName).toBe('SCRIPT');
  expect(script).toHaveAttribute('type', 'application/ld+json');
  return JSON.parse(script.textContent ?? '');
}

describe('/sets/public/[id] server render with data', () => {
  it('puts the name and every coin row in the HTML, in position order, with no client fetch', async () => {
    serverApiGetMock.mockResolvedValue(SET);

    const container = await renderContainer();

    expect(serverApiGetMock).toHaveBeenCalledWith(`/sets/public/${ID}`, { revalidate: 3600 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(container).getByTestId('public-set-detail-page')).toBeInTheDocument();
    expect(within(container).getByTestId('public-set-detail-name')).toHaveTextContent("Alice's Wheat Cents");
    expect(within(container).queryByTestId('public-set-detail-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-error')).not.toBeInTheDocument();

    expect(within(container).getByTestId('public-set-detail-coin-list')).toBeInTheDocument();
    const items = within(container).getAllByTestId('public-set-detail-coin-item');
    expect(items).toHaveLength(3);
    expect(within(items[0]).getByTestId('public-set-detail-coin-link').getAttribute('href')).toBe('/catalog/coin-1');
    expect(within(items[0]).getByTestId('public-set-detail-coin-eyebrow')).toHaveTextContent(/^Lincoln Wheat Cent$/);
    expect(within(items[0]).getByTestId('public-set-detail-coin-title')).toHaveTextContent(/^VDB$/);
    expect(within(items[0]).getByTestId('public-set-detail-coin-subtitle')).toHaveTextContent(
      /^USA · 1 Cent · 1909-S$/,
    );
    expect(within(items[1]).getByTestId('public-set-detail-coin-link').getAttribute('href')).toBe('/catalog/coin-2');
    expect(within(items[1]).getByTestId('public-set-detail-coin-subtitle')).toHaveTextContent(/^USA · 1 Cent · 1958$/);
    expect(within(items[2]).getByTestId('public-set-detail-coin-link').getAttribute('href')).toBe('/catalog/coin-3');
    expect(within(items[2]).getByTestId('public-set-detail-coin-title')).toHaveTextContent(/^Doubled Die Obverse$/);
  });

  it('renders another set from another response (the HTML is derived from the data)', async () => {
    serverApiGetMock.mockResolvedValue({
      ...SET,
      name: 'Bob Dimes',
      coins: [{ id: 'usc-9', position: 0, coin: coin('coin-9', 1946, { denomination: '10 Cents' }) }],
    });

    const container = await renderContainer();

    expect(within(container).getByTestId('public-set-detail-name')).toHaveTextContent('Bob Dimes');
    expect(within(container).getAllByTestId('public-set-detail-coin-item')).toHaveLength(1);
    expect(container.innerHTML).not.toContain("Alice's Wheat Cents");
  });

  it('adds no coin count element (the count is only in metadata and JSON-LD)', async () => {
    serverApiGetMock.mockResolvedValue(SET);

    const container = await renderContainer();

    expect(within(container).queryByText('3', { selector: 'span' })).not.toBeInTheDocument();
    expect(within(container).queryByText(/3 coins/)).not.toBeInTheDocument();
  });

  it('does not read the stored token while rendering and adds no signed-in elements', async () => {
    serverApiGetMock.mockResolvedValue(SET);
    getStoredTokenMock.mockReturnValue('tok-abc');

    const container = await renderContainer();

    expect(getStoredTokenMock).not.toHaveBeenCalled();
    expect(within(container).queryByTestId('public-set-clone-cta')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-progress')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-progress-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-coin-mark')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-coin-grade')).not.toBeInTheDocument();
  });

  it('adds BreadcrumbList and ItemList JSON-LD that parse with the exact fields', async () => {
    serverApiGetMock.mockResolvedValue(SET);

    const container = await renderContainer();

    expect(jsonLd(container, 'set-breadcrumb-json-ld')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Public sets', item: `${ORIGIN}/sets/public` },
        { '@type': 'ListItem', position: 3, name: "Alice's Wheat Cents", item: `${ORIGIN}/sets/public/${ID}` },
      ],
    });
    expect(jsonLd(container, 'set-coin-list-json-ld')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      numberOfItems: 3,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Lincoln Wheat Cent · VDB · USA · 1 Cent · 1909-S',
          url: `${ORIGIN}/catalog/coin-1`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Lincoln Wheat Cent · USA · 1 Cent · 1958',
          url: `${ORIGIN}/catalog/coin-2`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Lincoln Wheat Cent · Doubled Die Obverse · USA · 1 Cent · 1955',
          url: `${ORIGIN}/catalog/coin-3`,
        },
      ],
    });
    expect(within(container).queryByTestId('checklists-collection-json-ld')).not.toBeInTheDocument();
  });
});

describe('/sets/public/[id] generateMetadata', () => {
  it('returns the title, description, canonical URL, Open Graph and Twitter for the set', async () => {
    serverApiGetMock.mockResolvedValue(SET);

    const meta = await generateMetadata(params());

    const description = '3 coins, 1909-1958. Public coin set shared on Coin Companion.';
    expect(meta.title).toBe("Alice's Wheat Cents checklist · Coin Companion");
    expect(meta.description).toBe(description);
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/public/${ID}`);
    expect(meta.openGraph).toMatchObject({
      title: "Alice's Wheat Cents checklist · Coin Companion",
      description,
      url: `${ORIGIN}/sets/public/${ID}`,
      type: 'website',
    });
    expect(meta.twitter).toMatchObject({
      card: 'summary_large_image',
      title: "Alice's Wheat Cents checklist · Coin Companion",
    });
  });

  it('follows the set (another set, another title and description)', async () => {
    serverApiGetMock.mockResolvedValue({
      ...SET,
      name: 'Bob Dimes',
      coins: [{ id: 'usc-9', position: 0, coin: coin('coin-9', 1946) }],
    });

    const meta = await generateMetadata(params());

    expect(meta.title).toBe('Bob Dimes checklist · Coin Companion');
    expect(meta.description).toBe('1 coin, 1946. Public coin set shared on Coin Companion.');
  });

  it.each([
    ['a 404', new ServerApiError('http', 404, 'nf')],
    ['a timeout', new ServerApiError('timeout', null, 't')],
  ])('returns the generic metadata and does not throw after %s', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    const meta = await generateMetadata(params());

    expect(meta.title).toBe('Public coin set · Coin Companion');
    expect(meta.description).toBe('Public coin set on Coin Companion.');
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/public/${ID}`);
  });
});

describe('/sets/public/[id] unknown or invalid id (criterion 7)', () => {
  it.each([404, 400])('rejects with the Next 404 error for an API %i', async (status) => {
    serverApiGetMock.mockRejectedValue(new ServerApiError('http', status, 'x'));

    await expect(PublicSetDetailPage(params('not-a-uuid'))).rejects.toMatchObject({
      digest: 'NEXT_HTTP_ERROR_FALLBACK;404',
    });
  });

  it('does not 404 for a 500 (only a definitive 404/400 is a real 404)', async () => {
    serverApiGetMock.mockRejectedValue(new ServerApiError('http', 500, 'boom'));

    await expect(PublicSetDetailPage(params())).resolves.toBeDefined();
  });
});

describe('/sets/public/[id] when the server helper fails (criterion 8)', () => {
  it.each([
    ['a timeout', new ServerApiError('timeout', null, 'timed out')],
    ['a network error', new ServerApiError('network', null, 'down')],
    ['a 503', new ServerApiError('http', 503, 'down')],
  ])('still renders with the client loading path after %s, and without JSON-LD', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    const container = await renderContainer();

    expect(within(container).getByTestId('public-set-detail-page')).toBeInTheDocument();
    expect(within(container).getByTestId('public-set-detail-loading')).toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-coin-list')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('public-set-detail-error')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('not-found')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('set-breadcrumb-json-ld')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('set-coin-list-json-ld')).not.toBeInTheDocument();
  });
});

describe('/sets/public/[id] hydration with a stored token (criterion 9)', () => {
  it('hydrates the server HTML with no mismatch warning, then shows the clone CTA after mount', async () => {
    serverApiGetMock.mockResolvedValue(SET);
    const tree = await buildTree();

    getStoredTokenMock.mockReturnValue(null);
    const html = renderToString(tree);
    expect(html).not.toContain('public-set-clone-cta');

    getStoredTokenMock.mockReturnValue('tok-abc');
    useSetGapsMock.mockImplementation(
      () =>
        ({ data: undefined, isLoading: false, isError: false, isSuccess: false }) as ReturnType<typeof useSetGaps>,
    );
    const container = dom(html);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onRecoverableError = vi.fn();

    await act(async () => {
      hydrateRoot(container, tree, { onRecoverableError });
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(onRecoverableError).not.toHaveBeenCalled();
    const cta = within(container).getByTestId('public-set-clone-cta');
    expect(cta.getAttribute('href')).toBe(`/sets/new?cloneFrom=user&cloneFromId=${ID}`);
    expect(within(container).getAllByTestId('public-set-detail-coin-item')).toHaveLength(3);
  });
});
