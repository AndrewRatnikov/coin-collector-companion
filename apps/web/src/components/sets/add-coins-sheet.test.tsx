/**
 * Tests for: AddCoinsSheet (Phase 5 redesign): the Add coins side sheet / mobile full-screen dialog
 * Contract source: runs/run_20261018_161537/plan.md § Interface Contract → Component: AddCoinsSheet
 *                  (and Component: AddCoinsFilterChip, which is exercised through the sheet's chips)
 * Covers criteria: #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #15 (focus)
 *
 * One DOM serves desktop and mobile (CSS-only variants), so both Done buttons exist in jsdom.
 * Tests therefore always use testids, never getByRole('button', { name: 'Done' }).
 *
 * Mutations: the sheet must call usePatchSetCoins(setId).mutateAsync (never mutate). The mock returns
 * controllable promises so "Adding…" and the independent resolution of several rows can be observed.
 *
 * CONTRACT_GAPS: none
 */

import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogCoin, GapSlot } from '@coin-collector/shared';
import { AddCoinsSheet } from '@/components/sets/add-coins-sheet';
import { useCatalog, useCatalogFacets } from '@/lib/hooks/use-catalog';
import { useCollection } from '@/lib/hooks/use-collection';
import { usePatchSetCoins } from '@/lib/hooks/use-user-sets';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
  useCatalogFacets: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  usePatchSetCoins: vi.fn(),
}));

const useCatalogMock = vi.mocked(useCatalog);
const useCatalogFacetsMock = vi.mocked(useCatalogFacets);
const useCollectionMock = vi.mocked(useCollection);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);

function coin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'coin-donetsk',
    country: 'Ukraine',
    denomination: '10 Hryvnias',
    year: 2025,
    mintMark: '',
    variety: 'We Are Strong. We Are Together: Donetsk Oblast',
    name: 'Ukraine Commemorative 10 Hryvnias',
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

const DONETSK = coin();
const LUHANSK = coin({
  id: 'coin-luhansk',
  variety: 'We Are Strong. We Are Together: Luhansk Oblast',
});
const IN_SET = coin({
  id: 'coin-kyiv',
  variety: 'We Are Strong. We Are Together: Kyiv Oblast',
});
const PLAIN = coin({
  id: 'coin-plain',
  country: 'United States',
  denomination: '1 Cent',
  year: 1910,
  variety: '',
  name: 'Lincoln Wheat Cent',
});
const OTHER_SET_COIN = coin({
  id: 'coin-other',
  country: 'Poland',
  denomination: '2 Zlote',
  year: 2001,
  variety: '',
  name: 'Poland Commemorative 2 Zlote',
});

const SLOTS: GapSlot[] = [
  { id: 'usc-1', position: 0, coin: IN_SET, owned: false },
  { id: 'usc-2', position: 1, coin: OTHER_SET_COIN, owned: false },
];

const FACETS = { countries: ['Ukraine', 'Poland'], denominations: ['10 Hryvnias', '1 Hryvnia'] };

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn(), ...overrides } as never;
}

function setCatalog(items: CatalogCoin[], total = items.length) {
  useCatalogMock.mockReturnValue(queryResult({ data: { items, page: 1, limit: 20, total } }));
}

function lastCatalogArgs(): Record<string, unknown> {
  const calls = useCatalogMock.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

function lastFacetsArg(): unknown {
  const calls = useCatalogFacetsMock.mock.calls;
  return calls[calls.length - 1][0];
}

interface Deferred {
  resolve: () => void;
  reject: (err: Error) => void;
  promise: Promise<unknown>;
}

const pending: Deferred[] = [];
const mutateAsync = vi.fn();

function installDeferredMutation() {
  pending.length = 0;
  mutateAsync.mockReset();
  mutateAsync.mockImplementation(() => {
    let resolve: () => void = () => undefined;
    let reject: (err: Error) => void = () => undefined;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = () => res(undefined);
      reject = rej;
    });
    pending.push({ resolve, reject, promise });
    return promise;
  });
}

const onClose = vi.fn();

function renderSheet(props: { slots?: GapSlot[] } = {}) {
  return render(<AddCoinsSheet setId="set-1" setName="My Set" slots={props.slots ?? SLOTS} onClose={onClose} />);
}

function rowFor(coinId: string): HTMLElement {
  const row = screen.getAllByTestId('add-coins-row').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!row) throw new Error(`no row for ${coinId}`);
  return row;
}

function rowIds(): (string | null)[] {
  return screen.getAllByTestId('add-coins-row').map((el) => el.getAttribute('data-coin-id'));
}

