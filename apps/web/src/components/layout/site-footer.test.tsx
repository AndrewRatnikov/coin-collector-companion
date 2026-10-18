/**
 * Tests for: SiteFooter
 * Contract source: runs/run_20261018_085900/plan.md § Interface Contract → Component: SiteFooter
 * Covers criteria: #8 (from prd.md; Help omitted per plan D1)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SiteFooter } from '@/components/layout/site-footer';

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

  it('contains exactly the two footer nav links', () => {
    render(<SiteFooter />);

    const hrefs = within(screen.getByTestId('site-footer-nav'))
      .getAllByRole('link')
      .map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/glossary', '/settings/feedback']);
  });

  it('keeps the Wikipedia attribution', () => {
    render(<SiteFooter />);

    const footer = screen.getByTestId('site-footer');
    expect(footer.textContent).toContain('Wikipedia');
    expect(footer.textContent).toContain('CC BY-SA 4.0');
  });
});
