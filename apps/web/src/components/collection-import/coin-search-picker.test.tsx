/**
 * Tests for: CoinSearchPicker
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Component: CoinSearchPicker)
 * Covers criteria: #25 (search the catalog for an unmatched row and pick a coin) (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The catalog API (@/lib/catalog-api getCatalog) is mocked; useCatalog runs for real inside a
 * QueryClientProvider.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CatalogCoin } from '@coin-collector/shared';
import { CoinSearchPicker } from '@/components/collection-import/coin-search-picker';
import { getCatalog } from '@/lib/catalog-api';

vi.mock('@/lib/catalog-api', () => ({
  getCatalog: vi.fn(),
}));

const getCatalogMock = vi.mocked(getCatalog);

function makeCoin(overrides: Partial<CatalogCoin> = {}): CatalogCoin {
  return {
    id: 'coin-1',
    country: 'USA',
    denomination: 'Cent',
    year: 1950,
    mintMark: 'D',
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
    status: 'approved',
    submittedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function page(items: CatalogCoin[]) {
  return { items, page: 1, limit: 50, total: items.length };
}

function renderPicker(props: Partial<React.ComponentProps<typeof CoinSearchPicker>> = {}) {
  const onPick = vi.fn();
  const onCancel = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CoinSearchPicker onPick={onPick} onCancel={onCancel} {...props} />
    </QueryClientProvider>,
  );
  return { onPick, onCancel };
}

function inputOf(testId: string): HTMLInputElement {
  const el = screen.getByTestId(testId);
  if (!(el instanceof HTMLInputElement)) throw new Error(`${testId} is not an input`);
  return el;
}

function buttonIn(el: HTMLElement): HTMLElement {
  return el.tagName === 'BUTTON' ? el : within(el).getByRole('button');
}

describe('CoinSearchPicker', () => {
  beforeEach(() => {
    getCatalogMock.mockReset();
    getCatalogMock.mockResolvedValue(page([]));
  });

  describe('prefill and lazy search', () => {
    it('prefills the year and country inputs from props', () => {
      renderPicker({ initialYear: 1950, initialCountry: 'USA' });
      expect(screen.getByTestId('coin-search-picker')).toBeInTheDocument();
      expect(inputOf('coin-search-year').value).toBe('1950');
      expect(inputOf('coin-search-country').value).toBe('USA');
    });

    it('prefills different props with different values and leaves blanks for null / missing', () => {
      renderPicker({ initialYear: 1909, initialCountry: 'Ukraine' });
      expect(inputOf('coin-search-year').value).toBe('1909');
      expect(inputOf('coin-search-country').value).toBe('Ukraine');
    });

    it('leaves the inputs blank when no initial values are given', () => {
      renderPicker({ initialYear: null });
      expect(inputOf('coin-search-year').value).toBe('');
      expect(inputOf('coin-search-country').value).toBe('');
    });

    it('does not fetch anything until the user submits', async () => {
      renderPicker({ initialYear: 1950, initialCountry: 'USA' });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(getCatalogMock).not.toHaveBeenCalled();
      expect(screen.queryByTestId('coin-search-result')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-search-empty')).not.toBeInTheDocument();
    });
  });

  describe('searching', () => {
    it('queries the catalog with the year as yearMin and yearMax, the country and limit 50', async () => {
      const user = userEvent.setup();
      renderPicker({ initialYear: 1950, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-submit'));

      await waitFor(() => {
        expect(getCatalogMock).toHaveBeenCalledWith({ yearMin: 1950, yearMax: 1950, country: 'USA', limit: 50 });
      });
    });

    it('uses the edited values, not the prefilled ones', async () => {
      const user = userEvent.setup();
      renderPicker({ initialYear: 1950, initialCountry: 'USA' });

      fireEvent.change(screen.getByTestId('coin-search-year'), { target: { value: '1909' } });
      fireEvent.change(screen.getByTestId('coin-search-country'), { target: { value: 'Ukraine' } });
      await user.click(screen.getByTestId('coin-search-submit'));

      await waitFor(() => {
        expect(getCatalogMock).toHaveBeenCalledWith({ yearMin: 1909, yearMax: 1909, country: 'Ukraine', limit: 50 });
      });
    });

    it('omits the year bounds when the year is blank and the country when it is blank', async () => {
      const user = userEvent.setup();
      renderPicker({ initialYear: null, initialCountry: '' });

      await user.click(screen.getByTestId('coin-search-submit'));

      await waitFor(() => {
        expect(getCatalogMock).toHaveBeenCalledTimes(1);
      });
      const filters = getCatalogMock.mock.calls[0][0] ?? {};
      expect(filters.yearMin).toBeUndefined();
      expect(filters.yearMax).toBeUndefined();
      expect(filters.country).toBeUndefined();
      expect(filters.limit).toBe(50);
    });

    it('shows the loading indicator while the request is pending', async () => {
      const user = userEvent.setup();
      let resolve: (value: ReturnType<typeof page>) => void = () => undefined;
      getCatalogMock.mockReturnValue(new Promise((r) => (resolve = r)));
      renderPicker({ initialYear: 1950, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-submit'));
      expect(await screen.findByTestId('coin-search-loading')).toBeInTheDocument();

      resolve(page([makeCoin()]));
      await waitFor(() => {
        expect(screen.queryByTestId('coin-search-loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('results', () => {
    it('renders one result per coin, labelled with formatImportCoinLabel and tagged with data-coin-id', async () => {
      const user = userEvent.setup();
      getCatalogMock.mockResolvedValue(
        page([
          makeCoin({ id: 'coin-1', year: 1909, mintMark: 'S', variety: 'VDB' }),
          makeCoin({ id: 'coin-2', year: 1950, mintMark: '', variety: '' }),
        ]),
      );
      renderPicker({ initialYear: 1909, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-submit'));

      const results = await screen.findAllByTestId('coin-search-result');
      expect(results).toHaveLength(2);
      expect(results[0]).toHaveTextContent('USA Cent (1909 S), VDB');
      expect(results[1]).toHaveTextContent('USA Cent (1950)');
      expect(buttonIn(results[0]).getAttribute('data-coin-id') ?? results[0].getAttribute('data-coin-id')).toBe(
        'coin-1',
      );
      expect(buttonIn(results[1]).getAttribute('data-coin-id') ?? results[1].getAttribute('data-coin-id')).toBe(
        'coin-2',
      );
      expect(screen.queryByTestId('coin-search-empty')).not.toBeInTheDocument();
    });

    it('calls onPick with an ImportCoinSummary (owned false) for the clicked result', async () => {
      const user = userEvent.setup();
      getCatalogMock.mockResolvedValue(
        page([
          makeCoin({ id: 'coin-1', year: 1909, mintMark: 'S', variety: 'VDB', name: 'Lincoln Wheat Cent' }),
          makeCoin({ id: 'coin-2', year: 1950, mintMark: 'D', variety: '', name: 'Lincoln Wheat Cent' }),
        ]),
      );
      const { onPick } = renderPicker({ initialYear: 1909, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-submit'));
      const results = await screen.findAllByTestId('coin-search-result');
      await user.click(buttonIn(results[1]));

      expect(onPick).toHaveBeenCalledTimes(1);
      expect(onPick).toHaveBeenCalledWith({
        id: 'coin-2',
        country: 'USA',
        denomination: 'Cent',
        year: 1950,
        mintMark: 'D',
        variety: '',
        name: 'Lincoln Wheat Cent',
        owned: false,
      });
    });

    it('shows the empty state when nothing is found', async () => {
      const user = userEvent.setup();
      getCatalogMock.mockResolvedValue(page([]));
      renderPicker({ initialYear: 1999, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-submit'));

      expect(await screen.findByTestId('coin-search-empty')).toHaveTextContent('No coins found.');
      expect(screen.queryByTestId('coin-search-result')).not.toBeInTheDocument();
    });
  });

  describe('cancel', () => {
    it('calls onCancel and does not search', async () => {
      const user = userEvent.setup();
      const { onCancel, onPick } = renderPicker({ initialYear: 1950, initialCountry: 'USA' });

      await user.click(screen.getByTestId('coin-search-cancel'));

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onPick).not.toHaveBeenCalled();
      expect(getCatalogMock).not.toHaveBeenCalled();
    });
  });
});
