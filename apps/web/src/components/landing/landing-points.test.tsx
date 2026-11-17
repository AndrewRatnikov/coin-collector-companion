/**
 * Tests for: LandingPoints
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: LandingPoints
 * Covers criteria: #8, #18 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { LandingPoints } from '@/components/landing/landing-points';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import en from '@/lib/i18n/locales/en';
import es from '@/lib/i18n/locales/es';

describe('LandingPoints', () => {
  it('renders the band with a hidden-from-sight h2 and three points', () => {
    render(<LandingPoints />);

    const root = screen.getByTestId('landing-points');
    expect(within(root).getByRole('heading', { level: 2, name: en['landing.pointsHeading'] })).toBeInTheDocument();
    expect(screen.getAllByTestId('landing-point')).toHaveLength(3);
  });

  it('gives each point an h3 title and body text from the landing area, in order', () => {
    render(<LandingPoints />);

    const points = screen.getAllByTestId('landing-point');
    const titles = [en['landing.p1Title'], en['landing.p2Title'], en['landing.p3Title']];
    const bodies = [en['landing.p1Body'], en['landing.p2Body'], en['landing.p3Body']];
    points.forEach((point, index) => {
      expect(within(point).getByRole('heading', { level: 3 })).toHaveTextContent(titles[index]);
      expect(point).toHaveTextContent(bodies[index]);
    });
    expect(new Set(titles).size).toBe(3);
  });

  it('gives each point a decorative aria-hidden visual', () => {
    render(<LandingPoints />);

    for (const point of screen.getAllByTestId('landing-point')) {
      expect(point.querySelector('[aria-hidden="true"]')).not.toBeNull();
    }
  });

  it('renders the point titles in Spanish under a Spanish provider', () => {
    render(
      <I18nProvider initialLocale="es">
        <LandingPoints />
      </I18nProvider>,
    );

    const points = screen.getAllByTestId('landing-point');
    expect(points[0]).toHaveTextContent(es['landing.p1Title']);
    expect(points[2]).toHaveTextContent(es['landing.p3Title']);
    expect(es['landing.p1Title']).not.toBe(en['landing.p1Title']);
  });
});
