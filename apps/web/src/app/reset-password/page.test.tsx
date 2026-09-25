/**
 * Tests for: ResetPasswordPage (backlog_password-management.md Step 3, task 3.11).
 * `resetPassword` from '@/lib/auth-api' and next/navigation are mocked; the token comes from
 * a mutable URLSearchParams value, same technique as sets/new/page.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '@/app/reset-password/page';
import { resetPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';

const pushMock = vi.fn();
let searchParamsValue = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  useSearchParams: () => searchParamsValue,
}));

vi.mock('@/lib/auth-api', () => ({
  resetPassword: vi.fn(),
}));

const resetPasswordMock = vi.mocked(resetPassword);

async function submitPasswords(newPassword: string, confirmPassword: string) {
  const user = userEvent.setup();
  await user.type(document.getElementById('newPassword') as HTMLInputElement, newPassword);
  await user.type(document.getElementById('confirmPassword') as HTMLInputElement, confirmPassword);
  await user.click(screen.getByTestId('reset-password-submit'));
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    resetPasswordMock.mockReset();
    searchParamsValue = new URLSearchParams({ token: 'raw-token' });
  });

  it('resets the password with the token from the link and redirects to /login with the success flag', async () => {
    resetPasswordMock.mockResolvedValue(undefined);
    render(<ResetPasswordPage />);

    await submitPasswords('new-password-123', 'new-password-123');

    expect(resetPasswordMock).toHaveBeenCalledWith('raw-token', 'new-password-123');
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/login?reset=success');
    });
  });

  it('does not call the API when the two passwords differ', async () => {
    render(<ResetPasswordPage />);

    await submitPasswords('new-password-123', 'different-password');

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it('shows the invalid-link message with a way to request a new link when the token is expired or invalid', async () => {
    resetPasswordMock.mockRejectedValue(new ApiError(400, 'Invalid or expired reset link'));
    render(<ResetPasswordPage />);

    await submitPasswords('new-password-123', 'new-password-123');

    expect(await screen.findByTestId('reset-password-invalid')).toHaveTextContent('invalid or has expired');
    expect(screen.getByTestId('reset-password-request-new-link')).toHaveAttribute('href', '/forgot-password');
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('keeps the form and shows a field error when the new password fails validation', async () => {
    resetPasswordMock.mockRejectedValue(
      new ApiError(400, 'newPassword must be longer than or equal to 8 characters', [
        'newPassword must be longer than or equal to 8 characters',
      ]),
    );
    render(<ResetPasswordPage />);

    await submitPasswords('short', 'short');

    expect(await screen.findByText('newPassword must be longer than or equal to 8 characters')).toBeInTheDocument();
    expect(screen.getByTestId('reset-password-form')).toBeInTheDocument();
  });

  it('shows the invalid-link message straight away when the link has no token', () => {
    searchParamsValue = new URLSearchParams();
    render(<ResetPasswordPage />);

    expect(screen.getByTestId('reset-password-invalid')).toBeInTheDocument();
    expect(screen.queryByTestId('reset-password-form')).not.toBeInTheDocument();
  });
});
