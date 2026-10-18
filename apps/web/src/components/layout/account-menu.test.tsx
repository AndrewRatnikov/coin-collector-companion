/**
 * Tests for: AccountMenu
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: AccountMenu
 * Covers criteria: #2, #3, #4, #5, #12 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AccountMenu } from '@/components/layout/account-menu';
import type { CurrentUser } from '@/lib/auth-api';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',
    email: 'collector@example.com',
    createdAt: '2026-01-01T00:00:00.000Z',
    role: 'user',
    ...overrides,
  };
}

const onLogout = vi.fn();

function renderMenu(user: CurrentUser | null = makeUser()) {
  return render(
    <I18nProvider>
      <AccountMenu user={user} onLogout={onLogout} />
    </I18nProvider>,
  );
}

async function openMenu() {
  const user = userEvent.setup();
  renderMenu();
  await user.click(screen.getByTestId('site-nav-account-trigger'));
  return { user, menu: screen.getByTestId('site-nav-account-menu') };
}

const ORDER = [
  'site-nav-settings-link',
  'site-nav-my-submissions-link',
  'site-nav-import-link',
  'site-nav-account-language-en',
  'site-nav-account-language-es',
  'site-nav-logout',
];

describe('AccountMenu', () => {
  beforeEach(() => {
    localStorage.clear();
    onLogout.mockClear();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue('/dashboard');
  });

  describe('trigger', () => {
    it('shows the avatar initial from the email local part', () => {
      renderMenu();
      expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('C');
    });

    it('shows a different initial for a different user', () => {
      renderMenu(makeUser({ email: 'zed@example.com' }));
      expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('Z');
    });

    it('derives the accessible name, header name and email from the given user', async () => {
      const user = userEvent.setup();
      renderMenu(makeUser({ email: 'zed@example.com' }));
      const trigger = screen.getByTestId('site-nav-account-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Account menu for zed');

      await user.click(trigger);
      const name = screen.getByTestId('site-nav-account-name');
      const email = screen.getByTestId('site-nav-account-email');
      expect(name).toHaveTextContent('zed');
      expect(email).toHaveTextContent('zed@example.com');
      expect(name).not.toHaveTextContent('collector');
      expect(email).not.toHaveTextContent('collector');
    });

    it('has aria-haspopup=menu and a collapsed state when closed', () => {
      renderMenu();
      const trigger = screen.getByTestId('site-nav-account-trigger');
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });

    it('includes the user name in the accessible name', () => {
      renderMenu();
      const trigger = screen.getByTestId('site-nav-account-trigger');
      expect(trigger).toHaveAttribute('aria-label', 'Account menu for collector');
      expect(screen.getByRole('button', { name: /collector/ })).toBe(trigger);
    });

    it('falls back to a generic name and empty avatar when user is null', () => {
      renderMenu(null);
      expect(screen.getByTestId('site-nav-account-trigger')).toHaveAttribute('aria-label', 'Account menu');
      expect(screen.getByTestId('site-nav-account-avatar')).toHaveTextContent('');
    });

    it('toggles aria-expanded on click', async () => {
      const user = userEvent.setup();
      renderMenu();
      const trigger = screen.getByTestId('site-nav-account-trigger');

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('site-nav-account-menu')).toHaveAttribute('role', 'menu');

      await user.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });
  });

  describe('menu content', () => {
    it('shows the name and email in a header', async () => {
      const { menu } = await openMenu();
      const header = within(menu).getByTestId('site-nav-account-header');
      expect(within(header).getByTestId('site-nav-account-name')).toHaveTextContent('collector');
      expect(within(header).getByTestId('site-nav-account-email')).toHaveTextContent('collector@example.com');
    });

    it('does not render the header when user is null', async () => {
      const user = userEvent.setup();
      renderMenu(null);
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.queryByTestId('site-nav-account-header')).not.toBeInTheDocument();
    });

    it('lists Settings, My submissions, Import from CSV, Log out as menuitems in order for non-admins', async () => {
      const { menu } = await openMenu();
      const items = within(menu).getAllByRole('menuitem');

      expect(items.map((el) => el.getAttribute('data-testid'))).toEqual([
        'site-nav-settings-link',
        'site-nav-my-submissions-link',
        'site-nav-import-link',
        'site-nav-logout',
      ]);
      expect(items[0]).toHaveTextContent('Settings');
      expect(items[0].getAttribute('href')).toBe('/settings');
      expect(items[1]).toHaveTextContent('My submissions');
      expect(items[1].getAttribute('href')).toBe('/catalog/mine');
      expect(items[2]).toHaveTextContent('Import from CSV');
      expect(items[2].getAttribute('href')).toBe('/collection/import');
      expect(items[3]).toHaveTextContent('Log out');
    });

    it('does not show an Admin item to non-admins', async () => {
      await openMenu();
      expect(screen.queryByTestId('site-nav-admin-link')).not.toBeInTheDocument();
    });

    it('shows Admin as the first menuitem for admins', async () => {
      const user = userEvent.setup();
      renderMenu(makeUser({ role: 'admin' }));
      await user.click(screen.getByTestId('site-nav-account-trigger'));

      const items = within(screen.getByTestId('site-nav-account-menu')).getAllByRole('menuitem');
      expect(items).toHaveLength(5);
      expect(items[0]).toBe(screen.getByTestId('site-nav-admin-link'));
      expect(items[0].getAttribute('href')).toBe('/admin/submissions');
      expect(items[0]).toHaveTextContent('Admin');
      expect(items[1]).toBe(screen.getByTestId('site-nav-settings-link'));
    });

    it('has a divider before Log out', async () => {
      const { menu } = await openMenu();
      expect(within(menu).getByRole('separator')).toBeInTheDocument();
    });

    it('has a Language group with EN/ES radios, EN checked by default', async () => {
      const { menu } = await openMenu();
      const group = within(menu).getByTestId('site-nav-account-language');
      expect(group).toHaveAttribute('role', 'group');
      expect(screen.getByRole('group', { name: 'Language' })).toBe(group);

      const en = within(group).getByTestId('site-nav-account-language-en');
      const es = within(group).getByTestId('site-nav-account-language-es');
      expect(en).toHaveAttribute('role', 'menuitemradio');
      expect(en).toHaveTextContent('EN');
      expect(en).toHaveAttribute('aria-checked', 'true');
      expect(es).toHaveAttribute('role', 'menuitemradio');
      expect(es).toHaveTextContent('ES');
      expect(es).toHaveAttribute('aria-checked', 'false');
    });

    it('does not include the removed Dashboard or Collection entries', async () => {
      const { menu } = await openMenu();
      const hrefs = within(menu)
        .getAllByRole('menuitem')
        .map((el) => el.getAttribute('href'))
        .filter(Boolean);
      expect(hrefs).not.toContain('/dashboard');
      expect(hrefs).not.toContain('/collection');
    });
  });

  describe('actions', () => {
    it('calls onLogout when Log out is clicked', async () => {
      const { user } = await openMenu();
      await user.click(screen.getByTestId('site-nav-logout'));
      expect(onLogout).toHaveBeenCalledTimes(1);
    });

    it('switches language via the radios, keeps the menu open and persists the choice', async () => {
      const { user } = await openMenu();
      await user.click(screen.getByTestId('site-nav-account-language-es'));

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-account-language-es')).toHaveAttribute('aria-checked', 'true');
      });
      expect(screen.getByTestId('site-nav-account-language-en')).toHaveAttribute('aria-checked', 'false');
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();
      expect(screen.getByTestId('site-nav-logout')).toHaveTextContent('Cerrar sesión');
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    });
  });

  describe('closing', () => {
    it('closes on Escape and returns focus to the trigger', async () => {
      const { user } = await openMenu();
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
      expect(screen.getByTestId('site-nav-account-trigger')).toHaveFocus();
    });

    it('closes on an outside click', async () => {
      const { user } = await openMenu();
      await user.click(document.body);
      expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
    });

    it('closes when the pathname changes', async () => {
      const user = userEvent.setup();
      const view = renderMenu();
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();

      usePathnameMock.mockReturnValue('/collection');
      view.rerender(
        <I18nProvider>
          <AccountMenu user={makeUser()} onLogout={onLogout} />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.queryByTestId('site-nav-account-menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('keyboard navigation', () => {
    it('moves focus to the first item when opened', async () => {
      await openMenu();
      expect(screen.getByTestId('site-nav-settings-link')).toHaveFocus();
    });

    it('focuses Admin first for admins', async () => {
      const user = userEvent.setup();
      renderMenu(makeUser({ role: 'admin' }));
      await user.click(screen.getByTestId('site-nav-account-trigger'));
      expect(screen.getByTestId('site-nav-admin-link')).toHaveFocus();
    });

    it('opens from the closed trigger with ArrowDown', async () => {
      const user = userEvent.setup();
      renderMenu();
      screen.getByTestId('site-nav-account-trigger').focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('site-nav-account-menu')).toBeInTheDocument();
    });

    it('ArrowDown walks the items in order', async () => {
      const { user } = await openMenu();
      for (let i = 1; i < ORDER.length; i += 1) {
        await user.keyboard('{ArrowDown}');
        expect(screen.getByTestId(ORDER[i])).toHaveFocus();
      }
    });

    it('ArrowDown wraps from the last item to the first', async () => {
      const { user } = await openMenu();
      screen.getByTestId('site-nav-logout').focus();
      await user.keyboard('{ArrowDown}');
      expect(screen.getByTestId('site-nav-settings-link')).toHaveFocus();
    });

    it('ArrowUp moves back and wraps from the first item to the last', async () => {
      const { user } = await openMenu();
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('site-nav-logout')).toHaveFocus();
      await user.keyboard('{ArrowUp}');
      expect(screen.getByTestId('site-nav-account-language-es')).toHaveFocus();
    });

    it('End and Home jump to the last and first item', async () => {
      const { user } = await openMenu();
      await user.keyboard('{End}');
      expect(screen.getByTestId('site-nav-logout')).toHaveFocus();
      await user.keyboard('{Home}');
      expect(screen.getByTestId('site-nav-settings-link')).toHaveFocus();
    });
  });
});
