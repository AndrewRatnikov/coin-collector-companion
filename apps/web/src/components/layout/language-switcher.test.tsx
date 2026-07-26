/**
 * Tests for: LanguageSwitcher
 * Contract source: runs/run_20260726_221855/plan.md § Interface Contract → Component: LanguageSwitcher
 * Covers criteria: #3, #4 (from prd.md)
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

function renderSwitcher() {
  return render(
    <I18nProvider>
      <LanguageSwitcher />
    </I18nProvider>,
  );
}

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('rendering', () => {
    it('renders the root wrapper and both language buttons', () => {
      renderSwitcher();

      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-en')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-es')).toBeInTheDocument();
    });

    it('labels the buttons "English" and "Spanish"', () => {
      renderSwitcher();

      expect(screen.getByTestId('language-switcher-en')).toHaveTextContent('English');
      expect(screen.getByTestId('language-switcher-es')).toHaveTextContent('Spanish');
    });
  });

  describe('criterion 3: visible switcher reflects and changes the active locale', () => {
    it('marks the English button as pressed by default', () => {
      renderSwitcher();

      expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'false');
    });

    it('marks the Spanish button as pressed after it is clicked', async () => {
      const user = userEvent.setup();
      renderSwitcher();

      await user.click(screen.getByTestId('language-switcher-es'));

      await waitFor(() => {
        expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'true');
      });
      expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('criterion 4: selecting a language persists it', () => {
    it('writes "es" to localStorage under LOCALE_STORAGE_KEY after clicking the Spanish button', async () => {
      const user = userEvent.setup();
      renderSwitcher();

      await user.click(screen.getByTestId('language-switcher-es'));

      await waitFor(() => {
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
      });
    });
  });
});
