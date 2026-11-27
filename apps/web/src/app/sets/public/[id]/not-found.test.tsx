/**
 * Tests for: route 404 page of /sets/public/[id]
 * Contract source: runs/run_20261127_120807/plan.md § Interface Contract → Route 404 pages
 * Covers criteria: #7 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PublicSetNotFound from '@/app/sets/public/[id]/not-found';

describe('PublicSetNotFound', () => {
  it('renders the set not-found content inside the route main', () => {
    render(<PublicSetNotFound />);

    const main = screen.getByTestId('public-set-not-found-page');
    expect(main.tagName).toBe('MAIN');
    const notFound = screen.getByTestId('not-found');
    expect(main).toContainElement(notFound);
    expect(notFound).toHaveAttribute('data-variant', 'set');
    expect(screen.getByTestId('not-found-title')).toHaveTextContent("This set doesn't exist or was deleted");
  });

  it('is not the checklist variant', () => {
    render(<PublicSetNotFound />);

    expect(screen.getByTestId('not-found')).not.toHaveAttribute('data-variant', 'checklist');
    expect(screen.queryByTestId('canonical-set-not-found-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('not-found-title')).not.toHaveTextContent("This checklist");
  });
});
