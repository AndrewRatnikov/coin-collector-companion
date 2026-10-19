/**
 * Tests for: CatalogPage ownership badge wiring
 * Contract source: runs/run_20261019_221037/plan.md § Interface Contract → Page: CatalogPage (web, MODIFY)
 * Covers criteria: #7, #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Mocks mirror page.test.tsx: next/navigation, the use-catalog hooks, and the submit-coin-form /
 * submission-confirmation components. The signed-in state comes from the stored token, which the
 * page reads on mount, so signed-in assertions use findBy*.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CatalogPage from '@/app/catalog/page';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { clearStoredToken, setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();
const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
}));

vi.mock('@/components/catalog/submit-coin-form', () => ({
  default: (props: { onSuccess: (coin: unknown) => void }) => (
    <div data-testid="mock-submit-coin-form">
      <button
        type="button"
        data-testid="mock-submit-coin-form-succeed"
        onClick={() => props.onSuccess({ id: 'new-coin-1', status: 'pending' })}
      >
        simulate success
      </button>
    </div>
  ),
}));

vi.mock('@/components/catalog/submission-confirmation', () => ({
  default: (props: { coin: { id: string } }) => (
    <div data-testid="mock-submission-confirmation">{props.coin.id}</div>
  ),
}));

const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);

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
    status: 'approved' as const,
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function pageOf(items: unknown[]) {
  return {
    data: { items, page: 1, limit: 20, total: items.length },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useCatalog>;
}

const SIGNED_IN_ITEMS = [
  makeCoin('c1', { owned: true, inSetsCount: 2 }),
  makeCoin('c2', { owned: false, inSetsCount: 0 }),
];

describe('CatalogPage ownership badges', () => {
  beforeEach(() => {
    useCatalogMock.mockReset();
    useCatalogFacetsMock.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    searchParamsValue = new URLSearchParams();
    localStorage.clear();
    useCatalogFacetsMock.mockReturnValue({
      data: { countries: ['USA'], denominations: ['1 Cent'] },
    } as unknown as ReturnType<typeof useCatalogFacets>);
  });

  afterEach(() => {
    clearStoredToken();
    localStorage.clear();
  });

  it('signed in: a row with owned: true and inSetsCount: 2 shows both badges (criterion #7)', async () => {
    setStoredToken('t');
    useCatalogMock.mockReturnValue(pageOf(SIGNED_IN_ITEMS));
    render(<CatalogPage />);

    const wrapper = await screen.findByTestId('catalog-item-ownership');
    const badges = within(wrapper).getAllByTestId('badge');
    expect(badges.map((badge) => badge.getAttribute('data-variant'))).toEqual(['owned', 'in-set']);
    expect(wrapper).toHaveTextContent('✓ Owned');
    expect(wrapper).toHaveTextContent('In 2 sets');
  });

  it('signed in: only the rows with something to show get the ownership wrapper (criterion #8)', async () => {
    setStoredToken('t');
    useCatalogMock.mockReturnValue(pageOf(SIGNED_IN_ITEMS));
    render(<CatalogPage />);

    await screen.findByTestId('catalog-item-ownership');

    const rows = screen.getAllByTestId('catalog-item');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByTestId('catalog-item-ownership')).toBeInTheDocument();
    expect(within(rows[1]).queryByTestId('catalog-item-ownership')).not.toBeInTheDocument();
  });

  it('signed in: a different row gives different badges (not hard-coded)', async () => {
    setStoredToken('t');
    useCatalogMock.mockReturnValue(pageOf([makeCoin('c9', { owned: false, inSetsCount: 1 })]));
    render(<CatalogPage />);

    const wrapper = await screen.findByTestId('catalog-item-ownership');
    expect(wrapper).toHaveTextContent('In 1 set');
    expect(wrapper).not.toHaveTextContent('Owned');
  });

  it('signed out: the same data shows no ownership badges (criterion #8)', () => {
    useCatalogMock.mockReturnValue(pageOf(SIGNED_IN_ITEMS));
    render(<CatalogPage />);

    expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
    expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    expect(screen.queryByTestId('catalog-item-ownership')).not.toBeInTheDocument();
  });

  it('signed out: a stale signed-in page in the cache never shows badges after the token is gone', () => {
    // Same cached data as the signed-in case, no token: the page's own signed-in state gates it.
    useCatalogMock.mockReturnValue(pageOf([makeCoin('c1', { owned: true, inSetsCount: 5 })]));
    render(<CatalogPage />);

    expect(screen.queryByTestId('catalog-item-ownership')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('catalog-item')).queryByTestId('badge')).not.toBeInTheDocument();
  });
});
