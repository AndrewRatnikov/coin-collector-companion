/**
 * Tests for: MySubmissionsPage
 * Contract source: runs/run_20260731_132040/plan.md § Interface Contract → Component: MySubmissionsPage (CREATE)
 *                   runs/run_20261001_224939/plan.md § Interface Contract → Page: MySubmissionsPage (MODIFY)
 * Covers criteria: #6, #7 (partially — nav link itself covered in site-nav.test.tsx), #8, #9 (from run_20260731_132040's prd.md),
 *                  #22 (from run_20261001_224939's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useMySubmissions is mocked entirely — this file only proves the page renders the right
 * testids/content for each query state and status value. No real network/DB call.
 *
 * run_20261001_224939: only the new describe block "criterion #22: rejection reason" at the end is
 * added; every existing block is unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

  describe('run_20261001_224939 criterion #22: rejection reason', () => {
    it('shows the reason with its label inside a rejected row when a reason is present', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({
          data: {
            items: [{ ...REJECTED_COIN, rejectionReason: 'Photo is too blurry to verify' }],
            page: 1,
            limit: 20,
            total: 1,
          },
        }),
      );
      render(<MySubmissionsPage />);

      const item = await screen.findByTestId('my-submissions-item');
      const reason = within(item).getByTestId('my-submissions-rejection-reason');
      expect(reason).toHaveTextContent('Reason:');
      expect(reason).toHaveTextContent('Photo is too blurry to verify');
    });

    it('shows nothing extra on a rejected row when the reason is null', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({ data: { items: [{ ...REJECTED_COIN, rejectionReason: null }], page: 1, limit: 20, total: 1 } }),
      );
      render(<MySubmissionsPage />);

      await screen.findByTestId('my-submissions-item');
      expect(screen.queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
    });

    it('shows nothing extra on a rejected row when the reason is an empty string', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({ data: { items: [{ ...REJECTED_COIN, rejectionReason: '' }], page: 1, limit: 20, total: 1 } }),
      );
      render(<MySubmissionsPage />);

      await screen.findByTestId('my-submissions-item');
      expect(screen.queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
    });

    it('shows nothing extra on a rejected row when the reason key is absent', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(queryResult({ data: { items: [REJECTED_COIN], page: 1, limit: 20, total: 1 } }));
      render(<MySubmissionsPage />);

      await screen.findByTestId('my-submissions-item');
      expect(screen.queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
    });

    it('does not show a reason on a pending or approved row, even if one were present', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({
          data: {
            items: [
              { ...PENDING_COIN, rejectionReason: 'stray reason on pending' },
              { ...APPROVED_COIN, rejectionReason: 'stray reason on approved' },
            ],
            page: 1,
            limit: 20,
            total: 2,
          },
        }),
      );
      render(<MySubmissionsPage />);

      await screen.findAllByTestId('my-submissions-item');
      expect(screen.queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
      expect(screen.queryByText('stray reason on pending', { exact: false })).not.toBeInTheDocument();
      expect(screen.queryByText('stray reason on approved', { exact: false })).not.toBeInTheDocument();
    });

    it('scopes each reason to its own row in a mixed list', async () => {
      setStoredToken('tok-abc');
      useMySubmissionsMock.mockReturnValue(
        queryResult({
          data: {
            items: [
              { ...PENDING_COIN, rejectionReason: null },
              { ...REJECTED_COIN, id: 'coin-rejected-a', rejectionReason: 'First reason' },
              { ...REJECTED_COIN, id: 'coin-rejected-b', year: 1938, rejectionReason: null },
              { ...REJECTED_COIN, id: 'coin-rejected-c', year: 1939, rejectionReason: 'Third reason' },
            ],
            page: 1,
            limit: 20,
            total: 4,
          },
        }),
      );
      render(<MySubmissionsPage />);

      const items = await screen.findAllByTestId('my-submissions-item');
      expect(items).toHaveLength(4);
      expect(within(items[0]).queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
      expect(within(items[1]).getByTestId('my-submissions-rejection-reason')).toHaveTextContent('First reason');
      expect(within(items[2]).queryByTestId('my-submissions-rejection-reason')).not.toBeInTheDocument();
      expect(within(items[3]).getByTestId('my-submissions-rejection-reason')).toHaveTextContent('Third reason');
      expect(within(items[3]).getByTestId('my-submissions-rejection-reason')).not.toHaveTextContent('First reason');
      expect(screen.getAllByTestId('my-submissions-rejection-reason')).toHaveLength(2);
    });
  });
});
