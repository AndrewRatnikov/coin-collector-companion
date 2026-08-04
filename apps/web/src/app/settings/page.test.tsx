/**
 * Tests for: SettingsPage
 * Contract source: runs/run_20260802_172836/plan.md § Interface Contract → Page: SettingsPage (CREATE)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Component: ChangePasswordForm (CREATE, inline)
 *                   runs/run_20260804_165504/plan.md § Interface Contract → Page: SettingsPage (Account tab) — apps/web/src/app/settings/page.tsx (MODIFY)
 * Covers criteria: #5, #6, #9 (from run_20260802_172836's prd.md), #6, #7, #9 (from run_20260802_183303's prd.md), #1 (from run_20260804_165504's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useCurrentUser (apps/web/src/lib/hooks/use-current-user.ts) is mocked entirely, following
 * collection/page.test.tsx's established convention of mocking a page's data hook directly
 * rather than rendering through a real QueryClientProvider — this file only proves the page
 * renders the right testid/content for each query state, not react-query's own internals.
 *
 * RequireAuth itself is not mocked — real localStorage token presence/absence (via
 * setStoredToken/localStorage.clear, same as collection/page.test.tsx) drives its
 * authorized/redirecting behavior, exercising criterion #6 (run_20260802_172836) end-to-end
 * through the real guard.
 *
 * run_20260802_183303: adds changePassword coverage (new describe blocks below). `changePassword`
 * from '@/lib/auth-api' is mocked (same technique as login/page.test.tsx mocking `login`) — no
 * real network call. Every existing describe block above is carried over byte-identical.
 *
 * run_20260804_165504: SettingsPage now renders <SettingsTabs /> (apps/web/src/components/layout/settings-tabs.tsx),
 * which calls next/navigation's usePathname(). The previous `vi.mock('next/navigation', ...)`
 * in this file replaced the whole module with only `useRouter` exported, which would make
 * every existing test below throw once SettingsTabs mounts — the mock is extended here to
 * also export `usePathname`, same convention as apps/web/src/components/layout/site-nav.test.tsx.
 * Every existing describe block below is otherwise carried over byte-identical; only a new
 * "criterion #1" describe block is added at the end.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { changePassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();
const usePathnameMock = vi.fn(() => '/settings');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  usePathname: () => usePathnameMock(),
}));

vi.mock('@/lib/hooks/use-current-user', () => ({
  useCurrentUser: vi.fn(),
}));

vi.mock('@/lib/auth-api', () => ({
  changePassword: vi.fn(),
}));

const useCurrentUserMock = vi.mocked(useCurrentUser);
const changePasswordMock = vi.mocked(changePassword);

function queryResult(overrides: Record<string, unknown> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as never;
}

const CURRENT_USER = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  email: 'collector@example.com',
  createdAt: '2026-01-01T00:00:00.000Z',
};

async function fillAndSubmitChangePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string = newPassword,
) {
  const user = userEvent.setup();
  const currentPasswordInput = document.getElementById('currentPassword') as HTMLInputElement;
  const newPasswordInput = document.getElementById('newPassword') as HTMLInputElement;
  const confirmNewPasswordInput = document.getElementById('confirmNewPassword') as HTMLInputElement;
  await user.type(currentPasswordInput, currentPassword);
  await user.type(newPasswordInput, newPassword);
  await user.type(confirmNewPasswordInput, confirmNewPassword);
  await user.click(screen.getByTestId('settings-change-password-submit'));
}

describe('SettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    usePathnameMock.mockClear();
    usePathnameMock.mockReturnValue('/settings');
    useCurrentUserMock.mockReset();
    useCurrentUserMock.mockReturnValue(queryResult());
    changePasswordMock.mockReset();
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

  describe('criterion 6 (run_20260802_183303): change-password form renders below account-info', () => {
    it('renders the settings-change-password-form once authenticated', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });
      expect(document.getElementById('currentPassword')).toBeInTheDocument();
      expect(document.getElementById('newPassword')).toBeInTheDocument();
      expect(document.getElementById('confirmNewPassword')).toBeInTheDocument();
    });
  });

  describe('criteria #7, #9 (run_20260802_183303): change-password happy path', () => {
    it('calls changePassword with the entered values and shows a success message', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      changePasswordMock.mockResolvedValue(undefined);
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });

      await fillAndSubmitChangePassword('oldpassword123', 'newpassword123');

      expect(changePasswordMock).toHaveBeenCalledWith('oldpassword123', 'newpassword123');
      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-success')).toBeInTheDocument();
      });
    });

    it('does not throw an unhandled exception on a successful submission', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      changePasswordMock.mockResolvedValue(undefined);
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });

      await expect(fillAndSubmitChangePassword('oldpassword123', 'newpassword123')).resolves.not.toThrow();
    });
  });

  describe('criteria #2, #7, #9 (run_20260802_183303): wrong current password shows an inline error', () => {
    it('shows a form-level error and does NOT redirect to /login on a 401 rejection', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      changePasswordMock.mockRejectedValue(
        new ApiError(401, 'Current password is incorrect', ['Current password is incorrect']),
      );
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });

      await fillAndSubmitChangePassword('wrongpassword', 'newpassword123');

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-error')).toHaveTextContent('Current password is incorrect');
      });
      expect(replaceMock).not.toHaveBeenCalledWith('/login');
      expect(screen.queryByTestId('settings-change-password-success')).not.toBeInTheDocument();
    });

    it('does not clear the account-info block when the change-password submission fails', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      changePasswordMock.mockRejectedValue(
        new ApiError(401, 'Current password is incorrect', ['Current password is incorrect']),
      );
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });

      await fillAndSubmitChangePassword('wrongpassword', 'newpassword123');

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-error')).toBeInTheDocument();
      });
      expect(screen.getByTestId('settings-account-info')).toBeInTheDocument();
    });
  });

  describe('confirm-new-password mismatch', () => {
    it('shows a mismatch error on both fields and does not call changePassword', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-change-password-form')).toBeInTheDocument();
      });

      await fillAndSubmitChangePassword('oldpassword123', 'newpassword123', 'somethingelse123');

      await waitFor(() => {
        expect(document.getElementById('confirmNewPassword-error')?.textContent).toBe('Passwords do not match');
      });
      expect(document.getElementById('newPassword-error')?.textContent).toBe('Passwords do not match');
      expect(document.getElementById('newPassword')).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById('confirmNewPassword')).toHaveAttribute('aria-invalid', 'true');
      expect(changePasswordMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion #1 (run_20260804_165504): renders SettingsTabs with the account tab active', () => {
    it('renders settings-tabs with both tab links once authenticated', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-tabs')).toBeInTheDocument();
      });
      expect(screen.getByTestId('settings-tab-account')).toBeInTheDocument();
      expect(screen.getByTestId('settings-tab-feedback')).toBeInTheDocument();
    });

    it('marks the account tab as the current page via aria-current, not the feedback tab', async () => {
      setStoredToken('tok-abc');
      useCurrentUserMock.mockReturnValue(queryResult({ data: CURRENT_USER }));
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-tab-account')).toHaveAttribute('aria-current', 'page');
      });
      expect(screen.getByTestId('settings-tab-feedback')).not.toHaveAttribute('aria-current');
    });
  });
});
