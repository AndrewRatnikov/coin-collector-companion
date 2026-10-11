/**
 * Tests for: CatalogResultsList, CatalogPagination
 * Contract source: runs/run_20261011_105146/plan.md § Interface Contract → Component: CatalogResultsList and CatalogPagination
 * Covers criteria: #13, #14, #15 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogCoin } from '@coin-collector/shared';
import CatalogResultsList, { CatalogPagination } from '@/components/catalog/catalog-results-list';

function makeCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'c1',
    country: 'Ukraine',
    denomination: '25 Kopiyok',
    year: 1992,
    mintMark: '',
    variety: '',
    name: 'Circulation coin',
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
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('CatalogResultsList', () => {
  describe('loading (criterion #15)', () => {
    it('shows catalog-loading and no results list while loading', () => {
      render(<CatalogResultsList coins={[]} isLoading />);

      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-results')).not.toBeInTheDocument();
    });

    it('shows catalog-results and no loading skeleton when not loading', () => {
      render(<CatalogResultsList coins={[makeCoin()]} isLoading={false} />);

      expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
    });
  });

  describe('rows (criterion #13)', () => {
    it('renders one catalog-item per coin', () => {
      render(
        <CatalogResultsList
          coins={[makeCoin({ id: 'a' }), makeCoin({ id: 'b' }), makeCoin({ id: 'c' })]}
          isLoading={false}
        />,
      );

      expect(screen.getAllByTestId('catalog-item')).toHaveLength(3);
    });

    it('the row link goes to /catalog/{id} and shows the denomination as title for a plain coin', () => {
      render(<CatalogResultsList coins={[makeCoin({ id: 'coin-42' })]} isLoading={false} />);

      const link = screen.getByTestId('catalog-item-link');
      expect(link).toHaveAttribute('href', '/catalog/coin-42');
      expect(link).toHaveTextContent('25 Kopiyok');
      expect(link).not.toHaveTextContent('1992');
    });

    it('each row links to its own coin id', () => {
      render(<CatalogResultsList coins={[makeCoin({ id: 'a' }), makeCoin({ id: 'b' })]} isLoading={false} />);

      const links = screen.getAllByTestId('catalog-item-link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/catalog/a', '/catalog/b']);
    });

    it('shows the series name as the variety line and the part after ": " as the title', () => {
      render(
        <CatalogResultsList
          coins={[
            makeCoin({
              year: 2025,
              denomination: '10 Hryvnias',
              variety: 'We Are Strong. We Are Together: Donetsk Oblast',
            }),
          ]}
          isLoading={false}
        />,
      );

      expect(screen.getByTestId('catalog-item-link')).toHaveTextContent('Donetsk Oblast');
      expect(screen.getByTestId('catalog-item-variety')).toHaveTextContent('We Are Strong. We Are Together');
    });

    it('renders no variety line when there is no series', () => {
      render(<CatalogResultsList coins={[makeCoin()]} isLoading={false} />);

      expect(screen.queryByTestId('catalog-item-variety')).not.toBeInTheDocument();
    });

    it('renders the year in its own cell, with the mint mark appended', () => {
      render(
        <CatalogResultsList
          coins={[makeCoin({ id: 'a', year: 1909, mintMark: 'S', variety: 'VDB', denomination: 'Cent' }), makeCoin({ id: 'b', year: 1992 })]}
          isLoading={false}
        />,
      );

      const years = screen.getAllByTestId('catalog-item-year');
      expect(years[0]).toHaveTextContent('1909 S');
      expect(years[1]).toHaveTextContent(/^1992$/);
    });

    it('renders the denomination in its own column', () => {
      render(<CatalogResultsList coins={[makeCoin({ denomination: '10 Hryvnias' })]} isLoading={false} />);

      expect(screen.getByTestId('catalog-item-denomination')).toHaveTextContent('10 Hryvnias');
    });

    it('shows the key-date pill only for key-date coins', () => {
      render(
        <CatalogResultsList
          coins={[makeCoin({ id: 'a', isKeyDate: true }), makeCoin({ id: 'b', isKeyDate: false })]}
          isLoading={false}
        />,
      );

      const rows = screen.getAllByTestId('catalog-item');
      expect(within(rows[0]).getByTestId('catalog-item-key-date')).toBeInTheDocument();
      expect(within(rows[1]).queryByTestId('catalog-item-key-date')).not.toBeInTheDocument();
    });

    it('renders a lazy round image when the coin has an imageUrl, and no numeral disc', () => {
      render(
        <CatalogResultsList
          coins={[makeCoin({ imageUrl: 'https://upload.wikimedia.org/coin.jpg' })]}
          isLoading={false}
        />,
      );

      const image = screen.getByTestId('catalog-item-image');
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image.getAttribute('src') ?? '').toContain('coin.jpg');
      expect(screen.queryByTestId('catalog-item-numeral')).not.toBeInTheDocument();
    });

    it('renders a numeral disc from the denomination when there is no imageUrl', () => {
      render(
        <CatalogResultsList
          coins={[makeCoin({ id: 'a', denomination: '10 Hryvnias' }), makeCoin({ id: 'b', denomination: 'Cent' })]}
          isLoading={false}
        />,
      );

      const numerals = screen.getAllByTestId('catalog-item-numeral');
      expect(numerals.map((numeral) => numeral.textContent)).toEqual(['10', '1']);
      expect(screen.queryByTestId('catalog-item-image')).not.toBeInTheDocument();
    });
  });
});

describe('CatalogPagination', () => {
  function pageNumbers() {
    return screen.getAllByTestId('catalog-pagination-page').map((page) => page.textContent);
  }

  it('shows the "Page X of Y" summary', () => {
    render(<CatalogPagination page={5} totalPages={9} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('catalog-pagination-summary')).toHaveTextContent('Page 5 of 9');
  });

  it('the summary follows the props', () => {
    render(<CatalogPagination page={2} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('catalog-pagination-summary')).toHaveTextContent('Page 2 of 3');
  });

  it('collapses the middle of a long range: 1 2 3 ... 9 on page 1', () => {
    render(<CatalogPagination page={1} totalPages={9} onPageChange={vi.fn()} />);

    expect(pageNumbers()).toEqual(['1', '2', '3', '9']);
    expect(screen.getAllByTestId('catalog-pagination-ellipsis')).toHaveLength(1);
  });

  it('shows ellipses on both sides when the current page is in the middle', () => {
    render(<CatalogPagination page={5} totalPages={9} onPageChange={vi.fn()} />);

    expect(pageNumbers()).toEqual(['1', '4', '5', '6', '9']);
    expect(screen.getAllByTestId('catalog-pagination-ellipsis')).toHaveLength(2);
  });

  it('shows every page and no ellipsis for a short range', () => {
    render(<CatalogPagination page={2} totalPages={3} onPageChange={vi.fn()} />);

    expect(pageNumbers()).toEqual(['1', '2', '3']);
    expect(screen.queryByTestId('catalog-pagination-ellipsis')).not.toBeInTheDocument();
  });

  it('marks only the current page with aria-current="page"', () => {
    render(<CatalogPagination page={5} totalPages={9} onPageChange={vi.fn()} />);

    const pages = screen.getAllByTestId('catalog-pagination-page');
    const current = pages.filter((page) => page.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('5');
  });

  it('is a navigation landmark labelled Pagination', () => {
    render(<CatalogPagination page={1} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('catalog-pagination')).toHaveAttribute('aria-label', 'Pagination');
  });

  it('disables prev on the first page and leaves next enabled', () => {
    render(<CatalogPagination page={1} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('catalog-pagination-prev')).toBeDisabled();
    expect(screen.getByTestId('catalog-pagination-next')).toBeEnabled();
  });

  it('disables next on the last page and leaves prev enabled', () => {
    render(<CatalogPagination page={3} totalPages={3} onPageChange={vi.fn()} />);

    expect(screen.getByTestId('catalog-pagination-next')).toBeDisabled();
    expect(screen.getByTestId('catalog-pagination-prev')).toBeEnabled();
  });

  it('clicking next asks for page + 1', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogPagination page={4} totalPages={9} onPageChange={onPageChange} />);

    await user.click(screen.getByTestId('catalog-pagination-next'));

    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('clicking prev asks for page - 1', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogPagination page={4} totalPages={9} onPageChange={onPageChange} />);

    await user.click(screen.getByTestId('catalog-pagination-prev'));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('clicking another page number asks for that page', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogPagination page={1} totalPages={9} onPageChange={onPageChange} />);

    await user.click(screen.getAllByTestId('catalog-pagination-page')[3]);

    expect(onPageChange).toHaveBeenCalledWith(9);
  });

  it('clicking the current page does nothing', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogPagination page={2} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getAllByTestId('catalog-pagination-page')[1]);

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('clicking a disabled prev does nothing', async () => {
    const onPageChange = vi.fn();
    const user = userEvent.setup();
    render(<CatalogPagination page={1} totalPages={3} onPageChange={onPageChange} />);

    await user.click(screen.getByTestId('catalog-pagination-prev'));

    expect(onPageChange).not.toHaveBeenCalled();
  });
});
