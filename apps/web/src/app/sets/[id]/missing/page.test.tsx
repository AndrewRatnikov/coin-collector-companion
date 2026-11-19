/**
 * Tests for: SetMissingPage
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Page (new): SetMissingPage
 *                   runs/run_20261119_210926/plan.md § Interface Contract → Page: SetMissingPage
 * Covers criteria: #10, #11 (from prd.md), and #7, #8, #9, #10, #11, #13, #15 of run_20261119_210926
 *
 * run_20261119_210926: the page is rewritten as a grouped want list. Tests that used the removed ids
 * (set-missing-table, set-missing-row, set-missing-cell-*, set-missing-key-date) are replaced by tests
 * on the WantListTable rows; the auth, states, date and print-button tests are kept.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SetMissingPage from '@/app/sets/[id]/missing/page';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useSetGaps } from '@/lib/hooks/use-user-sets';
import { setStoredToken } from '@/lib/auth-token';
import { downloadMissingCsv } from '@/lib/missing-list';
import { fill } from '@/lib/fill-template';
import en from '@/lib/i18n/locales/en';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-user-sets', () => ({
  useSetGaps: vi.fn(),
}));

vi.mock('@/lib/missing-list', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/missing-list')>()),
  downloadMissingCsv: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const downloadMissingCsvMock = vi.mocked(downloadMissingCsv);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetMissingPage params={Promise.resolve({ id })} />);
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
const COIN_OWNED = { ...BASE_COIN, id: 'coin-owned', name: 'Owned Coin', year: 1920, mintMark: 'P' };
const COIN_A = { ...BASE_COIN, id: 'coin-a', name: 'Alpha Cent', year: 1958, mintMark: 'D', isKeyDate: true };
const COIN_B = { ...BASE_COIN, id: 'coin-b', name: 'Bravo Cent', year: 1943, mintMark: 'S' };
const COIN_C = { ...BASE_COIN, id: 'coin-c', name: 'Charlie Cent', year: 1952 };
const COIN_UA = {
  ...BASE_COIN,
  id: 'coin-ua',
  name: 'Ukraine Five',
  country: 'Ukraine',
  denomination: '5 Kopiyok',
  year: 2011,
  variety: 'Series One: Donetsk Oblast',
};

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [],
};

// Slots deliberately out of position order; expected order: A (0), B (1), C (3)
const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  minGrade: null,
  slots: [
    { id: 'usc-c', position: 3, coin: COIN_C, owned: false, grade: null },
    { id: 'usc-o', position: 2, coin: COIN_OWNED, owned: true, grade: null },
    { id: 'usc-a', position: 0, coin: COIN_A, owned: false, grade: null },
    { id: 'usc-b', position: 1, coin: COIN_B, owned: false, grade: null },
  ],
};

const GAPS_ALL_OWNED = {
  ...GAPS,
  ownedCount: 4,
  completionPercent: 100,
  slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
};

const COIN_U1 = { ...BASE_COIN, id: 'coin-u1', name: 'Upgrade One', year: 1920, mintMark: 'D' };
const COIN_U2 = { ...BASE_COIN, id: 'coin-u2', name: 'Upgrade Two', year: 1921 };

const UPGRADE_SLOTS = [
  { id: 'usc-u1', position: 10, coin: COIN_U1, owned: true, grade: 'F', needsUpgrade: true },
  { id: 'usc-u2', position: 11, coin: COIN_U2, owned: true, grade: null, needsUpgrade: true },
];

const GAPS_WITH_UPGRADES = {
  ...GAPS,
  ownedCount: 3,
  totalCount: 6,
  completionPercent: 50,
  minGrade: 'VF',
  upgradeCount: 2,
  slots: [
    ...GAPS.slots.map((s) => ({ ...s, needsUpgrade: false })),
    ...UPGRADE_SLOTS,
  ],
};

const GAPS_ONLY_UPGRADES = {
  ...GAPS_WITH_UPGRADES,
  slots: [{ ...GAPS_WITH_UPGRADES.slots[1] }, ...UPGRADE_SLOTS],
};

describe('SetMissingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    downloadMissingCsvMock.mockClear();
    usePublicSetMock.mockReset();
    useSetGapsMock.mockReset();
    usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
    useSetGapsMock.mockReturnValue(queryResult({ data: GAPS }));
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('auth gating', () => {
    it('redirects to /login and renders no page when there is no token', async () => {
      renderPage();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('set-missing-page')).not.toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('renders the loading state inside the main root', async () => {
      setStoredToken('token');
      usePublicSetMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      expect(await screen.findByTestId('set-missing-loading')).toBeInTheDocument();
      expect(screen.getByTestId('set-missing-page').tagName).toBe('MAIN');
      expect(screen.queryByTestId('want-list-table')).not.toBeInTheDocument();
    });

    it('renders the loading state while the gaps are loading', async () => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      expect(await screen.findByTestId('set-missing-loading')).toBeInTheDocument();
    });

    it('renders the error state with the editor error message', async () => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      const error = await screen.findByTestId('set-missing-error');
      expect(error).toBeInTheDocument();
      expect(error.textContent).not.toBe('');
      expect(screen.getByTestId('set-missing-page')).toBeInTheDocument();
      expect(screen.queryByTestId('want-list-table')).not.toBeInTheDocument();
    });
  });

  describe('header', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('shows the Want list title in an h1 inside main', async () => {
      renderPage();

      const title = await screen.findByTestId('set-missing-title');
      expect(title.tagName).toBe('H1');
      expect(title).toHaveTextContent(en['missingList.title']);
      expect(screen.getByTestId('set-missing-page').tagName).toBe('MAIN');
    });

    it('shows the set name as its own element', async () => {
      renderPage();

      expect(await screen.findByTestId('set-missing-set-name')).toHaveTextContent('My Wheat Cents');
    });

    it('shows a back link to the set labelled with the set name', async () => {
      renderPage();

      const link = await screen.findByTestId('set-missing-back-link');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/sets/set-1');
      expect(link).toHaveTextContent(fill(en['missingList.backToSet'], { name: 'My Wheat Cents' }));
      expect(link).toHaveTextContent('‹ My Wheat Cents');
    });

    it('points the back link at the route id', async () => {
      renderPage('set-77');

      expect(await screen.findByTestId('set-missing-back-link')).toHaveAttribute('href', '/sets/set-77');
    });

    it('shows the summary line from ownedCount, totalCount and completionPercent', async () => {
      renderPage();

      expect(await screen.findByTestId('set-missing-summary')).toHaveTextContent(/^1 of 4 owned · 25%$/);
    });

    it('changes the summary line when the counts change', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({ data: { ...GAPS, ownedCount: 3, totalCount: 10, completionPercent: 30 } }),
      );
      renderPage();

      expect(await screen.findByTestId('set-missing-summary')).toHaveTextContent(/^3 of 10 owned · 30%$/);
    });

    it('does not change the summary because of upgrades', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_WITH_UPGRADES }));
      renderPage();

      expect(await screen.findByTestId('set-missing-summary')).toHaveTextContent(/^3 of 6 owned · 50%$/);
    });

    it("shows today's date with the Date label", async () => {
      renderPage();

      const date = await screen.findByTestId('set-missing-date');
      expect(date).toHaveTextContent('Date: October 1, 2026');
    });

    it('uses a different date when the system date differs', async () => {
      vi.setSystemTime(new Date(2027, 2, 15, 12, 0, 0));
      renderPage();

      expect(await screen.findByTestId('set-missing-date')).toHaveTextContent('Date: March 15, 2027');
    });

    it('does not render the removed table test ids', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      for (const id of [
        'set-missing-table',
        'set-missing-row',
        'set-missing-cell-name',
        'set-missing-cell-year',
        'set-missing-key-date',
      ]) {
        expect(screen.queryByTestId(id)).not.toBeInTheDocument();
      }
    });
  });

  describe('Missing section', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('lists only unowned coins as year rows, in position order, with key dates starred', async () => {
      renderPage();

      const section = await screen.findByTestId('set-missing-section-missing');
      const rows = within(section).getAllByTestId('want-list-row');
      expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1958', '1943', '1952']);
      const mints = within(section)
        .getAllByTestId('want-list-mints')
        .map((m) => m.textContent);
      expect(mints).toEqual(['D ★', 'S', en['missingList.plain']]);
      expect(screen.queryByText('Owned Coin')).not.toBeInTheDocument();
      expect(within(section).getByTestId('want-list-table')).toHaveAttribute('data-variant', 'missing');
    });

    it('shows the section heading with the number of missing coins', async () => {
      renderPage();

      const section = await screen.findByTestId('set-missing-section-missing');
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(en['missingList.sectionMissing']);
      expect(screen.getByTestId('set-missing-missing-count')).toHaveTextContent('3');
    });

    it('changes the missing count with the data', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({
          data: { ...GAPS, slots: GAPS.slots.map((s) => (s.id === 'usc-o' ? { ...s, owned: false } : s)) },
        }),
      );
      renderPage();

      expect(await screen.findByTestId('set-missing-missing-count')).toHaveTextContent('4');
    });

    it('shows no group heading for a one-denomination set', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('want-list-group-heading')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('want-list-group')).toHaveLength(1);
    });

    it('groups a mixed-denomination set into two groups with headings', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({
          data: {
            ...GAPS,
            slots: [...GAPS.slots, { id: 'usc-ua', position: 4, coin: COIN_UA, owned: false, grade: null }],
          },
        }),
      );
      renderPage();

      const section = await screen.findByTestId('set-missing-section-missing');
      const groups = within(section).getAllByTestId('want-list-group');
      expect(groups.map((g) => g.getAttribute('data-group-key'))).toEqual(['USA|1 Cent', 'Ukraine|5 Kopiyok']);
      expect(within(section).getAllByTestId('want-list-group-heading').map((h) => h.textContent)).toEqual([
        'USA · 1 Cent',
        'Ukraine · 5 Kopiyok',
      ]);
      expect(within(groups[1]).getByTestId('want-list-mints')).toHaveTextContent('Donetsk Oblast');
    });

    it('shows the key legend once', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      const legends = screen.getAllByTestId('set-missing-legend');
      expect(legends).toHaveLength(1);
      expect(legends[0]).toHaveTextContent(en['missingList.keyLegend']);
    });

    it('has no upgrade section when the set has no minimum grade', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('set-missing-section-upgrade')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-upgrade-note')).not.toBeInTheDocument();
    });

    it('does not show the empty message when something is missing', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('set-missing-empty')).not.toBeInTheDocument();
    });
  });

  describe('Upgrade wanted section', () => {
    beforeEach(() => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_WITH_UPGRADES }));
    });

    it('renders after the Missing section with the upgrade variant and "(from → to)" mints', async () => {
      renderPage();

      const upgrade = await screen.findByTestId('set-missing-section-upgrade');
      const missing = screen.getByTestId('set-missing-section-missing');
      expect(missing.compareDocumentPosition(upgrade) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(upgrade).getByTestId('want-list-table')).toHaveAttribute('data-variant', 'upgrade');
      const rows = within(upgrade).getAllByTestId('want-list-row');
      expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1920', '1921']);
      const mints = within(upgrade)
        .getAllByTestId('want-list-mints')
        .map((m) => m.textContent);
      expect(mints).toEqual([
        'D (F → VF)',
        `${en['missingList.plain']} (${en['missingList.noGrade']} → VF)`,
      ]);
    });

    it('keeps the missing rows free of grades and of upgrade coins', async () => {
      renderPage();

      const missing = await screen.findByTestId('set-missing-section-missing');
      expect(within(missing).getAllByTestId('want-list-row')).toHaveLength(3);
      expect(missing.textContent).not.toContain('→');
    });

    it('shows the upgrade count and the missing count separately', async () => {
      renderPage();

      expect(await screen.findByTestId('set-missing-upgrade-count')).toHaveTextContent('2');
      expect(screen.getByTestId('set-missing-missing-count')).toHaveTextContent('3');
    });

    it('shows the note with the minimum grade', async () => {
      renderPage();

      expect(await screen.findByTestId('set-missing-upgrade-note')).toHaveTextContent(
        fill(en['missingList.upgradeNote'], { grade: 'VF' }),
      );
    });

    it('follows the set minimum grade in the note and in the target grade', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: { ...GAPS_WITH_UPGRADES, minGrade: 'XF' } }));
      renderPage();

      expect(await screen.findByTestId('set-missing-upgrade-note')).toHaveTextContent(
        fill(en['missingList.upgradeNote'], { grade: 'XF' }),
      );
      const upgrade = screen.getByTestId('set-missing-section-upgrade');
      expect(within(upgrade).getAllByTestId('want-list-mints')[0]).toHaveTextContent('D (F → XF)');
    });

    it('shows the key legend once, after the upgrade section', async () => {
      renderPage();

      const upgrade = await screen.findByTestId('set-missing-section-upgrade');
      const legends = screen.getAllByTestId('set-missing-legend');
      expect(legends).toHaveLength(1);
      expect(upgrade.compareDocumentPosition(legends[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('is hidden when the set has a minimum grade but upgradeCount is 0', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({
          data: {
            ...GAPS,
            minGrade: 'VF',
            upgradeCount: 0,
            slots: GAPS.slots.map((s) => ({ ...s, needsUpgrade: false })),
          },
        }),
      );
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('set-missing-section-upgrade')).not.toBeInTheDocument();
    });

    it('is hidden when upgradeCount is above 0 but the set has no minimum grade', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: { ...GAPS_WITH_UPGRADES, minGrade: null } }));
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('set-missing-section-upgrade')).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('shows the empty message, a link back to the set, and no sections or legend when nothing is wanted', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ALL_OWNED }));
      renderPage();

      const empty = await screen.findByTestId('set-missing-empty');
      expect(empty).toHaveTextContent(en['missingList.empty']);
      const link = screen.getByTestId('set-missing-empty-link');
      expect(link).toHaveAttribute('href', '/sets/set-1');
      expect(link).toHaveTextContent('‹ My Wheat Cents');
      expect(screen.queryByTestId('set-missing-section-missing')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-section-upgrade')).not.toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-legend')).not.toBeInTheDocument();
      expect(screen.queryAllByTestId('want-list-row')).toHaveLength(0);
    });

    it('shows the empty message for a set with no coins at all', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({ data: { ...GAPS, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] } }),
      );
      renderPage();

      expect(await screen.findByTestId('set-missing-empty')).toBeInTheDocument();
      expect(screen.getByTestId('set-missing-title')).toBeInTheDocument();
    });

    it('shows the empty message when a minimum grade is set but nothing needs an upgrade', async () => {
      useSetGapsMock.mockReturnValue(
        queryResult({
          data: { ...GAPS_ALL_OWNED, minGrade: 'VF', upgradeCount: 0, slots: GAPS_ALL_OWNED.slots.map((s) => ({ ...s, needsUpgrade: false })) },
        }),
      );
      renderPage();

      expect(await screen.findByTestId('set-missing-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('set-missing-section-upgrade')).not.toBeInTheDocument();
    });

    it('shows "Nothing missing." in the Missing section and still the upgrade section when only upgrades remain', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_ONLY_UPGRADES }));
      renderPage();

      const missing = await screen.findByTestId('set-missing-section-missing');
      expect(within(missing).getByTestId('set-missing-nothing-missing')).toHaveTextContent(
        en['missingList.nothingMissing'],
      );
      expect(within(missing).queryByTestId('want-list-table')).not.toBeInTheDocument();
      expect(screen.getByTestId('set-missing-missing-count')).toHaveTextContent('0');
      const upgrade = screen.getByTestId('set-missing-section-upgrade');
      expect(within(upgrade).getAllByTestId('want-list-row')).toHaveLength(2);
      expect(screen.queryByTestId('set-missing-empty')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('set-missing-legend')).toHaveLength(1);
    });

    it('does not show "Nothing missing." when something is missing', async () => {
      renderPage();

      await screen.findByTestId('set-missing-section-missing');
      expect(screen.queryByTestId('set-missing-nothing-missing')).not.toBeInTheDocument();
    });
  });

  describe('print button', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('renders a Print button of type button', async () => {
      renderPage();

      const button = await screen.findByTestId('set-missing-print-button');
      expect(button).toHaveTextContent('Print');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('calls window.print exactly once per click', async () => {
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
      renderPage();

      const button = await screen.findByTestId('set-missing-print-button');
      expect(printSpy).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(1);
      fireEvent.click(button);
      expect(printSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Download CSV button', () => {
    beforeEach(() => {
      setStoredToken('token');
    });

    it('renders a Download CSV button of type button', async () => {
      renderPage();

      const button = await screen.findByTestId('set-missing-csv-button');
      expect(button).toHaveTextContent(en['missingList.downloadCsv']);
      expect(button).toHaveAttribute('type', 'button');
    });

    it('calls downloadMissingCsv with the gaps and the set name once per click', async () => {
      renderPage();

      const button = await screen.findByTestId('set-missing-csv-button');
      expect(downloadMissingCsvMock).not.toHaveBeenCalled();
      fireEvent.click(button);
      expect(downloadMissingCsvMock).toHaveBeenCalledTimes(1);
      expect(downloadMissingCsvMock).toHaveBeenCalledWith(GAPS, 'My Wheat Cents');
    });

    it('passes the full gaps including upgrade slots', async () => {
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_WITH_UPGRADES }));
      renderPage();

      fireEvent.click(await screen.findByTestId('set-missing-csv-button'));

      expect(downloadMissingCsvMock).toHaveBeenCalledWith(GAPS_WITH_UPGRADES, 'My Wheat Cents');
    });
  });

  describe('print region', () => {
    beforeEach(() => {
      setStoredToken('token');
      useSetGapsMock.mockReturnValue(queryResult({ data: GAPS_WITH_UPGRADES }));
    });

    it('wraps the title, set name, summary, date and sections in an element with data-print-region', async () => {
      renderPage();

      const region = await screen.findByTestId('set-missing-print-region');
      expect(region).toHaveAttribute('data-print-region');
      for (const id of [
        'set-missing-title',
        'set-missing-set-name',
        'set-missing-summary',
        'set-missing-date',
        'set-missing-section-missing',
        'set-missing-section-upgrade',
        'set-missing-legend',
      ]) {
        expect(within(region).getByTestId(id)).toBeInTheDocument();
      }
    });

    it('keeps the back link outside the print region and hidden in print', async () => {
      renderPage();

      const region = await screen.findByTestId('set-missing-print-region');
      const link = screen.getByTestId('set-missing-back-link');
      expect(region.contains(link)).toBe(false);
      expect(link.closest('.print\\:hidden')).not.toBeNull();
    });

    it('hides the Print and Download CSV buttons in print', async () => {
      renderPage();

      await screen.findByTestId('set-missing-print-region');
      expect(screen.getByTestId('set-missing-print-button').closest('.print\\:hidden')).not.toBeNull();
      expect(screen.getByTestId('set-missing-csv-button').closest('.print\\:hidden')).not.toBeNull();
    });
  });
});
