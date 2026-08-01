/**
 * Tests for: GlossaryPage
 * Contract source: runs/run_20260801_142634/plan.md § Interface Contract → Component: GlossaryPage
 * Covers criteria: #1, #2, #3, #4, #6, #7 (from prd.md)
 *
 * `glossary-term`/`glossary-term-label`/`glossary-term-definition` are deliberately
 * the SAME literal testid repeated on every row in both tier lists (per plan.md's
 * Interface Contract — mirrors the existing `public-set-item` convention in
 * sets/public/page.tsx). Tests below identify specific terms via text-content
 * assertions with `within()`/`getAllByTestId`, never via a unique per-term testid
 * (no such testid exists per the contract).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import GlossaryPage from '@/app/glossary/page';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

describe('GlossaryPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('criterion 1: renders anonymously, no auth gating', () => {
    it('renders the root element with no stored token and no auth wrapper delay', () => {
      render(<GlossaryPage />);

      expect(screen.getByTestId('glossary-page')).toBeInTheDocument();
    });

    it('renders full content synchronously (no require-auth-pending state ever appears)', () => {
      render(<GlossaryPage />);

      expect(screen.queryByTestId('require-auth-pending')).not.toBeInTheDocument();
      expect(screen.getByTestId('glossary-intro')).toBeInTheDocument();
    });
  });

  describe('criterion 2: app-grounded terms tier', () => {
    it('renders exactly 11 terms in the app-terms list', () => {
      render(<GlossaryPage />);

      const appList = screen.getByTestId('glossary-app-terms-list');
      expect(within(appList).getAllByTestId('glossary-term')).toHaveLength(11);
    });

    it('renders the app-terms-heading with the expected copy', () => {
      render(<GlossaryPage />);

      expect(screen.getByTestId('glossary-app-terms-heading')).toHaveTextContent(
        en['glossary.appTermsHeading'],
      );
    });

    it('includes "Mint mark" with its exact definition from the Interface Contract', () => {
      render(<GlossaryPage />);

      const appList = screen.getByTestId('glossary-app-terms-list');
      const labels = within(appList).getAllByTestId('glossary-term-label');
      const mintMarkLabel = labels.find((el) => el.textContent === en['glossary.term.mintMark']);
      expect(mintMarkLabel).toBeDefined();

      const row = mintMarkLabel!.closest('[data-testid="glossary-term"]') as HTMLElement;
      const definition = within(row).getByTestId('glossary-term-definition');
      expect(definition).toHaveTextContent(en['glossary.definition.mintMark']);
    });

    it('includes "Gap view" and "Canonical set" among the app-tier labels', () => {
      render(<GlossaryPage />);

      const appList = screen.getByTestId('glossary-app-terms-list');
      const labelTexts = within(appList)
        .getAllByTestId('glossary-term-label')
        .map((el) => el.textContent);

      expect(labelTexts).toContain(en['glossary.term.gapView']);
      expect(labelTexts).toContain(en['glossary.term.canonicalSet']);
    });
  });

  describe('criterion 3: general numismatic terms tier', () => {
    it('renders exactly 9 terms in the general-terms list', () => {
      render(<GlossaryPage />);

      const generalList = screen.getByTestId('glossary-general-terms-list');
      expect(within(generalList).getAllByTestId('glossary-term')).toHaveLength(9);
    });

    it('renders the general-terms-heading with the expected copy', () => {
      render(<GlossaryPage />);

      expect(screen.getByTestId('glossary-general-terms-heading')).toHaveTextContent(
        en['glossary.generalTermsHeading'],
      );
    });

    it('includes "Proof" with its exact definition from the Interface Contract', () => {
      render(<GlossaryPage />);

      const generalList = screen.getByTestId('glossary-general-terms-list');
      const labels = within(generalList).getAllByTestId('glossary-term-label');
      const proofLabel = labels.find((el) => el.textContent === en['glossary.term.proof']);
      expect(proofLabel).toBeDefined();

      const row = proofLabel!.closest('[data-testid="glossary-term"]') as HTMLElement;
      const definition = within(row).getByTestId('glossary-term-definition');
      expect(definition).toHaveTextContent(en['glossary.definition.proof']);
    });

    it('includes "Key date" and "Numismatics" among the general-tier labels', () => {
      render(<GlossaryPage />);

      const generalList = screen.getByTestId('glossary-general-terms-list');
      const labelTexts = within(generalList)
        .getAllByTestId('glossary-term-label')
        .map((el) => el.textContent);

      expect(labelTexts).toContain(en['glossary.term.keyDate']);
      expect(labelTexts).toContain(en['glossary.term.numismatics']);
    });
  });

  describe('criterion 4 & 7: full list renders from i18n, no missing-translation fallback', () => {
    it('renders 20 total term rows across both tiers', () => {
      render(<GlossaryPage />);

      expect(screen.getAllByTestId('glossary-term')).toHaveLength(20);
    });

    it('never renders a raw untranslated glossary.* key as visible text', () => {
      render(<GlossaryPage />);

      const root = screen.getByTestId('glossary-page');
      expect(root.textContent).not.toMatch(/glossary\.(term|definition)\.[a-zA-Z]+/);
    });

    it('every rendered label and definition is non-empty', () => {
      render(<GlossaryPage />);

      const labels = screen.getAllByTestId('glossary-term-label');
      const definitions = screen.getAllByTestId('glossary-term-definition');
      expect(labels).toHaveLength(20);
      expect(definitions).toHaveLength(20);
      for (const label of labels) {
        expect(label.textContent?.length).toBeGreaterThan(0);
      }
      for (const definition of definitions) {
        expect(definition.textContent?.length).toBeGreaterThan(0);
      }
    });
  });

  describe('criterion 6: locale switch re-renders term labels and definitions', () => {
    it('renders Spanish term/definition copy when the stored locale is "es"', async () => {
      localStorage.setItem(LOCALE_STORAGE_KEY, 'es');

      render(
        <I18nProvider>
          <GlossaryPage />
        </I18nProvider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('glossary-app-terms-heading')).toHaveTextContent(
          es['glossary.appTermsHeading'],
        );
      });

      const appList = screen.getByTestId('glossary-app-terms-list');
      const labelTexts = within(appList)
        .getAllByTestId('glossary-term-label')
        .map((el) => el.textContent);
      expect(labelTexts).toContain(es['glossary.term.mintMark']);
      expect(labelTexts).not.toContain(en['glossary.term.mintMark']);
    });

    it('starts in English with no stored locale preference', () => {
      render(
        <I18nProvider>
          <GlossaryPage />
        </I18nProvider>,
      );

      expect(screen.getByTestId('glossary-app-terms-heading')).toHaveTextContent(
        en['glossary.appTermsHeading'],
      );
    });
  });
});
