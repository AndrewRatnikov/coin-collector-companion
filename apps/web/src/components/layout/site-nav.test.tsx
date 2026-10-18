/**
 * Tests for: SiteNav
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: SiteNav
 * Covers criteria: #1, #2, #4, #7, #10, #11, #12 (from prd.md)
 *
 * run_20261018_085900: SiteNav is rewritten (responsive header, My sets / Collection /
 * Catalog primary items, Checklists, Create account, current-user fetch moved here from
 * AdminNavLink, mobile title/action, MobileTabBar sibling). Blocks that asserted the old
 * nav (Sets link, Glossary link, Dashboard/Collection inside the account menu, "Sign up",
 * the language <select>) are replaced; the logout, menu behaviour, brand, My submissions,
 * Settings and Admin-fetch blocks are carried over and adapted. Removed testids are only
 * asserted gone structurally (links inside `site-nav-main`), never by queryByTestId.
 *
 * Note: jsdom applies no Tailwind classes, so desktop and mobile elements are both in the
 * DOM; everything is scoped by testid.
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SiteNav } from '@/components/layout/site-nav';
import { getCurrentUser } from '@/lib/auth-api';
import { getStoredToken, setStoredToken } from '@/lib/auth-token';

const pushMock = vi.fn();
const replaceMock = vi.fn();
const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  usePathname: () => usePathnameMock(),
}));

vi.mock('@/lib/auth-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth-api')>()),
  getCurrentUser: vi.fn(),
}));

const getCurrentUserMock = vi.mocked(getCurrentUser);

function currentUser(role: 'user' | 'admin') {
  return { id: 'user-1', email: 'collector@example.com', createdAt: '2026-01-01T00:00:00.000Z', role };
}

function mainHrefs() {
  return within(screen.getByTestId('site-nav-main'))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('SiteNav', () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
    replaceMock.mockClear();
    usePathnameMock.mockClear();
    usePathnameMock.mockReturnValue('/dashboard');
    getCurrentUserMock.mockReset();
    getCurrentUserMock.mockResolvedValue(currentUser('user'));
  });

  describe('criterion 1: signed-in primary nav', () => {
    it('lists My sets, Collection, Catalog in order with the right hrefs and labels', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      expect(await screen.findByTestId('site-nav-my-sets-link')).toHaveTextContent('My sets');
      expect(mainHrefs()).toEqual(['/dashboard', '/collection', '/catalog']);
      expect(screen.getByTestId('site-nav-collection-link')).toHaveTextContent('Collection');
      expect(screen.getByTestId('site-nav-catalog-link')).toHaveTextContent('Catalog');
    });

    it('is a header root containing a nav named "Main"', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-my-sets-link');
      expect(screen.getByTestId('site-nav').tagName).toBe('HEADER');
      expect(screen.getByTestId('site-nav-main')).toHaveAttribute('aria-label', 'Main');
    });

    it.each([
      ['/dashboard', 'site-nav-my-sets-link'],
      ['/collection/import', 'site-nav-collection-link'],
      ['/catalog/123', 'site-nav-catalog-link'],
    ])('marks only the matching item aria-current at %s', async (pathname, activeId) => {
      usePathnameMock.mockReturnValue(pathname);
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-my-sets-link');
      for (const id of ['site-nav-my-sets-link', 'site-nav-collection-link', 'site-nav-catalog-link']) {
        if (id === activeId) {
          expect(screen.getByTestId(id)).toHaveAttribute('aria-current', 'page');
        } else {
          expect(screen.getByTestId(id)).not.toHaveAttribute('aria-current');
        }
      }
    });

    it('has no Glossary, Sets/Checklists or Admin link in the bar', async () => {
      setStoredToken('tok-abc');
      getCurrentUserMock.mockResolvedValue(currentUser('admin'));
      render(<SiteNav />);

      await screen.findByTestId('site-nav-my-sets-link');
      await settle();
      const main = screen.getByTestId('site-nav-main');
      expect(within(main).getAllByRole('link')).toHaveLength(3);
      expect(mainHrefs()).not.toContain('/glossary');
      expect(mainHrefs()).not.toContain('/sets');
      expect(mainHrefs()).not.toContain('/admin/submissions');
      expect(within(main).queryByText('Glossary')).not.toBeInTheDocument();
      expect(within(main).queryByText('Sets')).not.toBeInTheDocument();
    });

    it('hides the login and signup links and the signed-out Checklists item', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      expect(screen.queryByTestId('site-nav-login-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-signup-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-checklists-link')).not.toBeInTheDocument();
    });
  });

  describe('criterion 7: signed-out bar', () => {
    it('lists Catalog and Checklists (/sets) in the main nav', () => {
      usePathnameMock.mockReturnValue('/');
      render(<SiteNav />);

      expect(mainHrefs()).toEqual(['/catalog', '/sets']);
      expect(screen.getByTestId('site-nav-catalog-link')).toHaveTextContent('Catalog');
      const checklists = screen.getByTestId('site-nav-checklists-link');
      expect(checklists).toHaveTextContent('Checklists');
      expect(checklists.getAttribute('href')).toBe('/sets');
      expect(within(screen.getByTestId('site-nav-main')).queryByText('Sets')).not.toBeInTheDocument();
      expect(within(screen.getByTestId('site-nav-main')).queryByText('Glossary')).not.toBeInTheDocument();
    });

    it('does not show the signed-in primary items or the account menu', () => {
      render(<SiteNav />);

      expect(screen.queryByTestId('site-nav-my-sets-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-collection-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-account-trigger')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-logout')).not.toBeInTheDocument();
    });

    it('shows Log in (/login) and Create account (/signup)', () => {
      render(<SiteNav />);

      const login = screen.getByTestId('site-nav-login-link');
      expect(login).toHaveTextContent('Log in');
      expect(login.getAttribute('href')).toBe('/login');
      const signup = screen.getByTestId('site-nav-signup-link');
      expect(signup).toHaveTextContent('Create account');
      expect(signup.getAttribute('href')).toBe('/signup');
    });

    it('marks Catalog current at /catalog and Checklists at /sets/public', () => {
      usePathnameMock.mockReturnValue('/catalog');
      const first = render(<SiteNav />);
      expect(screen.getByTestId('site-nav-catalog-link')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('site-nav-checklists-link')).not.toHaveAttribute('aria-current');
      first.unmount();

      usePathnameMock.mockReturnValue('/sets/public');
      render(<SiteNav />);
      expect(screen.getByTestId('site-nav-checklists-link')).toHaveAttribute('aria-current', 'page');
      expect(screen.getByTestId('site-nav-catalog-link')).not.toHaveAttribute('aria-current');
    });

    it('marks nothing current on the home page', () => {
      usePathnameMock.mockReturnValue('/');
      render(<SiteNav />);

      for (const link of within(screen.getByTestId('site-nav-main')).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
      }
    });
  });

  describe('criterion 4: account menu wiring', () => {
    it('shows the avatar initial and name from the current user', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
      });
      expect(screen.getByTestId('site-nav-account-trigger')).toHaveAttribute(
        'aria-label',
        'Account menu for collector',
      );
    });

    it('opens a menu with the header, Settings, My submissions, Import and Log out, and no Dashboard/Collection', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
      });
      await user.click(screen.getByTestId('site-nav-account-trigger'));

      const menu = screen.getByTestId('site-nav-account-menu');
      expect(within(menu).getByTestId('site-nav-account-email')).toHaveTextContent('collector@example.com');
      expect(
        within(menu)
          .getAllByRole('menuitem')
          .map((el) => el.getAttribute('href')),
      ).toEqual(['/settings', '/catalog/mine', '/collection/import', null]);
      expect(within(menu).getByTestId('site-nav-logout')).toBeInTheDocument();
    });

    it('closes the menu on a second trigger click', async () => {
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
      await user.click(document.body);
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });

    it('closes the menu on Escape', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });
  });

  describe('criterion 4: logout behaviour', () => {
    it('clears the stored token and navigates to /login when the logout button is clicked', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => undefined,
      });
      vi.stubGlobal('fetch', fetchMock);

      const user = userEvent.setup();
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      await user.click(screen.getByTestId('site-nav-logout'));

      expect(fetchMock).toHaveBeenCalled();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/logout');
      expect(init.method).toBe('POST');

      expect(getStoredToken()).toBeNull();
      expect(pushMock).toHaveBeenCalledWith('/login');

      vi.unstubAllGlobals();
    });
  });

  describe('criterion 4: Admin item, only when /auth/me reports role admin', () => {
    it('shows site-nav-admin-link first in the opened menu for an admin', async () => {
      setStoredToken('tok-abc');
      getCurrentUserMock.mockResolvedValue(currentUser('admin'));
      const user = userEvent.setup();
      render(<SiteNav />);

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
      });
      await user.click(screen.getByTestId('site-nav-account-trigger'));

      const menu = screen.getByTestId('site-nav-account-menu');
      const items = within(menu).getAllByRole('menuitem');
      expect(items[0]).toBe(screen.getByTestId('site-nav-admin-link'));
      expect(items[0].getAttribute('href')).toBe('/admin/submissions');
      expect(items[0]).toHaveTextContent('Admin');
    });

    it('does not show the Admin item for role user', async () => {
      setStoredToken('tok-abc');
      const user = userEvent.setup();
      render(<SiteNav />);

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
      });
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.queryByTestId('site-nav-admin-link')).not.toBeInTheDocument();
    });

    it('calls getCurrentUser exactly once for a signed-in visitor, even across a pathname change', async () => {
      setStoredToken('tok-abc');
      const view = render(<SiteNav />);

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
      });
      usePathnameMock.mockReturnValue('/collection');
      view.rerender(<SiteNav />);
      await settle();

      expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    });

    it('keeps the generic trigger name and hides Admin while the request is pending', async () => {
      setStoredToken('tok-abc');
      getCurrentUserMock.mockReturnValue(new Promise(() => {}));
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await settle();
      expect(screen.getByTestId('site-nav-account-trigger')).toHaveAttribute('aria-label', 'Account menu');
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.queryByTestId('site-nav-admin-link')).not.toBeInTheDocument();
    });

    it('hides the Admin item when the /auth/me request fails', async () => {
      setStoredToken('tok-abc');
      getCurrentUserMock.mockRejectedValue(new Error('network down'));
      const user = userEvent.setup();
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      await settle();
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(getCurrentUserMock).toHaveBeenCalled();
      expect(screen.queryByTestId('site-nav-admin-link')).not.toBeInTheDocument();
    });

    it('never calls getCurrentUser for an anonymous visitor', async () => {
      getCurrentUserMock.mockResolvedValue(currentUser('admin'));
      render(<SiteNav />);

      await settle();

      expect(screen.getByTestId('site-nav-login-link')).toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-admin-link')).not.toBeInTheDocument();
      expect(getCurrentUserMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 6: language switcher is mounted in the site chrome', () => {
    it('renders the segmented LanguageSwitcher', () => {
      render(<SiteNav />);

      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-en')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-es')).toBeInTheDocument();
    });
  });

  describe('brand', () => {
    it('renders a site-nav-brand link to Home with the nav.brand copy, signed out', () => {
      render(<SiteNav />);

      const brand = screen.getByTestId('site-nav-brand');
      expect(brand).toHaveTextContent('Coin Collector Companion');
      expect(brand.getAttribute('href')).toBe('/');
    });

    it('renders the brand when signed in as well', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      const brand = screen.getByTestId('site-nav-brand');
      expect(brand).toHaveTextContent('Coin Collector Companion');
      expect(brand.getAttribute('href')).toBe('/');
    });
  });

  describe('criterion 10: mobile top bar content', () => {
    it('shows the page title "My sets" at /dashboard', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      expect(screen.getByTestId('site-nav-page-title')).toHaveTextContent('My sets');
    });

    it('shows the page title "Collection" at /collection/import', async () => {
      usePathnameMock.mockReturnValue('/collection/import');
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      expect(screen.getByTestId('site-nav-page-title')).toHaveTextContent('Collection');
    });

    it('shows the New set page action only at /dashboard', async () => {
      setStoredToken('tok-abc');
      const view = render(<SiteNav />);

      const action = await screen.findByTestId('site-nav-page-action');
      expect(action.getAttribute('href')).toBe('/sets/new');
      expect(action).toHaveAttribute('aria-label', 'New set');

      usePathnameMock.mockReturnValue('/collection');
      view.rerender(<SiteNav />);
      await waitFor(() => {
        expect(screen.queryByTestId('site-nav-page-action')).not.toBeInTheDocument();
      });
    });

    it('has no page title or page action when signed out', () => {
      render(<SiteNav />);

      expect(screen.queryByTestId('site-nav-page-title')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-page-action')).not.toBeInTheDocument();
    });
  });

  describe('criterion 11: mobile tab bar is rendered with the auth-dependent tab set', () => {
    it('renders My sets, Collection, Catalog tabs when signed in', async () => {
      setStoredToken('tok-abc');
      render(<SiteNav />);

      await screen.findByTestId('site-nav-account-trigger');
      const bar = screen.getByTestId('site-nav-tabbar');
      expect(
        within(bar)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(['/dashboard', '/collection', '/catalog']);
    });

    it('renders Catalog, Checklists, Glossary tabs when signed out', () => {
      usePathnameMock.mockReturnValue('/');
      render(<SiteNav />);

      const bar = screen.getByTestId('site-nav-tabbar');
      expect(
        within(bar)
          .getAllByRole('link')
          .map((a) => a.getAttribute('href')),
      ).toEqual(['/catalog', '/sets', '/glossary']);
    });
  });

  describe('carried over: Settings and My submissions only for signed-in users', () => {
    it('shows neither Settings nor My submissions links when signed out', () => {
      render(<SiteNav />);

      expect(screen.queryByTestId('site-nav-settings-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-my-submissions-link')).not.toBeInTheDocument();
    });
  });
});
