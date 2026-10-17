/**
 * Tests for: Skeleton
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: Skeleton (modified)
 * Covers criteria: #13 (from prd.md): pulse animation, slower under prefers-reduced-motion
 *
 * jsdom does not evaluate Tailwind or media queries, so the pulse and its reduced-motion slowdown
 * are checked as class hooks. design-tokens.test.ts asserts the --animate-skeleton token itself.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders a decorative element that screen readers skip', () => {
    render(<Skeleton />);
    const skeleton = screen.getByTestId('skeleton');

    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
    expect(skeleton.tagName).toBe('DIV');
  });

  it('pulses with the skeleton animation token', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').className).toContain('animate-skeleton');
  });

  it('slows the animation under reduced motion', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').className).toContain('motion-reduce:[animation-duration:2.4s]');
  });

  it('no longer uses the old Tailwind pulse', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton').className).not.toContain('animate-pulse');
  });

  it('is a neutral rounded block', () => {
    render(<Skeleton />);
    const { className } = screen.getByTestId('skeleton');

    expect(className).toContain('bg-neutral-200');
    expect(className).toContain('rounded-[var(--radius-md)]');
  });

  it('appends a custom className without dropping the base classes', () => {
    render(<Skeleton className="h-6 w-48" />);
    const { className } = screen.getByTestId('skeleton');

    expect(className).toContain('h-6 w-48');
    expect(className).toContain('animate-skeleton');
  });

  it('adds nothing extra, and no "undefined", when no className is given', () => {
    render(<Skeleton />);
    const { className } = screen.getByTestId('skeleton');

    expect(className).not.toContain('undefined');
    expect(className).not.toContain('h-6');
  });

  it('renders each instance as its own element', () => {
    render(
      <>
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-6 w-4/5" />
      </>,
    );
    const all = screen.getAllByTestId('skeleton');

    expect(all).toHaveLength(2);
    expect(all[0].className).toContain('w-2/5');
    expect(all[1].className).toContain('w-4/5');
    expect(all[0].className).not.toContain('w-4/5');
  });
});
