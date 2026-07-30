/**
 * Tests for: LanguageSwitcher
 * Contract source: runs/run_20260730_153718/plan.md § Interface Contract → Component: LanguageSwitcher
 * Covers criteria: #1, #2, #3, #4, #5, #6, #7 (from prd.md)
 *
 * run_20260730_153718: migrates LanguageSwitcher from two <button> toggles to a
 * single native <select> dropdown. Replaces the entire prior test file (old
 * `language-switcher-en`/`language-switcher-es` button testids and `aria-pressed`
 * assertions no longer apply — see plan.md § Interface Contract).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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
    it('renders the root wrapper and a single select dropdown, with no leftover button-based switcher', () => {
      renderSwitcher();

      expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
      expect(screen.getByTestId('language-switcher-select')).toBeInTheDocument();
      expect(screen.queryByTestId('language-switcher-en')).not.toBeInTheDocument();
      expect(screen.queryByTestId('language-switcher-es')).not.toBeInTheDocument();
    });
  });

  describe('criterion 3: dropdown exposes exactly the two existing locale options', () => {
    it('has exactly two options, labeled "English" and "Spanish"', () => {
      renderSwitcher();

      const select = screen.getByTestId('language-switcher-select');
      const options = within(select).getAllByRole('option');

      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('English');
      expect(options[0]).toHaveValue('en');
      expect(options[1]).toHaveTextContent('Spanish');
      expect(options[1]).toHaveValue('es');
    });
  });

  describe('criterion 2: trigger displays the currently active language', () => {
    it('shows English as the selected value by default', () => {
      renderSwitcher();

      expect(screen.getByTestId('language-switcher-select')).toHaveValue('en');
    });
  });

  describe('criterion 4: selecting a language updates the displayed value', () => {
    it('updates the select value to "es" after choosing Spanish', async () => {
      const user = userEvent.setup();
      renderSwitcher();

      await user.selectOptions(screen.getByTestId('language-switcher-select'), 'es');

      await waitFor(() => {
        expect(screen.getByTestId('language-switcher-select')).toHaveValue('es');
      });
    });
  });

  describe('criterion 5: selecting a language persists it', () => {
    it('writes "es" to localStorage under LOCALE_STORAGE_KEY after selecting Spanish', async () => {
      const user = userEvent.setup();
      renderSwitcher();

      await user.selectOptions(screen.getByTestId('language-switcher-select'), 'es');

      await waitFor(() => {
        expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
      });
    });
  });

  describe('criterion 6: initial render reflects a previously persisted locale', () => {
    it('restores "es" as the selected value when it was already stored before mount', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
      renderSwitcher();

      await waitFor(() => {
        expect(screen.getByTestId('language-switcher-select')).toHaveValue('es');
      });
    });
  });

  describe('criterion 7: dropdown uses native, keyboard-operable combobox semantics', () => {
    it('exposes the select element via the implicit combobox role', () => {
      renderSwitcher();

      const combobox = screen.getByRole('combobox');
      expect(combobox).toBe(screen.getByTestId('language-switcher-select'));
    });
  });
});
