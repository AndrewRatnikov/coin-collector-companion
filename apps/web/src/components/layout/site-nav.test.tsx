/**
 * Tests for: SiteNav
 * Contract source: runs/run_20260722_121303/plan.md § Interface Contract → Component: SiteNav
 * Covers criteria: #2 (from prd.md)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteNav } from '@/components/layout/site-nav';
import { getStoredToken, setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => usePathnameMock(),
}));

describe('SiteNav', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    usePathnameMock.mockClear();
    usePathnameMock.mockReturnValue('/dashboard');
  });

  describe('criterion 2: always-visible links', () => {
    it('renders the catalog, canonical-sets, and public-sets links when unauthenticated', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('site-nav')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-catalog-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-canonical-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-public-link')).toBeInTheDocument();
    });

    it('renders the catalog, canonical-sets, and public-sets links when authenticated', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-dashboard-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-catalog-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-canonical-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-public-link')).toBeInTheDocument();
    });
  });

  describe('criterion 2: authenticated state', () => {
    it('shows dashboard, collection, and logout, and hides the login link, when a token is stored', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-dashboard-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-collection-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-logout')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-login-link')).not.toBeInTheDocument();
    });
  });

  describe('criterion 2: unauthenticated state', () => {
    it('shows the login link, and hides dashboard/collection/logout, when no token is stored', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('site-nav-login-link')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-dashboard-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-collection-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-logout')).not.toBeInTheDocument();
    });
  });

  describe('criterion 2: logout behaviour', () => {
    it('clears the stored token and navigates to /login when the logout button is clicked', async () => {
      const user = userEvent.setup();
      setStoredToken('tok-abc');
      render(<SiteNav />);

      const logoutButton = await screen.findByTestId('site-nav-logout');
      await user.click(logoutButton);

      expect(getStoredToken()).toBeNull();
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });
});
