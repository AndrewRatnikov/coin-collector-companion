/**
 * Tests for: Coverage
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: Coverage
 * Covers criteria: #17 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Coverage } from '@/components/landing/coverage';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import en from '@/lib/i18n/locales/en';
import { COVERAGE_FALLBACKS } from '@/lib/landing/landing-data';

describe('Coverage', () => {
  it('shows the fallback counts in the meta lines', () => {
    render(<Coverage counts={COVERAGE_FALLBACKS} />);

    expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('142 coins · 7 key dates');
    expect(screen.getByTestId('landing-coverage-ukraine-meta')).toHaveTextContent(
      '187 circulation · 31 commemoratives',
    );
  });

  it('shows the counts it is given (not constants)', () => {
    render(<Coverage counts={{ coins: 150, keyDates: 9, circulation: 200, commemoratives: 40 }} />);

    expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('150 coins · 9 key dates');
    expect(screen.getByTestId('landing-coverage-ukraine-meta')).toHaveTextContent(
      '200 circulation · 40 commemoratives',
    );
  });

  it('has an h2, the intro, and a submit link to /catalog', () => {
    render(<Coverage counts={COVERAGE_FALLBACKS} />);

    const root = screen.getByTestId('landing-coverage');
    expect(within(root).getByRole('heading', { level: 2, name: en['landing.coverageHeading'] })).toBeInTheDocument();
    expect(root).toHaveTextContent(en['landing.coverageIntro']);
    const submit = screen.getByTestId('landing-coverage-submit');
    expect(submit).toHaveAttribute('href', '/catalog');
    expect(submit).toHaveTextContent(en['landing.coverageSubmit']);
  });

  it('describes the Lincoln and Ukraine cards with their date ranges and coins', () => {
    render(<Coverage counts={COVERAGE_FALLBACKS} />);

    const root = screen.getByTestId('landing-coverage');
    expect(root).toHaveTextContent(en['landing.coverageLincolnTitle']);
    expect(root).toHaveTextContent(en['landing.coverageLincolnBody']);
    expect(root).toHaveTextContent('1909–1958');
    expect(root).toHaveTextContent(en['landing.coverageUkraineTitle']);
    expect(root).toHaveTextContent(en['landing.coverageUkraineBody']);
    expect(root).toHaveTextContent('1992–');
    expect(within(root).getAllByTestId('placeholder-coin')).toHaveLength(2);
  });

  it('has no skeleton and no server waking notice', () => {
    render(<Coverage counts={COVERAGE_FALLBACKS} />);

    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('makes no claim about thousands of coins', () => {
    render(<Coverage counts={COVERAGE_FALLBACKS} />);

    expect(screen.getByTestId('landing-coverage').textContent).not.toMatch(/thousands/i);
  });

  it('renders in Spanish under a Spanish provider', () => {
    render(
      <I18nProvider initialLocale="es">
        <Coverage counts={COVERAGE_FALLBACKS} />
      </I18nProvider>,
    );

    expect(screen.getByTestId('landing-coverage-submit')).not.toHaveTextContent(en['landing.coverageSubmit']);
    expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('142');
  });
});
