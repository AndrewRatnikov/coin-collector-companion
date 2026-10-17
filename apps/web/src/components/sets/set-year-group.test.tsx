/**
 * Tests for: SetYearGroup
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Component: SetYearGroup
 * Covers criteria: #5, #6, #14
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetYearGroup } from '@/components/sets/set-year-group';

function renderGroup(over: Partial<React.ComponentProps<typeof SetYearGroup>> = {}) {
  return render(
    <SetYearGroup year={2025} ownedCount={2} totalCount={5} markAllCount={3} {...over}>
      <div>child content</div>
    </SetYearGroup>,
  );
}

describe('SetYearGroup: header', () => {
  it('is a section labelled and tagged with the year', () => {
    renderGroup({ year: 1931 });

    const group = screen.getByTestId('set-year-group');
    expect(group.tagName).toBe('SECTION');
    expect(group).toHaveAttribute('aria-label', '1931');
    expect(group).toHaveAttribute('data-year', '1931');
  });

  it('shows the year as an h2 in mono', () => {
    renderGroup({ year: 2026 });

    const year = screen.getByTestId('set-year-group-year');
    expect(year.tagName).toBe('H2');
    expect(year).toHaveTextContent('2026');
    expect(year.className).toContain('font-mono');
  });

  it('shows "N of M owned" in mono, following the props', () => {
    const { unmount } = renderGroup({ ownedCount: 2, totalCount: 5 });
    expect(screen.getByTestId('set-year-group-summary')).toHaveTextContent('2 of 5 owned');
    expect(screen.getByTestId('set-year-group-summary').className).toContain('font-mono');
    unmount();

    renderGroup({ ownedCount: 7, totalCount: 9 });
    expect(screen.getByTestId('set-year-group-summary')).toHaveTextContent('7 of 9 owned');
  });

  it('renders its children inside the section', () => {
    renderGroup();
    expect(within(screen.getByTestId('set-year-group')).getByText('child content')).toBeInTheDocument();
  });
});

describe('SetYearGroup: Mark all button', () => {
  it('shows "Mark all N as owned" when a handler is given and N is above 1', () => {
    renderGroup({ onMarkAll: vi.fn(), markAllCount: 4 });
    expect(screen.getByTestId('set-year-group-mark-all')).toHaveTextContent('Mark all 4 as owned');
  });

  it('shows "Mark 1 as owned" when exactly one coin can be marked', () => {
    renderGroup({ onMarkAll: vi.fn(), markAllCount: 1 });
    const button = screen.getByTestId('set-year-group-mark-all');
    expect(button).toHaveTextContent('Mark 1 as owned');
    expect(button).not.toHaveTextContent('Mark all');
  });

  it('is a button that calls onMarkAll once per click', async () => {
    const user = userEvent.setup();
    const onMarkAll = vi.fn();
    renderGroup({ onMarkAll, markAllCount: 3 });

    const button = screen.getByTestId('set-year-group-mark-all');
    expect(button.tagName).toBe('BUTTON');
    await user.click(button);

    expect(onMarkAll).toHaveBeenCalledTimes(1);
  });

  it('is not rendered when markAllCount is 0, even with a handler', () => {
    renderGroup({ onMarkAll: vi.fn(), markAllCount: 0 });
    expect(screen.queryByTestId('set-year-group-mark-all')).not.toBeInTheDocument();
  });

  it('is not rendered without a handler, even when coins are missing', () => {
    renderGroup({ markAllCount: 3 });
    expect(screen.queryByTestId('set-year-group-mark-all')).not.toBeInTheDocument();
  });

  it('is hidden under 900px', () => {
    renderGroup({ onMarkAll: vi.fn(), markAllCount: 3 });
    expect(screen.getByTestId('set-year-group-mark-all').className).toContain('max-[899px]:hidden');
  });
});
