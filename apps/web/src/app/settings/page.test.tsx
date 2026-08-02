/**
 * Tests for: SettingsPage
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Page: SettingsPage (CREATE)
 * Covers criteria: #5, #6, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useCurrentUser (apps/web/src/lib/hooks/use-current-user.ts) is mocked entirely, following
 * collection/page.test.tsx's established convention of mocking a page's data hook directly
 * rather than rendering through a real QueryClientProvider — this file only proves the page
 * renders the right testid/content for each query state, not react-query's own internals
 * (which use-collection.test.tsx-style hook tests would cover; plan.md's Files-changed table
 * does not include a dedicated use-current-user.test.ts file for this run, so hook-level
 * delegation to getCurrentUser() is not separately re-tested here — it's covered by
 * auth-api.test.ts's getCurrentUser() coverage instead).
 *
 * RequireAuth itself is not mocked — real localStorage token presence/absence (via
 * setStoredToken/localStorage.clear, same as collection/page.test.tsx) drives its
 * authorized/redirecting behavior, exercising criterion #6 end-to-end through the real guard.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SettingsPage from '@/app/settings/page';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(),
}));

const useCurrentUserMock = vi.mocked(useCurrentUser);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

const CURRENT_USER = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  email: 'collector@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    useCurrentUserMock.mockReset();
    useCurrentUserMock.mockReturnValue(queryResult());
  });

  describe('criterion 6: auth gating', () => {
    it('does not render settings-page and redirects to /login when no token is present', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('settings-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion 5: loading and error states', () => {
    it('renders settings-loading while the query is loading', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-loading')).toBeInTheDocument();
      });
    });

    it('renders settings-error when the query fails', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ isError: true }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-error')).toBeInTheDocument();
      });
    });
  });

  describe('criteria #5, #9: account-info block renders the email and member-since date', () => {
    it('renders settings-account-info with the email and member-since date from getCurrentUser', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-account-info')).toBeInTheDocument();
      });
      const emailEl = screen.getByTestId('settings-email');
      const memberSinceEl = screen.getByTestId('settings-member-since');
      expect(emailEl).toHaveTextContent('collector@example.com');
      expect(memberSinceEl).toHaveTextContent(new Date(CURRENT_USER.createdAt).toLocaleDateString());
    });

    it('does not render the account-info block while loading or on error', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ isLoading: true }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-loading')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('settings-account-info')).not.toBeInTheDocument();
    });
  });

  describe('criterion 5: renders the settings-page root once authenticated', () => {
    it('renders the settings-page testid when a token is present', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });
    });
  });
});
