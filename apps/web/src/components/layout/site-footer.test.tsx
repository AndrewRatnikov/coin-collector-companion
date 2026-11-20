/**
 * Tests for: SiteFooter
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: SiteFooter
 *                   runs/run_20261120_225014/plan.md § Interface Contract → Component: SiteFooter (modified)
 * Covers criteria: #8 (from prd.md; Help omitted per plan D1), and #14 of run_20261120_225014 (Privacy link)
 *
 * run_20261120_225014: a third footer link (site-footer-privacy-link, /privacy) is added, so the
 * "exactly the two footer nav links" test becomes "exactly the three". Every other test is unchanged.
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from '@/components/layout/site-footer';
import { I18nProvider } from '@/lib/i18n/i18n-context';

describe('SiteFooter', () => {
  it('renders a footer nav named "Footer" inside the footer', () => {
    render(<SiteFooter />);

    const footer = screen.getByTestId('site-footer');
    const nav = screen.getByTestId('site-footer-nav');
    expect(footer).toContainElement(nav);
    expect(screen.getByRole('navigation', { name: 'Footer' })).toBe(nav);
  });

  it('links Glossary to /glossary', () => {
    render(<SiteFooter />);

    const link = screen.getByTestId('site-footer-glossary-link');
    expect(link).toHaveTextContent('Glossary');
    expect(link.getAttribute('href')).toBe('/glossary');
  });

  it('links Send feedback to /settings/feedback', () => {
    render(<SiteFooter />);

    const link = screen.getByTestId('site-footer-feedback-link');
    expect(link).toHaveTextContent('Send feedback');
    expect(link.getAttribute('href')).toBe('/settings/feedback');
  });

  it('links Privacy to /privacy, inside the footer nav', () => {
    render(<SiteFooter />);

    const link = screen.getByTestId('site-footer-privacy-link');
    expect(link).toHaveTextContent('Privacy');
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(screen.getByTestId('site-footer-nav')).toContainElement(link);
  });

  it('shows Privacidad in Spanish', () => {
    render(
      <I18nProvider initialLocale="es">
        <SiteFooter />
      </I18nProvider>,
    );

    expect(screen.getByTestId('site-footer-privacy-link')).toHaveTextContent('Privacidad');
    expect(screen.getByTestId('site-footer-privacy-link').getAttribute('href')).toBe('/privacy');
  });

  it('contains exactly the three footer nav links, privacy last', () => {
    render(<SiteFooter />);

    const hrefs = within(screen.getByTestId('site-footer-nav'))
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/glossary', '/settings/feedback', '/privacy']);
  });

  it('keeps the Wikipedia attribution', () => {
    render(<SiteFooter />);

    const footer = screen.getByTestId('site-footer');
    expect(footer.textContent).toContain('Wikipedia');
    expect(footer.textContent).toContain('CC BY-SA 4.0');
  });
});
