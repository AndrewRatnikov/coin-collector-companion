/**
 * Tests for: SetEditorPage (modified) - download missing CSV button and print missing link
 * Contract source: runs/run_20261001_205959/plan.md § Interface Contract → Page (modified): SetEditorPage
 * Covers criteria: #7, #8, #9 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SetEditorPage from '@/app/sets/[id]/page';
import { buildMissingCsv } from '@/lib/missing-list';
import { usePublicSet } from '@/lib/hooks/use-public-sets';
import { useDeleteSet, usePatchSetCoins, useRenameSet, useSetGaps, useUserSets } from '@/lib/hooks/use-user-sets';
import { useSetOwnership } from '@/lib/hooks/use-collection';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

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
  useUserSets: vi.fn(),
  usePatchSetCoins: vi.fn(),
  useRenameSet: vi.fn(),
  useDeleteSet: vi.fn(),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useSetOwnership: vi.fn(),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

const usePublicSetMock = vi.mocked(usePublicSet);
const useSetGapsMock = vi.mocked(useSetGaps);
const useUserSetsMock = vi.mocked(useUserSets);
const usePatchSetCoinsMock = vi.mocked(usePatchSetCoins);
const useRenameSetMock = vi.mocked(useRenameSet);
const useDeleteSetMock = vi.mocked(useDeleteSet);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const useCatalogMock = vi.mocked(useCatalog);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

function mutationMock() {
  return { mutate: vi.fn(), isPending: false } as never;
}

function renderPage(id = 'set-1') {
  return render(<SetEditorPage params={Promise.resolve({ id })} />);
}

const COIN_1 = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
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
const COIN_2 = { ...COIN_1, id: 'coin-2', year: 1958, name: 'Lincoln, "Memorial"', isKeyDate: true, mintage: 1000 };
const COIN_3 = { ...COIN_1, id: 'coin-3', year: 1943, name: 'Steel Cent' };
const COIN_4 = { ...COIN_1, id: 'coin-4', year: 1952, name: 'Plain Cent' };

const SET_DETAIL = {
  id: 'set-1',
  userId: 'user-1',
  name: 'My Wheat Cents',
  clonedFromCanonicalId: null,
  clonedFromUserSetId: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  coins: [
    { id: 'usc-1', position: 2, coin: COIN_1 },
    { id: 'usc-2', position: 0, coin: COIN_2 },
    { id: 'usc-3', position: 1, coin: COIN_3 },
    { id: 'usc-4', position: 3, coin: COIN_4 },
  ],
};

const GAPS = {
  setId: 'set-1',
  ownedCount: 1,
  totalCount: 4,
  completionPercent: 25,
  slots: [
    { id: 'usc-4', position: 3, coin: COIN_4, owned: false },
    { id: 'usc-1', position: 2, coin: COIN_1, owned: true },
    { id: 'usc-2', position: 0, coin: COIN_2, owned: false },
    { id: 'usc-3', position: 1, coin: COIN_3, owned: false },
  ],
};

const GAPS_ALL_OWNED = {
  ...GAPS,
  ownedCount: 4,
  completionPercent: 100,
  slots: GAPS.slots.map((s) => ({ ...s, owned: true })),
};

const GAPS_EMPTY_SET = { ...GAPS, ownedCount: 0, totalCount: 0, completionPercent: 0, slots: [] };

const MY_SETS = [
  {
    id: 'set-1',
    userId: 'user-1',
    name: 'My Wheat Cents',
    clonedFromCanonicalId: null,
    clonedFromUserSetId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

function setDefaultMocks(gaps: unknown = GAPS) {
  usePublicSetMock.mockReturnValue(queryResult({ data: SET_DETAIL }));
  useSetGapsMock.mockReturnValue(queryResult({ data: gaps }));
  useUserSetsMock.mockReturnValue(queryResult({ data: MY_SETS }));
  usePatchSetCoinsMock.mockReturnValue(mutationMock());
  useRenameSetMock.mockReturnValue(mutationMock());
  useDeleteSetMock.mockReturnValue(mutationMock());
  useSetOwnershipMock.mockReturnValue(mutationMock());
  useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
}

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

// Download / Print live in the ⋯ actions menu; open it (once) and return the requested item.
async function findMenuItem(testId: string): Promise<HTMLElement> {
  const trigger = await screen.findByTestId('set-editor-actions-trigger');
  if (!screen.queryByTestId('set-editor-actions-menu')) fireEvent.click(trigger);
  return screen.findByTestId(testId);
}

describe('SetEditorPage missing-list controls', () => {
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let clicked: { download: string; href: string }[];

  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    [
      usePublicSetMock,
      useSetGapsMock,
      useUserSetsMock,
      usePatchSetCoinsMock,
      useRenameSetMock,
      useDeleteSetMock,
      useSetOwnershipMock,
      useCatalogMock,
    ].forEach((m) => m.mockReset());
    setDefaultMocks();
    setStoredToken('token');

    createObjectURL.mockReset();
    revokeObjectURL.mockReset();
    createObjectURL.mockReturnValue('blob:editor-url');
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    clicked = [];
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ download: this.download, href: this.href });
    });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 1, 12, 0, 0));
  });

  afterEach(async () => {
    vi.useRealTimers();
    // drain the pending setTimeout(..., 0) revoke before restoring URL
    await new Promise((resolve) => setTimeout(resolve, 10));
    clickSpy.mockRestore();
    URL.createObjectURL = originalCreate ?? (() => 'blob:noop');
    URL.revokeObjectURL = originalRevoke ?? (() => {});
  });

  describe('criterion 7: controls render when something is missing', () => {
    it('renders the download button, enabled, with its English label', async () => {
      renderPage();

      const button = await findMenuItem('set-editor-download-missing');
      expect(button).toHaveTextContent('Download missing (CSV)');
      expect(button).toBeEnabled();
      expect(button.tagName).toBe('BUTTON');
    });

    it('renders the print link to /sets/{id}/missing without aria-disabled', async () => {
      renderPage('set-1');

      const link = await findMenuItem('set-editor-print-missing');
      expect(link).toHaveTextContent('Print missing list');
      expect(link).toHaveAttribute('href', '/sets/set-1/missing');
      expect(link).not.toHaveAttribute('aria-disabled');
    });

    it('builds the link href from the route id', async () => {
      renderPage('set-77');

      const link = await findMenuItem('set-editor-print-missing');
      expect(link).toHaveAttribute('href', '/sets/set-77/missing');
    });
  });

  describe('criterion 8: controls disabled when nothing is missing', () => {
    it('disables the button and aria-disables the link when every slot is owned', async () => {
      setDefaultMocks(GAPS_ALL_OWNED);
      renderPage();

      const button = await findMenuItem('set-editor-download-missing');
      const link = screen.getByTestId('set-editor-print-missing');
      expect(button).toBeDisabled();
      expect(link).toHaveAttribute('aria-disabled', 'true');
      expect(link).toHaveAttribute('tabindex', '-1');
      expect(link).toHaveAttribute('href', '/sets/set-1/missing');
    });

    it('treats an empty set as nothing missing', async () => {
      setDefaultMocks(GAPS_EMPTY_SET);
      renderPage();

      expect(await findMenuItem('set-editor-download-missing')).toBeDisabled();
      expect(screen.getByTestId('set-editor-print-missing')).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not download when the disabled button is clicked', async () => {
      setDefaultMocks(GAPS_ALL_OWNED);
      renderPage();

      fireEvent.click(await findMenuItem('set-editor-download-missing'));

      expect(createObjectURL).not.toHaveBeenCalled();
      expect(clicked).toHaveLength(0);
    });

    it('prevents default when the disabled link is clicked', async () => {
      setDefaultMocks(GAPS_ALL_OWNED);
      renderPage();

      const link = await findMenuItem('set-editor-print-missing');
      // fireEvent returns false when preventDefault was called
      expect(fireEvent.click(link)).toBe(false);
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 9: clicking download', () => {
    it('creates a text/csv Blob with the real buildMissingCsv bytes and downloads with the dated filename', async () => {
      renderPage();

      fireEvent.click(await findMenuItem('set-editor-download-missing'));

      expect(createObjectURL).toHaveBeenCalledTimes(1);
      const blob = createObjectURL.mock.calls[0][0] as Blob;
      expect(blob.type).toBe('text/csv;charset=utf-8');
      const bytes = await readBytes(blob);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
      expect(text).toBe(buildMissingCsv(GAPS as never, SET_DETAIL.name));
      // missing coins only, in position order: usc-2 (0), usc-3 (1), usc-4 (3); owned usc-1 excluded
      const lines = text.slice(1).split('\r\n');
      expect(lines).toHaveLength(4);
      expect(lines[1].startsWith('"Lincoln, ""Memorial""",')).toBe(true);
      expect(lines[2].startsWith('Steel Cent,')).toBe(true);
      expect(lines[3].startsWith('Plain Cent,')).toBe(true);

      expect(clicked).toHaveLength(1);
      expect(clicked[0].download).toBe('my-wheat-cents-missing-2026-10-01.csv');
      expect(clicked[0].href).toBe('blob:editor-url');
    });

    it('revokes the object URL after the download', async () => {
      renderPage();

      fireEvent.click(await findMenuItem('set-editor-download-missing'));

      await waitFor(() => {
        expect(revokeObjectURL).toHaveBeenCalledWith('blob:editor-url');
      });
    });

    it('exports different content when the gaps data differs', async () => {
      const onlyOneMissing = {
        ...GAPS,
        slots: GAPS.slots.map((s) => ({ ...s, owned: s.id !== 'usc-3' })),
      };
      setDefaultMocks(onlyOneMissing);
      renderPage();

      fireEvent.click(await findMenuItem('set-editor-download-missing'));

      const blob = createObjectURL.mock.calls[0][0] as Blob;
      const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(await readBytes(blob));
      expect(text).toBe(buildMissingCsv(onlyOneMissing as never, SET_DETAIL.name));
      expect(text.slice(1).split('\r\n')).toHaveLength(2);
      expect(text).toContain('Steel Cent');
    });
  });
});
