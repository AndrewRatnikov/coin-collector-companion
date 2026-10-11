/**
 * Tests for: CatalogPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CatalogPage
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/app/catalog/page.tsx (MODIFY)
 *                   runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/catalog/page.tsx
 *                   runs/run_20261011_105146/plan.md § Interface Contract → Page: CatalogPage (rewritten for the sidebar)
 * Covers criteria: #4 (from run_20260721_131640's prd.md), #6 (from run_20260725_140648's prd.md),
 *                  #4 (from run_20260728_071525's prd.md),
 *                  #7, #8, #9, #10, #11, #12, #15, #16, #17, #21 (from run_20261011_105146's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * run_20261011_105146: the page is rewritten around a filter sidebar. The old filter-form tests
 * (Search button, catalog-filter-form fields, catalog-filter-clear) are replaced by live-filtering,
 * URL-sync, debounce and mobile-sheet tests; the old gating, loading, error, empty, pagination and
 * submit-coin tests are carried over, adapted to the new markup.
 *
 * SubmitCoinForm and SubmissionConfirmation are mocked entirely here (their own behaviour lives in
 * their own test files). next/navigation and the use-catalog hooks are mocked: filters are asserted
 * through useCatalog's last argument, the URL through router.replace's last call. The mocked
 * useSearchParams returns a mutable URLSearchParams that replace() does NOT update, so a test that
 * clicks something also proves local state (not the URL) drives the UI after mount.
 *
 * Debounce tests use vi.useFakeTimers() with fireEvent (no userEvent, no waitFor).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogPage from '@/app/catalog/page';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

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

function queryResult(overrides: Partial<ReturnType<typeof useCatalog>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCatalog>;
}

const FACETS = {
  countries: ['Ukraine', 'USA'],
  denominations: ['5 Kopiyok', '10 Hryvnias', '1 Cent'],
};

function facetsResult() {
  return { data: FACETS } as unknown as ReturnType<typeof useCatalogFacets>;
}

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

const COINS = [makeCoin('c1', { mintMark: 'D' }), makeCoin('c2', { year: 1958 })];

function pageOf(items: unknown[], total: number, page = 1, limit = 20) {
  return queryResult({ data: { items, page, limit, total } } as never);
}

function lastFilters() {
  return useCatalogMock.mock.calls.at(-1)?.[0];
}

function lastReplaceUrl() {
  const call = replaceMock.mock.calls.at(-1);
  expect(call).toBeDefined();
  return { url: new URL(call?.[0] as string, 'http://x'), options: call?.[1] as unknown };
}

describe('CatalogPage', () => {
  beforeEach(() => {
    useCatalogMock.mockReset();
    useCatalogFacetsMock.mockReset();
    replaceMock.mockReset();
    pushMock.mockReset();
    searchParamsValue = new URLSearchParams();
    localStorage.clear();
    useCatalogMock.mockReturnValue(pageOf(COINS, 2));
    useCatalogFacetsMock.mockReturnValue(facetsResult());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('criterion 10 (run_20260721_131640): not gated by auth', () => {
    it('renders result content synchronously with no stored token (no auth-guard delay/redirect before content appears)', () => {
      localStorage.clear();
      render(<CatalogPage />);

      // A route wrapped in RequireAuth never renders its children synchronously when
      // there is no stored token (the auth check itself is an async useEffect) — getting
      // real result content back immediately proves this page isn't gated.
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
      expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    });
  });

  describe('layout (run_20261011_105146 criterion #7)', () => {
    it('renders the page root, sidebar, count and results, and not the old filter form', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 42));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-count')).toHaveTextContent('42 coins');
      expect(screen.getByTestId('catalog-search')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-sort')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-results')).toBeInTheDocument();

      expect(screen.queryByTestId('catalog-filter-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-submit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-clear')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-name')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-country')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-denomination')).not.toBeInTheDocument();
    });

    it('the count follows data.total', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 7));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-count')).toHaveTextContent('7 coins');
    });

    it('renders no count before the first data arrives', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-count')).not.toBeInTheDocument();
    });

    it('puts the facet options in the sidebar', () => {
      render(<CatalogPage />);

      const sidebar = within(screen.getByTestId('catalog-sidebar'));
      expect(sidebar.getByTestId('catalog-filter-country-Ukraine')).toBeInTheDocument();
      expect(sidebar.getByTestId('catalog-filter-country-USA')).toBeInTheDocument();
      expect(sidebar.getByTestId('catalog-filter-denomination-5 Kopiyok')).toBeInTheDocument();
      expect(sidebar.getByTestId('catalog-filter-year-min')).toBeInTheDocument();
      expect(sidebar.getByTestId('catalog-filter-key-date')).toBeInTheDocument();
    });

    it('requests facets for no country by default', () => {
      render(<CatalogPage />);

      expect(useCatalogFacetsMock.mock.calls.at(-1)?.[0]).toBeUndefined();
    });
  });

  describe('criterion 4: loading, error, empty (run_20260721_131640, run_20261011_105146 #15)', () => {
    it('renders catalog-loading and no results while isLoading is true and there is no data', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-results')).not.toBeInTheDocument();
    });

    it('keeps showing the previous list while a refetch is loading (data stays defined)', () => {
      useCatalogMock.mockReturnValue(
        queryResult({ isLoading: true, data: { items: COINS, page: 1, limit: 20, total: 2 } } as never),
      );
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-loading')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    });

    it('renders catalog-error when isError is true', () => {
      useCatalogMock.mockReturnValue(queryResult({ isError: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
    });

    it('renders one catalog-item per coin with a link to the coin detail page', () => {
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
      const links = screen.getAllByTestId('catalog-item-link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/catalog/c1', '/catalog/c2']);
    });

    it('renders catalog-empty (and no list or pagination) when the result set is empty', () => {
      useCatalogMock.mockReturnValue(pageOf([], 0));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-empty-clear')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-item')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-results')).not.toBeInTheDocument();
      expect(screen.queryByTestId('catalog-pagination')).not.toBeInTheDocument();
    });

    it('does not offer "Add this coin" in the empty state when logged out', () => {
      useCatalogMock.mockReturnValue(pageOf([], 0));
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-empty-add-coin')).not.toBeInTheDocument();
    });

    it('offers "Add this coin" in the empty state when logged in, opening the Add-coin sheet', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(await screen.findByTestId('catalog-empty-add-coin'));

      expect(screen.getByTestId('sheet')).toBeInTheDocument();
      expect(screen.getByTestId('mock-submit-coin-form')).toBeInTheDocument();
    });

    it('the empty-state Clear all filters button resets filters like Clear all', async () => {
      searchParamsValue = new URLSearchParams('country=Ukraine&denomination=5%20Kopiyok&yearMin=1800&page=2');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-empty-clear'));

      const filters = lastFilters();
      expect(filters).toMatchObject({ page: 1, limit: 20 });
      expect(filters?.country).toBeUndefined();
      expect(filters?.denomination).toBeUndefined();
      expect(filters?.yearMin).toBeUndefined();
      expect(lastReplaceUrl().url.search).toBe('');
    });
  });

  describe('initial state from the URL (criterion #11)', () => {
    it('passes URL state to the first useCatalog call and checks the matching sidebar controls', () => {
      searchParamsValue = new URLSearchParams('country=Ukraine&denomination=5%20Kopiyok&sort=year_desc&page=2');
      render(<CatalogPage />);

      expect(useCatalogMock.mock.calls[0][0]).toMatchObject({
        country: 'Ukraine',
        denomination: ['5 Kopiyok'],
        sort: 'year_desc',
        page: 2,
        limit: 20,
      });
      expect(screen.getByTestId('catalog-filter-country-Ukraine')).toBeChecked();
      expect(screen.getByTestId('catalog-filter-denomination-5 Kopiyok')).toBeChecked();
      expect(screen.getByTestId('catalog-sort')).toHaveValue('year_desc');
    });

    it('requests facets scoped to the URL country', () => {
      searchParamsValue = new URLSearchParams('country=Ukraine');
      render(<CatalogPage />);

      expect(useCatalogFacetsMock.mock.calls.at(-1)?.[0]).toBe('Ukraine');
    });

    it('fills the search box and year inputs from the URL', () => {
      searchParamsValue = new URLSearchParams('name=wheat&yearMin=1900&yearMax=1950&keyDateOnly=true');
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-search')).toHaveValue('wheat');
      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('1900');
      expect(screen.getByTestId('catalog-filter-year-max')).toHaveValue('1950');
      expect(screen.getByTestId('catalog-filter-key-date')).toBeChecked();
      expect(useCatalogMock.mock.calls[0][0]).toMatchObject({ name: 'wheat', yearMin: 1900, yearMax: 1950, keyDateOnly: true });
    });

    it('defaults to page 1, limit 20, All countries and year_asc with no URL params', () => {
      render(<CatalogPage />);

      expect(useCatalogMock.mock.calls[0][0]).toMatchObject({ page: 1, limit: 20 });
      expect(useCatalogMock.mock.calls[0][0]?.sort).toBeUndefined();
      expect(screen.getByTestId('catalog-filter-country-all')).toBeChecked();
      expect(screen.getByTestId('catalog-sort')).toHaveValue('year_asc');
    });

    it('re-parses the URL when it changes from outside (e.g. the nav Catalog link)', () => {
      searchParamsValue = new URLSearchParams('country=Ukraine');
      const { rerender } = render(<CatalogPage />);
      expect(screen.getByTestId('catalog-filter-country-Ukraine')).toBeChecked();

      searchParamsValue = new URLSearchParams('country=USA');
      rerender(<CatalogPage />);

      expect(screen.getByTestId('catalog-filter-country-USA')).toBeChecked();
      expect(lastFilters()).toMatchObject({ country: 'USA' });
    });
  });

  describe('live filtering and URL sync (criteria #9, #10, #11)', () => {
    it('choosing a country updates useCatalog at once, with page 1, and replaces the URL without scrolling', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-country-Ukraine'));

      expect(lastFilters()).toMatchObject({ country: 'Ukraine', page: 1 });
      const { url, options } = lastReplaceUrl();
      expect(url.pathname).toBe('/catalog');
      expect(url.searchParams.get('country')).toBe('Ukraine');
      expect(options).toEqual({ scroll: false });
      expect(screen.getByTestId('catalog-filter-country-Ukraine')).toBeChecked();
      expect(useCatalogFacetsMock.mock.calls.at(-1)?.[0]).toBe('Ukraine');
    });

    it('a different country writes a different URL (not hard-coded)', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-country-USA'));

      expect(lastFilters()).toMatchObject({ country: 'USA' });
      expect(lastReplaceUrl().url.searchParams.get('country')).toBe('USA');
    });

    it('never uses router.push for filter changes', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-country-Ukraine'));

      expect(replaceMock).toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('ticking several denominations sends them all (facet order), and writes repeated URL params', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-denomination-5 Kopiyok'));
      await user.click(screen.getByTestId('catalog-filter-denomination-10 Hryvnias'));

      expect(lastFilters()).toMatchObject({ denomination: ['5 Kopiyok', '10 Hryvnias'], page: 1 });
      expect(lastReplaceUrl().url.searchParams.getAll('denomination')).toEqual(['5 Kopiyok', '10 Hryvnias']);
    });

    it('unticking the last denomination removes the denomination filter again', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-denomination-5 Kopiyok'));
      await user.click(screen.getByTestId('catalog-filter-denomination-5 Kopiyok'));

      expect(lastFilters()?.denomination).toBeUndefined();
      expect(lastReplaceUrl().url.searchParams.getAll('denomination')).toEqual([]);
    });

    it('changing country clears the ticked denominations in the same update', async () => {
      searchParamsValue = new URLSearchParams('country=Ukraine&denomination=5%20Kopiyok');
      const user = userEvent.setup();
      render(<CatalogPage />);
      expect(lastFilters()).toMatchObject({ denomination: ['5 Kopiyok'] });

      await user.click(screen.getByTestId('catalog-filter-country-USA'));

      expect(lastFilters()).toMatchObject({ country: 'USA' });
      expect(lastFilters()?.denomination).toBeUndefined();
      expect(lastReplaceUrl().url.searchParams.getAll('denomination')).toEqual([]);
      expect(screen.getByTestId('catalog-filter-denomination-5 Kopiyok')).not.toBeChecked();
    });

    it('choosing All countries drops the country filter', async () => {
      searchParamsValue = new URLSearchParams('country=Ukraine');
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-filter-country-all'));

      expect(lastFilters()?.country).toBeUndefined();
      expect(lastReplaceUrl().url.searchParams.has('country')).toBe(false);
    });

    it('ticking Key dates only sends keyDateOnly, writes it to the URL, and resets page to 1', async () => {
      searchParamsValue = new URLSearchParams('page=3');
      const user = userEvent.setup();
      render(<CatalogPage />);
      expect(lastFilters()).toMatchObject({ page: 3 });

      await user.click(screen.getByTestId('catalog-filter-key-date'));

      expect(lastFilters()).toMatchObject({ keyDateOnly: true, page: 1 });
      const { url } = lastReplaceUrl();
      expect(url.searchParams.get('keyDateOnly')).toBe('true');
      expect(url.searchParams.has('page')).toBe(false);
    });
  });

  describe('debounced search and years (criterion #10)', () => {
    it('applies the search text as name only after 300 ms, trimmed, resetting to page 1', () => {
      vi.useFakeTimers();
      searchParamsValue = new URLSearchParams('page=2');
      render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-search'), { target: { value: '  lincoln ' } });
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(lastFilters()?.name).toBeUndefined();
      expect(replaceMock).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(lastFilters()).toMatchObject({ name: 'lincoln', page: 1 });
      expect(lastReplaceUrl().url.searchParams.get('name')).toBe('lincoln');
      expect(lastReplaceUrl().options).toEqual({ scroll: false });
    });

    it('restarts the search timer on each keystroke', () => {
      vi.useFakeTimers();
      render(<CatalogPage />);
      const search = screen.getByTestId('catalog-search');

      fireEvent.change(search, { target: { value: 'lin' } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.change(search, { target: { value: 'lincoln' } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(lastFilters()?.name).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(lastFilters()).toMatchObject({ name: 'lincoln' });
    });

    it('a year typed into the sidebar applies after 300 ms and is written to the URL', () => {
      vi.useFakeTimers();
      render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-filter-year-min'), { target: { value: '1950' } });
      expect(lastFilters()?.yearMin).toBeUndefined();
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(lastFilters()).toMatchObject({ yearMin: 1950, page: 1 });
      expect(lastReplaceUrl().url.searchParams.get('yearMin')).toBe('1950');
    });

    it('the max year applies on blur immediately', () => {
      vi.useFakeTimers();
      render(<CatalogPage />);
      const input = screen.getByTestId('catalog-filter-year-max');

      fireEvent.change(input, { target: { value: '1999' } });
      fireEvent.blur(input);

      expect(lastFilters()).toMatchObject({ yearMax: 1999 });
    });

    it('an invalid year is ignored (no yearMin sent, no URL write)', () => {
      vi.useFakeTimers();
      render(<CatalogPage />);
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(lastFilters()?.yearMin).toBeUndefined();
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('does not fire a pending search after unmount', () => {
      vi.useFakeTimers();
      const { unmount } = render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-search'), { target: { value: 'lincoln' } });
      unmount();
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('sort (criterion #12)', () => {
    it('offers the three sort options', () => {
      render(<CatalogPage />);

      const options = within(screen.getByTestId('catalog-sort'))
        .getAllByRole('option')
        .map((option) => (option as HTMLOptionElement).value);
      expect(options).toEqual(['year_asc', 'year_desc', 'name_asc']);
    });

    it('changing the sort applies immediately, resets to page 1 and writes sort to the URL', () => {
      searchParamsValue = new URLSearchParams('page=4');
      render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-sort'), { target: { value: 'name_asc' } });

      expect(lastFilters()).toMatchObject({ sort: 'name_asc', page: 1 });
      const { url } = lastReplaceUrl();
      expect(url.searchParams.get('sort')).toBe('name_asc');
      expect(url.searchParams.has('page')).toBe(false);
    });

    it('going back to the default sort removes it from the filters and the URL', () => {
      searchParamsValue = new URLSearchParams('sort=year_desc');
      render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-sort'), { target: { value: 'year_asc' } });

      expect(lastFilters()?.sort).toBeUndefined();
      expect(lastReplaceUrl().url.searchParams.has('sort')).toBe(false);
    });
  });

  describe('Clear all (criterion #8)', () => {
    it('resets filters, search and years but keeps the sort', async () => {
      searchParamsValue = new URLSearchParams(
        'country=Ukraine&denomination=5%20Kopiyok&name=wheat&yearMin=1900&keyDateOnly=true&sort=year_desc&page=2',
      );
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-clear-all'));

      const filters = lastFilters();
      expect(filters).toMatchObject({ page: 1, limit: 20, sort: 'year_desc' });
      expect(filters?.country).toBeUndefined();
      expect(filters?.denomination).toBeUndefined();
      expect(filters?.name).toBeUndefined();
      expect(filters?.yearMin).toBeUndefined();
      expect(filters?.keyDateOnly).toBeUndefined();
      expect(lastReplaceUrl().url.search).toBe('?sort=year_desc');
      expect(screen.getByTestId('catalog-search')).toHaveValue('');
      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('');
      expect(screen.getByTestId('catalog-filter-country-all')).toBeChecked();
    });

    it('cancels a pending search debounce', () => {
      vi.useFakeTimers();
      render(<CatalogPage />);

      fireEvent.change(screen.getByTestId('catalog-search'), { target: { value: 'lincoln' } });
      fireEvent.click(screen.getByTestId('catalog-clear-all'));
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(lastFilters()?.name).toBeUndefined();
      expect(screen.getByTestId('catalog-search')).toHaveValue('');
    });
  });

  describe('Hide coins I own (criterion #8)', () => {
    it('is hidden when logged out', () => {
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-filter-hide-owned')).not.toBeInTheDocument();
    });

    it('is shown when logged in, and ticking it sends hideOwned and writes it to the URL', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(await screen.findByTestId('catalog-filter-hide-owned'));

      expect(lastFilters()).toMatchObject({ hideOwned: true, page: 1 });
      expect(lastReplaceUrl().url.searchParams.get('hideOwned')).toBe('true');
    });

    it('is not sent for a logged-out user even when the URL says hideOwned=true', () => {
      searchParamsValue = new URLSearchParams('hideOwned=true');
      render(<CatalogPage />);

      expect(lastFilters()?.hideOwned).toBeUndefined();
    });

    it('is sent for a logged-in user when the URL says hideOwned=true', async () => {
      setStoredToken('tok-abc');
      searchParamsValue = new URLSearchParams('hideOwned=true');
      render(<CatalogPage />);

      expect(await screen.findByTestId('catalog-filter-hide-owned')).toBeChecked();
      expect(lastFilters()).toMatchObject({ hideOwned: true });
    });
  });

  describe('run_20260728_071525 criterion 4 (numbered pagination, adapted)', () => {
    it('renders one catalog-pagination-page element per page, numbered in order', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 1, 20));
      render(<CatalogPage />);

      const pages = screen.getAllByTestId('catalog-pagination-page');
      expect(pages.map((page) => page.textContent)).toEqual(['1', '2', '3']);
    });

    it('computes the page count from total and limit', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 1, 20));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-pagination-summary')).toHaveTextContent('Page 1 of 3');
    });

    it('marks the active page with aria-current="page" and leaves the others without it', () => {
      searchParamsValue = new URLSearchParams('page=2');
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 2, 20));
      render(<CatalogPage />);

      const pages = screen.getAllByTestId('catalog-pagination-page');
      expect(pages[1]).toHaveAttribute('aria-current', 'page');
      expect(pages[0]).not.toHaveAttribute('aria-current');
      expect(pages[2]).not.toHaveAttribute('aria-current');
    });

    it('clicking an inactive page number calls useCatalog with that page and writes page to the URL', async () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 1, 20));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getAllByTestId('catalog-pagination-page')[2]);

      expect(lastFilters()).toMatchObject({ page: 3 });
      expect(lastReplaceUrl().url.searchParams.get('page')).toBe('3');
      expect(lastReplaceUrl().options).toEqual({ scroll: false });
    });

    it('next moves forward one page, keeping the other filters', async () => {
      searchParamsValue = new URLSearchParams('country=Ukraine');
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 1, 20));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-pagination-next'));

      expect(lastFilters()).toMatchObject({ page: 2, country: 'Ukraine' });
    });

    it('the active page is not clickable — clicking it triggers no URL write', async () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 45, 1, 20));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getAllByTestId('catalog-pagination-page')[0]);

      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('mobile filters sheet (criterion #16)', () => {
    it('shows a Filters button with the active filter count', () => {
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-filters-button')).toHaveTextContent('Filters · 0');
    });

    it('counts active filters: country and denominations together are 2', () => {
      searchParamsValue = new URLSearchParams('country=Ukraine&denomination=5%20Kopiyok&denomination=1%20Cent');
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-filters-button')).toHaveTextContent('Filters · 2');
    });

    it('wires aria-expanded and aria-controls', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);
      const button = screen.getByTestId('catalog-filters-button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-controls', 'catalog-filters-sheet');
      expect(screen.queryByTestId('catalog-filters-sheet')).not.toBeInTheDocument();

      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('catalog-filters-sheet')).toHaveAttribute('id', 'catalog-filters-sheet');
    });

    it('the sheet carries the same sidebar content and changes apply to the same state', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);
      await user.click(screen.getByTestId('catalog-filters-button'));

      const sheet = within(screen.getByTestId('catalog-filters-sheet'));
      await user.click(sheet.getByTestId('catalog-filter-country-USA'));

      expect(lastFilters()).toMatchObject({ country: 'USA' });
      expect(sheet.getByTestId('catalog-filter-country-USA')).toBeChecked();
      expect(
        within(screen.getByTestId('catalog-sidebar')).getByTestId('catalog-filter-country-USA'),
      ).toBeChecked();
    });

    it('uses a separate radio group name from the aside, so the groups stay independent', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);
      await user.click(screen.getByTestId('catalog-filters-button'));

      const asideName = within(screen.getByTestId('catalog-sidebar'))
        .getByTestId('catalog-filter-country-Ukraine')
        .getAttribute('name');
      const sheetName = within(screen.getByTestId('catalog-filters-sheet'))
        .getByTestId('catalog-filter-country-Ukraine')
        .getAttribute('name');
      expect(asideName).not.toBe(sheetName);
    });

    it('does not repeat the Filters heading inside the sheet content', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);
      await user.click(screen.getByTestId('catalog-filters-button'));

      expect(
        within(screen.getByTestId('catalog-filters-sheet')).queryByRole('heading', { name: 'Filters' }),
      ).not.toBeInTheDocument();
    });

    it('closing the sheet removes it again', async () => {
      const user = userEvent.setup();
      render(<CatalogPage />);
      await user.click(screen.getByTestId('catalog-filters-button'));

      await user.click(screen.getByTestId('sheet-close'));

      expect(screen.queryByTestId('catalog-filters-sheet')).not.toBeInTheDocument();
      expect(screen.getByTestId('catalog-filters-button')).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('live region (criterion #17)', () => {
    it('announces the result count politely', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 42));
      render(<CatalogPage />);

      const region = screen.getByTestId('catalog-live-region');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveTextContent('42 coins');
    });

    it('updates with the total', () => {
      useCatalogMock.mockReturnValue(pageOf(COINS, 3));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-live-region')).toHaveTextContent('3 coins');
    });

    it('is always rendered, with empty text before the first data', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-live-region')).toHaveTextContent(/^$/);
    });
  });

  describe('run_20260725_140648 criterion 6: submit-coin entry point, gated by login', () => {
    it('does not render the submit-coin toggle when logged out', () => {
      localStorage.clear();
      useCatalogMock.mockReturnValue(pageOf([], 0));
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-submit-coin-toggle')).not.toBeInTheDocument();
    });

    it('renders the submit-coin toggle when logged in, with the form hidden until clicked', () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-submit-coin-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });

    it('clicking the toggle opens the sheet showing the submit form; the sheet\'s close button hides it', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      const user = userEvent.setup();
      render(<CatalogPage />);

      expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      expect(screen.getByTestId('sheet')).toBeInTheDocument();
      expect(screen.getByTestId('mock-submit-coin-form')).toBeInTheDocument();

      await user.click(screen.getByTestId('sheet-close'));
      expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });
  });

  describe('run_20260725_140648 criterion 6: on successful submission, renders SubmissionConfirmation instead of resetting to a blank view', () => {
    it('swaps the sheet contents to SubmissionConfirmation after the form succeeds, leaving the trigger button in place', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      await user.click(screen.getByTestId('mock-submit-coin-form-succeed'));

      expect(screen.getByTestId('mock-submission-confirmation')).toHaveTextContent('new-coin-1');
      expect(screen.getByTestId('catalog-submit-coin-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });

    it('the rest of the catalog page (results, sidebar) still renders alongside the confirmation', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf(COINS, 2));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      await user.click(screen.getByTestId('mock-submit-coin-form-succeed'));

      expect(screen.getByTestId('mock-submission-confirmation')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-sidebar')).toBeInTheDocument();
      expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    });

    it('closing the sheet after a successful submission resets it, so reopening shows a fresh submit form', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(pageOf([], 0));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      await user.click(screen.getByTestId('mock-submit-coin-form-succeed'));
      await user.click(screen.getByTestId('sheet-close'));

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      expect(screen.getByTestId('mock-submit-coin-form')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-submission-confirmation')).not.toBeInTheDocument();
    });
  });
});
