/**
 * Tests for: route 404 page of /sets/canonical/[id]
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Route 404 pages
 * Covers criteria: #7 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import CanonicalSetNotFound from '@/app/sets/canonical/[id]/not-found';

describe('CanonicalSetNotFound', () => {
  it('renders the checklist not-found content inside the route main', () => {
    render(<CanonicalSetNotFound />);

    const main = screen.getByTestId('canonical-set-not-found-page');
    expect(main.tagName).toBe('MAIN');
    const notFound = screen.getByTestId('not-found');
    expect(main).toContainElement(notFound);
    expect(notFound).toHaveAttribute('data-variant', 'checklist');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This checklist doesn't exist");
  });

  it('is not the public set variant', () => {
    render(<CanonicalSetNotFound />);

    expect(screen.getByTestId('not-found')).not.toHaveAttribute('data-variant', 'set');
    expect(screen.queryByTestId('public-set-not-found-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-found-title')).not.toHaveTextContent('This set');
  });
});
