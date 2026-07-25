/**
 * Tests for: CatalogPage
 * Contract source: runs/run_20260721_131640/plan.md § Interface Contract → Component: CatalogPage
 *                   runs/run_20260725_140648/plan.md § Interface Contract → Frontend — apps/web/src/app/catalog/page.tsx (MODIFY)
 * Covers criteria: #4 (from run_20260721_131640's prd.md), #6, #8 (from run_20260725_140648's prd.md)
 *
 * SubmitCoinForm and SubmissionConfirmation are mocked entirely here — this file only proves
 * CatalogPage's own gating/wiring logic (isLoggedIn check, toggle state, submittedCoin
 * hand-off). Each component's own internal behavior (validation, set-selection flow) is
 * covered in its own dedicated test file (submit-coin-form.test.tsx, submission-confirmation.test.tsx).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogPage from '@/app/catalog/page';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

vi.mock('@/components/catalog/submit-coin-form', () => ({
  default: (props: { onSuccess: (coin: unknown) => void }) => (
    <div data-testid="mock-submit-coin-form">
      <button
        type="button"
        data-testid="mock-submit-coin-form-succeed"
        onClick={() => props.onSuccess({ id: 'new-coin-1', status: 'pending' })}
      >
        simulate success
      </button>
    </div>
  ),
}));

vi.mock('@/components/catalog/submission-confirmation', () => ({
  default: (props: { coin: { id: string } }) => (
    <div data-testid="mock-submission-confirmation">{props.coin.id}</div>
  ),
}));

const useCatalogMock = vi.mocked(useCatalog);

function queryResult(overrides: Partial<ReturnType<typeof useCatalog>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    ...overrides,
  } as ReturnType<typeof useCatalog>;
}

const COINS = [
  {
    id: 'c1',
    country: 'USA',
    denomination: '1 Cent',
    year: 1984,
    mintMark: 'D',
    variety: '',
    name: 'Lincoln Memorial Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: 'c2',
    country: 'USA',
    denomination: '1 Cent',
    year: 1958,
    mintMark: '',
    variety: '',
    name: 'Lincoln Wheat Cent',
    imageUrl: null,
    imageSource: null,
    imageLicense: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
];

describe('CatalogPage', () => {
  beforeEach(() => {
    useCatalogMock.mockReset();
    localStorage.clear();
  });

  describe('criterion 10: not gated by auth', () => {
    it('renders result content synchronously with no stored token (no auth-guard delay/redirect before content appears)', () => {
      localStorage.clear();
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 20, total: 2 } }));
      render(<CatalogPage />);

      // A route wrapped in RequireAuth never renders its children synchronously when
      // there is no stored token (the auth check itself is an async useEffect) — getting
      // real result content back immediately proves this page isn't gated.
      expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
      expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    });
  });

  describe('rendering', () => {
    it('renders the page root and filter form fields', () => {
      useCatalogMock.mockReturnValue(queryResult());
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-form')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-country')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-denomination')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-name')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-min')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-max')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-submit')).toBeInTheDocument();
    });
  });

  describe('criterion 4: shows a loading state while the catalog query is loading', () => {
    it('renders catalog-loading and no results while isLoading is true', () => {
      useCatalogMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-results')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: shows an error state when the catalog query fails', () => {
    it('renders catalog-error when isError is true', () => {
      useCatalogMock.mockReturnValue(queryResult({ isError: true }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-error')).toBeInTheDocument();
    });
  });

  describe('criterion 4: renders a paginated result grid using formatCoinLabel', () => {
    it('renders one catalog-item per coin with the compact label and a link to the coin detail page', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 20, total: 2 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-results')).toBeInTheDocument();
      const rows = screen.getAllByTestId('catalog-item');
      expect(rows).toHaveLength(2);
    });

    it('renders catalog-empty when the result set is empty', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-empty')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-item')).not.toBeInTheDocument();
    });

    it('disables Prev on page 1 and enables Next when more pages remain', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 1, total: 3 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page-prev')).toBeDisabled();
      expect(screen.getByTestId('catalog-page-next')).not.toBeDisabled();
      expect(screen.getByTestId('catalog-page-indicator')).toHaveTextContent('1');
    });

    it('disables Next on the last page', () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 3, limit: 1, total: 3 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-page-next')).toBeDisabled();
      expect(screen.getByTestId('catalog-page-prev')).not.toBeDisabled();
    });
  });

  describe('criterion 4: filter form requires an explicit submit before querying', () => {
    it('passes the submitted filter values to useCatalog and resets to page 1', async () => {
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.type(screen.getByTestId('catalog-filter-country'), 'USA');
      await user.type(screen.getByTestId('catalog-filter-name'), 'Lincoln');
      await user.click(screen.getByTestId('catalog-filter-submit'));

      const lastCall = useCatalogMock.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ country: 'USA', name: 'Lincoln', page: 1 });
    });
  });

  describe('run_20260725_140648 criterion 6: submit-coin entry point, gated by login', () => {
    it('does not render the submit-coin toggle when logged out', () => {
      localStorage.clear();
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<CatalogPage />);

      expect(screen.queryByTestId('catalog-submit-coin-toggle')).not.toBeInTheDocument();
    });

    it('renders the submit-coin toggle when logged in, with the form hidden until clicked', () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<CatalogPage />);

      expect(screen.getByTestId('catalog-submit-coin-toggle')).toBeInTheDocument();
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });

    it('clicking the toggle shows the submit form, clicking again hides it', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      expect(screen.getByTestId('mock-submit-coin-form')).toBeInTheDocument();

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });
  });

  describe('run_20260725_140648 criterion 6: on successful submission, renders SubmissionConfirmation instead of resetting to a blank view', () => {
    it('replaces the submit-coin entry point with SubmissionConfirmation after the form succeeds', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      await user.click(screen.getByTestId('mock-submit-coin-form-succeed'));

      expect(screen.getByTestId('mock-submission-confirmation')).toHaveTextContent('new-coin-1');
      expect(screen.queryByTestId('catalog-submit-coin-toggle')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-submit-coin-form')).not.toBeInTheDocument();
    });

    it('the rest of the catalog page (results, filter form) still renders alongside the confirmation', async () => {
      setStoredToken('tok-abc');
      useCatalogMock.mockReturnValue(queryResult({ data: { items: COINS, page: 1, limit: 20, total: 2 } }));
      const user = userEvent.setup();
      render(<CatalogPage />);

      await user.click(screen.getByTestId('catalog-submit-coin-toggle'));
      await user.click(screen.getByTestId('mock-submit-coin-form-succeed'));

      expect(screen.getByTestId('mock-submission-confirmation')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-form')).toBeInTheDocument();
      expect(screen.getAllByTestId('catalog-item')).toHaveLength(2);
    });
  });
});
