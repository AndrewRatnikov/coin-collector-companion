/**
 * Tests for: I18nProvider, useTranslation
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: i18n context
 *                   runs/run_20261117_063301/plan.md § Interface Contract → Provider: I18nProvider
 * Covers criteria: #3, #4, #8 (from prd.md), and #6 of run_20261117_063301
 *
 * The local `Consumer` fixture below deliberately avoids `data-testid` — every
 * data-testid used anywhere in this run's tests must be declared in plan.md's
 * Interface Contract, and a test-only fixture component has no contract entry.
 * Text/role queries are used instead.
 *
 * run_20261117_063301: the existing tests are unchanged apart from clearing the locale cookie in
 * beforeEach. New blocks cover initialLocale, the cookie writes and the localStorage migration.
 */

import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useTranslation } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

function Consumer() {
  const { locale, t, setLocale } = useTranslation();
  return (
    <div>
      <p>locale:{locale}</p>
      <p>{t('nav.catalog')}</p>
      <button type="button" onClick={() => setLocale('es')}>
        set es
      </button>
    </div>
  );
}

function Switcher() {
  const { locale, t, setLocale } = useTranslation();
  return (
    <div>
      <p>{`current:${locale}`}</p>
      <p>{t('nav.catalog')}</p>
      <button type="button" onClick={() => setLocale('en')}>
        switch en
      </button>
      <button type="button" onClick={() => setLocale('es')}>
        switch es
      </button>
    </div>
  );
}

const COOKIE = 'ccc-locale=es; path=/; max-age=31536000; SameSite=Lax';

function clearCookie() {
  document.cookie = 'ccc-locale=; max-age=0; path=/';
}

function cookieWrites(spy: { mock: { calls: unknown[][] } }): string[] {
  return spy.mock.calls.map((call) => String(call[0])).filter((value) => value.startsWith('ccc-locale='));
}

describe('useTranslation', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCookie();
  });

  describe('criterion 8: default context works with no I18nProvider ancestor', () => {
    it('resolves English text and reports locale "en" with no provider in the tree', () => {
      render(<Consumer />);

      expect(screen.getByText('locale:en')).toBeInTheDocument();
      expect(screen.getByText(en['nav.catalog'])).toBeInTheDocument();
    });

    it('does not throw when setLocale is called with no provider in the tree', async () => {
      const user = userEvent.setup();
      render(<Consumer />);

      await expect(
        user.click(screen.getByRole('button', { name: 'set es' })),
      ).resolves.not.toThrow();
    });
  });
});

