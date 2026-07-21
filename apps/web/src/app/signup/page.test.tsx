/**
 * Tests for: SignupPage
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Page: Signup
 * Covers criteria: #4 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupPage from '@/app/signup/page';
import { register } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('@/lib/auth-api', () => ({
  register: vi.fn(),
}));

const registerMock = vi.mocked(register);

async function fillAndSubmit(email: string, password: string, confirmPassword: string = password) {
  const user = userEvent.setup();
  const emailInput = document.getElementById('email') as HTMLInputElement;
  const passwordInput = document.getElementById('password') as HTMLInputElement;
  const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;
  await user.type(emailInput, email);
  await user.type(passwordInput, password);
  await user.type(confirmPasswordInput, confirmPassword);
  await user.click(screen.getByTestId('signup-submit'));
}

describe('SignupPage', () => {
  beforeEach(() => {
    pushMock.mockClear();
    registerMock.mockReset();
  });

  describe('rendering', () => {
    it('renders the signup page, form, and submit button', () => {
      render(<SignupPage />);
      expect(screen.getByTestId('signup-page')).toBeInTheDocument();
      expect(screen.getByTestId('signup-form')).toBeInTheDocument();
      expect(screen.getByTestId('signup-submit')).toBeInTheDocument();
      expect(document.getElementById('email')).toBeInTheDocument();
      expect(document.getElementById('password')).toBeInTheDocument();
      expect(document.getElementById('confirmPassword')).toBeInTheDocument();
    });
  });

  describe('criterion 4: confirm-password field must match before submitting', () => {
    it('shows a field error and never calls register when the confirmation does not match', async () => {
      render(<SignupPage />);

      await fillAndSubmit('new-user@example.com', 'password123', 'password124');

      await waitFor(() => {
        expect(document.getElementById('confirmPassword-error')?.textContent).toBe('Passwords do not match');
      });
      expect(document.getElementById('password-error')?.textContent).toBe('Passwords do not match');
      expect(document.getElementById('password')).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById('confirmPassword')).toHaveAttribute('aria-invalid', 'true');
      expect(registerMock).not.toHaveBeenCalled();
      expect(pushMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 4: submits via auth-api register and redirects to /dashboard on success', () => {
    it('calls register with the entered credentials and redirects on success', async () => {
      registerMock.mockResolvedValue({ accessToken: 'tok-abc' });
      render(<SignupPage />);

      await fillAndSubmit('new-user@example.com', 'password123');

      expect(registerMock).toHaveBeenCalledWith({ email: 'new-user@example.com', password: 'password123' });
      await waitFor(() => {
        expect(pushMock).toHaveBeenCalledWith('/dashboard');
      });
    });
  });

  describe('criterion 4: surfaces a rejected submission via lib/form-errors, not an unhandled exception', () => {
    it('shows a field-level error when the ApiError detail matches a known field', async () => {
      registerMock.mockRejectedValue(
        new ApiError(400, 'password must be longer than or equal to 8 characters', [
          'password must be longer than or equal to 8 characters',
        ]),
      );
      render(<SignupPage />);

      await fillAndSubmit('new-user@example.com', 'short');

      await waitFor(() => {
        expect(document.getElementById('password-error')?.textContent).toBe(
          'password must be longer than or equal to 8 characters',
        );
      });
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('shows a page-level error when the ApiError detail does not match a known field (e.g. duplicate email)', async () => {
      registerMock.mockRejectedValue(new ApiError(409, 'Email already registered', ['Email already registered']));
      render(<SignupPage />);

      await fillAndSubmit('dup@example.com', 'password123');

      await waitFor(() => {
        expect(screen.getByTestId('signup-form-error')).toHaveTextContent('Email already registered');
      });
      expect(pushMock).not.toHaveBeenCalled();
    });
  });
});
