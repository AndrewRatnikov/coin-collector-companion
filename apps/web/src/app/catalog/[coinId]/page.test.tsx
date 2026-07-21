/**
 * Tests for: CoinDetailPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CoinDetailPage
 * Covers criteria: #5 (from prd.md)
 *
 * CoinDetailPage unwraps its `params` prop (a Promise, per the Next.js 16 App Router
 * contract) via React's `use()`, which suspends on first render. Rendering it directly
 * with RTL therefore needs a <Suspense> boundary in the test itself — the app-level
 * Suspense boundaries Next.js provides in real navigation don't exist under a raw
 * render() call.
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import CoinDetailPage from '@/app/catalog/[coinId]/page';
import { useCoin } from '@/lib/hooks/use-catalog';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCoin: vi.fn(),
}));

const useCoinMock = vi.mocked(useCoin);

function queryResult(overrides: Partial<ReturnType<typeof useCoin>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCoin>;
}

function renderPage(coinId = 'coin-1') {
  return render(
    <Suspense fallback={<div data-testid="suspense-fallback" />}>
      <CoinDetailPage params={Promise.resolve({ coinId })} />
    </Suspense>,
  );
}

const COIN_WITH_IMAGE = {
  id: 'coin-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1984,
  mintMark: 'D',
  variety: 'Type 2',
  name: 'Lincoln Memorial Cent',
  imageUrl: 'https://upload.wikimedia.org/coin.jpg',
  imageSource: 'Wikimedia Commons',
  imageLicense: 'CC BY-SA 4.0',
};

const COIN_NO_IMAGE = { ...COIN_WITH_IMAGE, imageUrl: null, imageSource: null, imageLicense: null };

describe('CoinDetailPage', () => {
  beforeEach(() => {
    useCoinMock.mockReset();
  });

  describe('criterion 5: shows a loading state while the coin query is loading', () => {
    it('renders coin-detail-loading while isLoading is true', async () => {
      useCoinMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-loading')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: shows an error state when the coin query fails', () => {
    it('renders coin-detail-error when isError is true', async () => {
      useCoinMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 5: renders full identity fields', () => {
    it('renders country/denomination/year/mintMark/variety and the compact label', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage('coin-1');

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toHaveTextContent('USA 1 Cent (1984 D)');
      });
      expect(screen.getByTestId('coin-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('coin-detail-country')).toHaveTextContent('USA');
      expect(screen.getByTestId('coin-detail-denomination')).toHaveTextContent('1 Cent');
      expect(screen.getByTestId('coin-detail-year')).toHaveTextContent('1984');
      expect(screen.getByTestId('coin-detail-mint-mark')).toHaveTextContent('D');
      expect(screen.getByTestId('coin-detail-variety')).toHaveTextContent('Type 2');
      expect(useCoinMock).toHaveBeenCalledWith('coin-1');
    });
  });

  describe('criterion 5: per-image attribution', () => {
    it('renders the image and its imageSource/imageLicense credit when imageUrl is set', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_WITH_IMAGE as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-image')).toBeInTheDocument();
      });
      const attribution = screen.getByTestId('coin-detail-attribution');
      expect(attribution).toHaveTextContent('Wikimedia Commons');
      expect(attribution).toHaveTextContent('CC BY-SA 4.0');
    });

    it('omits the image and attribution when imageUrl is null', async () => {
      useCoinMock.mockReturnValue(queryResult({ data: COIN_NO_IMAGE as never }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('coin-detail-label')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('coin-detail-image')).not.toBeInTheDocument();
      expect(screen.queryByTestId('coin-detail-attribution')).not.toBeInTheDocument();
    });
  });
});
