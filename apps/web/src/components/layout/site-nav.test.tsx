/**
 * Tests for: SiteNav
 * Contract source: runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/components/layout/site-nav.tsx
 * (existing describe blocks below are carried over unchanged from
 * runs/run_20260726_221855/plan.md § Interface Contract → Modified: SiteNav, which itself
 * carried over runs/run_20260722_121303's original SiteNav coverage)
 * Covers criteria: #2, #3 (from prd.md)
 *
 * run_20260730_153718: LanguageSwitcher migrated from two buttons to a single
 * dropdown (see runs/run_20260730_153718/plan.md § Interface Contract → Existing
 * (unmodified) dependency: SiteNav). Only the "criterion 3: language switcher is
 * mounted" block below changes — its `language-switcher-en`/`language-switcher-es`
 * assertions are replaced with a single `language-switcher-select` assertion. Every
 * other describe block is untouched.
 *
 * run_20260731_132040: adds `site-nav-my-submissions-link` to the authenticated-only
 * link group (runs/run_20260731_132040/plan.md § Interface Contract → Component: SiteNav
 * (MODIFY)). Only the new describe block below is added; every existing block is
 * otherwise untouched.
 *
 * run_20260801_142634: adds `site-nav-glossary-link` to the always-visible link group
 * (runs/run_20260801_142634/plan.md § Interface Contract → Existing (MODIFIED)
 * component: SiteNav). Only the new describe block below is added; every existing
 * block is otherwise untouched.
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
    it('renders the catalog and sets links when unauthenticated', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('site-nav')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-catalog-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-sets-link')).toBeInTheDocument();
    });

    it('renders the catalog and sets links when authenticated', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-account-trigger')).toBeInTheDocument();
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-dashboard-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-catalog-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-sets-link')).toBeInTheDocument();
    });
  });

  describe('criterion 2: authenticated state', () => {
    it('shows dashboard, collection, and logout inside the account menu, and hides the login link, when a token is stored', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-account-trigger')).toBeInTheDocument();
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-dashboard-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-collection-link')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-logout')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-login-link')).not.toBeInTheDocument();
    });
  });

  describe('criterion 2: unauthenticated state', () => {
    it('shows the login link, and hides the account menu trigger, when no token is stored', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('site-nav-login-link')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-account-trigger')).not.toBeInTheDocument();
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

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      const logoutButton = screen.getByTestId('site-nav-logout');
      await user.click(logoutButton);

      expect(getStoredToken()).toBeNull();
      expect(pushMock).toHaveBeenCalledWith('/login');
    });
  });

  describe('account menu behaviour', () => {
    it('opens the menu on trigger click and closes it again on a second click', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();

      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });

    it('closes the menu when clicking outside it', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();

      await user.click(document.body);
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });

    it('closes the menu on Escape', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });
  });

  describe('criterion 3: language switcher is mounted in the site chrome', () => {
    it('renders the LanguageSwitcher inside the nav', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-select')).toBeInTheDocument();
    });
  });

  describe('criterion 2: brand element (new in run_20260728_071525)', () => {
    it('renders a site-nav-brand element with the nav.brand copy, linking to Home', () => {
      render(<SiteNav />);

      const brand = screen.getByTestId('site-nav-brand');
      expect(brand).toBeInTheDocument();
      expect(brand).toHaveTextContent('Coin Collector Companion');
      expect(brand.getAttribute('href')).toBe('/');
    });

    it('renders the brand element regardless of auth state', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-account-trigger')).toBeInTheDocument();
      const brand = screen.getByTestId('site-nav-brand');
      expect(brand).toBeInTheDocument();
      expect(brand.getAttribute('href')).toBe('/');
    });
  });

  describe('criterion 2: signup link, signed-out only (new in run_20260728_071525)', () => {
    it('renders site-nav-signup-link alongside the login link when signed out', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('site-nav-login-link')).toBeInTheDocument();
      const signup = screen.getByTestId('site-nav-signup-link');
      expect(signup).toBeInTheDocument();
      expect(signup).toHaveTextContent('Sign up');
      expect(signup.getAttribute('href')).toBe('/signup');
    });

    it('hides site-nav-signup-link when a token is stored', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-account-trigger')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-signup-link')).not.toBeInTheDocument();
    });
  });

  describe('criterion 2: single Sets link (canonical/public merged behind tabs)', () => {
    it('renders a single "Sets" link pointing at /sets', () => {
      render(<SiteNav />);

      const link = screen.getByTestId('site-nav-sets-link');
      expect(link).toHaveTextContent('Sets');
      expect(link.getAttribute('href')).toBe('/sets');
    });
  });

  describe('run_20260731_132040 criterion 7: My Submissions link, authenticated only', () => {
    it('renders site-nav-my-submissions-link pointing at /catalog/mine when a token is stored', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      const link = screen.getByTestId('site-nav-my-submissions-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/catalog/mine');
    });

    it('hides site-nav-my-submissions-link when no token is stored', () => {
      render(<SiteNav />);

      expect(screen.queryByTestId('site-nav-my-submissions-link')).not.toBeInTheDocument();
    });
  });

  describe('run_20260801_142634 criterion 5: Glossary link, always visible', () => {
    it('renders site-nav-glossary-link pointing at /glossary when unauthenticated', () => {
      render(<SiteNav />);

      const link = screen.getByTestId('site-nav-glossary-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/glossary');
    });

    it('renders site-nav-glossary-link when authenticated (not gated by auth state)', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-account-trigger')).toBeInTheDocument();
      const link = screen.getByTestId('site-nav-glossary-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/glossary');
    });
  });
});
