/**
 * Tests for: DashboardPage (placeholder)
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Page: Dashboard (placeholder)
 * Covers criteria: #5 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
  });

  describe('criterion 5: wrapped in RequireAuth', () => {
    it('renders the dashboard placeholder when a token is present', async () => {
      setStoredToken('tok-abc');
      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('does not render the dashboard placeholder and redirects to /login when no token is present', async () => {
      render(<DashboardPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    });
  });
});
