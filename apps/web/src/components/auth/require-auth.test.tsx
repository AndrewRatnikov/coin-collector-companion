/**
 * Tests for: RequireAuth
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Component: RequireAuth
 * Covers criteria: #5, #6 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RequireAuth } from '@/components/auth/require-auth';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
  });

  describe('criterion 5: renders protected content when a token is present', () => {
    it('renders children once the token check resolves to authorized', async () => {
      setStoredToken('tok-abc');
      render(
        <RequireAuth>
          <div data-testid="protected-content">secret</div>
        </RequireAuth>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(replaceMock).not.toHaveBeenCalled();
    });

    it('does not show the pending state once authorized', async () => {
      setStoredToken('tok-abc');
      render(
        <RequireAuth>
          <div data-testid="protected-content">secret</div>
        </RequireAuth>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('require-auth-pending')).not.toBeInTheDocument();
    });
  });

  describe('criterion 5/6: redirects to /login and withholds content when no token is present', () => {
    it('never renders children when there is no stored token', async () => {
      render(
        <RequireAuth>
          <div data-testid="protected-content">secret</div>
        </RequireAuth>,
      );

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });

    it('renders the require-auth-pending state when there is no stored token', async () => {
      render(
        <RequireAuth>
          <div data-testid="protected-content">secret</div>
        </RequireAuth>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('require-auth-pending')).toBeInTheDocument();
      });
    });
  });
});
