/**
 * Tests for: ForgotPasswordPage (backlog_password-management.md Step 3, task 3.11).
 * `forgotPassword` from '@/lib/auth-api' is mocked, same technique as login/page.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from '@/app/forgot-password/page';
import { forgotPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/auth-api', () => ({
  forgotPassword: vi.fn(),
}));

const forgotPasswordMock = vi.mocked(forgotPassword);

async function submitEmail(email: string) {
  const user = userEvent.setup();
  await user.type(document.getElementById('email') as HTMLInputElement, email);
  await user.click(screen.getByTestId('forgot-password-submit'));
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
  });

  it('renders the email form and a link back to /login', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByTestId('forgot-password-form')).toBeInTheDocument();
    expect(document.getElementById('email')).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password-back-link')).toHaveAttribute('href', '/login');
  });

  it('sends the entered email and shows the generic confirmation instead of the form', async () => {
    forgotPasswordMock.mockResolvedValue({ message: 'anything the API says' });
    render(<ForgotPasswordPage />);

    await submitEmail('collector@example.com');

    expect(forgotPasswordMock).toHaveBeenCalledWith('collector@example.com');
    expect(await screen.findByTestId('forgot-password-sent')).toHaveTextContent(
      "If an account exists for that email, we've sent a link",
    );
    expect(screen.queryByTestId('forgot-password-form')).not.toBeInTheDocument();
  });

  it('shows a rate-limit message on 429 and keeps the form', async () => {
    forgotPasswordMock.mockRejectedValue(new ApiError(429, 'ThrottlerException: Too Many Requests'));
    render(<ForgotPasswordPage />);

    await submitEmail('collector@example.com');

    expect(await screen.findByTestId('forgot-password-form-error')).toHaveTextContent('Too many reset requests');
    expect(screen.queryByTestId('forgot-password-sent')).not.toBeInTheDocument();
  });

  it('shows a field error when the API rejects the email', async () => {
    forgotPasswordMock.mockRejectedValue(new ApiError(400, 'email must be an email', ['email must be an email']));
    render(<ForgotPasswordPage />);

    await submitEmail('user@localhost');

    expect(await screen.findByText('email must be an email')).toBeInTheDocument();
    expect(screen.queryByTestId('forgot-password-sent')).not.toBeInTheDocument();
  });

  it('shows a generic error when the request fails for another reason', async () => {
    forgotPasswordMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<ForgotPasswordPage />);

    await submitEmail('collector@example.com');

    expect(await screen.findByTestId('forgot-password-form-error')).toHaveTextContent('Something went wrong');
  });
});
