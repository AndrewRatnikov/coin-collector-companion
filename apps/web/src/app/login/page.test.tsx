/**
 * Tests for: LoginPage
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Page: Login
 * Covers criteria: #4 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '@/app/login/page';
import { login } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('@/lib/auth-api', () => ({
  login: vi.fn(),
}));

const loginMock = vi.mocked(login);

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  await user.type(emailInput, email);
  await user.type(passwordInput, password);
  await user.click(screen.getByTestId('login-submit'));
}

describe('LoginPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    loginMock.mockReset();
  });

  describe('rendering', () => {
    it('renders the login page, form, and submit button', () => {
      render(<LoginPage />);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByTestId('login-form')).toBeInTheDocument();
      expect(screen.getByTestId('login-submit')).toBeInTheDocument();
      expect(document.getElementById('email')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
    });
  });

  describe('criterion 4: submits via auth-api login and redirects to /dashboard on success', () => {
    it('calls login with the entered credentials and redirects on success', async () => {
      loginMock.mockResolvedValue({ accessToken: 'tok-abc' });
      render(<LoginPage />);

      await fillAndSubmit('user@example.com', 'password123');

      expect(loginMock).toHaveBeenCalledWith({ email: 'user@example.com', password: 'password123' });
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('criterion 4: surfaces a rejected submission via lib/form-errors, not an unhandled exception', () => {
    it('shows a field-level error when the ApiError detail matches a known field', async () => {
      loginMock.mockRejectedValue(new ApiError(401, 'email must be an email', ['email must be an email']));
      render(<LoginPage />);

      await fillAndSubmit('not-an-email', 'password123');

      await waitFor(() => {
        expect(document.getElementById('email-error')?.textContent).toBe('email must be an email');
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('shows a page-level error when the ApiError detail does not match a known field', async () => {
      loginMock.mockRejectedValue(new ApiError(401, 'Invalid credentials', ['Invalid credentials']));
      render(<LoginPage />);

      await fillAndSubmit('user@example.com', 'wrongpassword');

      await waitFor(() => {
        expect(screen.getByTestId('login-form-error')).toHaveTextContent('Invalid credentials');
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('does not throw an unhandled exception on a rejected submission', async () => {
      loginMock.mockRejectedValue(new ApiError(401, 'Invalid credentials', ['Invalid credentials']));
      render(<LoginPage />);

      await expect(fillAndSubmit('user@example.com', 'wrongpassword')).resolves.not.toThrow();
    });
  });
});
