/**
 * Tests for: NotFound (unknown URLs)
 * Contract source: runs/run_20261112_212821/plan.md § Interface Contract → Page: NotFound
 * Covers criteria: #5
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import NotFound from '@/app/not-found';

describe('NotFound page', () => {
  it('renders the page variant of NotFoundContent inside the main wrapper', () => {
    render(<NotFound />);

    const page = screen.getByTestId('not-found-page');
    expect(page.tagName).toBe('MAIN');
    const content = within(page).getByTestId('not-found');
    expect(content).toHaveAttribute('data-variant', 'page');
    expect(within(page).getByTestId('not-found-title')).toHaveTextContent('Page not found');
  });

  it('offers the catalog link', () => {
    render(<NotFound />);

    expect(screen.getByTestId('not-found-catalog-link')).toHaveAttribute('href', '/catalog');
  });
});
