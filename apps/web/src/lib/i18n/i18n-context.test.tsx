/**
 * Tests for: I18nProvider, useTranslation
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Module: i18n context
 * Covers criteria: #3, #4, #8 (from prd.md)
 *
 * The local `Consumer` fixture below deliberately avoids `data-testid` — every
 * data-testid used anywhere in this run's tests must be declared in plan.md's
 * Interface Contract, and a test-only fixture component has no contract entry.
 * Text/role queries are used instead.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, useTranslation } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';
import en from '@/lib/i18n/locales/en';

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

describe('useTranslation', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
