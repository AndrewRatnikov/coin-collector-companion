/**
 * Tests for: LandingHero
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: LandingHero
 * Covers criteria: #8, #18 (from prd.md)
 *
 * The variant-B flow through the hero is tested in gap-demo.test.tsx.
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LandingHero, type LandingHeroProps } from '@/components/landing/landing-hero';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';
import { fill } from '@/lib/fill-template';

function renderHero(over: Partial<LandingHeroProps> = {}) {
  return render(<LandingHero setCoinCount={142} fullChecklistHref="/sets/canonical" {...over} />);
}

describe('LandingHero: copy and calls to action', () => {
  it('renders the hero root with exactly one h1 carrying the headline', () => {
    renderHero();

    expect(screen.getByTestId('landing-hero')).toBeInTheDocument();
    const headline = screen.getByTestId('landing-headline');
    expect(headline.tagName).toBe('H1');
    expect(headline).toHaveTextContent('See what you’re still missing.');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('renders the long and the short body text, switched by CSS', () => {
    renderHero();

    expect(screen.getByTestId('landing-body')).toHaveTextContent(en['landing.body']);
    expect(screen.getByTestId('landing-body-short')).toHaveTextContent(en['landing.bodyShort']);
    expect(en['landing.body']).not.toBe(en['landing.bodyShort']);
  });

  it('links the primary call to action to /signup and the secondary one to /sets/canonical', () => {
    renderHero();

    const primary = screen.getByTestId('landing-cta-primary');
    expect(primary).toHaveAttribute('href', '/signup');
    expect(primary).toHaveTextContent('Create a free account');
    const secondary = screen.getByTestId('landing-cta-secondary');
    expect(secondary).toHaveAttribute('href', '/sets/canonical');
    expect(secondary).toHaveTextContent('Browse checklists');
  });

  it('shows the honest line', () => {
    renderHero();

    expect(screen.getByTestId('landing-honest')).toHaveTextContent(en['landing.honest']);
  });

  it('renders in Spanish under a Spanish provider', () => {
    render(
      <I18nProvider initialLocale="es">
        <LandingHero setCoinCount={142} fullChecklistHref="/sets/canonical" />
      </I18nProvider>,
    );

    expect(screen.getByTestId('landing-headline')).toHaveTextContent(es['landing.headline']);
    expect(screen.getByTestId('landing-cta-primary')).toHaveTextContent(es['landing.ctaPrimary']);
    expect(es['landing.headline']).not.toBe(en['landing.headline']);
  });
});

describe('LandingHero: demo and want list', () => {
  it('contains the demo and the want list built from the 24-coin sample', () => {
    renderHero();

    expect(within(screen.getByTestId('landing-hero')).getByTestId('gap-demo')).toBeInTheDocument();
    expect(within(screen.getByTestId('landing-hero')).getByTestId('want-list')).toBeInTheDocument();
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
    expect(screen.getAllByTestId('want-list-row')).toHaveLength(6);
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('8 coins');
  });

  it('is read-only by default and variant B with interactive', () => {
    const { unmount } = renderHero();
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gap-demo-try-hint')).not.toBeInTheDocument();
    unmount();

    renderHero({ interactive: true });

    expect(screen.getAllByTestId('status-toggle')).toHaveLength(24);
    expect(screen.getByTestId('gap-demo-try-hint')).toBeInTheDocument();
  });

  it('uses the 1909-1912 slice for the demo and the want list when compact', () => {
    renderHero({ compact: true });

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('8 of 12 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
    expect(screen.getAllByTestId('coin-card')).toHaveLength(12);
    expect(screen.getAllByTestId('want-list-row')).toHaveLength(3);
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('4 coins');
    expect(screen.getByTestId('want-list-range')).toHaveTextContent('1909–1912');
  });

  it('passes the full checklist href through to the demo', () => {
    const { unmount } = renderHero({ fullChecklistHref: '/sets/canonical/xyz' });
    expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical/xyz');
    unmount();

    renderHero({ fullChecklistHref: '/sets/canonical' });

    expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical');
  });

  it('passes the set coin count through to the demo subtitle', () => {
    const { unmount } = renderHero({ setCoinCount: 142 });
    expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent(
      fill(en['landing.demoSubtitle'], { shown: 24, total: 142 }),
    );
    unmount();

    renderHero({ setCoinCount: 150 });

    expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent(
      fill(en['landing.demoSubtitle'], { shown: 24, total: 150 }),
    );
  });

  it('makes no network request', () => {
    const calls: unknown[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(args);
      return Promise.reject(new Error('no network in tests'));
    }) as typeof fetch;
    try {
      renderHero();
    } finally {
      globalThis.fetch = original;
    }

    expect(calls).toHaveLength(0);
  });
});
