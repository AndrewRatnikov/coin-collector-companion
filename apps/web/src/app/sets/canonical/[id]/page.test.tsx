/**
 * Tests for: CanonicalSetDetailPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CanonicalSetDetailPage
 * Covers criteria: #9 (from prd.md)
 *
 * Like CoinDetailPage, this page unwraps a Promise `params` prop via React's `use()`,
 * which suspends on first render — rendered here inside a <Suspense> boundary for the
 * same reason (no app-level Suspense exists under a raw RTL render()).
 */

import { Suspense } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import CanonicalSetDetailPage from '@/app/sets/canonical/[id]/page';
import { useCanonicalSet } from '@/lib/hooks/use-canonical-sets';
import { getStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSet: vi.fn(),
}));

vi.mock('@/lib/auth-token', () => ({
  getStoredToken: vi.fn(),
}));

const useCanonicalSetMock = vi.mocked(useCanonicalSet);
const getStoredTokenMock = vi.mocked(getStoredToken);

function queryResult(overrides: Partial<ReturnType<typeof useCanonicalSet>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCanonicalSet>;
}

function renderPage(id = 'set-1') {
  return render(
    <Suspense fallback={<div />}>
      <CanonicalSetDetailPage params={Promise.resolve({ id })} />
    </Suspense>,
  );
}

const DETAIL = {
  id: 'set-1',
  name: 'Lincoln Wheat Cents',
  description: 'Every wheat cent year',
  source: 'seed-template',
  templateVersion: 'v1',
  coins: [
    { id: 'usc-2', position: 1, coin: { id: 'coin-2', country: 'USA', denomination: '1 Cent', year: 1958, mintMark: '' } },
    { id: 'usc-1', position: 0, coin: { id: 'coin-1', country: 'USA', denomination: '1 Cent', year: 1909, mintMark: 'S' } },
  ],
};

describe('CanonicalSetDetailPage', () => {
  beforeEach(() => {
    useCanonicalSetMock.mockReset();
    getStoredTokenMock.mockReset();
    getStoredTokenMock.mockReturnValue(null);
  });

  describe('criterion 9: shows a loading state while the query is loading', () => {
    it('renders canonical-set-detail-loading while isLoading is true', async () => {
      useCanonicalSetMock.mockReturnValue(queryResult({ isLoading: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('canonical-set-detail-loading')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 9: shows an error state when the query fails', () => {
    it('renders canonical-set-detail-error when isError is true', async () => {
      useCanonicalSetMock.mockReturnValue(queryResult({ isError: true }));
      renderPage();

      await waitFor(() => {
        expect(screen.getByTestId('canonical-set-detail-error')).toBeInTheDocument();
      });
    });
  });

  describe('criterion 9: renders name, description, and the coin list ordered by position', () => {
    it('sorts coins by position ascending regardless of API array order', async () => {
      useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('canonical-set-detail-name')).toHaveTextContent('Lincoln Wheat Cents');
      });
      expect(screen.getByTestId('canonical-set-detail-page')).toBeInTheDocument();
      expect(screen.getByTestId('canonical-set-detail-description')).toHaveTextContent('Every wheat cent year');
      expect(screen.getByTestId('canonical-set-coin-list')).toBeInTheDocument();

      const items = screen.getAllByTestId('canonical-set-coin-item');
      expect(items).toHaveLength(2);
      expect(within(items[0]).getByText('USA 1 Cent (1909 S)')).toBeInTheDocument();
      expect(within(items[1]).getByText('USA 1 Cent (1958)')).toBeInTheDocument();
      expect(useCanonicalSetMock).toHaveBeenCalledWith('set-1');
    });
  });

  describe('criterion 9 / criterion 10: page itself renders anonymously; only the clone CTA is auth-gated', () => {
    it('is entirely absent from the DOM when no token is stored, while the rest of the page still renders (page is not auth-gated, only the CTA is)', async () => {
      getStoredTokenMock.mockReturnValue(null);
      useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('canonical-set-detail-name')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('canonical-set-clone-cta')).not.toBeInTheDocument();
    });

    it('is present and links to /sets/new with the source pre-filled when a token is stored', async () => {
      getStoredTokenMock.mockReturnValue('tok-abc');
      useCanonicalSetMock.mockReturnValue(queryResult({ data: DETAIL as never }));
      renderPage('set-1');

      await waitFor(() => {
        expect(screen.getByTestId('canonical-set-clone-cta')).toBeInTheDocument();
      });
      const href = screen.getByTestId('canonical-set-clone-cta').getAttribute('href');
      expect(href).toBe('/sets/new?cloneFrom=canonical&cloneFromId=set-1');
    });
  });
});
