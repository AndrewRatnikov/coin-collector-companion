/**
 * Tests for: LanguageSwitcher (segmented EN/ES control)
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: LanguageSwitcher
 * Covers criteria: #6 (from prd.md)
 *
 * Replaces the dropdown-era tests from run_20260730_153718 (select testid removed).
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
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

  it('renders a group named "Language" with exactly two buttons, EN and ES', () => {
    renderSwitcher();

    const root = screen.getByTestId('language-switcher');
    expect(root).toHaveAttribute('role', 'group');
    expect(screen.getByRole('group', { name: 'Language' })).toBe(root);
    expect(within(root).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByTestId('language-switcher-en')).toHaveTextContent('EN');
    expect(screen.getByTestId('language-switcher-es')).toHaveTextContent('ES');
  });

  it('labels the buttons English and Spanish', () => {
    renderSwitcher();

    expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-label', 'English');
    expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-label', 'Spanish');
  });

  it('marks English as pressed by default', () => {
    renderSwitcher();

    expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches the pressed button when Spanish is clicked', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByTestId('language-switcher-es'));

    await waitFor(() => {
      expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches back to English after Spanish', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByTestId('language-switcher-es'));
    await user.click(screen.getByTestId('language-switcher-en'));

    await waitFor(() => {
      expect(screen.getByTestId('language-switcher-en')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'false');
  });

  it('persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    renderSwitcher();

    await user.click(screen.getByTestId('language-switcher-es'));

    await waitFor(() => {
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
    });
  });

  it('restores a stored Spanish locale and localizes the group name', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    renderSwitcher();

    await waitFor(() => {
      expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('group', { name: 'Idioma' })).toBe(screen.getByTestId('language-switcher'));
    expect(screen.getByTestId('language-switcher-es')).toHaveAttribute('aria-label', 'Español');
  });
});
