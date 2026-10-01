/**
 * Tests for: DeleteAccountSection
 * Contract source: runs/run_20261001_214421/plan.md § Interface Contract → Component: DeleteAccountSection
 * Covers criteria: #11, #12, #13, #14, #18 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * `deleteAccount` from '@/lib/auth-api' is mocked (no network). next/navigation's useRouter is
 * mocked. The component is rendered inside a real QueryClientProvider so queryClient.clear can
 * be spied on.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeleteAccountSection } from '@/components/settings/delete-account-section';
import { deleteAccount } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { getStoredToken, setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('@/lib/auth-api', () => ({
  deleteAccount: vi.fn(),
}));

const deleteAccountMock = vi.mocked(deleteAccount);

let qc: QueryClient;
let clearSpy: ReturnType<typeof vi.spyOn>;

function renderSection() {
  return render(
    <QueryClientProvider client={qc}>
      <DeleteAccountSection />
    </QueryClientProvider>,
  );
}

async function openStep() {
  const user = userEvent.setup();
  await user.click(screen.getByTestId('settings-delete-account-open'));
  return user;
}

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    replaceMock.mockClear();
    deleteAccountMock.mockReset();
    qc = new QueryClient();
    clearSpy = vi.spyOn(qc, 'clear');
  });

  describe('initial state', () => {
    it('renders the section and open button but not the confirmation step', () => {
      renderSection();

      expect(screen.getByTestId('settings-delete-account')).toBeInTheDocument();
      expect(screen.getByTestId('settings-delete-account-open')).toBeInTheDocument();
      expect(screen.queryByTestId('settings-delete-account-confirm-step')).not.toBeInTheDocument();
      expect(screen.queryByTestId('settings-delete-account-error')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: confirmation step', () => {
    it('opens the step with explanation, password input and checkbox', async () => {
      renderSection();
      await openStep();

      expect(screen.getByTestId('settings-delete-account-confirm-step')).toBeInTheDocument();
      expect(screen.getByTestId('settings-delete-account-explanation')).toBeInTheDocument();
      expect(screen.getByTestId('settings-delete-account-password')).toHaveAttribute('type', 'password');
      expect(screen.getByTestId('settings-delete-account-acknowledge')).toHaveAttribute('type', 'checkbox');
      expect(screen.getByTestId('settings-delete-account-submit')).toBeInTheDocument();
      expect(screen.getByTestId('settings-delete-account-cancel')).toBeInTheDocument();
    });

    it('explains what is deleted and what stays', async () => {
      renderSection();
      await openStep();

      const text = screen.getByTestId('settings-delete-account-explanation').textContent ?? '';
      expect(text).toContain('This permanently deletes your sets, your collection and your feedback.');
      expect(text).toContain('Coins you submitted to the catalog stay in the catalog, no longer linked to you.');
    });
  });

  describe('criterion 12: submit is blocked until checkbox ticked AND password non-empty', () => {
    it('is disabled initially', async () => {
      renderSection();
      await openStep();

      expect(screen.getByTestId('settings-delete-account-submit')).toBeDisabled();
    });

    it('stays disabled with a password but no checkbox', async () => {
      renderSection();
      const user = await openStep();
      await user.type(screen.getByTestId('settings-delete-account-password'), 'secret-pass-1');

      expect(screen.getByTestId('settings-delete-account-submit')).toBeDisabled();
    });

    it('stays disabled with the checkbox but an empty password', async () => {
      renderSection();
      const user = await openStep();
      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));

      expect(screen.getByTestId('settings-delete-account-submit')).toBeDisabled();
    });

    it('is enabled with both, and disabled again when the checkbox is unticked', async () => {
      renderSection();
      const user = await openStep();
      await user.type(screen.getByTestId('settings-delete-account-password'), 'secret-pass-1');
      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));

      expect(screen.getByTestId('settings-delete-account-submit')).toBeEnabled();

      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));
      expect(screen.getByTestId('settings-delete-account-submit')).toBeDisabled();
      expect(deleteAccountMock).not.toHaveBeenCalled();
    });
  });

  describe('cancel', () => {
    it('collapses the step and resets the fields when reopened', async () => {
      renderSection();
      const user = await openStep();
      await user.type(screen.getByTestId('settings-delete-account-password'), 'secret-pass-1');
      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));

      await user.click(screen.getByTestId('settings-delete-account-cancel'));
      expect(screen.queryByTestId('settings-delete-account-confirm-step')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('settings-delete-account-open'));
      expect(screen.getByTestId('settings-delete-account-password')).toHaveValue('');
      expect(screen.getByTestId('settings-delete-account-acknowledge')).not.toBeChecked();
      expect(deleteAccountMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 13: wrong password (401)', () => {
    it('shows the inline error, does not redirect, keeps the token and does not clear caches', async () => {
      setStoredToken('tok-abc');
      deleteAccountMock.mockRejectedValue(new ApiError(401, 'Password is incorrect'));
      renderSection();
      const user = await openStep();
      await user.type(screen.getByTestId('settings-delete-account-password'), 'wrong-pass-1');
      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));
      await user.click(screen.getByTestId('settings-delete-account-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('settings-delete-account-error')).toHaveTextContent('Password is incorrect.');
      });
      expect(deleteAccountMock).toHaveBeenCalledWith('wrong-pass-1');
      expect(replaceMock).not.toHaveBeenCalled();
      expect(getStoredToken()).toBe('tok-abc');
      expect(clearSpy).not.toHaveBeenCalled();
      expect(sessionStorage.getItem('ccc-account-deleted')).toBeNull();
    });

    it('shows a generic error (not the wrong-password text) for a non-401 failure', async () => {
      deleteAccountMock.mockRejectedValue(new ApiError(500, 'Internal error'));
      renderSection();
      const user = await openStep();
      await user.type(screen.getByTestId('settings-delete-account-password'), 'secret-pass-1');
      await user.click(screen.getByTestId('settings-delete-account-acknowledge'));
      await user.click(screen.getByTestId('settings-delete-account-submit'));

      await waitFor(() => {
        expect(screen.getByTestId('settings-delete-account-error')).toHaveTextContent(
          'Something went wrong deleting your account. Please try again.',
        );
      });
      expect(screen.getByTestId('settings-delete-account-error')).not.toHaveTextContent('Password is incorrect.');
      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 14: success', () => {
    it('clears the token, clears the query cache, sets the one-shot flag and redirects to /', async () => {
      setStoredToken('tok-abc');
      deleteAccountMock.mockResolvedValue(undefined);
      renderSection();
      await openStep();
      fireEvent.change(screen.getByTestId('settings-delete-account-password'), { target: { value: 'right-pass-1' } });
      await userEvent.setup().click(screen.getByTestId('settings-delete-account-acknowledge'));
      await userEvent.setup().click(screen.getByTestId('settings-delete-account-submit'));

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/');
      });
      expect(deleteAccountMock).toHaveBeenCalledWith('right-pass-1');
      expect(getStoredToken()).toBeNull();
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('ccc-account-deleted')).toBe('1');
      expect(screen.queryByTestId('settings-delete-account-error')).not.toBeInTheDocument();
    });
  });
});
