/**
 * Tests for: UpgradeBadge
 * Contract source: runs/run_20261103_192441/plan.md § Interface Contract → Component: UpgradeBadge (CREATE)
 * Covers criteria: #5 (accessible, distinct Upgrade state: icon + text + hint, never colour alone)
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpgradeBadge } from '@/components/ui/upgrade-badge';

describe('UpgradeBadge', () => {
  it('renders under the default test id with data-upgrade="true"', () => {
    render(<UpgradeBadge />);

    const badge = screen.getByTestId('upgrade-badge');
    expect(badge.tagName).toBe('SPAN');
    expect(badge).toHaveAttribute('data-upgrade', 'true');
  });

  it('shows the visible word "Upgrade"', () => {
    render(<UpgradeBadge />);
    expect(screen.getByTestId('upgrade-badge')).toHaveTextContent('Upgrade');
  });

  it('carries the hint as the title', () => {
    render(<UpgradeBadge />);
    expect(screen.getByTestId('upgrade-badge')).toHaveAttribute('title', 'Owned, below your minimum grade');
  });

  it('has a screen-reader-only hint after a separator, so the text content includes both', () => {
    render(<UpgradeBadge />);
    const badge = screen.getByTestId('upgrade-badge');

    const hint = badge.querySelector('.sr-only');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toBe(', Owned, below your minimum grade');
    expect(badge.textContent).toBe('Upgrade, Owned, below your minimum grade');
  });

  it('has an aria-hidden svg icon, so meaning never relies on the icon or colour', () => {
    render(<UpgradeBadge />);
    const svg = screen.getByTestId('upgrade-badge').querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('uses the given testId instead of the default', () => {
    render(<UpgradeBadge testId="coin-card-upgrade" />);

    expect(screen.getByTestId('coin-card-upgrade')).toHaveAttribute('data-upgrade', 'true');
    expect(screen.queryByTestId('upgrade-badge')).not.toBeInTheDocument();
  });

  it('applies the given className and keeps its own style', () => {
    render(<UpgradeBadge className="relative z-[3]" />);
    const cls = screen.getByTestId('upgrade-badge').className;

    expect(cls).toContain('relative');
    expect(cls).toContain('z-[3]');
    expect(cls).toContain('border-dashed');
  });

  it('does not add the extra class when none is given', () => {
    render(<UpgradeBadge />);
    expect(screen.getByTestId('upgrade-badge').className).not.toContain('z-[3]');
  });
});
