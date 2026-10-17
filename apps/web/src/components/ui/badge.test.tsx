/**
 * Tests for: Badge
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: Badge
 * Covers criteria: #10, #16 (from prd.md)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';

describe('Badge: default labels', () => {
  it('owned reads "✓ Owned"', () => {
    render(<Badge variant="owned" />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^✓ Owned$/);
  });

  it('key-date reads "★ Key date"', () => {
    render(<Badge variant="key-date" />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^★ Key date$/);
  });

  it('complete reads "✓ Complete"', () => {
    render(<Badge variant="complete" />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^✓ Complete$/);
  });

  it('in-set without a count reads "In this set"', () => {
    render(<Badge variant="in-set" />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^In this set$/);
  });

  it('in-set with count 1 reads "In 1 set" (singular)', () => {
    render(<Badge variant="in-set" count={1} />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^In 1 set$/);
  });

  it('in-set with another count reads "In {n} sets"', () => {
    const { unmount } = render(<Badge variant="in-set" count={3} />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^In 3 sets$/);
    unmount();

    render(<Badge variant="in-set" count={12} />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^In 12 sets$/);
  });

  it('missing reads "{n} missing" and defaults n to 1', () => {
    const { unmount } = render(<Badge variant="missing" />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^1 missing$/);
    unmount();

    render(<Badge variant="missing" count={5} />);
    expect(screen.getByTestId('badge')).toHaveTextContent(/^5 missing$/);
  });
});

describe('Badge: structure', () => {
  it('exposes the variant as a data attribute for every variant', () => {
    const variants: BadgeVariant[] = ['owned', 'in-set', 'missing', 'key-date', 'complete'];
    for (const variant of variants) {
      const { unmount } = render(<Badge variant={variant} />);
      expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', variant);
      unmount();
    }
  });

  it('lets children override the default label', () => {
    render(
      <Badge variant="owned" count={4}>
        Custom words
      </Badge>,
    );
    const badge = screen.getByTestId('badge');
    expect(badge).toHaveTextContent(/^Custom words$/);
    expect(badge).not.toHaveTextContent('Owned');
  });

  it('is a 22px tall pill that never wraps', () => {
    render(<Badge variant="owned" />);
    const badge = screen.getByTestId('badge');
    expect(badge.className).toContain('h-[22px]');
    expect(badge.className).toContain('rounded-full');
    expect(badge.className).toContain('whitespace-nowrap');
  });
});

describe('Badge: variant styling', () => {
  it('owned uses the accent tint with an accent border', () => {
    render(<Badge variant="owned" />);
    const { className } = screen.getByTestId('badge');
    expect(className).toContain('bg-accent-100');
    expect(className).toContain('text-accent-800');
    expect(className).toContain('border-accent-400');
  });

  it('in-set uses the surface background with a neutral border', () => {
    render(<Badge variant="in-set" />);
    const { className } = screen.getByTestId('badge');
    expect(className).toContain('bg-surface');
    expect(className).toContain('border-neutral-300');
  });

  it('missing uses a white background with a dashed border', () => {
    render(<Badge variant="missing" />);
    const { className } = screen.getByTestId('badge');
    expect(className).toContain('bg-white');
    expect(className).toContain('border-dashed');
  });

  it('key-date is the dark accent fill', () => {
    render(<Badge variant="key-date" />);
    const { className } = screen.getByTestId('badge');
    expect(className).toContain('bg-accent-800');
    expect(className).toContain('text-accent-100');
  });

  it('complete is the solid accent fill with white text', () => {
    render(<Badge variant="complete" />);
    const { className } = screen.getByTestId('badge');
    expect(className).toContain('bg-accent-700');
    expect(className).toContain('text-white');
  });

  it('gives each variant its own look (no two share the same class list)', () => {
    const variants: BadgeVariant[] = ['owned', 'in-set', 'missing', 'key-date', 'complete'];
    const classNames = variants.map((variant) => {
      const { unmount } = render(<Badge variant={variant} />);
      const { className } = screen.getByTestId('badge');
      unmount();
      return className;
    });
    expect(new Set(classNames).size).toBe(variants.length);
  });
});