describe('I18nProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    clearCookie();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearCookie();
  });

  describe('criterion 3: switching locale re-renders translated text', () => {
    it('starts on English and switches every consumer to Spanish after setLocale("es")', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider>
          <Consumer />
        </I18nProvider>,
      );

      expect(screen.getByText('locale:en')).toBeInTheDocument();
      expect(screen.getByText(en['nav.catalog'])).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'set es' }));

      await waitFor(() => {
        expect(screen.getByText('locale:es')).toBeInTheDocument();
      });
      expect(screen.queryByText(en['nav.catalog'])).not.toBeInTheDocument();
    });
  });

  describe('document.documentElement.lang stays in sync with locale', () => {
    it('sets html lang to "es" after switching and back to "en" after switching back', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider>
          <Consumer />
        </I18nProvider>,
      );

      expect(document.documentElement.lang).toBe('en');

      await user.click(screen.getByRole('button', { name: 'set es' }));

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('es');
      });
    });

    it('applies "es" to html lang when a stored preference is picked up on mount', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

      render(
        <I18nProvider>
          <Consumer />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('es');
      });
    });
  });

  describe('criterion 4: persisted language choice', () => {
    it('writes the selected locale to localStorage under LOCALE_STORAGE_KEY when changed', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider>
          <Consumer />
        </I18nProvider>,
      );

      await user.click(screen.getByRole('button', { name: 'set es' }));

      await waitFor(() => {
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
      });
    });

    it('applies a previously stored "es" locale after mount without any user interaction', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

      render(
        <I18nProvider>
          <Consumer />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('locale:es')).toBeInTheDocument();
      });
    });
  });

  describe('run_20261117_063301 criterion 6: initialLocale', () => {
    it('renders Spanish on the very first render with initialLocale="es" (server render)', () => {
      const html = renderToString(
        <I18nProvider initialLocale="es">
          <Switcher />
        </I18nProvider>,
      );

      expect(html).toContain('current:es');
      expect(html).toContain(es['nav.catalog']);
      expect(html).not.toContain('current:en');
    });

    it('renders English on the very first render when no initialLocale is given', () => {
      const html = renderToString(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );

      expect(html).toContain('current:en');
      expect(html).toContain(en['nav.catalog']);
    });

    it('shows Spanish text and html lang "es" with initialLocale="es" and nothing stored', async () => {
      render(
        <I18nProvider initialLocale="es">
          <Switcher />
        </I18nProvider>,
      );

      expect(screen.getByText('current:es')).toBeInTheDocument();
      expect(screen.getByText(es['nav.catalog'])).toBeInTheDocument();
      await waitFor(() => {
        expect(document.documentElement.lang).toBe('es');
      });
    });

    it('keeps English with initialLocale="en"', () => {
      render(
        <I18nProvider initialLocale="en">
          <Switcher />
        </I18nProvider>,
      );

      expect(screen.getByText('current:en')).toBeInTheDocument();
      expect(screen.getByText(en['nav.catalog'])).toBeInTheDocument();
    });

    it('lets the visitor switch away from the initial locale', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider initialLocale="es">
          <Switcher />
        </I18nProvider>,
      );

      await user.click(screen.getByRole('button', { name: 'switch en' }));

      await waitFor(() => {
        expect(screen.getByText('current:en')).toBeInTheDocument();
      });
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    });
  });

  describe('run_20261117_063301 criterion 6: setLocale writes the cookie too', () => {
    it('writes localStorage and the exact cookie string on setLocale("es")', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

      await user.click(screen.getByRole('button', { name: 'switch es' }));

      await waitFor(() => {
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
      });
      expect(cookieWrites(setter)).toEqual([COOKIE]);
    });

    it('writes the new locale (en) when switching back, not a constant', async () => {
      const user = userEvent.setup();
      render(
        <I18nProvider initialLocale="es">
          <Switcher />
        </I18nProvider>,
      );
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

      await user.click(screen.getByRole('button', { name: 'switch en' }));

      await waitFor(() => {
        expect(cookieWrites(setter)).toContain('ccc-locale=en; path=/; max-age=31536000; SameSite=Lax');
      });
      expect(document.cookie).toContain('ccc-locale=en');
    });
  });

  describe('run_20261117_063301 criterion 6: migration from localStorage on mount', () => {
    it('applies a stored "es" and writes it to the cookie when the cookie is missing', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

      render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('current:es')).toBeInTheDocument();
      });
      expect(document.cookie).toContain('ccc-locale=es');
    });

    it('writes a stored "en" to the cookie when the cookie is missing (value follows storage)', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'en');

      render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(document.cookie).toContain('ccc-locale=en');
      });
      expect(screen.getByText('current:en')).toBeInTheDocument();
    });

    it('replaces a different cookie with the stored locale and applies it', async () => {
      document.cookie = 'ccc-locale=en; path=/';
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

      render(
        <I18nProvider initialLocale="en">
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText('current:es')).toBeInTheDocument();
      });
      expect(document.cookie).toContain('ccc-locale=es');
      expect(document.cookie).not.toContain('ccc-locale=en');
    });

    it('does not rewrite the cookie when it already matches the stored locale', async () => {
      document.cookie = 'ccc-locale=es; path=/';
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

      render(
        <I18nProvider initialLocale="es">
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('es');
      });
      expect(cookieWrites(setter)).toEqual([]);
    });

    it('ignores an invalid stored value: stays English and writes no cookie', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

      render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('en');
      });
      expect(screen.getByText('current:en')).toBeInTheDocument();
      expect(cookieWrites(setter)).toEqual([]);
    });

    it('a cookie alone changes nothing: no locale switch, no localStorage write, no cookie write', async () => {
      document.cookie = 'ccc-locale=es; path=/';
      const setter = vi.spyOn(Document.prototype, 'cookie', 'set');

      render(
        <I18nProvider>
          <Switcher />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(document.documentElement.lang).toBe('en');
      });
      expect(screen.getByText('current:en')).toBeInTheDocument();
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull();
      expect(cookieWrites(setter)).toEqual([]);
    });
  });
});
