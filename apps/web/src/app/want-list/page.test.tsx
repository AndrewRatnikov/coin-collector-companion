/**
 * Tests for: WantListPage and WantListSetsDisclosure
 * Contract source: runs/run_20261120_215525/plan.md § Interface Contract → Page: WantListPage,
 *                   Component: WantListSetsDisclosure
 * Covers criteria: #4, #5, #6, #7, #8, #9, #10, #11, #12 (button), #16 (from prd.md)
 *
 * The disclosure is prop-only and rendered through the page here (its testids live inside the sections).
 * useSlowLoading is deliberately not mocked.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import WantListPage from '@/app/want-list/page';
import { useWantList } from '@/lib/hooks/use-user-sets';
import { setStoredToken } from '@/lib/auth-token';
import { downloadWantListCsv } from '@/lib/missing-list';
import en from '@/lib/i18n/locales/en';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useWantList: vi.fn(),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadWantListCsv: vi.fn(),
}));

const useWantListMock = vi.mocked(useWantList);
const downloadWantListCsvMock = vi.mocked(downloadWantListCsv);
const refetchMock = vi.fn();

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, refetch: refetchMock, ...overrides } as never;
}

const BASE_COIN = {
  id: 'coin-1',
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
  material: null,
  mintage: null,
  isKeyDate: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const COIN_US_1909 = { ...BASE_COIN, id: 'coin-us-1909', year: 1909 };
const COIN_US_1914D = { ...BASE_COIN, id: 'coin-us-1914d', year: 1914, mintMark: 'D', isKeyDate: true };
const COIN_UA = {
  ...BASE_COIN,
  id: 'coin-ua',
  name: 'Ukraine Five',
  country: 'Ukraine',
  denomination: '5 Kopiyok',
  year: 2011,
  variety: 'Series One: Donetsk Oblast',
};
const COIN_UP_1920D = { ...BASE_COIN, id: 'coin-up-1920d', year: 1920, mintMark: 'D' };
const COIN_UP_1921 = { ...BASE_COIN, id: 'coin-up-1921', year: 1921 };

const SET_A = { id: 'set-a', name: 'Wheat Cents' };
const SET_B = { id: 'set-b', name: 'Mixed Coins' };

// Two (country, denomination) groups, wanted by two different sets, in response order.
const MISSING = [
  { coin: COIN_US_1914D, sets: [SET_A, SET_B] },
  { coin: COIN_US_1909, sets: [SET_A] },
  { coin: COIN_UA, sets: [SET_B] },
];

const UPGRADES = [
  { coin: COIN_UP_1920D, sets: [SET_A], grade: 'F', targetGrade: 'VF' },
  { coin: COIN_UP_1921, sets: [SET_A, SET_B], grade: null, targetGrade: 'VF' },
];

const DATA = { setCount: 2, missing: MISSING, upgrades: UPGRADES };
const DATA_NO_UPGRADES = { setCount: 2, missing: MISSING, upgrades: [] };
const DATA_ONLY_UPGRADES = { setCount: 2, missing: [], upgrades: UPGRADES };
const DATA_NOTHING = { setCount: 3, missing: [], upgrades: [] };
const DATA_NO_SETS = { setCount: 0, missing: [], upgrades: [] };

describe('WantListPage', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    refetchMock.mockReset();
    downloadWantListCsvMock.mockClear();
    useWantListMock.mockReset();
    useWantListMock.mockReturnValue(queryResult({ data: DATA }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('auth gating', () => {
    it('redirects to /login and renders no page when there is no token', async () => {
      render(<WantListPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('want-list-page')).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('renders the title as an h1 inside the main root', async () => {
      render(<WantListPage />);

      const title = await screen.findByTestId('want-list-title');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveTextContent(en['wantList.title']);
      expect(screen.getByTestId('want-list-page').tagName).toBe('MAIN');
    });

    it('builds the subtitle from setCount, missing.length and upgrades.length', async () => {
      render(<WantListPage />);

      const subtitle = await screen.findByTestId('want-list-subtitle');
      expect(screen.getByTestId('want-list-set-count')).toHaveTextContent(/^2$/);
      expect(screen.getByTestId('want-list-missing-count')).toHaveTextContent(/^3$/);
      expect(screen.getByTestId('want-list-upgrade-count')).toHaveTextContent(/^2$/);
      expect(subtitle).toHaveTextContent('Across your 2 sets · 3 missing · 2 to upgrade');
    });

    it('shows different counts for a different response', async () => {
      useWantListMock.mockReturnValue(
        queryResult({ data: { setCount: 5, missing: MISSING.slice(0, 1), upgrades: [] } }),
      );
      render(<WantListPage />);

      const subtitle = await screen.findByTestId('want-list-subtitle');
      expect(screen.getByTestId('want-list-set-count')).toHaveTextContent(/^5$/);
      expect(screen.getByTestId('want-list-missing-count')).toHaveTextContent(/^1$/);
      expect(screen.getByTestId('want-list-upgrade-count')).toHaveTextContent(/^0$/);
      expect(subtitle).toHaveTextContent('Across your 5 sets · 1 missing · 0 to upgrade');
    });

    it('renders the counts in mono', async () => {
      render(<WantListPage />);

      await screen.findByTestId('want-list-subtitle');
      for (const id of ['want-list-set-count', 'want-list-missing-count', 'want-list-upgrade-count']) {
        expect(screen.getByTestId(id).className).toContain('font-mono');
      }
    });
  });

  describe('Missing section', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('groups the coins of two sets into two headed groups in response order', async () => {
      render(<WantListPage />);

      const section = await screen.findByTestId('want-list-section-missing');
      const groups = within(section).getAllByTestId('want-list-group');
      expect(groups.map((g) => g.getAttribute('data-group-key'))).toEqual(['USA|1 Cent', 'Ukraine|5 Kopiyok']);
      expect(within(section).getAllByTestId('want-list-group-heading').map((h) => h.textContent)).toEqual([
        'USA · 1 Cent',
        'Ukraine · 5 Kopiyok',
      ]);
      expect(within(section).getByTestId('want-list-table')).toHaveAttribute('data-variant', 'missing');
      expect(within(groups[1]).getByTestId('want-list-mints')).toHaveTextContent('Donetsk Oblast');
    });

    it('lists year rows in response order with key dates starred and plain coins labelled', async () => {
      render(<WantListPage />);

      const section = await screen.findByTestId('want-list-section-missing');
      expect(
        within(section)
          .getAllByTestId('want-list-row')
          .map((r) => r.getAttribute('data-year')),
      ).toEqual(['1914', '1909', '2011']);
      expect(
        within(section)
          .getAllByTestId('want-list-mints')
          .map((m) => m.textContent),
      ).toEqual(['D ★', en['wantList.plain'], 'Donetsk Oblast']);
    });

    it('still shows the group heading when there is only one group', async () => {
      useWantListMock.mockReturnValue(
        queryResult({ data: { setCount: 1, missing: [MISSING[0], MISSING[1]], upgrades: [] } }),
      );
      render(<WantListPage />);

      const section = await screen.findByTestId('want-list-section-missing');
      expect(within(section).getAllByTestId('want-list-group')).toHaveLength(1);
      expect(within(section).getByTestId('want-list-group-heading')).toHaveTextContent('USA · 1 Cent');
    });

    it('shows the section heading and the missing count', async () => {
      render(<WantListPage />);

      const section = await screen.findByTestId('want-list-section-missing');
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(en['wantList.sectionMissing']);
      expect(screen.getByTestId('want-list-section-missing-count')).toHaveTextContent(/^3$/);
    });

    it('shows "Nothing missing." instead of a table when only upgrades remain', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_ONLY_UPGRADES }));
      render(<WantListPage />);

      const section = await screen.findByTestId('want-list-section-missing');
      expect(within(section).getByTestId('want-list-missing-none')).toHaveTextContent(en['wantList.nothingMissing']);
      expect(within(section).queryByTestId('want-list-table')).not.toBeInTheDocument();
      expect(screen.getByTestId('want-list-section-missing-count')).toHaveTextContent(/^0$/);
      expect(screen.queryByTestId('want-list-nothing')).not.toBeInTheDocument();
    });

    it('does not show "Nothing missing." when something is missing', async () => {
      render(<WantListPage />);

      await screen.findByTestId('want-list-section-missing');
      expect(screen.queryByTestId('want-list-missing-none')).not.toBeInTheDocument();
    });
  });

  describe('Upgrade wanted section', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('renders after the Missing section with the upgrade variant and "(from → to)" mints', async () => {
      render(<WantListPage />);

      const upgrade = await screen.findByTestId('want-list-section-upgrade');
      const missing = screen.getByTestId('want-list-section-missing');
      expect(missing.compareDocumentPosition(upgrade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(upgrade).getByTestId('want-list-table')).toHaveAttribute('data-variant', 'upgrade');
      expect(
        within(upgrade)
          .getAllByTestId('want-list-row')
          .map((r) => r.getAttribute('data-year')),
      ).toEqual(['1920', '1921']);
      expect(
        within(upgrade)
          .getAllByTestId('want-list-mints')
          .map((m) => m.textContent),
      ).toEqual(['D (F → VF)', `${en['wantList.plain']} (${en['missingList.noGrade']} → VF)`]);
    });

    it('shows group headings even with one group, the count and the note', async () => {
      render(<WantListPage />);

      const upgrade = await screen.findByTestId('want-list-section-upgrade');
      expect(within(upgrade).getByTestId('want-list-group-heading')).toHaveTextContent('USA · 1 Cent');
      expect(screen.getByTestId('want-list-section-upgrade-count')).toHaveTextContent(/^2$/);
      expect(screen.getByTestId('want-list-upgrade-note')).toHaveTextContent(en['wantList.upgradeNote']);
    });

    it('is absent when there are no upgrades', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_NO_UPGRADES }));
      render(<WantListPage />);

      await screen.findByTestId('want-list-section-missing');
      expect(screen.queryByTestId('want-list-section-upgrade')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-upgrade-note')).not.toBeInTheDocument();
    });

    it('keeps the missing rows free of upgrade coins and grades', async () => {
      render(<WantListPage />);

      const missing = await screen.findByTestId('want-list-section-missing');
      expect(within(missing).getAllByTestId('want-list-row')).toHaveLength(3);
      expect(missing.textContent).not.toContain('→');
    });

    it('shows the key legend once, after the last section', async () => {
      render(<WantListPage />);

      const upgrade = await screen.findByTestId('want-list-section-upgrade');
      const legends = screen.getAllByTestId('want-list-legend');
      expect(legends).toHaveLength(1);
      expect(legends[0]).toHaveTextContent(en['wantList.keyLegend']);
      expect(upgrade.compareDocumentPosition(legends[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('"Which sets?" disclosure', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('is a closed details element with the summary text, one per section', async () => {
      render(<WantListPage />);

      const missing = await screen.findByTestId('want-list-section-missing');
      const upgrade = screen.getByTestId('want-list-section-upgrade');
      const missingSets = within(missing).getByTestId('want-list-sets');
      const upgradeSets = within(upgrade).getByTestId('want-list-sets');
      for (const el of [missingSets, upgradeSets]) {
        expect(el.tagName).toBe('DETAILS');
        expect(el).not.toHaveAttribute('open');
        expect(el.className).toContain('print:hidden');
        expect(within(el).getByTestId('want-list-sets-summary')).toHaveTextContent(en['wantList.whichSets']);
      }
      expect(missingSets).toHaveAttribute('data-section', 'missing');
      expect(upgradeSets).toHaveAttribute('data-section', 'upgrade');
    });

    it('lists one item per missing coin, in response order, with the coin label', async () => {
      render(<WantListPage />);

      const missing = await screen.findByTestId('want-list-section-missing');
      const items = within(within(missing).getByTestId('want-list-sets')).getAllByTestId('want-list-sets-item');
      expect(items.map((i) => i.getAttribute('data-coin-id'))).toEqual(['coin-us-1914d', 'coin-us-1909', 'coin-ua']);
      expect(items.map((i) => within(i).getByTestId('want-list-sets-coin').textContent)).toEqual([
        'USA · 1 Cent · 1914-D',
        'USA · 1 Cent · 1909',
        'Ukraine · 5 Kopiyok · 2011 · Donetsk Oblast',
      ]);
    });

    it('links each coin to every set that wants it, by /sets/{id}', async () => {
      render(<WantListPage />);

      const missing = await screen.findByTestId('want-list-section-missing');
      const items = within(within(missing).getByTestId('want-list-sets')).getAllByTestId('want-list-sets-item');

      const first = within(items[0]).getAllByTestId('want-list-sets-link');
      expect(first.map((l) => l.textContent)).toEqual(['Wheat Cents', 'Mixed Coins']);
      expect(first.map((l) => l.getAttribute('href'))).toEqual(['/sets/set-a', '/sets/set-b']);

      const last = within(items[2]).getAllByTestId('want-list-sets-link');
      expect(last.map((l) => l.textContent)).toEqual(['Mixed Coins']);
      expect(last[0]).toHaveAttribute('href', '/sets/set-b');
    });

    it('lists the upgrade entries in the upgrade section', async () => {
      render(<WantListPage />);

      const upgrade = await screen.findByTestId('want-list-section-upgrade');
      const items = within(within(upgrade).getByTestId('want-list-sets')).getAllByTestId('want-list-sets-item');
      expect(items.map((i) => i.getAttribute('data-coin-id'))).toEqual(['coin-up-1920d', 'coin-up-1921']);
      expect(within(items[1]).getAllByTestId('want-list-sets-link')).toHaveLength(2);
    });

    it('has no upgrade disclosure when there is no upgrade section', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_NO_UPGRADES }));
      render(<WantListPage />);

      await screen.findByTestId('want-list-section-missing');
      expect(screen.getAllByTestId('want-list-sets')).toHaveLength(1);
    });
  });

  describe('Print and Download CSV buttons', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('renders both buttons as type button with their labels', async () => {
      render(<WantListPage />);

      const print = await screen.findByTestId('want-list-print-button');
      const csv = screen.getByTestId('want-list-csv-button');
      expect(print).toHaveTextContent(en['wantList.printButton']);
      expect(print).toHaveAttribute('type', 'button');
      expect(csv).toHaveTextContent(en['wantList.downloadCsv']);
      expect(csv).toHaveAttribute('type', 'button');
    });

    it('calls window.print once per click', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      render(<WantListPage />);

      const button = await screen.findByTestId('want-list-print-button');
      expect(printSpy).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(1);
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(2);
    });

    it('calls downloadWantListCsv with the response only, once per click', async () => {
      render(<WantListPage />);

      const button = await screen.findByTestId('want-list-csv-button');
      expect(downloadWantListCsvMock).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(downloadWantListCsvMock).toHaveBeenCalledTimes(1);
      expect(downloadWantListCsvMock).toHaveBeenCalledWith(DATA);
    });

    it('passes the response it was given, not a fixed one', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_ONLY_UPGRADES }));
      render(<WantListPage />);

      fireEvent.click(await screen.findByTestId('want-list-csv-button'));

      expect(downloadWantListCsvMock).toHaveBeenCalledWith(DATA_ONLY_UPGRADES);
    });

    it('shows the buttons when only upgrades are wanted', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_ONLY_UPGRADES }));
      render(<WantListPage />);

      expect(await screen.findByTestId('want-list-print-button')).toBeInTheDocument();
      expect(screen.getByTestId('want-list-csv-button')).toBeInTheDocument();
    });

    it('hides the buttons when nothing is wanted', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_NOTHING }));
      render(<WantListPage />);

      await screen.findByTestId('want-list-nothing');
      expect(screen.queryByTestId('want-list-print-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-csv-button')).not.toBeInTheDocument();
    });
  });

  describe('print region', () => {
    beforeEach(() => {
      setStoredToken('t');
    });

    it('wraps the title, subtitle, sections and legend in an element with data-print-region', async () => {
      render(<WantListPage />);

      const region = await screen.findByTestId('want-list-print-region');
      expect(region).toHaveAttribute('data-print-region');
      for (const id of [
        'want-list-title',
        'want-list-subtitle',
        'want-list-section-missing',
        'want-list-section-upgrade',
        'want-list-legend',
      ]) {
        expect(within(region).getByTestId(id)).toBeInTheDocument();
      }
    });

    it('hides the buttons in print', async () => {
      render(<WantListPage />);

      await screen.findByTestId('want-list-print-region');
      expect(screen.getByTestId('want-list-print-button').closest('.print\\:hidden')).not.toBeNull();
      expect(screen.getByTestId('want-list-csv-button').closest('.print\\:hidden')).not.toBeNull();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      setStoredToken('t');
      useWantListMock.mockReturnValue(queryResult({ isLoading: true }));
    });

    it('shows the title and a busy skeleton container, and no list', async () => {
      render(<WantListPage />);

      const loading = await screen.findByTestId('want-list-loading');
      expect(loading).toHaveAttribute('aria-busy', 'true');
      expect(loading).toHaveAttribute('aria-label', en['wantList.loadingLabel']);
      expect(screen.getByTestId('want-list-title')).toBeInTheDocument();
      expect(screen.getByTestId('want-list-page').tagName).toBe('MAIN');
      expect(screen.queryByTestId('want-list-section-missing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-subtitle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-print-button')).not.toBeInTheDocument();
    });

    it('treats a missing response as loading too', async () => {
      useWantListMock.mockReturnValue(queryResult({ isLoading: false, data: undefined }));
      render(<WantListPage />);

      expect(await screen.findByTestId('want-list-loading')).toBeInTheDocument();
    });

    it('shows the server waking notice only after 3 s of loading', () => {
      vi.useFakeTimers();
      const view = render(<WantListPage />);
      expect(screen.getByTestId('want-list-loading')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(2900);
      });
      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(screen.getByTestId('server-waking-notice')).toHaveTextContent(en['common.serverWaking']);

      useWantListMock.mockReturnValue(queryResult({ data: DATA }));
      view.rerender(<WantListPage />);
      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('want-list-section-missing')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      setStoredToken('t');
      useWantListMock.mockReturnValue(queryResult({ isError: true }));
    });

    it('shows the title, an alert with the error copy, and no list', async () => {
      render(<WantListPage />);

      const error = await screen.findByTestId('want-list-error');
      expect(error).toHaveAttribute('role', 'alert');
      expect(error).toHaveTextContent(en['wantList.errorTitle']);
      expect(error).toHaveTextContent(en['wantList.errorBody']);
      expect(screen.getByTestId('want-list-title')).toBeInTheDocument();
      expect(screen.queryByTestId('want-list-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-section-missing')).not.toBeInTheDocument();
    });

    it('refetches when Retry is clicked', async () => {
      render(<WantListPage />);

      const retry = await screen.findByTestId('want-list-retry');
      expect(retry).toHaveTextContent(en['wantList.retry']);
      expect(refetchMock).not.toHaveBeenCalled();
      fireEvent.click(retry);
      expect(refetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not show the server waking notice', () => {
      vi.useFakeTimers();
      render(<WantListPage />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    });
  });

  describe('no-sets state', () => {
    beforeEach(() => {
      setStoredToken('t');
      useWantListMock.mockReturnValue(queryResult({ data: DATA_NO_SETS }));
    });

    it('shows the message and a link to /sets/new, with no subtitle, buttons or list', async () => {
      render(<WantListPage />);

      const noSets = await screen.findByTestId('want-list-no-sets');
      expect(noSets).toHaveTextContent(en['wantList.noSets']);
      const link = screen.getByTestId('want-list-new-set-link');
      expect(link).toHaveAttribute('href', '/sets/new');
      expect(link).toHaveTextContent(en['wantList.newSetLink']);
      expect(screen.getByTestId('want-list-title')).toBeInTheDocument();
      expect(screen.queryByTestId('want-list-subtitle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-print-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-csv-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-section-missing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-nothing')).not.toBeInTheDocument();
    });

    it('is not shown when the user has sets', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA }));
      render(<WantListPage />);

      await screen.findByTestId('want-list-section-missing');
      expect(screen.queryByTestId('want-list-no-sets')).not.toBeInTheDocument();
    });
  });

  describe('nothing-wanted state', () => {
    beforeEach(() => {
      setStoredToken('t');
      useWantListMock.mockReturnValue(queryResult({ data: DATA_NOTHING }));
    });

    it('shows "Nothing missing across your sets." with the subtitle, and no sections or legend', async () => {
      render(<WantListPage />);

      const nothing = await screen.findByTestId('want-list-nothing');
      expect(nothing).toHaveTextContent('Nothing missing across your sets.');
      expect(screen.getByTestId('want-list-subtitle')).toHaveTextContent('Across your 3 sets · 0 missing · 0 to upgrade');
      expect(screen.queryByTestId('want-list-section-missing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-section-upgrade')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-legend')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-sets')).not.toBeInTheDocument();
      expect(screen.queryByTestId('want-list-no-sets')).not.toBeInTheDocument();
    });

    it('is not shown when something is wanted', async () => {
      useWantListMock.mockReturnValue(queryResult({ data: DATA_ONLY_UPGRADES }));
      render(<WantListPage />);

      await screen.findByTestId('want-list-section-missing');
      expect(screen.queryByTestId('want-list-nothing')).not.toBeInTheDocument();
    });
  });
});
