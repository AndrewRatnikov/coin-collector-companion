/**
 * Tests for: CollectionImportPage (/collection/import), including ImportPreviewTable through the page
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract
 *                   (Page: /collection/import, Component: ImportPreviewTable, Component: ImportMappingForm)
 * Covers criteria: #1, #3, #9 (web side), #13, #21, #24, #25, #26 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Mocks: @/lib/collection-import-api (previewImport, confirmImport), @/lib/catalog-api (getCatalog),
 * @/lib/auth-token (getStoredToken), next/navigation. Mocked preview rows use `line` values 2..7.
 * The summary counts in the mocked server responses are deliberately different from each other, and
 * the server's own `toImport` is deliberately inconsistent with the rows, to prove that
 * import-summary-to-import is computed live on the client.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  IMPORT_MAX_FILE_BYTES,
  type CatalogCoin,
  type ImportCoinSummary,
  type ImportPreviewResponse,
  type ImportPreviewRow,
} from '@coin-collector/shared';
import CollectionImportPage from '@/app/collection/import/page';
import { ApiError } from '@/lib/api-client';
import { getCatalog } from '@/lib/catalog-api';
import { confirmImport, previewImport } from '@/lib/collection-import-api';
import { getStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
  setStoredToken: vi.fn(),
  clearStoredToken: vi.fn(),
}));

vi.mock('@/lib/collection-import-api', () => ({
  previewImport: vi.fn(),
  confirmImport: vi.fn(),
}));

vi.mock('@/lib/catalog-api', () => ({
  getCatalog: vi.fn(),
}));

const getStoredTokenMock = vi.mocked(getStoredToken);
const previewImportMock = vi.mocked(previewImport);
const confirmImportMock = vi.mocked(confirmImport);
const getCatalogMock = vi.mocked(getCatalog);

function coinSummary(id: string, overrides: Partial<ImportCoinSummary> = {}): ImportCoinSummary {
  return {
    id,
    country: 'USA',
    denomination: 'Cent',
    year: 1950,
    mintMark: 'D',
    variety: '',
    name: `Coin ${id}`,
    owned: false,
    ...overrides,
  };
}

const COIN_A = coinSummary('coin-a'); // USA Cent (1950 D)
const COIN_OWNED = coinSummary('coin-owned', { year: 1951, mintMark: 'S', owned: true }); // USA Cent (1951 S)
const CAND_1 = coinSummary('cand-1', { year: 1955, mintMark: '', variety: '' }); // USA Cent (1955)
const CAND_2 = coinSummary('cand-2', { year: 1955, mintMark: '', variety: 'Doubled Die' }); // USA Cent (1955), Doubled Die

function row(overrides: Partial<ImportPreviewRow> & Pick<ImportPreviewRow, 'line'>): ImportPreviewRow {
  return {
    values: ['x'],
    status: 'matched',
    reason: null,
    coin: null,
    candidates: [],
    alreadyOwned: false,
    duplicateOfLine: null,
    ...overrides,
  };
}

const ROW_MATCHED = row({ line: 2, values: ['1950', 'USA', 'Cent', 'D'], coin: COIN_A });
const ROW_OWNED = row({
  line: 3,
  values: ['1951', 'USA', 'Cent', 'S'],
  coin: COIN_OWNED,
  alreadyOwned: true,
});
const ROW_DUPLICATE = row({ line: 4, values: ['1950', 'USA', 'penny', 'D'], coin: COIN_A, duplicateOfLine: 2 });
const ROW_AMBIGUOUS = row({
  line: 5,
  values: ['1955', 'USA', 'Cent', ''],
  status: 'ambiguous',
  reason: 'multiple_matches',
  candidates: [CAND_1, CAND_2],
});
const ROW_UNMATCHED = row({
  line: 6,
  values: ['1960', 'USA', 'Cent', 'D'],
  status: 'unmatched',
  reason: 'no_such_coin',
});
const ROW_INVALID = row({
  line: 7,
  values: ['', 'USA', 'Cent', 'D'],
  status: 'invalid',
  reason: 'year_missing',
});

function previewResponse(
  rows: ImportPreviewRow[],
  overrides: Partial<ImportPreviewResponse> = {},
): ImportPreviewResponse {
  return {
    headers: ['Year', 'Country', 'Denomination', 'Mint'],
    delimiter: ',',
    mapping: { year: 0, country: 1, denomination: 2 },
    rows,
    summary: {
      total: 60,
      matched: 7,
      alreadyOwned: 2,
      duplicateInFile: 3,
      ambiguous: 4,
      unmatched: 5,
      invalid: 6,
      toImport: 99,
    },
    ...overrides,
  };
}

const MIXED_ROWS = [ROW_MATCHED, ROW_OWNED, ROW_DUPLICATE, ROW_AMBIGUOUS, ROW_UNMATCHED, ROW_INVALID];

function csvFile(name = 'c.csv') {
  return new File(['Year,Country,Denomination,Mint\n1950,USA,Cent,D\n'], name, { type: 'text/csv' });
}

function catalogCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'found-1',
    country: 'USA',
    denomination: 'Cent',
    year: 1960,
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
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CollectionImportPage />
    </QueryClientProvider>,
  );
  return { queryClient, user: userEvent.setup() };
}

type User = ReturnType<typeof userEvent.setup>;

async function uploadAndPreview(user: User, file: File = csvFile()) {
  await user.upload(await screen.findByTestId('import-file-input'), file);
  await user.click(screen.getByTestId('import-upload-submit'));
}

async function reachPreview(user: User, rows: ImportPreviewRow[] = MIXED_ROWS) {
  previewImportMock.mockResolvedValue(previewResponse(rows));
  await uploadAndPreview(user);
  await screen.findByTestId('import-summary');
}

function rowEl(line: number): HTMLElement {
  return screen.getByTestId(`import-row-${line}`);
}

function textOf(testId: string): string | null {
  return screen.getByTestId(testId).textContent;
}

describe('CollectionImportPage', () => {
  beforeEach(() => {
    replaceMock.mockClear();
    previewImportMock.mockReset();
    confirmImportMock.mockReset();
    getCatalogMock.mockReset();
    getCatalogMock.mockResolvedValue({ items: [], page: 1, limit: 50, total: 0 });
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue('tok-abc');
  });

  describe('auth gating (criterion #1)', () => {
    it('redirects an anonymous visitor to /login and does not render the page', async () => {
      getStoredTokenMock.mockReturnValue(null);
      renderPage();

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.getByTestId('require-auth-pending')).toBeInTheDocument();
      expect(screen.queryByTestId('collection-import-page')).not.toBeInTheDocument();
    });

    it('renders the upload step for a logged-in user without redirecting', async () => {
      renderPage();

      expect(await screen.findByTestId('collection-import-page')).toBeInTheDocument();
      expect(replaceMock).not.toHaveBeenCalled();
      expect(screen.getByTestId('import-file-input')).toBeInTheDocument();
      expect(screen.getByTestId('import-upload-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
    });
  });

  describe('upload step (criterion #9)', () => {
    it('shows the limits hint and a CSV-only file input', async () => {
      renderPage();
      await screen.findByTestId('collection-import-page');

      expect(screen.getByTestId('import-limits-hint')).toHaveTextContent('CSV only, up to 1 MB and 2,000 rows.');
      const input = screen.getByTestId('import-file-input');
      expect(input).toHaveAttribute('type', 'file');
      expect(input).toHaveAttribute('accept', '.csv,text/csv');
    });

    it('shows "Choose a CSV file first." and sends no request when no file is selected', async () => {
      const { user } = renderPage();
      await user.click(await screen.findByTestId('import-upload-submit'));

      expect(screen.getByTestId('import-upload-error')).toHaveTextContent('Choose a CSV file first.');
      expect(previewImportMock).not.toHaveBeenCalled();
    });

    it('rejects a file over 1 MB on the client without sending a request', async () => {
      const { user } = renderPage();
      const big = new File([new Uint8Array(IMPORT_MAX_FILE_BYTES + 1)], 'big.csv', { type: 'text/csv' });

      await uploadAndPreview(user, big);

      expect(screen.getByTestId('import-upload-error')).toHaveTextContent('The file is larger than 1 MB.');
      expect(previewImportMock).not.toHaveBeenCalled();
    });

    it('sends the chosen file with no mapping on the first preview', async () => {
      const { user } = renderPage();
      const file = csvFile('my-coins.csv');
      previewImportMock.mockResolvedValue(previewResponse([ROW_MATCHED]));

      await uploadAndPreview(user, file);

      await waitFor(() => {
        expect(previewImportMock).toHaveBeenCalledTimes(1);
      });
      const [sentFile, sentMapping] = previewImportMock.mock.calls[0];
      expect((sentFile as File).name).toBe('my-coins.csv');
      expect(sentMapping).toBeUndefined();
      expect(await screen.findByTestId('import-summary')).toBeInTheDocument();
    });

    it('shows the loading indicator while the preview request is pending', async () => {
      const { user } = renderPage();
      let resolve: (value: ImportPreviewResponse) => void = () => undefined;
      previewImportMock.mockReturnValue(new Promise((r) => (resolve = r)));

      await uploadAndPreview(user);
      expect(await screen.findByTestId('import-loading')).toBeInTheDocument();

      resolve(previewResponse([ROW_MATCHED]));
      await screen.findByTestId('import-summary');
      expect(screen.queryByTestId('import-loading')).not.toBeInTheDocument();
    });

    it.each([
      [new ApiError(400, 'IMPORT_NOT_UTF8'), 'The file is not UTF-8 text. Save it as "CSV UTF-8" and try again.'],
      [new ApiError(400, 'IMPORT_EMPTY'), 'The file is empty.'],
      [new ApiError(400, 'IMPORT_TOO_MANY_ROWS'), 'The file has more than 2,000 rows.'],
      [new ApiError(413, 'Payload Too Large'), 'The file is larger than 1 MB.'],
      [new ApiError(429, 'Too Many Requests'), 'Too many attempts. Please wait a minute and try again.'],
    ])('shows the translated server error for %j', async (error, message) => {
      const { user } = renderPage();
      previewImportMock.mockRejectedValue(error);

      await uploadAndPreview(user);

      expect(await screen.findByTestId('import-upload-error')).toHaveTextContent(message);
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
      expect(screen.getByTestId('import-file-input')).toBeInTheDocument();
    });

    it('shows a generic error for an unknown failure', async () => {
      const { user } = renderPage();
      previewImportMock.mockRejectedValue(new Error('network down'));

      await uploadAndPreview(user);

      expect(await screen.findByTestId('import-upload-error')).toHaveTextContent(
        'Something went wrong. Please try again.',
      );
    });
  });

  describe('preview step: summary and rows (criteria #21, #24)', () => {
    it('shows each server count in its own element', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      expect(textOf('import-summary-matched')).toBe('7');
      expect(textOf('import-summary-already-owned')).toBe('2');
      expect(textOf('import-summary-duplicate')).toBe('3');
      expect(textOf('import-summary-ambiguous')).toBe('4');
      expect(textOf('import-summary-unmatched')).toBe('5');
      expect(textOf('import-summary-invalid')).toBe('6');
    });

    it('computes "to be imported" live from the rows (unique, not owned), not from the server summary', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      // coin-a (rows 2 and 4, duplicate) counts once; coin-owned is owned; the rest are unresolved.
      expect(textOf('import-summary-to-import')).toBe('1');
    });

    it('renders every row with status, original values, matched coin, reason and flags', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      expect(screen.getByTestId('import-preview-table')).toBeInTheDocument();

      const matched = rowEl(2);
      expect(matched).toHaveAttribute('data-status', 'matched');
      expect(matched).toHaveAttribute('data-decision', 'auto');
      expect(within(matched).getByTestId('import-row-status')).toHaveTextContent('Matched');
      expect(within(matched).getByTestId('import-row-values')).toHaveTextContent('1950 · USA · Cent · D');
      expect(within(matched).getByTestId('import-row-coin')).toHaveTextContent('USA Cent (1950 D)');
      expect(within(matched).queryByTestId('import-row-reason')).not.toBeInTheDocument();
      expect(within(matched).queryByTestId('import-row-flag-owned')).not.toBeInTheDocument();
      expect(within(matched).queryByTestId('import-row-flag-duplicate')).not.toBeInTheDocument();

      const owned = rowEl(3);
      expect(within(owned).getByTestId('import-row-coin')).toHaveTextContent('USA Cent (1951 S)');
      expect(within(owned).getByTestId('import-row-flag-owned')).toBeInTheDocument();
      expect(within(owned).queryByTestId('import-row-flag-duplicate')).not.toBeInTheDocument();

      const duplicate = rowEl(4);
      expect(within(duplicate).getByTestId('import-row-flag-duplicate')).toBeInTheDocument();
      expect(within(duplicate).getByTestId('import-row-coin')).toHaveTextContent('USA Cent (1950 D)');

      const ambiguous = rowEl(5);
      expect(ambiguous).toHaveAttribute('data-status', 'ambiguous');
      expect(within(ambiguous).getByTestId('import-row-status')).toHaveTextContent('Ambiguous');
      expect(within(ambiguous).getByTestId('import-row-reason')).toHaveTextContent('Several coins match; pick one');
      expect(within(ambiguous).queryByTestId('import-row-coin')).not.toBeInTheDocument();

      const unmatched = rowEl(6);
      expect(unmatched).toHaveAttribute('data-status', 'unmatched');
      expect(within(unmatched).getByTestId('import-row-status')).toHaveTextContent('Unmatched');
      expect(within(unmatched).getByTestId('import-row-reason')).toHaveTextContent('No such coin in the catalog');

      const invalid = rowEl(7);
      expect(invalid).toHaveAttribute('data-status', 'invalid');
      expect(within(invalid).getByTestId('import-row-status')).toHaveTextContent('Invalid');
      expect(within(invalid).getByTestId('import-row-reason')).toHaveTextContent('Year is missing');
    });

    it('offers the right controls per row type', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      // matched: skip only
      expect(within(rowEl(2)).getByTestId('import-row-skip')).toBeInTheDocument();
      expect(within(rowEl(2)).queryByTestId('import-row-candidates')).not.toBeInTheDocument();
      expect(within(rowEl(2)).queryByTestId('import-row-search-toggle')).not.toBeInTheDocument();
      expect(within(rowEl(2)).queryByTestId('import-row-reset')).not.toBeInTheDocument();
      // ambiguous: candidates + search + skip
      expect(within(rowEl(5)).getByTestId('import-row-candidates')).toBeInTheDocument();
      expect(within(rowEl(5)).getByTestId('import-row-search-toggle')).toBeInTheDocument();
      expect(within(rowEl(5)).getByTestId('import-row-skip')).toBeInTheDocument();
      // unmatched and invalid: search + skip, no candidates
      for (const line of [6, 7]) {
        expect(within(rowEl(line)).getByTestId('import-row-search-toggle')).toBeInTheDocument();
        expect(within(rowEl(line)).getByTestId('import-row-skip')).toBeInTheDocument();
        expect(within(rowEl(line)).queryByTestId('import-row-candidates')).not.toBeInTheDocument();
      }
    });

    it('lists the candidates of an ambiguous row in a select, after a "choose" placeholder option', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      const select = within(rowEl(5)).getByTestId('import-row-candidates');
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.getAttribute('value'))).toEqual(['', 'cand-1', 'cand-2']);
      expect(options[0]).toHaveTextContent('Choose a coin…');
      expect(options[1]).toHaveTextContent('USA Cent (1955)');
      expect(options[2]).toHaveTextContent('USA Cent (1955), Doubled Die');
    });
  });

  describe('preview step: resolve and skip (criterion #25)', () => {
    it('picking a candidate resolves an ambiguous row and raises the to-import count', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      expect(textOf('import-summary-to-import')).toBe('1');

      await user.selectOptions(within(rowEl(5)).getByTestId('import-row-candidates'), 'cand-2');

      expect(rowEl(5)).toHaveAttribute('data-decision', 'pick');
      expect(within(rowEl(5)).getByTestId('import-row-status')).toHaveTextContent('Resolved');
      expect(within(rowEl(5)).getByTestId('import-row-coin')).toHaveTextContent('USA Cent (1955), Doubled Die');
      expect(within(rowEl(5)).queryByTestId('import-row-reason')).not.toBeInTheDocument();
      expect(within(rowEl(5)).getByTestId('import-row-reset')).toBeInTheDocument();
      expect(textOf('import-summary-to-import')).toBe('2');
    });

    it('skipping a matched row lowers the count, marks the row skipped and hides its coin', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.click(within(rowEl(2)).getByTestId('import-row-skip'));

      expect(rowEl(2)).toHaveAttribute('data-decision', 'skip');
      expect(within(rowEl(2)).getByTestId('import-row-status')).toHaveTextContent('Skipped');
      expect(within(rowEl(2)).queryByTestId('import-row-coin')).not.toBeInTheDocument();
      expect(within(rowEl(2)).queryByTestId('import-row-skip')).not.toBeInTheDocument();
      expect(within(rowEl(2)).getByTestId('import-row-reset')).toBeInTheDocument();
      expect(textOf('import-summary-to-import')).toBe('0');
    });

    it('skipping a row hides its duplicate flag and reason (only shown for auto decisions)', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.click(within(rowEl(4)).getByTestId('import-row-skip'));
      expect(within(rowEl(4)).queryByTestId('import-row-flag-duplicate')).not.toBeInTheDocument();

      await user.click(within(rowEl(6)).getByTestId('import-row-skip'));
      expect(within(rowEl(6)).queryByTestId('import-row-reason')).not.toBeInTheDocument();
      expect(within(rowEl(6)).getByTestId('import-row-status')).toHaveTextContent('Skipped');
    });

    it('Undo returns a skipped row to its original state and restores the count', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.click(within(rowEl(2)).getByTestId('import-row-skip'));
      expect(textOf('import-summary-to-import')).toBe('0');
      await user.click(within(rowEl(2)).getByTestId('import-row-reset'));

      expect(rowEl(2)).toHaveAttribute('data-decision', 'auto');
      expect(within(rowEl(2)).getByTestId('import-row-status')).toHaveTextContent('Matched');
      expect(within(rowEl(2)).getByTestId('import-row-coin')).toBeInTheDocument();
      expect(within(rowEl(2)).queryByTestId('import-row-reset')).not.toBeInTheDocument();
      expect(textOf('import-summary-to-import')).toBe('1');
    });

    it('an unmatched row can be resolved by searching the catalog and picking a coin', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      getCatalogMock.mockResolvedValue({ items: [catalogCoin()], page: 1, limit: 50, total: 1 });

      await user.click(within(rowEl(6)).getByTestId('import-row-search-toggle'));
      const picker = within(rowEl(6)).getByTestId('coin-search-picker');
      expect((within(picker).getByTestId('coin-search-year') as HTMLInputElement).value).toBe('1960');
      expect(getCatalogMock).not.toHaveBeenCalled();

      await user.click(within(picker).getByTestId('coin-search-submit'));
      await waitFor(() => {
        expect(getCatalogMock).toHaveBeenCalledWith(expect.objectContaining({ yearMin: 1960, yearMax: 1960, limit: 50 }));
      });
      const result = await within(picker).findByTestId('coin-search-result');
      await user.click(result.tagName === 'BUTTON' ? result : within(result).getByRole('button'));

      expect(rowEl(6)).toHaveAttribute('data-decision', 'pick');
      expect(within(rowEl(6)).getByTestId('import-row-status')).toHaveTextContent('Resolved');
      expect(within(rowEl(6)).getByTestId('import-row-coin')).toHaveTextContent('USA Cent (1960 D)');
      expect(within(rowEl(6)).queryByTestId('coin-search-picker')).not.toBeInTheDocument();
      expect(textOf('import-summary-to-import')).toBe('2');
    });

    it('cancelling the catalog search closes the picker and leaves the row unresolved', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.click(within(rowEl(7)).getByTestId('import-row-search-toggle'));
      await user.click(within(rowEl(7)).getByTestId('coin-search-cancel'));

      expect(within(rowEl(7)).queryByTestId('coin-search-picker')).not.toBeInTheDocument();
      expect(rowEl(7)).toHaveAttribute('data-decision', 'auto');
      expect(textOf('import-summary-to-import')).toBe('1');
    });

    it('a coin picked from the catalog search counts as one coin to import', async () => {
      const { user } = renderPage();
      await reachPreview(user, [ROW_UNMATCHED]);
      getCatalogMock.mockResolvedValue({ items: [catalogCoin({ id: 'found-2' })], page: 1, limit: 50, total: 1 });

      expect(textOf('import-summary-to-import')).toBe('0');
      await user.click(within(rowEl(6)).getByTestId('import-row-search-toggle'));
      await user.click(within(rowEl(6)).getByTestId('coin-search-submit'));
      const result = await within(rowEl(6)).findByTestId('coin-search-result');
      await user.click(result.tagName === 'BUTTON' ? result : within(result).getByRole('button'));

      // toImportCoinSummary() marks the picked coin as not owned, so it counts as one to import.
      expect(textOf('import-summary-to-import')).toBe('1');
      expect(rowEl(6)).toHaveAttribute('data-decision', 'pick');
    });
  });

  describe('confirm (criteria #3, #26)', () => {
    it('is disabled when nothing is importable', async () => {
      const { user } = renderPage();
      await reachPreview(user, [ROW_UNMATCHED, ROW_INVALID, ROW_AMBIGUOUS]);

      expect(textOf('import-summary-to-import')).toBe('0');
      expect(screen.getByTestId('import-confirm')).toBeDisabled();
    });

    it('is enabled when something is importable and disabled again after skipping everything', async () => {
      const { user } = renderPage();
      await reachPreview(user, [ROW_MATCHED, ROW_UNMATCHED]);
      expect(screen.getByTestId('import-confirm')).toBeEnabled();

      await user.click(within(rowEl(2)).getByTestId('import-row-skip'));
      expect(screen.getByTestId('import-confirm')).toBeDisabled();
    });

    it('is disabled when the only matched rows are already owned', async () => {
      const { user } = renderPage();
      await reachPreview(user, [ROW_OWNED]);
      expect(screen.getByTestId('import-confirm')).toBeDisabled();
    });

    it('sends the unique ids of every selected coin in row order, including owned ones, and nothing else', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockResolvedValue({ requested: 2, created: 1, alreadyOwned: 1 });

      await user.click(screen.getByTestId('import-confirm'));

      await waitFor(() => {
        expect(confirmImportMock).toHaveBeenCalledTimes(1);
      });
      expect(confirmImportMock.mock.calls[0][0]).toEqual(['coin-a', 'coin-owned']);
    });

    it('leaves out skipped rows and includes resolved ones', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockResolvedValue({ requested: 2, created: 2, alreadyOwned: 0 });

      await user.click(within(rowEl(2)).getByTestId('import-row-skip')); // skip coin-a (rows 2 and 4 -> row 4 still counts)
      await user.click(within(rowEl(4)).getByTestId('import-row-skip')); // now coin-a is fully skipped
      await user.selectOptions(within(rowEl(5)).getByTestId('import-row-candidates'), 'cand-1');
      await user.click(screen.getByTestId('import-confirm'));

      await waitFor(() => {
        expect(confirmImportMock).toHaveBeenCalledTimes(1);
      });
      expect(confirmImportMock.mock.calls[0][0]).toEqual(['coin-owned', 'cand-1']);
    });

    it('disables the button while the request is pending', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      let resolve: (value: { requested: number; created: number; alreadyOwned: number }) => void = () => undefined;
      confirmImportMock.mockReturnValue(new Promise((r) => (resolve = r)));

      await user.click(screen.getByTestId('import-confirm'));

      await waitFor(() => {
        expect(screen.getByTestId('import-confirm')).toBeDisabled();
      });
      resolve({ requested: 2, created: 1, alreadyOwned: 1 });
      await screen.findByTestId('import-result');
    });

    it('shows a translated error and stays on the preview when confirm fails', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockRejectedValue(new ApiError(400, 'IMPORT_UNKNOWN_COIN'));

      await user.click(screen.getByTestId('import-confirm'));

      expect(await screen.findByTestId('import-confirm-error')).toHaveTextContent(
        'Some selected coins are no longer in the catalog. Preview the file again.',
      );
      expect(screen.getByTestId('import-summary')).toBeInTheDocument();
      expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
    });
  });

  describe('result step (criterion #26)', () => {
    it('shows created, already owned and skipped counts with a link to the collection', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockResolvedValue({ requested: 2, created: 1, alreadyOwned: 1 });

      await user.click(screen.getByTestId('import-confirm'));

      expect(await screen.findByTestId('import-result')).toBeInTheDocument();
      expect(textOf('import-result-created')).toBe('1');
      expect(textOf('import-result-already-owned')).toBe('1');
      // unresolved ambiguous (5), unmatched (6) and invalid (7) rows have no coin
      expect(textOf('import-result-skipped')).toBe('3');
      expect(screen.getByTestId('import-result-collection-link')).toHaveAttribute('href', '/collection');
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
    });

    it('counts user-skipped and resolved rows correctly in the skipped figure', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockResolvedValue({ requested: 3, created: 3, alreadyOwned: 0 });

      await user.selectOptions(within(rowEl(5)).getByTestId('import-row-candidates'), 'cand-1'); // resolved: not skipped
      await user.click(within(rowEl(3)).getByTestId('import-row-skip')); // user skip: skipped
      await user.click(screen.getByTestId('import-confirm'));

      await screen.findByTestId('import-result');
      // skipped: row 3 (user), row 6 (unmatched), row 7 (invalid)
      expect(textOf('import-result-skipped')).toBe('3');
      expect(textOf('import-result-created')).toBe('3');
      expect(textOf('import-result-already-owned')).toBe('0');
    });

    it('"Import another file" returns to a clean upload step', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      confirmImportMock.mockResolvedValue({ requested: 2, created: 1, alreadyOwned: 1 });
      await user.click(screen.getByTestId('import-confirm'));
      await screen.findByTestId('import-result');

      await user.click(screen.getByTestId('import-result-again'));

      expect(screen.getByTestId('import-file-input')).toBeInTheDocument();
      expect(screen.getByTestId('import-upload-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('import-result')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
    });
  });

  describe('start over and re-mapping (criterion #13)', () => {
    it('"Start over" returns to the upload step and clears the preview', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.click(screen.getByTestId('import-start-over'));

      expect(screen.getByTestId('import-file-input')).toBeInTheDocument();
      expect(screen.queryByTestId('import-summary')).not.toBeInTheDocument();
      expect(screen.queryByTestId('import-preview-table')).not.toBeInTheDocument();
    });

    it('shows the mapping form initialised with the mapping the server used', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      expect(screen.getByTestId('import-mapping-form')).toBeInTheDocument();
      expect((screen.getByTestId('import-mapping-year') as HTMLSelectElement).value).toBe('0');
      expect((screen.getByTestId('import-mapping-country') as HTMLSelectElement).value).toBe('1');
      expect((screen.getByTestId('import-mapping-denomination') as HTMLSelectElement).value).toBe('2');
      expect((screen.getByTestId('import-mapping-mint-mark') as HTMLSelectElement).value).toBe('');
      const options = within(screen.getByTestId('import-mapping-year')).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual(['Not mapped', 'Year', 'Country', 'Denomination', 'Mint']);
    });

    it('applying a new mapping re-previews the same file with that mapping and resets all row decisions', async () => {
      const { user } = renderPage();
      const file = csvFile('same.csv');
      previewImportMock.mockResolvedValueOnce(previewResponse(MIXED_ROWS));
      await uploadAndPreview(user, file);
      await screen.findByTestId('import-summary');

      await user.click(within(rowEl(2)).getByTestId('import-row-skip'));
      expect(rowEl(2)).toHaveAttribute('data-decision', 'skip');

      previewImportMock.mockResolvedValueOnce(
        previewResponse([ROW_MATCHED, ROW_OWNED], {
          mapping: { year: 0, country: 1, denomination: 2, mintMark: 3 },
          summary: {
            total: 2,
            matched: 2,
            alreadyOwned: 1,
            duplicateInFile: 0,
            ambiguous: 0,
            unmatched: 0,
            invalid: 0,
            toImport: 1,
          },
        }),
      );
      await user.selectOptions(screen.getByTestId('import-mapping-mint-mark'), '3');
      await user.click(screen.getByTestId('import-mapping-apply'));

      await waitFor(() => {
        expect(previewImportMock).toHaveBeenCalledTimes(2);
      });
      const [sentFile, sentMapping] = previewImportMock.mock.calls[1];
      expect((sentFile as File).name).toBe('same.csv');
      expect(sentMapping).toEqual({ year: 0, country: 1, denomination: 2, mintMark: 3 });

      await waitFor(() => {
        expect(textOf('import-summary-matched')).toBe('2');
      });
      expect(rowEl(2)).toHaveAttribute('data-decision', 'auto');
      expect(textOf('import-summary-to-import')).toBe('1');
      expect(screen.queryByTestId('import-row-5')).not.toBeInTheDocument();
      expect((screen.getByTestId('import-mapping-mint-mark') as HTMLSelectElement).value).toBe('3');
    });

    it('shows a translated error in the upload error element when re-previewing fails, keeping the preview', async () => {
      const { user } = renderPage();
      await reachPreview(user);
      previewImportMock.mockRejectedValueOnce(new ApiError(400, 'IMPORT_INVALID_MAPPING'));

      await user.selectOptions(screen.getByTestId('import-mapping-mint-mark'), '3');
      await user.click(screen.getByTestId('import-mapping-apply'));

      expect(await screen.findByTestId('import-upload-error')).toHaveTextContent('The column mapping is not valid.');
      expect(screen.getByTestId('import-summary')).toBeInTheDocument();
    });

    it('does not allow applying an incomplete mapping', async () => {
      const { user } = renderPage();
      await reachPreview(user);

      await user.selectOptions(screen.getByTestId('import-mapping-country'), '');

      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
      expect(screen.getByTestId('import-mapping-required-hint')).toBeInTheDocument();
    });
  });
});
