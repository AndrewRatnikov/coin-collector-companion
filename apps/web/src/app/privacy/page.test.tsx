/**
 * Tests for: PrivacyPage
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Component: PrivacyPage
 * Covers criteria: #14 (from prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PrivacyPage from '@/app/privacy/page';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

describe('PrivacyPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('rendering without a login', () => {
    it('renders the page root as main with no auth wait', () => {
      render(<PrivacyPage />);

      const root = screen.getByTestId('privacy-page');
      expect(root.tagName).toBe('MAIN');
      expect(within(root).getAllByRole('heading', { level: 1 })).toHaveLength(1);
    });

    it('has an h1 title and an intro paragraph', () => {
      render(<PrivacyPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacy');
      expect(screen.getByTestId('privacy-intro')).toHaveTextContent(en['privacy.intro']);
    });

    it('uses the glossary page width and a limited line length for body text', () => {
      render(<PrivacyPage />);

      expect(screen.getByTestId('privacy-page').className).toContain('max-w-[1080px]');
    });
  });

  describe('sections (English)', () => {
    it('says what the app stores: the account email', () => {
      render(<PrivacyPage />);

      const section = screen.getByTestId('privacy-stored');
      expect(section.tagName).toBe('SECTION');
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(en['privacy.storedHeading']);
      expect(section.textContent?.toLowerCase()).toContain('email');
      expect(section).toHaveTextContent(en['privacy.storedBody']);
    });

    it('says Sentry receives error reports', () => {
      render(<PrivacyPage />);

      const section = screen.getByTestId('privacy-errors');
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(en['privacy.errorsHeading']);
      expect(section).toHaveTextContent('Sentry');
      expect(section).toHaveTextContent(en['privacy.errorsBody']);
      expect(section).not.toHaveTextContent('PostHog');
    });

    it('says PostHog counts visits without cookies', () => {
      render(<PrivacyPage />);

      const section = screen.getByTestId('privacy-analytics');
      expect(within(section).getByRole('heading', { level: 2 })).toHaveTextContent(en['privacy.analyticsHeading']);
      expect(section).toHaveTextContent('PostHog');
      expect(section).toHaveTextContent('cookies');
      expect(section).toHaveTextContent(en['privacy.analyticsBody']);
      expect(section).not.toHaveTextContent('Sentry');
    });

    it('has exactly three h2 sections inside the page', () => {
      render(<PrivacyPage />);

      const headings = within(screen.getByTestId('privacy-page')).getAllByRole('heading', { level: 2 });
      expect(headings).toHaveLength(3);
    });
  });

  describe('Spanish', () => {
    it('shows the Spanish title and section copy', () => {
      render(
        <I18nProvider initialLocale="es">
          <PrivacyPage />
        </I18nProvider>,
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Privacidad');
      expect(screen.getByTestId('privacy-intro')).toHaveTextContent(es['privacy.intro']);
      expect(screen.getByTestId('privacy-stored')).toHaveTextContent(es['privacy.storedBody']);
      expect(screen.getByTestId('privacy-errors')).toHaveTextContent('Sentry');
      expect(screen.getByTestId('privacy-analytics')).toHaveTextContent('PostHog');
      expect(screen.getByTestId('privacy-analytics')).not.toHaveTextContent(en['privacy.analyticsBody']);
    });
  });
});
