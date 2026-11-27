/**
 * Tests for: set page JSON-LD components (apps/web/src/components/seo/set-page-json-ld.tsx)
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Components: set-page JSON-LD
 * Covers criteria: #6 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ChecklistsCollectionJsonLd,
  SetBreadcrumbJsonLd,
  SetCoinListJsonLd,
} from '@/components/seo/set-page-json-ld';
import { CHECKLISTS_DESCRIPTION, canonicalSetBreadcrumb, publicSetBreadcrumb } from '@/lib/set-page-seo';

afterEach(() => {
  vi.unstubAllEnvs();
});

function coin(id: string, year: number, variety = '') {
  return {
    id,
    country: 'USA',
    denomination: '1 Cent',
    year,
    mintMark: '',
    variety,
    name: 'Lincoln Wheat Cent',
    isKeyDate: false,
  };
}

describe('SetBreadcrumbJsonLd', () => {
  it('renders one ld+json script that parses to the BreadcrumbList', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(<SetBreadcrumbJsonLd items={canonicalSetBreadcrumb('c-1', 'Lincoln')} />);

    const script = screen.getByTestId('set-breadcrumb-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(JSON.parse(script.innerHTML)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://site.example/' },
        { '@type': 'ListItem', position: 2, name: 'Coin checklists', item: 'https://site.example/sets/canonical' },
        { '@type': 'ListItem', position: 3, name: 'Lincoln', item: 'https://site.example/sets/canonical/c-1' },
      ],
    });
  });

  it('follows the items and the configured origin (public set, other origin)', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example');
    render(<SetBreadcrumbJsonLd items={publicSetBreadcrumb('p-9', 'Alice')} />);

    const data = JSON.parse(screen.getByTestId('set-breadcrumb-json-ld').innerHTML);
    expect(data.itemListElement[1]).toMatchObject({ name: 'Public sets', item: 'https://other.example/sets/public' });
    expect(data.itemListElement[2]).toMatchObject({ name: 'Alice', item: 'https://other.example/sets/public/p-9' });
  });

  it('escapes < in names so a set name cannot close the script tag', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(<SetBreadcrumbJsonLd items={publicSetBreadcrumb('p1', '</script><b>x')} />);

    const script = screen.getByTestId('set-breadcrumb-json-ld');
    expect(script.innerHTML).not.toContain('<');
    expect(JSON.parse(script.innerHTML).itemListElement[2].name).toBe('</script><b>x');
  });
});

describe('SetCoinListJsonLd', () => {
  it('renders one ld+json script that parses to the ItemList in position order', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(
      <SetCoinListJsonLd
        coins={[
          { position: 1, coin: coin('coin-2', 1958) },
          { position: 0, coin: coin('coin-1', 1909, 'VDB') },
        ] as never}
      />,
    );

    const script = screen.getByTestId('set-coin-list-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    const data = JSON.parse(script.innerHTML);
    expect(data['@context']).toBe('https://schema.org');
    expect(data['@type']).toBe('ItemList');
    expect(data.numberOfItems).toBe(2);
    expect(data.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Lincoln Wheat Cent · VDB · USA · 1 Cent · 1909',
        url: 'https://site.example/catalog/coin-1',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Lincoln Wheat Cent · USA · 1 Cent · 1958',
        url: 'https://site.example/catalog/coin-2',
      },
    ]);
  });

  it('renders an empty ItemList for a set with no coins', () => {
    render(<SetCoinListJsonLd coins={[]} />);

    const data = JSON.parse(screen.getByTestId('set-coin-list-json-ld').innerHTML);
    expect(data.numberOfItems).toBe(0);
    expect(data.itemListElement).toEqual([]);
  });
});

describe('ChecklistsCollectionJsonLd', () => {
  it('renders one ld+json script that parses to the CollectionPage', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(<ChecklistsCollectionJsonLd />);

    const script = screen.getByTestId('checklists-collection-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(JSON.parse(script.innerHTML)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Coin checklists',
      url: 'https://site.example/sets/canonical',
      description: CHECKLISTS_DESCRIPTION,
    });
  });

  it('uses the configured site origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example');
    render(<ChecklistsCollectionJsonLd />);

    expect(JSON.parse(screen.getByTestId('checklists-collection-json-ld').innerHTML).url).toBe(
      'https://other.example/sets/canonical',
    );
  });
});
