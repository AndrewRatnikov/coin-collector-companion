/**
 * Tests for: CoinPageJsonLd (apps/web/src/components/seo/coin-page-json-ld.tsx)
 * Contract source: runs/run_20261127_133045/plan.md § Interface Contract → Component: CoinPageJsonLd (CREATE)
 * Covers criteria: #10 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CatalogCoin } from '@coin-collector/shared';
import { CoinPageJsonLd } from '@/components/seo/coin-page-json-ld';
import { buildCoinThingJsonLd, coinBreadcrumb } from '@/lib/catalog-seo';
import { buildBreadcrumbJsonLd } from '@/lib/set-page-seo';

afterEach(() => {
  vi.unstubAllEnvs();
});

const ID = '7e57c011-0000-4000-8000-000000000001';

function makeCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: ID,
    country: 'USA',
    denomination: '1 Cent',
    year: 1909,
    mintMark: 'S',
    variety: 'VDB',
    name: 'Lincoln Wheat Cent',
    imageUrl: 'https://upload.wikimedia.org/vdb.jpg',
    imageSource: 'Wikimedia Commons',
    imageLicense: 'CC BY-SA 4.0',
    diameterMm: 19.05,
    weightG: 3.11,
    thicknessMm: null,
    material: 'Bronze',
    mintage: 484000,
    isKeyDate: true,
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CoinPageJsonLd', () => {
  it('renders the BreadcrumbList as one ld+json script', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    const coin = makeCoin();
    render(<CoinPageJsonLd coin={coin} />);

    const script = screen.getByTestId('coin-breadcrumb-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(JSON.parse(script.innerHTML)).toEqual(
      buildBreadcrumbJsonLd(coinBreadcrumb(coin), 'https://site.example'),
    );
    expect(JSON.parse(script.innerHTML)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Catalog', item: 'https://site.example/catalog' },
        { '@type': 'ListItem', position: 2, name: 'USA', item: 'https://site.example/catalog?country=USA' },
        {
          '@type': 'ListItem',
          position: 3,
          name: '1 Cent',
          item: 'https://site.example/catalog?country=USA&denomination=1+Cent',
        },
        { '@type': 'ListItem', position: 4, name: '1909-S VDB', item: `https://site.example/catalog/${ID}` },
      ],
    });
  });

  it('renders the Thing as one ld+json script', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    const coin = makeCoin();
    render(<CoinPageJsonLd coin={coin} />);

    const script = screen.getByTestId('coin-thing-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    const data = JSON.parse(script.innerHTML);
    expect(data).toEqual(buildCoinThingJsonLd(coin, 'https://site.example'));
    expect(data['@type']).toBe('Thing');
    expect(data.url).toBe(`https://site.example/catalog/${ID}`);
    expect(data.image).toBe('https://upload.wikimedia.org/vdb.jpg');
  });

  it('follows the coin and the configured origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example');
    render(<CoinPageJsonLd coin={makeCoin({ id: 'other-id', country: '', imageLicense: null })} />);

    const breadcrumb = JSON.parse(screen.getByTestId('coin-breadcrumb-json-ld').innerHTML);
    expect(breadcrumb.itemListElement).toHaveLength(2);
    expect(breadcrumb.itemListElement[1].item).toBe('https://other.example/catalog/other-id');
    const thing = JSON.parse(screen.getByTestId('coin-thing-json-ld').innerHTML);
    expect(thing.url).toBe('https://other.example/catalog/other-id');
    expect(thing).not.toHaveProperty('image');
  });

  it('escapes < so a variety cannot close the script tag', () => {
    render(<CoinPageJsonLd coin={makeCoin({ variety: '</script><b>x', isKeyDate: false })} />);

    for (const testId of ['coin-breadcrumb-json-ld', 'coin-thing-json-ld']) {
      expect(screen.getByTestId(testId).innerHTML).not.toContain('<');
    }
    const thing = JSON.parse(screen.getByTestId('coin-thing-json-ld').innerHTML);
    expect(thing.additionalProperty).toContainEqual({ '@type': 'PropertyValue', name: 'Variety', value: '</script><b>x' });
  });

  it('carries no Product, offers, rating or review data', () => {
    render(<CoinPageJsonLd coin={makeCoin()} />);

    const text =
      screen.getByTestId('coin-breadcrumb-json-ld').innerHTML + screen.getByTestId('coin-thing-json-ld').innerHTML;
    expect(text).not.toMatch(/Product|offers|aggregateRating|review/i);
  });
});
