/**
 * Tests for: SelectionActionBar
 * Contract source: runs/run_20261017_210503/plan.md § Interface Contract → Component: SelectionActionBar
 * Covers criteria: #9
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectionActionBar } from '@/components/sets/selection-action-bar';

function renderBar(over: Partial<React.ComponentProps<typeof SelectionActionBar>> = {}) {
  const handlers = { onMarkOwned: vi.fn(), onMarkMissing: vi.fn(), onCancel: vi.fn() };
  const utils = render(<SelectionActionBar count={3} {...handlers} {...over} />);
  return { ...utils, ...handlers };
}

describe('SelectionActionBar', () => {
  it('is a region labelled Selection', () => {
    renderBar();
    const bar = screen.getByTestId('selection-bar');
    expect(bar).toHaveAttribute('role', 'region');
    expect(bar).toHaveAttribute('aria-label', 'Selection');
  });

  it('shows "{n} selected" following the count', () => {
    const { unmount } = renderBar({ count: 3 });
    expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('3 selected');
    unmount();

    renderBar({ count: 12 });
    expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('12 selected');
  });

  it('has Mark owned, Mark missing and Cancel buttons with their labels', () => {
    renderBar();
    expect(screen.getByTestId('selection-bar-mark-owned')).toHaveTextContent('Mark owned');
    expect(screen.getByTestId('selection-bar-mark-missing')).toHaveTextContent('Mark missing');
    expect(screen.getByTestId('selection-bar-cancel')).toHaveTextContent('Cancel');
  });

  it('enables both Mark buttons when something is selected', () => {
    renderBar({ count: 1 });
    expect(screen.getByTestId('selection-bar-mark-owned')).toBeEnabled();
    expect(screen.getByTestId('selection-bar-mark-missing')).toBeEnabled();
  });

  it('disables both Mark buttons while nothing is selected, but keeps Cancel enabled', () => {
    renderBar({ count: 0 });
    expect(screen.getByTestId('selection-bar-mark-owned')).toBeDisabled();
    expect(screen.getByTestId('selection-bar-mark-missing')).toBeDisabled();
    expect(screen.getByTestId('selection-bar-cancel')).toBeEnabled();
    expect(screen.getByTestId('selection-bar-count')).toHaveTextContent('0 selected');
  });

  it('calls only onMarkOwned for Mark owned', async () => {
    const user = userEvent.setup();
    const { onMarkOwned, onMarkMissing, onCancel } = renderBar();

    await user.click(screen.getByTestId('selection-bar-mark-owned'));

    expect(onMarkOwned).toHaveBeenCalledTimes(1);
    expect(onMarkMissing).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls only onMarkMissing for Mark missing', async () => {
    const user = userEvent.setup();
    const { onMarkOwned, onMarkMissing, onCancel } = renderBar();

    await user.click(screen.getByTestId('selection-bar-mark-missing'));

    expect(onMarkMissing).toHaveBeenCalledTimes(1);
    expect(onMarkOwned).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('calls only onCancel for Cancel', async () => {
    const user = userEvent.setup();
    const { onMarkOwned, onMarkMissing, onCancel } = renderBar();

    await user.click(screen.getByTestId('selection-bar-cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onMarkOwned).not.toHaveBeenCalled();
    expect(onMarkMissing).not.toHaveBeenCalled();
  });

  it('does not call the Mark handlers when they are disabled', async () => {
    const user = userEvent.setup();
    const { onMarkOwned, onMarkMissing } = renderBar({ count: 0 });

    await user.click(screen.getByTestId('selection-bar-mark-owned'));
    await user.click(screen.getByTestId('selection-bar-mark-missing'));

    expect(onMarkOwned).not.toHaveBeenCalled();
    expect(onMarkMissing).not.toHaveBeenCalled();
  });
});