function badgeVariants(row: HTMLElement): string[] {
  return within(row)
    .queryAllByTestId('badge')
    .map((el) => el.getAttribute('data-variant') ?? '')
    .sort();
}

function panelFocusables(): HTMLElement[] {
  const panel = screen.getByTestId('add-coins-sheet');
  return Array.from(
    panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'),
  );
}

describe('AddCoinsSheet', () => {
  beforeEach(() => {
    onClose.mockClear();
    [useCatalogMock, useCatalogFacetsMock, useCollectionMock, usePatchSetCoinsMock].forEach((m) => m.mockReset());
    installDeferredMutation();
    setCatalog([DONETSK, LUHANSK, IN_SET, PLAIN]);
    useCatalogFacetsMock.mockReturnValue(queryResult({ data: FACETS }));
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    usePatchSetCoinsMock.mockReturnValue({ mutateAsync, mutate: vi.fn(), isPending: false } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('criteria 2 and 3: dialog shell and header', () => {
    it('is a modal dialog labelled by its h2 title, with the set name in the subtitle', () => {
      renderSheet();

      const dialog = screen.getByTestId('add-coins-sheet');
      expect(dialog).toHaveAttribute('role', 'dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      const title = screen.getByTestId('add-coins-title');
      expect(title.tagName).toBe('H2');
      expect(title).toHaveTextContent('Add coins');
      expect(title.id).not.toBe('');
      expect(dialog).toHaveAttribute('aria-labelledby', title.id);
      expect(screen.getByTestId('add-coins-subtitle')).toHaveTextContent('to My Set');
      expect(screen.getByTestId('add-coins-root')).toContainElement(dialog);
      expect(usePatchSetCoinsMock).toHaveBeenCalledWith('set-1');
    });

    it('renders the subtitle from the setName prop', () => {
      render(<AddCoinsSheet setId="set-1" setName="Another Name" slots={SLOTS} onClose={onClose} />);

      expect(screen.getByTestId('add-coins-subtitle')).toHaveTextContent('to Another Name');
      expect(screen.getByTestId('add-coins-subtitle')).not.toHaveTextContent('My Set');
    });

    it('has a labelled Close button in the header', () => {
      renderSheet();

      expect(screen.getByTestId('add-coins-close')).toHaveAttribute('aria-label', 'Close');
      expect(screen.getByTestId('add-coins-done-top')).toHaveTextContent('Done');
      expect(screen.getByTestId('add-coins-done')).toHaveTextContent('Done');
    });

    it.each([['add-coins-close'], ['add-coins-done-top'], ['add-coins-done'], ['add-coins-scrim']])(
      'calls onClose when %s is clicked',
      async (testId) => {
        const user = userEvent.setup();
        renderSheet();
        expect(onClose).not.toHaveBeenCalled();

        await user.click(screen.getByTestId(testId));

        expect(onClose).toHaveBeenCalledTimes(1);
      },
    );

    it('calls onClose on Escape', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close when clicking inside the panel', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(screen.getByTestId('add-coins-title'));
      await user.click(screen.getByTestId('add-coins-sheet'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('criterion 15: focus', () => {
    it('moves focus to the search input on open', () => {
      renderSheet();

      expect(screen.getByTestId('add-coins-search')).toHaveFocus();
    });

    it('traps Tab: from the last focusable it wraps to the first, and Shift+Tab goes the other way', async () => {
      const user = userEvent.setup();
      renderSheet();
      const focusables = panelFocusables();
      expect(focusables.length).toBeGreaterThan(3);
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      last.focus();
      await user.tab();
      expect(first).toHaveFocus();

      await user.tab({ shift: true });
      expect(last).toHaveFocus();
    });

    it('locks body scroll while open and restores focus to the opener (and scroll) on close', async () => {
      function Harness() {
        const [open, setOpen] = useState(false);
        return (
          <>
            <button type="button" onClick={() => setOpen(true)}>
              Open sheet
            </button>
            {open && <AddCoinsSheet setId="set-1" setName="My Set" slots={SLOTS} onClose={() => setOpen(false)} />}
          </>
        );
      }
      const user = userEvent.setup();
      render(<Harness />);
      const opener = screen.getByRole('button', { name: 'Open sheet' });
      await user.click(opener);
      expect(screen.getByTestId('add-coins-search')).toHaveFocus();
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('add-coins-sheet')).not.toBeInTheDocument();
      expect(opener).toHaveFocus();
      expect(document.body.style.overflow).not.toBe('hidden');
    });
  });

  describe('criterion 4: live search', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    it('has a labelled search input, no submit button, and starts with page 1, limit 20 and no name', () => {
      renderSheet();

      const search = screen.getByTestId('add-coins-search');
      expect(search).toHaveAttribute('aria-label', 'Search the catalog');
      expect(screen.queryByRole('button', { name: /^search$/i })).not.toBeInTheDocument();
      expect(document.querySelector('button[type="submit"]')).toBeNull();
      expect(lastCatalogArgs()).toEqual({ page: 1, limit: 20 });
    });

    it('applies the typed text to useCatalog after 300ms, trimmed, without any button', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderSheet();

      await user.type(screen.getByTestId('add-coins-search'), '  odesa ');
      expect(lastCatalogArgs().name).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(lastCatalogArgs().name).toBe('odesa');
    });

    it('follows the text: a different query gives a different name, and clearing removes it', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderSheet();
      const search = screen.getByTestId('add-coins-search');

      await user.type(search, 'kyiv');
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastCatalogArgs().name).toBe('kyiv');

      await user.clear(search);
      await user.type(search, 'lviv');
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastCatalogArgs().name).toBe('lviv');

      await user.clear(search);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastCatalogArgs().name).toBeUndefined();
    });

    it('applies the text at once on Enter', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderSheet();

      await user.type(screen.getByTestId('add-coins-search'), 'luhansk{Enter}');

      expect(lastCatalogArgs().name).toBe('luhansk');
    });
  });

  describe('criterion 4: Country / Denomination / Year chips', () => {
    it('shows Any … labels, aria-pressed false and a collapsed popover when nothing is set', () => {
      renderSheet();

      const country = screen.getByTestId('add-coins-filter-country');
      const denomination = screen.getByTestId('add-coins-filter-denomination');
      const year = screen.getByTestId('add-coins-filter-year');
      expect(country).toHaveTextContent('Any country');
      expect(denomination).toHaveTextContent('Any denomination');
      expect(year).toHaveTextContent('Any year');
      [country, denomination, year].forEach((chip) => {
        expect(chip).toHaveAttribute('aria-pressed', 'false');
        expect(chip).toHaveAttribute('aria-expanded', 'false');
      });
      expect(screen.queryByTestId('add-coins-country-menu')).not.toBeInTheDocument();
      expect(lastFacetsArg()).toBeUndefined();
    });

    it('opens a menu of Any country plus the facet countries, with Any checked', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(screen.getByTestId('add-coins-filter-country'));

      const menu = screen.getByTestId('add-coins-country-menu');
      expect(menu).toHaveAttribute('role', 'menu');
      expect(screen.getByTestId('add-coins-filter-country')).toHaveAttribute('aria-expanded', 'true');
      const options = within(menu).getAllByTestId('add-coins-country-option');
      expect(options.map((o) => o.getAttribute('data-value'))).toEqual(['', 'Ukraine', 'Poland']);
      options.forEach((o) => expect(o).toHaveAttribute('role', 'menuitemradio'));
      expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    });

    it('choosing a country filters useCatalog, closes the menu, presses the chip and scopes the facets', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));

      await user.click(screen.getAllByTestId('add-coins-country-option')[1]);

      expect(lastCatalogArgs().country).toBe('Ukraine');
      expect(screen.queryByTestId('add-coins-country-menu')).not.toBeInTheDocument();
      const chip = screen.getByTestId('add-coins-filter-country');
      expect(chip).toHaveTextContent('Ukraine');
      expect(chip).toHaveAttribute('aria-pressed', 'true');
      expect(lastFacetsArg()).toBe('Ukraine');

      await user.click(chip);
      await user.click(screen.getAllByTestId('add-coins-country-option')[2]);
      expect(lastCatalogArgs().country).toBe('Poland');
      expect(lastFacetsArg()).toBe('Poland');
    });

    it('choosing Any country clears the country', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[1]);
      expect(lastCatalogArgs().country).toBe('Ukraine');

      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[0]);

      expect(lastCatalogArgs().country).toBeUndefined();
      expect(screen.getByTestId('add-coins-filter-country')).toHaveTextContent('Any country');
      expect(screen.getByTestId('add-coins-filter-country')).toHaveAttribute('aria-pressed', 'false');
    });

    it('lists the facet denominations, filters by one, and resets it when the country changes', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(screen.getByTestId('add-coins-filter-denomination'));
      const menu = screen.getByTestId('add-coins-denomination-menu');
      expect(menu).toHaveAttribute('role', 'menu');
      expect(
        within(menu)
          .getAllByTestId('add-coins-denomination-option')
          .map((o) => o.getAttribute('data-value')),
      ).toEqual(['', '10 Hryvnias', '1 Hryvnia']);

      await user.click(within(menu).getAllByTestId('add-coins-denomination-option')[1]);
      expect(lastCatalogArgs().denomination).toBe('10 Hryvnias');
      const chip = screen.getByTestId('add-coins-filter-denomination');
      expect(chip).toHaveTextContent('10 Hryvnias');
      expect(chip).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[2]);

      expect(lastCatalogArgs().country).toBe('Poland');
      expect(lastCatalogArgs().denomination).toBeUndefined();
      expect(screen.getByTestId('add-coins-filter-denomination')).toHaveTextContent('Any denomination');
    });

    it('includes the selected country in the menu even when the facets lack it', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[1]);
      useCatalogFacetsMock.mockReturnValue(queryResult({ data: { countries: ['Poland'], denominations: [] } }));

      await user.click(screen.getByTestId('add-coins-filter-country'));

      const values = screen.getAllByTestId('add-coins-country-option').map((o) => o.getAttribute('data-value'));
      expect(values).toContain('Ukraine');
      expect(values).toContain('Poland');
    });

    it('Escape inside a menu closes only the menu, returns focus to the chip, and the next Escape closes the sheet', async () => {
      const user = userEvent.setup();
      renderSheet();
      const chip = screen.getByTestId('add-coins-filter-country');
      await user.click(chip);
      expect(screen.getByTestId('add-coins-country-menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('add-coins-country-menu')).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(chip).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('closes a menu when the user presses outside it', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));
      expect(screen.getByTestId('add-coins-country-menu')).toBeInTheDocument();

      await user.click(screen.getByTestId('add-coins-search'));

      expect(screen.queryByTestId('add-coins-country-menu')).not.toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('moves focus among menu items with the arrow keys, wrapping, and Home / End', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));
      const options = screen.getAllByTestId('add-coins-country-option');
      // opens on the checked item
      expect(options[0]).toHaveFocus();

      await user.keyboard('{ArrowDown}');
      expect(options[1]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(options[2]).toHaveFocus();
      await user.keyboard('{ArrowDown}');
      expect(options[0]).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(options[2]).toHaveFocus();
      await user.keyboard('{Home}');
      expect(options[0]).toHaveFocus();
      await user.keyboard('{End}');
      expect(options[2]).toHaveFocus();
    });

    it('the Year chip applies a typed year after 300ms as yearMin = yearMax, and presses the chip', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-year'));

      const input = screen.getByTestId('add-coins-year-input');
      expect(input).toHaveAttribute('aria-label', 'Year');
      await user.type(input, '2025');
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(lastCatalogArgs().yearMin).toBe(2025);
      expect(lastCatalogArgs().yearMax).toBe(2025);
      const chip = screen.getByTestId('add-coins-filter-year');
      expect(chip).toHaveTextContent('2025');
      expect(chip).toHaveAttribute('aria-pressed', 'true');
    });

    it('Enter in the year input applies at once and closes the popover; a different year gives different args', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-year'));

      await user.type(screen.getByTestId('add-coins-year-input'), '1999{Enter}');

      expect(lastCatalogArgs().yearMin).toBe(1999);
      expect(lastCatalogArgs().yearMax).toBe(1999);
      expect(screen.queryByTestId('add-coins-year-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-coins-filter-year')).toHaveTextContent('1999');
    });

    it('the Any year button clears the year and closes the popover', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-year'));
      await user.type(screen.getByTestId('add-coins-year-input'), '1999{Enter}');
      expect(lastCatalogArgs().yearMin).toBe(1999);

      await user.click(screen.getByTestId('add-coins-filter-year'));
      await user.click(screen.getByTestId('add-coins-year-any'));

      expect(lastCatalogArgs().yearMin).toBeUndefined();
      expect(lastCatalogArgs().yearMax).toBeUndefined();
      expect(screen.queryByTestId('add-coins-year-input')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-coins-filter-year')).toHaveTextContent('Any year');
      expect(screen.getByTestId('add-coins-filter-year')).toHaveAttribute('aria-pressed', 'false');
    });

    it('treats an invalid year as unset', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-year'));

      await user.type(screen.getByTestId('add-coins-year-input'), 'abc{Enter}');

      expect(lastCatalogArgs().yearMin).toBeUndefined();
      expect(lastCatalogArgs().yearMax).toBeUndefined();
    });
  });

  describe('data states', () => {
    it('shows a busy loading block (and no list or count) while the first load has no data', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      renderSheet();

      const loading = screen.getByTestId('add-coins-loading');
      expect(loading).toHaveAttribute('aria-busy', 'true');
      expect(within(loading).getAllByTestId('skeleton').length).toBeGreaterThan(0);
      expect(screen.queryByTestId('add-coins-results')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-coins-count')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-coins-error')).not.toBeInTheDocument();
    });

    it('renders with no collection data yet', () => {
      useCollectionMock.mockReturnValue(queryResult());
      renderSheet();

      expect(screen.getAllByTestId('add-coins-row')).toHaveLength(4);
    });

    it('shows an error with a retry button that refetches the catalog', async () => {
      const refetch = vi.fn();
      useCatalogMock.mockReturnValue(queryResult({ isError: true, refetch }));
      const user = userEvent.setup();
      renderSheet();

      expect(screen.getByTestId('add-coins-error')).toHaveTextContent(/couldn.t load the catalog/i);
      expect(screen.queryByTestId('add-coins-loading')).not.toBeInTheDocument();
      await user.click(screen.getByTestId('add-coins-error-retry'));

      expect(refetch).toHaveBeenCalledTimes(1);
    });

    it('shows the empty state when there are no results', () => {
      setCatalog([], 0);
      renderSheet();

      expect(screen.getByTestId('add-coins-empty')).toHaveTextContent('No coins match these filters.');
      expect(screen.queryByTestId('add-coins-row')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-coins-error')).not.toBeInTheDocument();
    });

    it('does not show the empty state or the error when there are rows', () => {
      renderSheet();

      expect(screen.queryByTestId('add-coins-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-coins-error')).not.toBeInTheDocument();
      expect(screen.queryByTestId('add-coins-loading')).not.toBeInTheDocument();
    });
  });

  describe('criterion 6: results count', () => {
    it('shows "N results" following the API total', () => {
      setCatalog([DONETSK, LUHANSK], 37);
      const { unmount } = renderSheet();
      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^37 results$/);
      unmount();

      setCatalog([DONETSK], 12);
      renderSheet();
      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^12 results$/);
    });

    it('uses the singular for exactly one result', () => {
      setCatalog([DONETSK], 1);
      renderSheet();

      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^1 result$/);
    });
  });

  describe('criteria 7 and 10: rows, name block and badges', () => {
    it('renders one row per item with the getCoinName eyebrow, title and subtitle', () => {
      renderSheet();

      expect(rowIds()).toEqual(['coin-donetsk', 'coin-luhansk', 'coin-kyiv', 'coin-plain']);
      const donetsk = rowFor('coin-donetsk');
      expect(within(donetsk).getByTestId('add-coins-row-eyebrow')).toHaveTextContent(/^We Are Strong\. We Are Together$/);
      expect(within(donetsk).getByTestId('add-coins-row-title')).toHaveTextContent(/^Donetsk Oblast$/);
      expect(within(donetsk).getByTestId('add-coins-row-subtitle')).toHaveTextContent(
        /^Ukraine · 10 Hryvnias · 2025$/,
      );
      const luhansk = rowFor('coin-luhansk');
      expect(within(luhansk).getByTestId('add-coins-row-title')).toHaveTextContent(/^Luhansk Oblast$/);
    });

    it('omits the eyebrow for a self-describing coin and titles it by its type name', () => {
      renderSheet();

      const plain = rowFor('coin-plain');
      expect(within(plain).queryByTestId('add-coins-row-eyebrow')).not.toBeInTheDocument();
      expect(within(plain).getByTestId('add-coins-row-title')).toHaveTextContent(/^Lincoln Wheat Cent$/);
      expect(within(plain).getByTestId('add-coins-row-subtitle')).toHaveTextContent(
        /^United States · 1 Cent · 1910$/,
      );
    });

    it('links each title to /catalog/{id}', () => {
      renderSheet();

      expect(rowFor('coin-donetsk').querySelector('a[href="/catalog/coin-donetsk"]')).not.toBeNull();
      expect(rowFor('coin-plain').querySelector('a[href="/catalog/coin-plain"]')).not.toBeNull();
      expect(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-title').closest('a')).toHaveAttribute(
        'href',
        '/catalog/coin-luhansk',
      );
    });

    it('shows In this set and "Already added" (no Add button) for a coin in the set', () => {
      renderSheet();

      const row = rowFor('coin-kyiv');
      expect(row).toHaveAttribute('data-action', 'already');
      expect(badgeVariants(row)).toEqual(['in-set']);
      expect(within(row).getByTestId('add-coins-row-already')).toHaveTextContent('Already added');
      expect(within(row).queryByTestId('add-coins-row-add')).not.toBeInTheDocument();
    });

    it('shows an Add button and no In this set badge for a coin outside the set', () => {
      renderSheet();

      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'add');
      expect(badgeVariants(row)).toEqual([]);
      expect(within(row).getByTestId('add-coins-row-add')).toBeInTheDocument();
      expect(within(row).queryByTestId('add-coins-row-already')).not.toBeInTheDocument();
    });

    it('shows Owned for coins in the collection, and for owned set slots, but not for others', () => {
      useCollectionMock.mockReturnValue(
        queryResult({ data: [{ coinId: 'coin-luhansk', coin: LUHANSK, ownedAt: new Date('2026-01-01') }] }),
      );
      renderSheet({
        slots: [
          { id: 'usc-1', position: 0, coin: IN_SET, owned: true },
          { id: 'usc-2', position: 1, coin: OTHER_SET_COIN, owned: false },
        ],
      });

      const owned = badgeVariants(rowFor('coin-luhansk'));
      expect(owned).toEqual(['owned']);
      expect(within(rowFor('coin-luhansk')).getByTestId('badge')).toHaveTextContent('✓ Owned');
      expect(badgeVariants(rowFor('coin-kyiv'))).toEqual(['in-set', 'owned']);
      expect(badgeVariants(rowFor('coin-donetsk'))).toEqual([]);
    });

    it('shows In this set text in the badge', () => {
      renderSheet();

      expect(within(rowFor('coin-kyiv')).getByTestId('badge')).toHaveTextContent('In this set');
    });
  });

  describe('Show more', () => {
    it('is absent when all results are loaded', () => {
      setCatalog([DONETSK, LUHANSK], 2);
      renderSheet();

      expect(screen.queryByTestId('add-coins-show-more')).not.toBeInTheDocument();
    });

    it('raises the limit by 20 each click up to the API cap of 100, then disappears', async () => {
      setCatalog([DONETSK, LUHANSK], 250);
      const user = userEvent.setup();
      renderSheet();
      expect(lastCatalogArgs().limit).toBe(20);

      for (const expected of [40, 60, 80, 100]) {
        await user.click(screen.getByTestId('add-coins-show-more'));
        expect(lastCatalogArgs().limit).toBe(expected);
      }

      expect(screen.queryByTestId('add-coins-show-more')).not.toBeInTheDocument();
    });

    it('resets the limit to 20 when a filter changes', async () => {
      setCatalog([DONETSK, LUHANSK], 250);
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-show-more'));
      expect(lastCatalogArgs().limit).toBe(40);

      await user.click(screen.getByTestId('add-coins-hide-in-set'));

      expect(lastCatalogArgs().limit).toBe(20);
    });
  });

  describe('criterion 5: Hide coins in this set', () => {
    beforeEach(() => {
      setCatalog([IN_SET, DONETSK, LUHANSK], 5);
    });

    it('is a pressed-state chip that is off by default and does not change the request', async () => {
      const user = userEvent.setup();
      renderSheet();
      const toggle = screen.getByTestId('add-coins-hide-in-set');
      expect(toggle).toHaveTextContent('Hide coins in this set');
      expect(toggle).toHaveAttribute('aria-pressed', 'false');
      expect(rowIds()).toEqual(['coin-kyiv', 'coin-donetsk', 'coin-luhansk']);

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-pressed', 'true');
      expect(lastCatalogArgs()).toEqual({ page: 1, limit: 20 });
    });

    it('hides set coins and lowers the count by the matching set coins', async () => {
      const user = userEvent.setup();
      renderSheet();
      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^5 results$/);

      await user.click(screen.getByTestId('add-coins-hide-in-set'));

      expect(rowIds()).toEqual(['coin-donetsk', 'coin-luhansk']);
      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^3 results$/);

      await user.click(screen.getByTestId('add-coins-hide-in-set'));
      expect(rowIds()).toEqual(['coin-kyiv', 'coin-donetsk', 'coin-luhansk']);
      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^5 results$/);
    });

    it('subtracts only the set coins that match the active filters', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-hide-in-set'));
      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[1]); // Ukraine: only the Kyiv set coin matches

      expect(screen.getByTestId('add-coins-count')).toHaveTextContent(/^4 results$/);
    });

    it('keeps a coin added in this session visible while hiding, until the toggle changes', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-hide-in-set'));
      expect(rowIds()).toEqual(['coin-donetsk', 'coin-luhansk']);

      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[0].resolve();
      });

      expect(rowIds()).toEqual(['coin-donetsk', 'coin-luhansk']);
      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'added');

      await user.click(screen.getByTestId('add-coins-hide-in-set')); // off
      await user.click(screen.getByTestId('add-coins-hide-in-set')); // on again

      expect(rowIds()).toEqual(['coin-luhansk']);
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent('1 coin added');
    });
  });

  describe('criterion 8: Add -> Adding… -> Added', () => {
    it('gives the Add button an accessible name with title and subtitle', () => {
      renderSheet();

      expect(
        within(rowFor('coin-donetsk')).getByRole('button', {
          name: 'Add Donetsk Oblast (Ukraine · 10 Hryvnias · 2025) to this set',
        }),
      ).toBe(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      expect(
        within(rowFor('coin-plain')).getByRole('button', {
          name: 'Add Lincoln Wheat Cent (United States · 1 Cent · 1910) to this set',
        }),
      ).toBeInTheDocument();
    });

    it('calls mutateAsync({ add: [id] }) and shows a polite "Adding…" in place while pending', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));

      expect(mutateAsync).toHaveBeenCalledTimes(1);
      expect(mutateAsync).toHaveBeenCalledWith({ add: ['coin-donetsk'] });
      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'adding');
      const adding = within(row).getByTestId('add-coins-row-adding');
      expect(adding).toHaveAttribute('aria-live', 'polite');
      expect(adding).toHaveTextContent('Adding…');
      expect(within(row).queryByTestId('add-coins-row-add')).not.toBeInTheDocument();
      expect(rowFor('coin-luhansk')).toHaveAttribute('data-action', 'add');
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(
        'Added coins appear in the set right away.',
      );
    });

    it('after the request succeeds shows "✓ Added" with Undo, the footer count and a live message', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));

      await act(async () => {
        pending[0].resolve();
      });

      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'added');
      expect(within(row).getByTestId('add-coins-row-added')).toHaveTextContent('✓ Added');
      expect(within(row).getByTestId('add-coins-row-added')).toHaveAttribute('aria-live', 'polite');
      expect(within(row).getByTestId('add-coins-row-undo')).toHaveTextContent('Undo');
      expect(within(row).getByTestId('add-coins-row-undo')).toHaveAttribute('aria-label', 'Undo adding Donetsk Oblast');
      expect(within(row).queryByTestId('add-coins-row-adding')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^1 coin added$/);
      expect(screen.getByTestId('add-coins-live')).toHaveTextContent('Added Donetsk Oblast to this set.');
      expect(screen.getByTestId('add-coins-live')).toHaveAttribute('role', 'status');
    });

    it('keeps search and filter state while adding', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(screen.getByTestId('add-coins-filter-country'));
      await user.click(screen.getAllByTestId('add-coins-country-option')[1]);

      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[0].resolve();
      });

      expect(lastCatalogArgs().country).toBe('Ukraine');
      expect(screen.getByTestId('add-coins-filter-country')).toHaveTextContent('Ukraine');
    });

    it('resolves rows independently: add A, add B, resolve A first, then B', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await user.click(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-add'));
      expect(mutateAsync).toHaveBeenCalledTimes(2);
      expect(mutateAsync).toHaveBeenNthCalledWith(1, { add: ['coin-donetsk'] });
      expect(mutateAsync).toHaveBeenNthCalledWith(2, { add: ['coin-luhansk'] });
      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'adding');
      expect(rowFor('coin-luhansk')).toHaveAttribute('data-action', 'adding');

      await act(async () => {
        pending[0].resolve();
      });
      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'added');
      expect(rowFor('coin-luhansk')).toHaveAttribute('data-action', 'adding');
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^1 coin added$/);

      await act(async () => {
        pending[1].resolve();
      });
      expect(rowFor('coin-luhansk')).toHaveAttribute('data-action', 'added');
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^2 coins added$/);
    });
  });

  describe('criterion 9: Undo', () => {
    async function addDonetsk(user: ReturnType<typeof userEvent.setup>) {
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[pending.length - 1].resolve();
      });
    }

    it('calls mutateAsync({ remove: [id] }), shows a busy disabled Undo, then returns the row to Add', async () => {
      const user = userEvent.setup();
      renderSheet();
      await addDonetsk(user);

      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-undo'));

      expect(mutateAsync).toHaveBeenLastCalledWith({ remove: ['coin-donetsk'] });
      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'undoing');
      expect(within(row).getByTestId('add-coins-row-undo')).toBeDisabled();
      expect(within(row).getByTestId('add-coins-row-undo')).toHaveAttribute('aria-busy', 'true');

      await act(async () => {
        pending[pending.length - 1].resolve();
      });

      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'add');
      expect(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add')).toBeInTheDocument();
      expect(within(rowFor('coin-donetsk')).queryByTestId('add-coins-row-undo')).not.toBeInTheDocument();
      expect(screen.getByTestId('add-coins-live')).toHaveTextContent('Removed Donetsk Oblast from this set.');
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(
        'Added coins appear in the set right away.',
      );
    });

    it('lowers the footer count by one when one of two added coins is undone', async () => {
      const user = userEvent.setup();
      renderSheet();
      await addDonetsk(user);
      await user.click(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[pending.length - 1].resolve();
      });
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^2 coins added$/);

      await user.click(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-undo'));
      await act(async () => {
        pending[pending.length - 1].resolve();
      });

      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^1 coin added$/);
      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'added');
      expect(rowFor('coin-luhansk')).toHaveAttribute('data-action', 'add');
    });
  });

  describe('criterion 11: failures', () => {
    it('a failed add returns the row to Add with a row error, keeps the sheet open, and can be retried', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));

      await act(async () => {
        pending[0].reject(new Error('boom'));
      });

      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'add');
      expect(within(row).getByTestId('add-coins-row-add')).toBeInTheDocument();
      expect(within(row).getByTestId('add-coins-row-error')).toHaveTextContent(/couldn.t add this coin/i);
      expect(screen.getByTestId('add-coins-sheet')).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('add-coins-live')).toHaveTextContent(/couldn.t add Donetsk Oblast/i);
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(
        'Added coins appear in the set right away.',
      );
      expect(within(rowFor('coin-luhansk')).queryByTestId('add-coins-row-error')).not.toBeInTheDocument();

      await user.click(within(row).getByTestId('add-coins-row-add'));
      expect(mutateAsync).toHaveBeenCalledTimes(2);
      await act(async () => {
        pending[1].resolve();
      });
      expect(rowFor('coin-donetsk')).toHaveAttribute('data-action', 'added');
      expect(within(rowFor('coin-donetsk')).queryByTestId('add-coins-row-error')).not.toBeInTheDocument();
    });

    it('a failed undo keeps the coin as Added with Undo again and a row error', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[0].resolve();
      });
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-undo'));

      await act(async () => {
        pending[1].reject(new Error('boom'));
      });

      const row = rowFor('coin-donetsk');
      expect(row).toHaveAttribute('data-action', 'added');
      expect(within(row).getByTestId('add-coins-row-undo')).toBeEnabled();
      expect(within(row).getByTestId('add-coins-row-error')).toHaveTextContent(/couldn.t undo/i);
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^1 coin added$/);
      expect(screen.getByTestId('add-coins-live')).toHaveTextContent(/couldn.t undo adding Donetsk Oblast/i);
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('criterion 12: footer', () => {
    it('shows the hint when nothing was added, and a Done button that closes', async () => {
      const user = userEvent.setup();
      renderSheet();

      expect(screen.getByTestId('add-coins-footer')).toContainElement(screen.getByTestId('add-coins-done'));
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(
        'Added coins appear in the set right away.',
      );
      await user.click(screen.getByTestId('add-coins-done'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('counts "1 coin added" then "N coins added" as coins are added', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[0].resolve();
      });
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^1 coin added$/);

      await user.click(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[1].resolve();
      });
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^2 coins added$/);

      await user.click(within(rowFor('coin-plain')).getByTestId('add-coins-row-add'));
      await act(async () => {
        pending[2].resolve();
      });
      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(/^3 coins added$/);
    });

    it('does not count a coin that is still adding or whose add failed', async () => {
      const user = userEvent.setup();
      renderSheet();
      await user.click(within(rowFor('coin-donetsk')).getByTestId('add-coins-row-add'));
      await user.click(within(rowFor('coin-luhansk')).getByTestId('add-coins-row-add'));

      await act(async () => {
        pending[1].reject(new Error('boom'));
      });

      expect(screen.getByTestId('add-coins-footer-count')).toHaveTextContent(
        'Added coins appear in the set right away.',
      );
    });
  });

  describe('misc', () => {
    it('fires change events on the search input without needing a form submit', () => {
      renderSheet();
      const search = screen.getByTestId<HTMLInputElement>('add-coins-search');

      fireEvent.change(search, { target: { value: 'abc' } });

      expect(search.value).toBe('abc');
    });

    it('waits for the typed text before changing the request (no immediate name)', () => {
      renderSheet();
      fireEvent.change(screen.getByTestId('add-coins-search'), { target: { value: 'abc' } });

      expect(lastCatalogArgs().name).toBeUndefined();
    });
  });
});
