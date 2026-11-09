/**
 * Tests for: OwnershipMark
 * Contract source: runs/run_20261109_220451/plan.md § Interface Contract → Component: OwnershipMark
 * Covers criteria: #9, #12 (from run_20261109_220451's prd.md)
 *
 * There is no I18nProvider: the default context is English ("Owned" / "Missing").
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OwnershipMark } from '@/components/ui/ownership-mark';

describe('OwnershipMark', () => {
  it('shows "Owned" and data-owned="true" for an owned coin', () => {
    render(<OwnershipMark owned />);
    const mark = screen.getByTestId('ownership-mark');
    expect(mark).toHaveTextContent('Owned');
    expect(mark).not.toHaveTextContent('Missing');
    expect(mark).toHaveAttribute('data-owned', 'true');
  });

  it('shows "Missing" and data-owned="false" for a missing coin', () => {
    render(<OwnershipMark owned={false} />);
    const mark = screen.getByTestId('ownership-mark');
    expect(mark).toHaveTextContent('Missing');
    expect(mark).not.toHaveTextContent('Owned');
    expect(mark).toHaveAttribute('data-owned', 'false');
  });

  it('uses a custom testId when given, and not the default', () => {
    render(<OwnershipMark owned testId="test-mark" />);
    expect(screen.getByTestId('test-mark')).toHaveAttribute('data-owned', 'true');
    expect(screen.queryByTestId('ownership-mark')).not.toBeInTheDocument();
  });

  it('is not interactive: a span, no button, no role, not focusable', () => {
    render(<OwnershipMark owned={false} />);
    const mark = screen.getByTestId('ownership-mark');
    expect(mark.tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(mark).not.toHaveAttribute('role');
    expect(mark).not.toHaveAttribute('tabindex');
  });

  it('carries the meaning in text and hides the tick icon from assistive tech', () => {
    const { container } = render(<OwnershipMark owned />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders the tick icon for a missing coin too (icon + text, not colour only)', () => {
    const { container } = render(<OwnershipMark owned={false} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('adds className to the root', () => {
    render(<OwnershipMark owned className="test-extra-class" />);
    expect(screen.getByTestId('ownership-mark').className).toContain('test-extra-class');
  });
});
