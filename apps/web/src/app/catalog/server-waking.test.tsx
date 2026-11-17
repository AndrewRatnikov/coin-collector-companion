/**
 * Tests for: CatalogPage (server waking notice)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Public pages (waking notice)
 * Covers criteria: #4 (from prd.md)
 *
 * The mock block mirrors catalog/page.test.tsx. useSlowLoading is deliberately not mocked.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import CatalogPage from '@/app/catalog/page';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';

const replaceMock = vi.fn();
const pushMock = vi.fn();
const searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
}));

vi.mock('@/components/catalog/submit-coin-form', () => ({
  default: () => <div />,
}));

vi.mock('@/components/catalog/submission-confirmation', () => ({
  default: () => <div />,
}));

const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

function queryResult(overrides: Partial<ReturnType<typeof useCatalog>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCatalog>;
}

const COIN = {
  id: 'c1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1984,
  mintMark: 'D',
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
  status: 'approved' as const,
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const RESOLVED = queryResult({ data: { items: [COIN], page: 1, limit: 20, total: 1 } } as never);

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('CatalogPage: server waking notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useCatalogMock.mockReset();
    useCatalogFacetsMock.mockReset();
    useCatalogFacetsMock.mockReturnValue({
      data: { countries: ['USA'], denominations: ['1 Cent'] },
    } as unknown as ReturnType<typeof useCatalogFacets>);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is absent at 2.9 s, present at 3 s next to the existing skeleton, and gone once data resolves', () => {
    useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<CatalogPage />);

    expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
    advance(2900);
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    advance(100);
    expect(screen.getByTestId('server-waking-notice')).toHaveTextContent(
      'Waking the server. This can take up to a minute on the first visit.',
    );
    expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();

    useCatalogMock.mockReturnValue(RESOLVED);
    view.rerender(<CatalogPage />);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
    expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
  });

  it('never appears when the query resolves before 3 s', () => {
    useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
    const view = render(<CatalogPage />);
    advance(2000);

    useCatalogMock.mockReturnValue(RESOLVED);
    view.rerender(<CatalogPage />);
    advance(10000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('does not appear when data is already there and the query is only refetching', () => {
    useCatalogMock.mockReturnValue(
      queryResult({ isLoading: true, data: { items: [COIN], page: 1, limit: 20, total: 1 } } as never),
    );
    render(<CatalogPage />);

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('does not appear on an error', () => {
    useCatalogMock.mockReturnValue(queryResult({ isError: true }));
    render(<CatalogPage />);

    advance(5000);

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });
});
