/**
 * Tests for: CollectionPage Export CSV button
 * Contract source: runs/run_20261111_204530/plan.md § Interface Contract → Page: CollectionPage (modified)
 * Covers criteria: #2, #3, #7, #8 (from prd.md); #4-#6 are covered by collection-export.test.ts
 *
 * The real download helper runs; URL.createObjectURL is stubbed and the Blob is read back.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogCoin, OwnershipItem } from '@coin-collector/shared';
import CollectionPage from '@/app/collection/page';
import { getCollection } from '@/lib/collection-api';
import { useCollection, useSetOwnership } from '@/lib/hooks/use-collection';
import { setStoredToken } from '@/lib/auth-token';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-collection', () => ({
  useCollection: vi.fn(),
  useSetOwnership: vi.fn(),
}));

vi.mock('@/lib/collection-api', () => ({
  getCollection: vi.fn(),
}));

const useCollectionMock = vi.mocked(useCollection);
const useSetOwnershipMock = vi.mocked(useSetOwnership);
const getCollectionMock = vi.mocked(getCollection);

const HEADER = 'Country,Denomination,Year,Mint mark,Variety,Grade,Series,Key date,Mintage,Owned since';
const ERROR_TEXT = 'Could not create the export file. Please try again.';

const createObjectURL = vi.fn();
const revokeObjectURL = vi.fn();
const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
let clickSpy: ReturnType<typeof vi.spyOn>;
let clicked: { download: string }[];

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
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
  variety: 'Donetsk Oblast',
  name: 'Ukraine Commemorative 10 Hryvnias',
};
const ODESA: CatalogCoin = { ...DONETSK, id: 'odesa', year: 2026, variety: 'Odesa Oblast' };
const VDB: CatalogCoin = { ...BASE, id: 'vdb', mintMark: 'S', variety: 'VDB', isKeyDate: true };

function own(coin: CatalogCoin): OwnershipItem {
  return { coinId: coin.id, coin, ownedAt: new Date(2026, 0, 2, 12), grade: null };
}

const ITEMS = [own(BASE), own(DONETSK), own(VDB), own(ODESA)];

function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function lastExportLines(): Promise<string[]> {
  const blob = createObjectURL.mock.calls.at(-1)?.[0] as Blob;
  const bytes = await readBytes(blob);
  expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
  return text.slice(1).split('\r\n');
}

async function renderPage() {
  setStoredToken('tok-abc');
  render(<CollectionPage />);
  await screen.findByTestId('collection-page');
}

beforeEach(() => {
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
  createObjectURL.mockReturnValue('blob:mock-url');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  clicked = [];
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download });
  });
  getCollectionMock.mockReset();
  useCollectionMock.mockReset();
  useSetOwnershipMock.mockReturnValue({ mutate: vi.fn() } as never);
});

afterEach(() => {
  vi.useRealTimers();
  clickSpy.mockRestore();
  URL.createObjectURL = originalCreate ?? (() => 'blob:noop');
  URL.revokeObjectURL = originalRevoke ?? (() => {});
});

describe('Export CSV button states', () => {
  it('is present and disabled while loading', async () => {
    useCollectionMock.mockReturnValue(queryResult({ isLoading: true }));
    await renderPage();

    const button = screen.getByTestId('collection-export-button');
    expect(button).toHaveTextContent('Export CSV');
    expect(button).toBeDisabled();
  });

  it('is present and disabled when the loaded collection is empty', async () => {
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    await renderPage();

    expect(screen.getByTestId('collection-export-button')).toBeDisabled();
    expect(screen.queryByTestId('collection-layout-switch')).not.toBeInTheDocument();
  });

  it('is enabled with data and sits next to the Import button', async () => {
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();

    const button = screen.getByTestId('collection-export-button');
    expect(button).toBeEnabled();
    expect(button.tagName).toBe('BUTTON');
    expect(screen.getByTestId('collection-import-button')).toBeInTheDocument();
  });

  it('does not download anything when disabled and clicked', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ data: [] }));
    await renderPage();

    await user.click(screen.getByTestId('collection-export-button'));

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(getCollectionMock).not.toHaveBeenCalled();
  });

  it('stays enabled when filters match nothing', async () => {
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();

    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'zzzz-no-such-coin' } });

    await screen.findByTestId('collection-no-results');
    expect(screen.getByTestId('collection-export-button')).toBeEnabled();
  });
});

describe('Export CSV click', () => {
  it('exports every item from loaded data with header, dated filename and no fetch', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();

    await user.click(screen.getByTestId('collection-export-button'));

    expect(getCollectionMock).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((createObjectURL.mock.calls[0][0] as Blob).type).toBe('text/csv;charset=utf-8');
    const lines = await lastExportLines();
    expect(lines[0]).toBe(HEADER);
    expect(lines).toHaveLength(1 + ITEMS.length);
    expect(lines).toContain('USA,1 Cent,1909,,,,Lincoln Wheat Cent,no,,2026-01-02');
    expect(lines).toContain('Ukraine,10 Hryvnias,2026,,Odesa Oblast,,Ukraine Commemorative 10 Hryvnias,no,,2026-01-02');
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/^coin-collection-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(screen.queryByTestId('collection-export-error')).not.toBeInTheDocument();
  });

  it('exports all rows even when a search filter reduces what the page shows', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();
    const before = screen.queryAllByTestId('coin-card').length;

    fireEvent.change(screen.getByTestId('collection-search'), { target: { value: 'Donetsk' } });
    await waitFor(() => {
      expect(screen.queryAllByTestId('coin-card').length).toBeLessThan(before);
    });
    await user.click(screen.getByTestId('collection-export-button'));

    const lines = await lastExportLines();
    expect(lines).toHaveLength(1 + ITEMS.length);
    expect(lines.join('\n')).toContain('Odesa Oblast');
    expect(lines.join('\n')).toContain('VDB');
  });

  it('exports all rows when a country chip narrows the page', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();

    const chips = screen.getAllByTestId('collection-country-chip');
    await user.click(chips[0]);
    await user.click(screen.getByTestId('collection-export-button'));

    const lines = await lastExportLines();
    expect(lines).toHaveLength(1 + ITEMS.length);
  });
});

describe('Export CSV failure', () => {
  it('shows an inline alert when the download cannot be built, and clears it on the next success', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ data: ITEMS }));
    await renderPage();
    createObjectURL.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await user.click(screen.getByTestId('collection-export-button'));

    const alert = await screen.findByTestId('collection-export-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent(ERROR_TEXT);
    expect(screen.getByTestId('collection-page')).toBeInTheDocument();
    expect(screen.getByTestId('collection-export-button')).toBeEnabled();

    await user.click(screen.getByTestId('collection-export-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('collection-export-error')).not.toBeInTheDocument();
    });
    expect(clicked).toHaveLength(1);
  });
});

describe('Export CSV fallback fetch', () => {
  it('is enabled after a failed load and fetches the whole collection with no arguments', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ isError: true }));
    getCollectionMock.mockResolvedValue([own(BASE), own(VDB)]);
    await renderPage();

    const button = screen.getByTestId('collection-export-button');
    expect(button).toBeEnabled();
    await user.click(button);

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(getCollectionMock).toHaveBeenCalledTimes(1);
    expect(getCollectionMock).toHaveBeenCalledWith();
    const lines = await lastExportLines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(HEADER);
    expect(lines.join('\n')).toContain('VDB');
  });

  it('shows the inline error when the fallback fetch rejects', async () => {
    const user = userEvent.setup();
    useCollectionMock.mockReturnValue(queryResult({ isError: true }));
    getCollectionMock.mockRejectedValue(new Error('network'));
    await renderPage();

    await user.click(screen.getByTestId('collection-export-button'));

    expect(await screen.findByTestId('collection-export-error')).toHaveTextContent(ERROR_TEXT);
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
