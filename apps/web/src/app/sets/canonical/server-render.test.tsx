/**
 * Tests for: /sets/canonical server page (apps/web/src/app/sets/canonical/page.tsx)
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Pages (server components)
 * Covers criteria: #1, #2, #5, #6, #8 (from prd.md)
 *
 * The page is built with renderToString and the TanStack hooks are NOT mocked: the list has to be in
 * the HTML without any client fetch. The API is mocked at the server helper (serverApiGet), with the
 * real ServerApiError class.
 *
 * CONTRACT_GAPs: none
 */

import { renderToString } from 'react-dom/server';
import { within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/server-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/server-api')>()),
  serverApiGet: vi.fn(),
}));

import CanonicalSetsPage, { generateMetadata } from '@/app/sets/canonical/page';
import { QueryProvider } from '@/components/providers/query-provider';
import { ServerApiError, serverApiGet } from '@/lib/server-api';

const serverApiGetMock = vi.mocked(serverApiGet);

const SETS = [
  { id: 's1', name: 'Lincoln Wheat Cent Key Dates', description: 'The key dates only', source: 'seed-template', templateVersion: 'v1' },
  { id: 's2', name: 'Lincoln Wheat Cents', description: 'Every year', source: 'seed-template', templateVersion: 'v1' },
];

const ORIGIN = 'https://site.example';

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN);
  serverApiGetMock.mockReset();
  fetchSpy = vi.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  document.body.innerHTML = '';
});

async function renderHtml() {
  const page = await CanonicalSetsPage();
  return renderToString(<QueryProvider>{page}</QueryProvider>);
}

function dom(html: string) {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function jsonLd(container: HTMLElement, testId: string) {
  const script = within(container).getByTestId(testId);
  expect(script.tagName).toBe('SCRIPT');
  expect(script).toHaveAttribute('type', 'application/ld+json');
  return JSON.parse(script.textContent ?? '');
}

describe('/sets/canonical server render with data', () => {
  it('puts every checklist name, description and link in the HTML, in order, with no client fetch', async () => {
    serverApiGetMock.mockResolvedValue(SETS);

    const container = dom(await renderHtml());

    expect(serverApiGetMock).toHaveBeenCalledWith('/sets/canonical', { revalidate: 3600 });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(within(container).getByTestId('canonical-sets-page')).toBeInTheDocument();
    const items = within(container).getAllByTestId('canonical-set-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Lincoln Wheat Cent Key Dates');
    expect(items[0]).toHaveTextContent('The key dates only');
    expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/sets/canonical/s1');
    expect(items[1]).toHaveTextContent('Every year');
    expect(within(items[1]).getByRole('link').getAttribute('href')).toBe('/sets/canonical/s2');
    expect(within(container).queryByTestId('canonical-sets-loading')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('canonical-sets-error')).not.toBeInTheDocument();
  });

  it('renders what the helper returned (another response, another list)', async () => {
    serverApiGetMock.mockResolvedValue([
      { id: 'z9', name: 'Morgan Dollars', description: null, source: 'seed-template', templateVersion: 'v1' },
    ]);

    const container = dom(await renderHtml());

    const items = within(container).getAllByTestId('canonical-set-item');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Morgan Dollars');
    expect(within(items[0]).getByRole('link').getAttribute('href')).toBe('/sets/canonical/z9');
    expect(container.innerHTML).not.toContain('Lincoln');
  });

  it('renders the empty state for an empty list', async () => {
    serverApiGetMock.mockResolvedValue([]);

    const container = dom(await renderHtml());

    expect(within(container).getByTestId('canonical-sets-empty')).toBeInTheDocument();
    expect(within(container).queryByTestId('canonical-set-item')).not.toBeInTheDocument();
  });

  it('adds the BreadcrumbList and CollectionPage JSON-LD, which parse with the exact fields', async () => {
    serverApiGetMock.mockResolvedValue(SETS);

    const container = dom(await renderHtml());

    expect(jsonLd(container, 'set-breadcrumb-json-ld')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'Coin checklists', item: `${ORIGIN}/sets/canonical` },
      ],
    });
    const collection = jsonLd(container, 'checklists-collection-json-ld');
    expect(collection).toMatchObject({
      '@type': 'CollectionPage',
      name: 'Coin checklists',
      url: `${ORIGIN}/sets/canonical`,
    });
    expect(Object.keys(collection).sort()).toEqual(['@context', '@type', 'description', 'name', 'url']);
    expect(within(container).queryByTestId('set-coin-list-json-ld')).not.toBeInTheDocument();
  });
});

describe('/sets/canonical generateMetadata', () => {
  it('returns the list metadata with the canonical URL, Open Graph and Twitter overrides', async () => {
    const meta = await generateMetadata();

    expect(meta.title).toBe('Coin checklists · Coin Companion');
    expect(meta.description).toBe(
      'Browse curated coin checklists on Coin Companion and track which coins you own and which are missing.',
    );
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/sets/canonical`);
    expect(meta.openGraph).toMatchObject({
      title: 'Coin checklists · Coin Companion',
      url: `${ORIGIN}/sets/canonical`,
      type: 'website',
    });
    expect(meta.twitter).toMatchObject({ card: 'summary_large_image', title: 'Coin checklists · Coin Companion' });
  });

  it('does not need the API (the helper is never called)', async () => {
    await generateMetadata();

    expect(serverApiGetMock).not.toHaveBeenCalled();
  });
});

describe('/sets/canonical when the server helper fails (criterion 8)', () => {
  it.each([
    ['a timeout', new ServerApiError('timeout', null, 'timed out')],
    ['a 503', new ServerApiError('http', 503, 'down')],
  ])('still renders with the client loading path after %s, and keeps the static JSON-LD', async (_label, error) => {
    serverApiGetMock.mockRejectedValue(error);

    const container = dom(await renderHtml());

    expect(within(container).getByTestId('canonical-sets-page')).toBeInTheDocument();
    expect(within(container).getByTestId('canonical-sets-loading')).toBeInTheDocument();
    expect(within(container).queryByTestId('canonical-sets-list')).not.toBeInTheDocument();
    expect(within(container).queryByTestId('canonical-sets-error')).not.toBeInTheDocument();
    expect(jsonLd(container, 'set-breadcrumb-json-ld')['@type']).toBe('BreadcrumbList');
    expect(jsonLd(container, 'checklists-collection-json-ld')['@type']).toBe('CollectionPage');
  });
});
