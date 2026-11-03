/**
 * Tests for: CoinOwnershipPanel
 * Contract source: runs/run_20261019_205931/plan.md § Interface Contract → Component: CoinOwnershipPanel
 *                   runs/run_20261102_220909/plan.md § Interface Contract → Component: CoinOwnershipPanel (MODIFY)
 * Covers criteria: #4, #5, #6, #7, #13 (from run_20261019_205931's prd.md)
 *                  #1, #2, #5, #6 (from run_20261102_220909's prd.md: picker only when owned, both layouts)
 *
 * CONTRACT_GAPS: none
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinOwnershipPanel, type CoinOwnershipPanelProps } from '@/components/catalog/coin-ownership-panel';
import { PENDING_SPINNER_DELAY_MS } from '@/components/ui/status-toggle';

function renderPanel(over: Partial<CoinOwnershipPanelProps> = {}) {
  const handlers = { onToggle: vi.fn(), onRetry: vi.fn() };
  const utils = render(
    <CoinOwnershipPanel layout="panel" coinTitle="Type 2" owned={false} state="idle" {...handlers} {...over} />,
  );
  return { ...utils, ...handlers };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CoinOwnershipPanel: panel layout, states', () => {
  it('not owned: dashed outline text, note and primary Mark as owned button', () => {
    renderPanel();
    const root = screen.getByTestId('coin-detail-ownership-panel');

    expect(root).toHaveAttribute('data-state', 'not-owned');
    expect(root).toHaveAttribute('aria-label', 'Ownership');
    expect(root.className).toContain('border-dashed');
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('Not in your collection');
    expect(screen.getByTestId('coin-detail-ownership-note')).toHaveTextContent(
      'Mark it owned and every set that includes it updates.',
    );
    const button = screen.getByTestId('coin-detail-owned-toggle');
    expect(button).toHaveTextContent('Mark as owned');
    expect(button).toHaveAttribute('aria-label', 'Mark Type 2 as owned');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toBeDisabled();
  });

  it('owned: solid accent panel, owned text and Remove from collection button', () => {
    renderPanel({ owned: true });
    const root = screen.getByTestId('coin-detail-ownership-panel');

    expect(root).toHaveAttribute('data-state', 'owned');
    expect(root.className).toContain('border-solid');
    expect(root.className).not.toContain('border-dashed');
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('In your collection');
    expect(screen.getByTestId('coin-detail-ownership-note')).toHaveTextContent(
      'Counted as owned in every set that includes it.',
    );
    const button = screen.getByTestId('coin-detail-owned-toggle');
    expect(button).toHaveTextContent('Remove from collection');
    expect(button).toHaveAttribute('aria-label', 'Remove Type 2 from your collection');
    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('uses the given coin title in the accessible name', () => {
    renderPanel({ coinTitle: 'Donetsk Oblast' });
    expect(screen.getByTestId('coin-detail-owned-toggle')).toHaveAttribute('aria-label', 'Mark Donetsk Oblast as owned');
  });

  it('failed: danger state, Couldn’t save, note and Try again', () => {
    renderPanel({ state: 'failed' });
    const root = screen.getByTestId('coin-detail-ownership-panel');

    expect(root).toHaveAttribute('data-state', 'failed');
    expect(root.className).toMatch(/danger/);
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('Couldn’t save');
    expect(screen.getByTestId('coin-detail-ownership-note')).toHaveTextContent(
      'Nothing changed. Check your connection and try again.',
    );
    const button = screen.getByTestId('coin-detail-owned-toggle');
    expect(button).toHaveTextContent('Try again');
    expect(button).toHaveAttribute('aria-label', 'Try saving Type 2 again');
  });
});

describe('CoinOwnershipPanel: clicks', () => {
  it('calls onToggle (not onRetry) when idle', async () => {
    const { onToggle, onRetry } = renderPanel();
    await userEvent.setup().click(screen.getByTestId('coin-detail-owned-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('calls onRetry (not onToggle) when failed', async () => {
    const { onToggle, onRetry } = renderPanel({ state: 'failed' });
    await userEvent.setup().click(screen.getByTestId('coin-detail-owned-toggle'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does nothing while pending', async () => {
    const { onToggle, onRetry } = renderPanel({ state: 'pending' });
    await userEvent.setup().click(screen.getByTestId('coin-detail-owned-toggle'));
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });
});

describe('CoinOwnershipPanel: pending', () => {
  it('disables and marks the button busy at once, keeping the label for the current value', () => {
    renderPanel({ state: 'pending', owned: true });
    const root = screen.getByTestId('coin-detail-ownership-panel');
    const button = screen.getByTestId('coin-detail-owned-toggle');

    expect(root).toHaveAttribute('data-state', 'pending');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent('Remove from collection');
    expect(screen.queryByTestId('coin-detail-ownership-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('In your collection');
  });

  it('shows the spinner and Saving… only after the 150ms delay', () => {
    vi.useFakeTimers();
    renderPanel({ state: 'pending' });

    act(() => {
      vi.advanceTimersByTime(PENDING_SPINNER_DELAY_MS - 1);
    });
    expect(screen.queryByTestId('coin-detail-ownership-spinner')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('coin-detail-ownership-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('Saving…');
  });

  it('never shows a spinner when idle', () => {
    vi.useFakeTimers();
    renderPanel();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.queryByTestId('coin-detail-ownership-spinner')).not.toBeInTheDocument();
  });

  it('does not set aria-busy when idle', () => {
    renderPanel();
    expect(screen.getByTestId('coin-detail-owned-toggle')).not.toHaveAttribute('aria-busy');
  });
});

describe('CoinOwnershipPanel: tap target', () => {
  it('button is at least 44px tall', () => {
    renderPanel();
    expect(screen.getByTestId('coin-detail-owned-toggle').className).toMatch(/min-h-11|h-11/);
  });
});

describe('CoinOwnershipPanel: bar layout', () => {
  it('renders a region with the bar toggle and no panel testids, and no note', () => {
    renderPanel({ layout: 'bar' });
    const bar = screen.getByTestId('coin-detail-mobile-bar');

    expect(bar).toHaveAttribute('role', 'region');
    expect(bar).toHaveAttribute('data-state', 'not-owned');
    expect(screen.queryByTestId('coin-detail-ownership-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-detail-owned-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-detail-ownership-note')).not.toBeInTheDocument();
    expect(within(bar).getByTestId('coin-detail-ownership-title')).toHaveTextContent('Not in your collection');
    expect(screen.getByTestId('coin-detail-mobile-bar-toggle')).toHaveTextContent('Mark as owned');
  });

  it('shows the owned state and toggles from the bar button', async () => {
    const { onToggle } = renderPanel({ layout: 'bar', owned: true });

    expect(screen.getByTestId('coin-detail-mobile-bar')).toHaveAttribute('data-state', 'owned');
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('In your collection');
    const button = screen.getByTestId('coin-detail-mobile-bar-toggle');
    expect(button).toHaveTextContent('Remove from collection');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('failed bar shows Couldn’t save and retries', async () => {
    const { onRetry, onToggle } = renderPanel({ layout: 'bar', state: 'failed' });

    expect(screen.getByTestId('coin-detail-mobile-bar')).toHaveAttribute('data-state', 'failed');
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('Couldn’t save');
    const button = screen.getByTestId('coin-detail-mobile-bar-toggle');
    expect(button).toHaveTextContent('Try again');
    await userEvent.setup().click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('pending bar disables the button', () => {
    renderPanel({ layout: 'bar', state: 'pending' });
    expect(screen.getByTestId('coin-detail-mobile-bar')).toHaveAttribute('data-state', 'pending');
    expect(screen.getByTestId('coin-detail-mobile-bar-toggle')).toBeDisabled();
  });
});

describe('CoinOwnershipPanel: grade picker, panel layout', () => {
  it('shows the picker inside the panel when owned and onGradeChange is given', () => {
    renderPanel({ owned: true, onGradeChange: vi.fn() });

    const panel = screen.getByTestId('coin-detail-ownership-panel');
    const select = within(panel).getByTestId('coin-detail-grade-select');
    expect(select).toBeInTheDocument();
    expect(within(panel).getByLabelText('Grade')).toBe(select);
    expect(screen.queryByTestId('coin-detail-mobile-bar-grade-select')).not.toBeInTheDocument();
  });

  it('hides the picker when not owned, even with onGradeChange', () => {
    renderPanel({ owned: false, onGradeChange: vi.fn() });
    expect(screen.queryByTestId('coin-detail-grade-select')).not.toBeInTheDocument();
  });

  it('hides the picker when owned but no onGradeChange is given', () => {
    renderPanel({ owned: true });
    expect(screen.queryByTestId('coin-detail-grade-select')).not.toBeInTheDocument();
  });

  it('shows the Not set option for a null grade and the given grade otherwise', () => {
    const { rerender } = renderPanel({ owned: true, grade: null, onGradeChange: vi.fn() });
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('');

    rerender(
      <CoinOwnershipPanel
        layout="panel"
        coinTitle="Type 2"
        owned
        state="idle"
        onToggle={vi.fn()}
        onRetry={vi.fn()}
        grade="XF"
        onGradeChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('XF');
  });

  it('defaults to Not set when the grade prop is omitted', () => {
    renderPanel({ owned: true, onGradeChange: vi.fn() });
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('');
  });

  it('calls onGradeChange with the chosen grade code, and with null for Not set', async () => {
    const onGradeChange = vi.fn();
    renderPanel({ owned: true, grade: 'F', onGradeChange });
    const user = userEvent.setup();

    await user.selectOptions(screen.getByTestId('coin-detail-grade-select'), 'VF');
    expect(onGradeChange).toHaveBeenLastCalledWith('VF');

    await user.selectOptions(screen.getByTestId('coin-detail-grade-select'), 'UNC');
    expect(onGradeChange).toHaveBeenLastCalledWith('UNC');

    await user.selectOptions(screen.getByTestId('coin-detail-grade-select'), '');
    expect(onGradeChange).toHaveBeenLastCalledWith(null);
  });

  it('picking a grade does not trigger the ownership toggle or retry', async () => {
    const { onToggle, onRetry } = renderPanel({ owned: true, onGradeChange: vi.fn() });
    await userEvent.setup().selectOptions(screen.getByTestId('coin-detail-grade-select'), 'AU');
    expect(onToggle).not.toHaveBeenCalled();
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('shows the grade error alert only when gradeState is failed', () => {
    const { rerender } = renderPanel({ owned: true, gradeState: 'idle', onGradeChange: vi.fn() });
    expect(screen.queryByTestId('coin-detail-grade-error')).not.toBeInTheDocument();

    rerender(
      <CoinOwnershipPanel
        layout="panel"
        coinTitle="Type 2"
        owned
        state="idle"
        onToggle={vi.fn()}
        onRetry={vi.fn()}
        gradeState="failed"
        onGradeChange={vi.fn()}
      />,
    );
    const alert = screen.getByTestId('coin-detail-grade-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Couldn’t save the grade. It was changed back.');
  });

  it('a grade failure does not change the ownership data-state', () => {
    renderPanel({ owned: true, state: 'idle', gradeState: 'failed', onGradeChange: vi.fn() });
    expect(screen.getByTestId('coin-detail-ownership-panel')).toHaveAttribute('data-state', 'owned');
    expect(screen.getByTestId('coin-detail-ownership-title')).toHaveTextContent('In your collection');
  });

  it('keeps the ownership toggle working with the picker present', async () => {
    const { onToggle } = renderPanel({ owned: true, onGradeChange: vi.fn() });
    await userEvent.setup().click(screen.getByTestId('coin-detail-owned-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('CoinOwnershipPanel: grade picker, bar layout', () => {
  it('shows the bar picker inside the bar when owned and onGradeChange is given', () => {
    renderPanel({ layout: 'bar', owned: true, onGradeChange: vi.fn() });

    const bar = screen.getByTestId('coin-detail-mobile-bar');
    const select = within(bar).getByTestId('coin-detail-mobile-bar-grade-select');
    expect(within(bar).getByLabelText('Grade')).toBe(select);
    expect(screen.queryByTestId('coin-detail-grade-select')).not.toBeInTheDocument();
  });

  it('hides the bar picker when not owned', () => {
    renderPanel({ layout: 'bar', owned: false, onGradeChange: vi.fn() });
    expect(screen.queryByTestId('coin-detail-mobile-bar-grade-select')).not.toBeInTheDocument();
  });

  it('hides the bar picker when owned but no onGradeChange is given', () => {
    renderPanel({ layout: 'bar', owned: true });
    expect(screen.queryByTestId('coin-detail-mobile-bar-grade-select')).not.toBeInTheDocument();
  });

  it('reflects the grade and reports changes', async () => {
    const onGradeChange = vi.fn();
    renderPanel({ layout: 'bar', owned: true, grade: 'VG', onGradeChange });
    const select = screen.getByTestId('coin-detail-mobile-bar-grade-select');
    expect(select).toHaveValue('VG');

    const user = userEvent.setup();
    await user.selectOptions(select, 'XF');
    expect(onGradeChange).toHaveBeenLastCalledWith('XF');
    await user.selectOptions(select, '');
    expect(onGradeChange).toHaveBeenLastCalledWith(null);
  });

  it('shows the bar grade error only when gradeState is failed', () => {
    const { rerender } = renderPanel({ layout: 'bar', owned: true, onGradeChange: vi.fn() });
    expect(screen.queryByTestId('coin-detail-mobile-bar-grade-error')).not.toBeInTheDocument();

    rerender(
      <CoinOwnershipPanel
        layout="bar"
        coinTitle="Type 2"
        owned
        state="idle"
        onToggle={vi.fn()}
        onRetry={vi.fn()}
        gradeState="failed"
        onGradeChange={vi.fn()}
      />,
    );
    const alert = screen.getByTestId('coin-detail-mobile-bar-grade-error');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('coin-detail-grade-error')).not.toBeInTheDocument();
  });

  it('keeps the bar toggle working with the picker present', async () => {
    const { onToggle } = renderPanel({ layout: 'bar', owned: true, onGradeChange: vi.fn() });
    await userEvent.setup().click(screen.getByTestId('coin-detail-mobile-bar-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
