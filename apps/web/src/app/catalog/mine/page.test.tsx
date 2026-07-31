/**
 * Tests for: MySubmissionsPage
 * Contract source: runs/run_20260731_132040/plan.md § Interface Contract → Component: MySubmissionsPage (CREATE)
 * Covers criteria: #6, #7 (partially — nav link itself covered in site-nav.test.tsx), #8, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useMySubmissions is mocked entirely — this file only proves the page renders the right
 * testids/content for each query state and status value. No real network/DB call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MySubmissionsPage from '@/app/catalog/mine/page';
import { useMySubmissions } from '@/lib/hooks/use-catalog';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useMySubmissions: vi.fn(),
}));

const useMySubmissionsMock = vi.mocked(useMySubmissions);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

const PENDING_COIN = {
  id: 'coin-pending-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1943,
  mintMark: 'D',
  variety: 'Steel',
  name: 'Lincoln Wheat Cent',
  status: 'pending',
};

const APPROVED_COIN = {
  id: 'coin-approved-1',
  country: 'USA',
  denomination: '1 Cent',
  year: 1909,
  mintMark: 'S',
  variety: '',
  name: 'Lincoln Wheat Cent',
  status: 'approved',
};

const REJECTED_COIN = {
  id: 'coin-rejected-1',
  country: 'Canada',
  denomination: '5 Cents',
  year: 1937,
  mintMark: '',
  variety: '',
  name: 'Beaver Nickel',
  status: 'rejected',
};

describe('MySubmissionsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    useMySubmissionsMock.mockReset();
    useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
  });

  describe('auth gating (criterion #9)', () => {
    it('does not render my-submissions-page and redirects to /login when no token is present', async () => {
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('my-submissions-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion #6: loading, error, and empty states', () => {
    it('renders my-submissions-loading while the query is loading', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('my-submissions-loading')).toBeInTheDocument();
      });
    });

    it('renders my-submissions-error when the query fails', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ isError: true }));
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('my-submissions-error')).toBeInTheDocument();
      });
    });

    it('renders my-submissions-empty when the user has no submissions', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [], page: 1, limit: 20, total: 0 } }));
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('my-submissions-empty')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('my-submissions-list')).not.toBeInTheDocument();
    });
  });

  describe('criterion #6: renders a mixed-status list with the correct badge per status', () => {
    it('renders one my-submissions-item per submission, regardless of status', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({ data: { items: [PENDING_COIN, APPROVED_COIN, REJECTED_COIN], page: 1, limit: 20, total: 3 } }),
      );
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(screen.getAllByTestId('my-submissions-item')).toHaveLength(3);
      });
    });

    it('shows the "Pending review" badge for a pending submission', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [PENDING_COIN], page: 1, limit: 20, total: 1 } }));
      render(<MySubmissionsPage />);

      const badge = await screen.findByTestId('my-submissions-status-badge');
      expect(badge).toHaveTextContent('Pending review');
    });

    it('shows the "Approved" badge for an approved submission', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [APPROVED_COIN], page: 1, limit: 20, total: 1 } }));
      render(<MySubmissionsPage />);

      const badge = await screen.findByTestId('my-submissions-status-badge');
      expect(badge).toHaveTextContent('Approved');
    });

    it('shows the "Not approved" badge for a rejected submission', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [REJECTED_COIN], page: 1, limit: 20, total: 1 } }));
      render(<MySubmissionsPage />);

      const badge = await screen.findByTestId('my-submissions-status-badge');
      expect(badge).toHaveTextContent('Not approved');
    });

    it('renders three distinct badge texts when statuses are mixed, in list order (no status confusion between rows)', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({ data: { items: [PENDING_COIN, APPROVED_COIN, REJECTED_COIN], page: 1, limit: 20, total: 3 } }),
      );
      render(<MySubmissionsPage />);

      const badges = await screen.findAllByTestId('my-submissions-status-badge');
      expect(badges).toHaveLength(3);
      expect(badges[0]).toHaveTextContent('Pending review');
      expect(badges[1]).toHaveTextContent('Approved');
      expect(badges[2]).toHaveTextContent('Not approved');
    });
  });

  describe('criterion #8: each row links to the coin\'s own catalog detail page, not a set', () => {
    it('links a submission row to /catalog/:id', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [PENDING_COIN], page: 1, limit: 20, total: 1 } }));
      render(<MySubmissionsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('my-submissions-item')).toBeInTheDocument();
      });
      // Label format follows the same formatCoinLabel(coin) convention as collection/page.tsx:
      // "{country} {denomination} ({year} {mintMark})"
      const link = screen.getByRole('link', { name: 'USA 1 Cent (1943 D)' });
      expect(link.getAttribute('href')).toBe('/catalog/coin-pending-1');
    });
  });
});
