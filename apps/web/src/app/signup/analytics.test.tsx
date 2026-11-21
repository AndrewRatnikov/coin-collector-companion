/**
 * Tests for: SignupPage analytics (user_signed_up)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Call sites
 * Covers criteria: #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignupPage from '@/app/signup/page';
import { register } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { getFirstTouchChannel, track } from '@/lib/analytics';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

vi.mock('@/lib/auth-api', () => ({
  register: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
  getFirstTouchChannel: vi.fn(() => 'direct'),
}));

const registerMock = vi.mocked(register);
const trackMock = vi.mocked(track);
const channelMock = vi.mocked(getFirstTouchChannel);

async function fillAndSubmit(email: string, password: string, confirmPassword: string = password) {
  const user = userEvent.setup();
  await user.type(document.getElementById('email') as HTMLInputElement, email);
  await user.type(document.getElementById('password') as HTMLInputElement, password);
  await user.type(document.getElementById('confirmPassword') as HTMLInputElement, confirmPassword);
  await user.click(screen.getByTestId('signup-submit'));
}

describe('SignupPage analytics', () => {
  beforeEach(() => {
    pushMock.mockClear();
    registerMock.mockReset();
    trackMock.mockClear();
    channelMock.mockReset();
    channelMock.mockReturnValue('direct');
  });

  it('tracks user_signed_up with the first-touch channel after a successful register', async () => {
    channelMock.mockReturnValue('reddit');
    registerMock.mockResolvedValue({ accessToken: 'tok-abc' });
    render(<SignupPage />);

    await fillAndSubmit('new-user@example.com', 'password123');

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/dashboard'));
    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith('user_signed_up', { channel: 'reddit' });
  });

  it('sends whatever channel it is given, including direct', async () => {
    registerMock.mockResolvedValue({ accessToken: 'tok-abc' });
    render(<SignupPage />);

    await fillAndSubmit('new-user@example.com', 'password123');

    await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
    expect(trackMock).toHaveBeenCalledWith('user_signed_up', { channel: 'direct' });
  });

  it('never puts the email or password in the event', async () => {
    registerMock.mockResolvedValue({ accessToken: 'tok-abc' });
    render(<SignupPage />);

    await fillAndSubmit('new-user@example.com', 'password123');

    await waitFor(() => expect(trackMock).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain('new-user');
    expect(JSON.stringify(trackMock.mock.calls)).not.toContain('password123');
  });

  it('tracks nothing when register rejects, and shows the page error', async () => {
    registerMock.mockRejectedValue(new ApiError(409, 'Email already registered', ['Email already registered']));
    render(<SignupPage />);

    await fillAndSubmit('dup@example.com', 'password123');

    await waitFor(() => expect(screen.getByTestId('signup-form-error')).toBeInTheDocument());
    expect(trackMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('tracks nothing when the passwords do not match', async () => {
    render(<SignupPage />);

    await fillAndSubmit('new-user@example.com', 'password123', 'password124');

    await waitFor(() => {
      expect(document.getElementById('confirmPassword-error')).toBeInTheDocument();
    });
    expect(registerMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalled();
  });
});
