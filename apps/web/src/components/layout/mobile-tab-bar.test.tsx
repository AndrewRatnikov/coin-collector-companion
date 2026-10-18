/**
 * Tests for: MobileTabBar
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: MobileTabBar
 * Covers criteria: #11, #13 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MobileTabBar } from '@/components/layout/mobile-tab-bar';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

const usePathnameMock = vi.fn(() => '/dashboard');

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

function tabHrefs() {
  return within(screen.getByTestId('site-nav-tabbar'))
    .getAllByRole('link')
    .map((a) => a.getAttribute('href'));
}

describe('MobileTabBar', () => {
  beforeEach(() => {
    localStorage.clear();
    usePathnameMock.mockReset();
    usePathnameMock.mockReturnValue('/dashboard');
  });

  describe('signed in', () => {
    it('is a nav named "Main" with My sets, Collection, Catalog in order', () => {
      render(<MobileTabBar isAuthenticated />);

      const bar = screen.getByTestId('site-nav-tabbar');
      expect(screen.getByRole('navigation', { name: 'Main' })).toBe(bar);
      expect(tabHrefs()).toEqual(['/dashboard', '/collection', '/catalog']);
      expect(screen.getByTestId('site-nav-tab-my-sets')).toHaveTextContent('My sets');
      expect(screen.getByTestId('site-nav-tab-collection')).toHaveTextContent('Collection');
      expect(screen.getByTestId('site-nav-tab-catalog')).toHaveTextContent('Catalog');
    });

    it('does not show the signed-out tabs', () => {
      render(<MobileTabBar isAuthenticated />);

      expect(screen.queryByTestId('site-nav-tab-checklists')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-tab-glossary')).not.toBeInTheDocument();
    });

    it.each([
      ['/dashboard', 'site-nav-tab-my-sets'],
      ['/collection', 'site-nav-tab-collection'],
      ['/collection/import', 'site-nav-tab-collection'],
      ['/catalog/123', 'site-nav-tab-catalog'],
    ])('marks only the matching tab current at %s', (pathname, activeId) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<MobileTabBar isAuthenticated />);

      const ids = ['site-nav-tab-my-sets', 'site-nav-tab-collection', 'site-nav-tab-catalog'];
      for (const id of ids) {
        if (id === activeId) {
          expect(screen.getByTestId(id)).toHaveAttribute('aria-current', 'page');
        } else {
          expect(screen.getByTestId(id)).not.toHaveAttribute('aria-current');
        }
      }
    });

    it('marks no tab current on an unrelated route', () => {
      usePathnameMock.mockReturnValue('/settings');
      render(<MobileTabBar isAuthenticated />);

      for (const link of within(screen.getByTestId('site-nav-tabbar')).getAllByRole('link')) {
        expect(link).not.toHaveAttribute('aria-current');
      }
    });
  });

  describe('signed out', () => {
    it('shows Catalog, Checklists, Glossary in order', () => {
      usePathnameMock.mockReturnValue('/');
      render(<MobileTabBar isAuthenticated={false} />);

      expect(tabHrefs()).toEqual(['/catalog', '/sets', '/glossary']);
      expect(screen.getByTestId('site-nav-tab-catalog')).toHaveTextContent('Catalog');
      expect(screen.getByTestId('site-nav-tab-checklists')).toHaveTextContent('Checklists');
      expect(screen.getByTestId('site-nav-tab-glossary')).toHaveTextContent('Glossary');
      expect(screen.queryByTestId('site-nav-tab-my-sets')).not.toBeInTheDocument();
      expect(screen.queryByTestId('site-nav-tab-collection')).not.toBeInTheDocument();
    });

    it.each([
      ['/catalog', 'site-nav-tab-catalog'],
      ['/sets/public', 'site-nav-tab-checklists'],
      ['/glossary', 'site-nav-tab-glossary'],
    ])('marks only the matching tab current at %s', (pathname, activeId) => {
      usePathnameMock.mockReturnValue(pathname);
      render(<MobileTabBar isAuthenticated={false} />);

      const ids = ['site-nav-tab-catalog', 'site-nav-tab-checklists', 'site-nav-tab-glossary'];
      for (const id of ids) {
        if (id === activeId) {
          expect(screen.getByTestId(id)).toHaveAttribute('aria-current', 'page');
        } else {
          expect(screen.getByTestId(id)).not.toHaveAttribute('aria-current');
        }
      }
    });
  });

  describe('Spanish', () => {
    it('shows the Spanish labels when es is stored (signed in)', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
      render(
        <I18nProvider>
          <MobileTabBar isAuthenticated />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-tab-my-sets')).toHaveTextContent('Mis colecciones');
      });
      expect(screen.getByTestId('site-nav-tab-collection')).toHaveTextContent('Colección');
      expect(screen.getByTestId('site-nav-tab-catalog')).toHaveTextContent('Catálogo');
    });

    it('shows the Spanish labels when es is stored (signed out)', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
      render(
        <I18nProvider>
          <MobileTabBar isAuthenticated={false} />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('site-nav-tab-checklists')).toHaveTextContent('Listas de control');
      });
      expect(screen.getByTestId('site-nav-tab-glossary')).toHaveTextContent('Glosario');
    });
  });
});
