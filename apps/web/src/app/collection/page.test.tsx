/**
 * Tests for: CollectionPage (Phase 6 redesign: grouped collection, live filters, Cards/Rows, un-own with Undo)
 * Contract source: runs/run_20261019_073415/plan.md § Interface Contract → Page: CollectionPage,
 *                  Component: CollectionFilterBar, Component: CollectionSubgroupSection, Component: CollectionEmpty
 * Earlier contracts kept: runs/run_20260721_171115 (auth gating, loading, error, empty),
 *                         runs/run_20261017_142658 (name block via getCoinName)
 * Covers criteria: #1-#12 and #14 (from prd.md). #13 (mobile layout) is CSS-only and is covered by the
 * render targets, apart from the Years toggle DOM checked below.
 *
 * The old form-based tests are gone on purpose: the free-text country/year form, the Search button, the text
 * import link and the flat list (collection-filter-form, collection-filter-country, collection-filter-year,
 * collection-filter-submit, collection-import-link, collection-list, collection-item) no longer exist.
 *
 * The ownership hook is mocked, so nothing patches the cache. Optimistic removal is simulated by returning
 * `data` without the coin from useCollection and re-rendering; the hook-level onSettled is captured and
 * called by the test.
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogCoin, OwnershipItem } from '@coin-collector/shared';
import CollectionPage from '@/app/collection/page';
import { ApiError } from '@/lib/api-client';
import {
  useCollection,
  useSetOwnership,
  type SetOwnershipVariables,
  type UseSetOwnershipOptions,
} from '@/lib/hooks/use-collection';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
  useSetOwnership: vi.fn(),
}));

const useCollectionMock = vi.mocked(useCollection);
const useSetOwnershipMock = vi.mocked(useSetOwnership);

const mutateMock = vi.fn();
let ownershipOptions: UseSetOwnershipOptions | undefined;

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function setData(items: OwnershipItem[]) {
  useCollectionMock.mockReturnValue(queryResult({ data: items }));
}

function settle(error: ApiError | null, variables: SetOwnershipVariables) {
  act(() => {
    ownershipOptions?.onSettled?.(error, variables);
  });
}

const BASE: CatalogCoin = {
  id: 'base',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: '',
  variety: '',
  name: 'Lincoln Wheat Cent',
  imageUrl: null,
  imageSource: null,
  imageLicense: null,
  diameterMm: null,
  weightG: null,
  thicknessMm: null,
  material: 'Bronze',
  mintage: null,
  isKeyDate: false,
  status: 'approved',
  submittedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const DONETSK: CatalogCoin = {
  ...BASE,
  id: 'donetsk',
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  year: 2025,
  variety: 'We Are Strong. We Are Together: Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
  material: 'Brass-plated steel',
};
const ODESA: CatalogCoin = {
  ...DONETSK,
  id: 'odesa',
  year: 2026,
  variety: 'We Are Strong. We Are Together: Odesa Oblast',
};
const K25: CatalogCoin = {
  ...BASE,
  id: 'k25',
  country: 'Ukraine',
  denomination: '25 Kopiyok',
  year: 1992,
  name: 'Ukraine 25 Kopiyok',
  material: null,
};
const K10: CatalogCoin = { ...K25, id: 'k10', denomination: '10 Kopiyok', name: 'Ukraine 10 Kopiyok' };
const CENT: CatalogCoin = { ...BASE, id: 'cent-1909' };
const VDB: CatalogCoin = { ...BASE, id: 'vdb', mintMark: 'S', variety: 'VDB', isKeyDate: true };

function own(coin: CatalogCoin): OwnershipItem {
  return { coinId: coin.id, coin, ownedAt: new Date('2026-01-02T00:00:00.000Z') };
}

// Subgroups in page order: Ukraine/We Are Strong (2025, 2026), USA/Lincoln Wheat Cent (1909, 1909-S).
const SMALL = [own(CENT), own(DONETSK), own(VDB), own(ODESA)];
// Subgroups in page order: 0 We Are Strong, 1 10 Kopiyok, 2 25 Kopiyok, 3 USA/Lincoln Wheat Cent (closed by default).
const LARGE = [own(CENT), own(K25), own(DONETSK), own(VDB), own(K10), own(ODESA)];

function without(items: OwnershipItem[], coinId: string): OwnershipItem[] {
  return items.filter((i) => i.coinId !== coinId);
}

async function renderPage() {
  setStoredToken('tok-abc');
  const utils = render(<CollectionPage />);
  await screen.findByTestId('collection-page');
  return utils;
}

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

function card(coinId: string): HTMLElement {
  return must(
    screen.queryAllByTestId('coin-card').find((el) => el.getAttribute('data-coin-id') === coinId),
    `coin-card ${coinId}`,
  );
}

function cardIds(): Array<string | null> {
  return screen.queryAllByTestId('coin-card').map((el) => el.getAttribute('data-coin-id'));
}

function row(coinId: string): HTMLElement {
  return must(
    screen.queryAllByTestId('collection-row').find((el) => el.getAttribute('data-coin-id') === coinId),
    `collection-row ${coinId}`,
  );
}

function rowIds(): Array<string | null> {
  return screen.queryAllByTestId('collection-row').map((el) => el.getAttribute('data-coin-id'));
}

function chip(country: string): HTMLElement {
  return must(
    screen.getAllByTestId('collection-country-chip').find((el) => el.getAttribute('data-country') === country),
    `chip ${country}`,
  );
}

function chipCount(el: HTMLElement): string | null {
  return within(el).getByTestId('collection-country-chip-count').textContent;
}

function subgroup(key: string): HTMLElement {
  return must(
    screen.getAllByTestId('collection-subgroup').find((el) => el.getAttribute('data-subgroup-key') === key),
    `subgroup ${key}`,
  );
}

function expandedStates(): Array<string | null> {
  return screen.getAllByTestId('collection-subgroup-toggle').map((el) => el.getAttribute('aria-expanded'));
}

function search(value: string) {
  fireEvent.change(screen.getByTestId('collection-search'), { target: { value } });
}

function setYears(from: string, to: string) {
  fireEvent.change(screen.getByTestId('collection-year-from'), { target: { value: from } });
  fireEvent.change(screen.getByTestId('collection-year-to'), { target: { value: to } });
}

describe('CollectionPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    mutateMock.mockReset();
    ownershipOptions = undefined;
    useCollectionMock.mockReset();
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    useSetOwnershipMock.mockReset();
    useSetOwnershipMock.mockImplementation((options) => {
      ownershipOptions = options;
      return { mutate: mutateMock } as never;
    });
  });

  describe('auth gating', () => {
    it('does not render collection-page and redirects to /login when no token is present', async () => {
      render(<CollectionPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('collection-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion 12: loading, error and first-run empty states', () => {
    it('renders a skeleton grid while loading, with no filter bar or subtitle', async () => {
      useCollectionMock.mockReturnValue(queryResult({ isLoading: true }));
      await renderPage();

      const loading = screen.getByTestId('collection-loading');
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(0);
      expect(screen.getByTestId('collection-title')).toBeInTheDocument();
      expect(screen.queryByTestId('collection-subtitle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-filter-bar')).not.toBeInTheDocument();
    });

    it('renders an alert when the query fails and there is no data', async () => {
      useCollectionMock.mockReturnValue(queryResult({ isError: true }));
      await renderPage();

      expect(screen.getByTestId('collection-error')).toHaveAttribute('role', 'alert');
      expect(screen.queryByTestId('collection-results')).not.toBeInTheDocument();
    });

    it('keeps showing the collection when a refetch fails but data exists', async () => {
      useCollectionMock.mockReturnValue(queryResult({ data: SMALL, isError: true }));
      await renderPage();

      expect(screen.queryByTestId('collection-error')).not.toBeInTheDocument();
      expect(screen.getByTestId('collection-results')).toBeInTheDocument();
    });

    it('shows the first-run empty state, with no filter bar and no layout switch, when the user owns nothing', async () => {
      await renderPage();

      const empty = screen.getByTestId('collection-empty');
      expect(within(empty).getByTestId('collection-empty-title')).toHaveTextContent(/^Your collection is empty$/);
      expect(within(empty).getByTestId('collection-empty-primary')).toHaveAttribute('href', '/dashboard');
      expect(within(empty).getByTestId('collection-empty-import')).toHaveAttribute('href', '/collection/import');
      expect(within(empty).getByTestId('collection-empty-import')).toHaveTextContent('Import from CSV');
      expect(screen.queryByTestId('collection-filter-bar')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-layout-switch')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-results')).not.toBeInTheDocument();
    });

    it('does not show the empty state when the user owns coins', async () => {
      setData(SMALL);
      await renderPage();

      expect(screen.queryByTestId('collection-empty')).not.toBeInTheDocument();
    });
  });

  describe('criterion 1: header', () => {
    it('renders the h1 and the subtitle with the owned count', async () => {
      setData(LARGE);
      await renderPage();

      const title = screen.getByTestId('collection-title');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveTextContent(/^Collection$/);
      expect(screen.getByTestId('collection-subtitle')).toHaveTextContent(
        'Every coin you own, across all your sets · 6 coins',
      );
      expect(screen.getByTestId('collection-owned-count')).toHaveTextContent(/^6$/);
    });

    it('follows the number of owned coins and uses the singular for one coin', async () => {
      setData([own(CENT)]);
      await renderPage();

      expect(screen.getByTestId('collection-owned-count')).toHaveTextContent(/^1$/);
      expect(screen.getByTestId('collection-subtitle').textContent).toMatch(/· 1 coin$/);
    });

    it('links the Import button to /collection/import', async () => {
      setData(SMALL);
      await renderPage();

      expect(screen.getByTestId('collection-import-button')).toHaveAttribute('href', '/collection/import');
    });

    it('has a Cards/Rows switch with Cards pressed by default, and flips on click', async () => {
      setData(SMALL);
      await renderPage();

      expect(screen.getByTestId('collection-layout-switch')).toHaveAttribute('role', 'group');
      expect(screen.getByTestId('collection-layout-cards')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('collection-layout-rows')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('collection-subgroup-cards').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('collection-subgroup-rows')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('collection-layout-rows'));

      expect(screen.getByTestId('collection-layout-rows')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('collection-layout-cards')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('collection-subgroup-rows').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('collection-subgroup-cards')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-card')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('collection-layout-cards'));

      expect(screen.getByTestId('collection-layout-cards')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByTestId('coin-card')).toHaveLength(4);
    });

    it('calls useCollection with no arguments (client-side filtering, one fetch)', async () => {
      setData(SMALL);
      await renderPage();
      search('donetsk');
      setYears('2000', '');

      expect(useCollectionMock).toHaveBeenCalled();
      expect(useCollectionMock.mock.calls.every((args) => args.length === 0)).toBe(true);
    });

    it('no longer renders the old form, Search button, text import link or flat list', async () => {
      setData(SMALL);
      await renderPage();

      expect(screen.queryByTestId('collection-filter-form')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-filter-country')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-filter-year')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-filter-submit')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-import-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('collection-item')).not.toBeInTheDocument();
    });
  });

  describe('criteria 6 and 7: grouping and cards', () => {
    it('groups by country, then by series or denomination, with counts', async () => {
      setData(LARGE);
      await renderPage();

      const countries = screen.getAllByTestId('collection-country');
      expect(countries.map((el) => el.getAttribute('data-country'))).toEqual(['Ukraine', 'USA']);
      expect(within(countries[0]).getByTestId('collection-country-heading')).toHaveTextContent(/^Ukraine$/);
      expect(within(countries[0]).getByTestId('collection-country-heading').tagName).toBe('H2');
      expect(within(countries[0]).getByTestId('collection-country-count')).toHaveTextContent(/^4 coins$/);
      expect(within(countries[1]).getByTestId('collection-country-count')).toHaveTextContent(/^2 coins$/);

      const groups = screen.getAllByTestId('collection-subgroup');
      expect(groups.map((el) => el.getAttribute('data-subgroup-key'))).toEqual([
        'Ukraine|We Are Strong. We Are Together',
        'Ukraine|10 Kopiyok',
        'Ukraine|25 Kopiyok',
        'USA|Lincoln Wheat Cent',
      ]);
      expect(groups.map((el) => within(el).getByTestId('collection-subgroup-name').textContent)).toEqual([
        'We Are Strong. We Are Together',
        '10 Kopiyok',
        '25 Kopiyok',
        'Lincoln Wheat Cent',
      ]);
      expect(groups.map((el) => within(el).getByTestId('collection-subgroup-count').textContent)).toEqual([
        '2 coins',
        '1 coin',
        '1 coin',
        '2 coins',
      ]);
    });

    it('renders each coin as a CoinCard with its getCoinName parts and a link to the coin page', async () => {
      setData(SMALL);
      await renderPage();

      const donetsk = card('donetsk');
      expect(within(donetsk).getByTestId('coin-card-eyebrow')).toHaveTextContent(/^We Are Strong\. We Are Together$/);
      expect(within(donetsk).getByTestId('coin-card-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(donetsk).getByTestId('coin-card-subtitle')).toHaveTextContent(/^Ukraine · 10 Hryvnias · 2025$/);
      expect(within(donetsk).getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/donetsk');
      expect(within(donetsk).getByTestId('coin-card-status')).toHaveTextContent(/^In collection$/);
      expect(donetsk).toHaveAttribute('data-state', 'owned');

      const vdb = card('vdb');
      expect(within(vdb).getByTestId('coin-card-title')).toHaveTextContent(/^1909-S VDB$/);
      expect(within(vdb).getByTestId('coin-card-link')).toHaveAttribute('href', '/catalog/vdb');

      const cent = card('cent-1909');
      expect(within(cent).getByTestId('coin-card-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(cent).queryByTestId('coin-card-eyebrow')).not.toBeInTheDocument();
    });

    it('orders coins in a subgroup by year, whatever the order of the data', async () => {
      setData(SMALL);
      await renderPage();

      expect(cardIds()).toEqual(['donetsk', 'odesa', 'cent-1909', 'vdb']);
    });

    it('opens exactly the first 3 subgroups by default', async () => {
      setData(LARGE);
      await renderPage();

      expect(expandedStates()).toEqual(['true', 'true', 'true', 'false']);
      expect(cardIds()).toEqual(['donetsk', 'odesa', 'k10', 'k25']);
      expect(within(subgroup('USA|Lincoln Wheat Cent')).queryByTestId('collection-subgroup-cards')).not.toBeInTheDocument();
    });

    it('flips a subgroup when its header is clicked', async () => {
      setData(LARGE);
      await renderPage();

      fireEvent.click(within(subgroup('USA|Lincoln Wheat Cent')).getByTestId('collection-subgroup-toggle'));
      expect(expandedStates()).toEqual(['true', 'true', 'true', 'true']);
      expect(cardIds()).toEqual(['donetsk', 'odesa', 'k10', 'k25', 'cent-1909', 'vdb']);

      fireEvent.click(within(subgroup('Ukraine|We Are Strong. We Are Together')).getByTestId('collection-subgroup-toggle'));
      expect(expandedStates()).toEqual(['false', 'true', 'true', 'true']);
      expect(cardIds()).toEqual(['k10', 'k25', 'cent-1909', 'vdb']);
    });

    it('opens every subgroup while a filter is active, and goes back to the first 3 on Clear', async () => {
      setData(LARGE);
      await renderPage();

      setYears('1900', '');
      expect(expandedStates()).toEqual(['true', 'true', 'true', 'true']);
      expect(screen.getAllByTestId('coin-card')).toHaveLength(6);

      fireEvent.click(screen.getByTestId('collection-filter-clear'));
      expect(expandedStates()).toEqual(['true', 'true', 'true', 'false']);
    });

    it('forgets manual toggles when the filters change', async () => {
      setData(LARGE);
      await renderPage();

      fireEvent.click(within(subgroup('USA|Lincoln Wheat Cent')).getByTestId('collection-subgroup-toggle'));
      expect(expandedStates()[3]).toBe('true');

      search('lincoln');
      fireEvent.click(screen.getByTestId('collection-filter-clear'));

      expect(expandedStates()).toEqual(['true', 'true', 'true', 'false']);
    });
  });

  describe('criteria 2 and 10: live search and the shown count', () => {
    it('has no submit form and a labelled search input', async () => {
      setData(SMALL);
      await renderPage();

      const bar = screen.getByTestId('collection-filter-bar');
      expect(bar).toHaveAttribute('role', 'search');
      expect(bar).toHaveAttribute('aria-label', 'Filter collection');
      expect(bar.closest('form')).toBeNull();
      const input = screen.getByTestId('collection-search');
      expect(input).toHaveAttribute('type', 'search');
      expect(input).toHaveAttribute('aria-label', 'Search your collection');
      expect(input).toHaveAttribute('placeholder', 'Search by name, series or denomination');
      expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();
    });

    it('narrows the cards on every keystroke, with no submit', async () => {
      setData(SMALL);
      await renderPage();
      const user = userEvent.setup();

      await user.type(screen.getByTestId('collection-search'), 'don');
      expect(cardIds()).toEqual(['donetsk']);

      await user.type(screen.getByTestId('collection-search'), 'xyz');
      expect(screen.queryByTestId('coin-card')).not.toBeInTheDocument();
    });

    it('matches title, series and denomination case-insensitively', async () => {
      setData(LARGE);
      await renderPage();

      search('ODESA');
      expect(cardIds()).toEqual(['odesa']);

      search('we are strong');
      expect(cardIds()).toEqual(['donetsk', 'odesa']);

      search('Kopiyok');
      expect(cardIds()).toEqual(['k10', 'k25']);

      search('hryvnias');
      expect(cardIds()).toEqual(['donetsk', 'odesa']);
    });

    it('announces how many coins are shown in a polite live region', async () => {
      setData(LARGE);
      await renderPage();

      const status = screen.getByTestId('collection-shown-status');
      expect(status).toHaveAttribute('role', 'status');
      expect(status).toHaveAttribute('aria-live', 'polite');
      expect(status).toHaveTextContent(/^6 coins shown$/);

      search('odesa');
      expect(status).toHaveTextContent(/^1 coin shown$/);

      search('kopiyok');
      expect(status).toHaveTextContent(/^2 coins shown$/);
    });
  });

  describe('criterion 3: country chips', () => {
    it('has an All chip and one chip per country, with counts', async () => {
      setData(LARGE);
      await renderPage();

      expect(screen.getByTestId('collection-country-chips')).toHaveAttribute('role', 'group');
      const all = screen.getByTestId('collection-country-chip-all');
      expect(all).toHaveAttribute('aria-pressed', 'true');
      expect(all).toHaveTextContent('All countries');
      expect(chipCount(all)).toBe('6');
      expect(screen.getAllByTestId('collection-country-chip').map((el) => el.getAttribute('data-country'))).toEqual([
        'Ukraine',
        'USA',
      ]);
      expect(chipCount(chip('Ukraine'))).toBe('4');
      expect(chipCount(chip('USA'))).toBe('2');
      expect(chip('Ukraine')).toHaveAttribute('aria-pressed', 'false');
    });

    it('reflects the search in the counts, keeping a zero chip', async () => {
      setData(LARGE);
      await renderPage();

      search('lincoln');

      expect(chipCount(screen.getByTestId('collection-country-chip-all'))).toBe('2');
      expect(chipCount(chip('USA'))).toBe('2');
      expect(chipCount(chip('Ukraine'))).toBe('0');
    });

    it('reflects the years in the counts', async () => {
      setData(LARGE);
      await renderPage();

      setYears('2026', '');

      expect(chipCount(screen.getByTestId('collection-country-chip-all'))).toBe('1');
      expect(chipCount(chip('Ukraine'))).toBe('1');
      expect(chipCount(chip('USA'))).toBe('0');
    });

    it('selects a country: presses its chip and hides the other sections', async () => {
      setData(LARGE);
      await renderPage();

      fireEvent.click(chip('USA'));

      expect(chip('USA')).toHaveAttribute('aria-pressed', 'true');
      expect(chip('Ukraine')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByTestId('collection-country-chip-all')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getAllByTestId('collection-country').map((el) => el.getAttribute('data-country'))).toEqual(['USA']);
      expect(cardIds()).toEqual(['cent-1909', 'vdb']);
      expect(screen.getByTestId('collection-shown-status')).toHaveTextContent(/^2 coins shown$/);

      fireEvent.click(chip('Ukraine'));
      expect(screen.getAllByTestId('collection-country').map((el) => el.getAttribute('data-country'))).toEqual([
        'Ukraine',
      ]);

      fireEvent.click(screen.getByTestId('collection-country-chip-all'));
      expect(screen.getByTestId('collection-country-chip-all')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByTestId('collection-country')).toHaveLength(2);
    });

    it('keeps the other chips counted while a country is selected', async () => {
      setData(LARGE);
      await renderPage();

      fireEvent.click(chip('USA'));

      expect(chipCount(chip('Ukraine'))).toBe('4');
      expect(chipCount(screen.getByTestId('collection-country-chip-all'))).toBe('6');
    });
  });

  describe('criterion 4: year range', () => {
    it('has two numeric text inputs named From year and To year', async () => {
      setData(SMALL);
      await renderPage();

      const from = screen.getByTestId('collection-year-from');
      const to = screen.getByTestId('collection-year-to');
      expect(from).toHaveAttribute('type', 'text');
      expect(from).toHaveAttribute('inputmode', 'numeric');
      expect(from).toHaveAttribute('aria-label', 'From year');
      expect(from).toHaveAttribute('placeholder', 'From');
      expect(to).toHaveAttribute('type', 'text');
      expect(to).toHaveAttribute('inputmode', 'numeric');
      expect(to).toHaveAttribute('aria-label', 'To year');
      expect(to).toHaveAttribute('placeholder', 'To');
      expect(screen.getByTestId('collection-years').tagName).toBe('FIELDSET');
    });

    it('ignores non-digit input and keeps at most 4 digits', async () => {
      setData(SMALL);
      await renderPage();
      const from = screen.getByTestId('collection-year-from');

      fireEvent.change(from, { target: { value: '20a2' } });
      expect(from).toHaveValue('202');

      fireEvent.change(from, { target: { value: '20255' } });
      expect(from).toHaveValue('2025');

      fireEvent.change(from, { target: { value: 'abc' } });
      expect(from).toHaveValue('');
    });

    it('filters from a year, inclusively', async () => {
      setData(SMALL);
      await renderPage();

      setYears('2025', '');
      expect(cardIds()).toEqual(['donetsk', 'odesa']);

      setYears('2026', '');
      expect(cardIds()).toEqual(['odesa']);
    });

    it('filters to a year, inclusively', async () => {
      setData(SMALL);
      await renderPage();

      setYears('', '1909');
      expect(cardIds()).toEqual(['cent-1909', 'vdb']);

      setYears('', '2025');
      expect(cardIds()).toEqual(['donetsk', 'cent-1909', 'vdb']);
    });

    it('filters to an exact year when both bounds are equal', async () => {
      setData(SMALL);
      await renderPage();

      setYears('2025', '2025');

      expect(cardIds()).toEqual(['donetsk']);
    });

    it('shows the no-results state when the range is empty', async () => {
      setData(SMALL);
      await renderPage();

      setYears('2026', '2025');

      expect(screen.getByTestId('collection-no-results')).toBeInTheDocument();
    });

    it('has a Years toggle for small screens that controls the year fieldset', async () => {
      setData(SMALL);
      await renderPage();

      const toggle = screen.getByTestId('collection-years-toggle');
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', screen.getByTestId('collection-years').id);

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');

      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('criterion 5: Clear', () => {
    it('is absent with no filters', async () => {
      setData(SMALL);
      await renderPage();

      expect(screen.queryByTestId('collection-filter-clear')).not.toBeInTheDocument();
    });

    it('appears for each kind of filter on its own', async () => {
      setData(SMALL);
      await renderPage();

      search('odesa');
      expect(screen.getByTestId('collection-filter-clear')).toBeInTheDocument();
      search('');
      expect(screen.queryByTestId('collection-filter-clear')).not.toBeInTheDocument();

      fireEvent.click(chip('USA'));
      expect(screen.getByTestId('collection-filter-clear')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('collection-country-chip-all'));
      expect(screen.queryByTestId('collection-filter-clear')).not.toBeInTheDocument();

      setYears('1900', '');
      expect(screen.getByTestId('collection-filter-clear')).toBeInTheDocument();
      setYears('', '');
      expect(screen.queryByTestId('collection-filter-clear')).not.toBeInTheDocument();

      setYears('', '2030');
      expect(screen.getByTestId('collection-filter-clear')).toBeInTheDocument();
    });

    it('resets the search, the country and both years', async () => {
      setData(SMALL);
      await renderPage();
      search('oblast');
      fireEvent.click(chip('Ukraine'));
      setYears('2000', '2030');
      expect(cardIds()).toEqual(['donetsk', 'odesa']);

      fireEvent.click(screen.getByTestId('collection-filter-clear'));

      expect(screen.getByTestId('collection-search')).toHaveValue('');
      expect(screen.getByTestId('collection-country-chip-all')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('collection-year-from')).toHaveValue('');
      expect(screen.getByTestId('collection-year-to')).toHaveValue('');
      expect(cardIds()).toEqual(['donetsk', 'odesa', 'cent-1909', 'vdb']);
      expect(screen.queryByTestId('collection-filter-clear')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: no matches', () => {
    it('shows the message and a Clear filters button, and no results', async () => {
      setData(SMALL);
      await renderPage();

      search('zzzz');

      expect(screen.getByTestId('collection-no-results')).toHaveTextContent(
        'No coins in your collection match these filters.',
      );
      expect(screen.getByTestId('collection-no-results-clear')).toHaveTextContent('Clear filters');
      expect(screen.queryByTestId('collection-results')).not.toBeInTheDocument();
      expect(screen.getByTestId('collection-filter-bar')).toBeInTheDocument();
      expect(screen.getByTestId('collection-shown-status')).toHaveTextContent(/^0 coins shown$/);
    });

    it('does not show it while something matches', async () => {
      setData(SMALL);
      await renderPage();

      search('odesa');

      expect(screen.queryByTestId('collection-no-results')).not.toBeInTheDocument();
    });

    it('Clear filters resets every filter and brings the coins back', async () => {
      setData(SMALL);
      await renderPage();
      search('zzzz');
      setYears('1900', '');

      fireEvent.click(screen.getByTestId('collection-no-results-clear'));

      expect(screen.queryByTestId('collection-no-results')).not.toBeInTheDocument();
      expect(screen.getByTestId('collection-search')).toHaveValue('');
      expect(screen.getByTestId('collection-year-from')).toHaveValue('');
      expect(cardIds()).toEqual(['donetsk', 'odesa', 'cent-1909', 'vdb']);
    });
  });

  describe('criteria 8 and 10: un-owning a card', () => {
    it('names the toggle by owned state, title and year', async () => {
      setData(SMALL);
      await renderPage();

      expect(within(card('donetsk')).getByTestId('status-toggle')).toHaveAttribute(
        'aria-label',
        'Remove Donetsk Oblast (2025) from your collection',
      );
      expect(within(card('vdb')).getByTestId('status-toggle')).toHaveAttribute(
        'aria-label',
        'Remove 1909-S VDB (1909) from your collection',
      );
      expect(within(card('donetsk')).getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'true');
    });

    it('calls the ownership mutation with the coin, and shows it saving', async () => {
      setData(SMALL);
      await renderPage();

      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'donetsk', owned: false, coin: DONETSK });
      expect(card('donetsk')).toHaveAttribute('data-status', 'pending');
      expect(card('odesa')).toHaveAttribute('data-status', 'idle');

      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));
      expect(mutateMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the card in place as "Removed" once the cache drops the coin, and offers to add it back', async () => {
      setData(SMALL);
      const { rerender } = await renderPage();
      const before = cardIds();

      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));
      setData(without(SMALL, 'donetsk'));
      rerender(<CollectionPage />);
      settle(null, { coinId: 'donetsk', owned: false, coin: DONETSK });

      expect(cardIds()).toEqual(before);
      const removed = card('donetsk');
      expect(removed).toHaveAttribute('data-state', 'missing');
      expect(removed).toHaveAttribute('data-status', 'idle');
      expect(within(removed).getByTestId('coin-card-status')).toHaveTextContent(/^Removed$/);
      expect(within(removed).getByTestId('status-toggle')).toHaveAttribute(
        'aria-label',
        'Add Donetsk Oblast (2025) back to your collection',
      );
      expect(within(removed).getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'false');
      expect(within(card('odesa')).getByTestId('coin-card-status')).toHaveTextContent(/^In collection$/);
      expect(screen.getByTestId('collection-owned-count')).toHaveTextContent(/^3$/);
    });

    it('re-owns the coin on a second click, with the same coin and no new removal', async () => {
      setData(SMALL);
      const { rerender } = await renderPage();
      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));
      setData(without(SMALL, 'donetsk'));
      rerender(<CollectionPage />);
      settle(null, { coinId: 'donetsk', owned: false, coin: DONETSK });
      mutateMock.mockClear();

      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'donetsk', owned: true, coin: DONETSK });

      setData(SMALL);
      rerender(<CollectionPage />);
      settle(null, { coinId: 'donetsk', owned: true, coin: DONETSK });

      expect(card('donetsk')).toHaveAttribute('data-state', 'owned');
      expect(within(card('donetsk')).getByTestId('coin-card-status')).toHaveTextContent(/^In collection$/);
      expect(screen.getByTestId('collection-owned-count')).toHaveTextContent(/^4$/);
    });

    it('shows the failed state with Retry when the save fails, and Retry tries the same change again', async () => {
      setData(SMALL);
      await renderPage();
      fireEvent.click(within(card('odesa')).getByTestId('status-toggle'));
      mutateMock.mockClear();

      settle(new ApiError(500, 'boom'), { coinId: 'odesa', owned: false, coin: ODESA });

      expect(card('odesa')).toHaveAttribute('data-status', 'failed');
      expect(card('donetsk')).toHaveAttribute('data-status', 'idle');
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();

      fireEvent.click(within(card('odesa')).getByTestId('coin-card-retry'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'odesa', owned: false, coin: ODESA });
      expect(card('odesa')).toHaveAttribute('data-status', 'pending');
    });
  });

  describe('criterion 8: un-owning a row', () => {
    async function renderRows() {
      setData(SMALL);
      const utils = await renderPage();
      fireEvent.click(screen.getByTestId('collection-layout-rows'));
      return utils;
    }

    it('renders one row per coin with eyebrow, title, subtitle, link and an Owned pill', async () => {
      await renderRows();

      expect(rowIds()).toEqual(['donetsk', 'odesa', 'cent-1909', 'vdb']);
      const donetsk = row('donetsk');
      expect(donetsk).toHaveAttribute('data-state', 'owned');
      expect(within(donetsk).getByTestId('collection-row-eyebrow')).toHaveTextContent(
        /^We Are Strong\. We Are Together$/,
      );
      expect(within(donetsk).getByTestId('collection-row-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(donetsk).getByTestId('collection-row-subtitle')).toHaveTextContent(
        /^Ukraine · 10 Hryvnias · 2025$/,
      );
      expect(within(donetsk).getByTestId('collection-row-link')).toHaveAttribute('href', '/catalog/donetsk');
      const pill = within(donetsk).getByTestId('status-toggle');
      expect(pill).toHaveAttribute('data-variant', 'pill');
      expect(pill).toHaveTextContent('Owned');
      expect(pill).toHaveAttribute('aria-label', 'Remove Donetsk Oblast (2025) from your collection');
      expect(within(row('cent-1909')).queryByTestId('collection-row-eyebrow')).not.toBeInTheDocument();
      expect(within(row('vdb')).getByTestId('collection-row-title')).toHaveTextContent(/^1909-S VDB$/);
    });

    it('un-owns through the pill and keeps the row in place as "Removed"', async () => {
      const { rerender } = await renderRows();
      const before = rowIds();

      fireEvent.click(within(row('odesa')).getByTestId('status-toggle'));
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'odesa', owned: false, coin: ODESA });

      setData(without(SMALL, 'odesa'));
      rerender(<CollectionPage />);
      settle(null, { coinId: 'odesa', owned: false, coin: ODESA });

      expect(rowIds()).toEqual(before);
      const removed = row('odesa');
      expect(removed).toHaveAttribute('data-state', 'removed');
      expect(within(removed).getByTestId('status-toggle')).toHaveTextContent('Removed');
      expect(within(removed).getByTestId('status-toggle')).toHaveAttribute(
        'aria-label',
        'Add Odesa Oblast (2026) back to your collection',
      );
      expect(row('donetsk')).toHaveAttribute('data-state', 'owned');
      expect(within(row('donetsk')).getByTestId('status-toggle')).toHaveTextContent('Owned');
    });

    it('marks a row failed when the save fails', async () => {
      await renderRows();
      fireEvent.click(within(row('vdb')).getByTestId('status-toggle'));

      settle(new ApiError(500, 'boom'), { coinId: 'vdb', owned: false, coin: VDB });

      expect(row('vdb')).toHaveAttribute('data-status', 'failed');
      expect(row('cent-1909')).toHaveAttribute('data-status', 'idle');
    });
  });

  describe('criterion 9: Undo toast', () => {
    it('shows the removal toast after the save settles, and Undo re-owns the coin', async () => {
      setData(SMALL);
      const { rerender } = await renderPage();
      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
      setData(without(SMALL, 'donetsk'));
      rerender(<CollectionPage />);
      mutateMock.mockClear();

      settle(null, { coinId: 'donetsk', owned: false, coin: DONETSK });

      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent(
        'Donetsk Oblast (2025) removed from your collection and every set.',
      );

      fireEvent.click(screen.getByTestId('undo-toast-undo'));

      expect(mutateMock).toHaveBeenCalledTimes(1);
      expect(mutateMock).toHaveBeenCalledWith({ coinId: 'donetsk', owned: true, coin: DONETSK });
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('names the coin that was removed', async () => {
      setData(SMALL);
      await renderPage();
      fireEvent.click(within(card('vdb')).getByTestId('status-toggle'));

      settle(null, { coinId: 'vdb', owned: false, coin: VDB });

      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent(
        '1909-S VDB (1909) removed from your collection and every set.',
      );
    });

    it('shows no toast when a coin is re-owned', async () => {
      setData(SMALL);
      await renderPage();

      settle(null, { coinId: 'donetsk', owned: true, coin: DONETSK });

      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('shows no toast when the save failed', async () => {
      setData(SMALL);
      await renderPage();
      fireEvent.click(within(card('donetsk')).getByTestId('status-toggle'));

      settle(new ApiError(500, 'boom'), { coinId: 'donetsk', owned: false, coin: DONETSK });

      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });
  });

  describe('filters apply to removed coins too', () => {
    it('keeps a removed coin visible and counted in its country chip', async () => {
      setData(SMALL);
      const { rerender } = await renderPage();
      fireEvent.click(within(card('cent-1909')).getByTestId('status-toggle'));
      setData(without(SMALL, 'cent-1909'));
      rerender(<CollectionPage />);
      settle(null, { coinId: 'cent-1909', owned: false, coin: CENT });

      fireEvent.click(chip('USA'));

      expect(cardIds()).toEqual(['cent-1909', 'vdb']);
      expect(chipCount(chip('USA'))).toBe('2');
    });
  });
});
