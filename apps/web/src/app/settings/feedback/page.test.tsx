/**
 * Tests for: SettingsFeedbackPage
 * Contract source: runs/run_20260804_165504/plan.md § Interface Contract → Page: SettingsFeedbackPage (CREATE)
 * Covers criteria: #1, #7 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * RequireAuth is not mocked — real localStorage token presence/absence drives its
 * authorized/redirecting behavior, same convention as apps/web/src/app/settings/page.test.tsx.
 * next/navigation is mocked for both useRouter (RequireAuth) and usePathname (SettingsTabs),
 * same convention as apps/web/src/components/layout/site-nav.test.tsx.
 * FeedbackForm is mocked to a stub rendering its own already-contract-declared root testid
 * (settings-feedback-form) — its internal behavior is fully covered by
 * apps/web/src/components/settings/feedback-form.test.tsx; this file only proves the page
 * assembles RequireAuth + SettingsTabs + FeedbackForm correctly.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SettingsFeedbackPage from '@/app/settings/feedback/page';
import { setStoredToken } from '@/lib/auth-token';

const replaceMock = vi.fn();
const usePathnameMock = vi.fn(() => '/settings/feedback');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  usePathname: () => usePathnameMock(),
}));

vi.mock('@/components/settings/feedback-form', () => ({
  FeedbackForm: () => <div data-testid="settings-feedback-form" />,
}));

describe('SettingsFeedbackPage', () => {
  beforeEach(() => {
    localStorage.clear();
    replaceMock.mockClear();
    usePathnameMock.mockClear();
    usePathnameMock.mockReturnValue('/settings/feedback');
  });

  describe('criterion #7: auth gating', () => {
    it('does not render settings-feedback-page and redirects to /login when no token is present', async () => {
      render(<SettingsFeedbackPage />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/login');
      });
      expect(screen.queryByTestId('settings-feedback-page')).not.toBeInTheDocument();
    });
  });

  describe('criterion #1: renders the feedback tab page once authenticated', () => {
    it('renders settings-feedback-page when a token is present', async () => {
      setStoredToken('tok-abc');
      render(<SettingsFeedbackPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback-page')).toBeInTheDocument();
      });
    });

    it('renders SettingsTabs with the feedback tab marked active', async () => {
      setStoredToken('tok-abc');
      render(<SettingsFeedbackPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-tabs')).toBeInTheDocument();
      });
      expect(screen.getByTestId('settings-tab-feedback')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('settings-tab-account')).not.toHaveAttribute('aria-current');
    });

    it('renders the FeedbackForm', async () => {
      setStoredToken('tok-abc');
      render(<SettingsFeedbackPage />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-feedback-form')).toBeInTheDocument();
      });
    });
  });
});
