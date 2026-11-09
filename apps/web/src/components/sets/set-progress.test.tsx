/**
 * Tests for: SetProgress, OwnedOfTotal, SetProgressSkeleton
 * Contract source: runs/run_20261109_220451/plan.md § Interface Contract → Component: SetProgress
 * Covers criteria: #1, #4, #5, #6 (from run_20261109_220451's prd.md)
 *
 * Rendered with testIdPrefix="test", so the ids are test-progress, test-owned-count and test-completion.
 * There is no I18nProvider: the default context is English.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OwnedOfTotal, SetProgress, SetProgressSkeleton } from '@/components/sets/set-progress';

function renderProgress(over: Partial<React.ComponentProps<typeof SetProgress>> = {}) {
  return render(
    <SetProgress
      testIdPrefix="test"
      ownedTemplate="{owned} of {total} owned"
      owned={3}
      total={5}
      percent={60}
      {...over}
    />,
  );
}

describe('OwnedOfTotal', () => {
  it('fills {owned} and {total} into the template', () => {
    const { container } = render(<OwnedOfTotal template="You own {owned} of {total}" owned={1} total={2} />);
    expect(container.textContent).toBe('You own 1 of 2');
  });

  it('gives a different sentence for different numbers and a different template', () => {
    const { container } = render(<OwnedOfTotal template="{owned} of {total} owned" owned={7} total={9} />);
    expect(container.textContent).toBe('7 of 9 owned');
    expect(container.textContent).not.toContain('1 of 2');
  });
});

describe('SetProgress', () => {
  it('renders the root, the owned sentence and the completion under the given prefix', () => {
    renderProgress();
    expect(screen.getByTestId('test-progress')).toBeInTheDocument();
    expect(screen.getByTestId('test-owned-count').textContent).toBe('3 of 5 owned');
    expect(screen.getByTestId('test-completion')).toHaveTextContent('60%');
  });

  it('follows the props: other numbers give other text', () => {
    renderProgress({ ownedTemplate: 'You own {owned} of {total}', owned: 1, total: 2, percent: 50 });
    expect(screen.getByTestId('test-owned-count').textContent).toBe('You own 1 of 2');
    expect(screen.getByTestId('test-completion')).toHaveTextContent('50%');
    expect(screen.getByTestId('test-completion')).not.toHaveTextContent('60%');
  });

  it('uses the prefix it is given (no fixed ids)', () => {
    renderProgress({ testIdPrefix: 'set-editor' });
    expect(screen.getByTestId('set-editor-progress')).toBeInTheDocument();
    expect(screen.getByTestId('set-editor-owned-count')).toBeInTheDocument();
    expect(screen.getByTestId('set-editor-completion')).toBeInTheDocument();
    expect(screen.queryByTestId('test-progress')).not.toBeInTheDocument();
  });

  it('shows the completion in a mono, tabular-number style', () => {
    renderProgress();
    const completion = screen.getByTestId('test-completion');
    expect(completion.className).toContain('font-mono');
    expect(completion.className).toContain('tabular-nums');
  });

  it('has a progressbar named "Set completion" whose value and width equal the percent', () => {
    const { container } = renderProgress({ percent: 60 });
    const bar = screen.getByRole('progressbar', { name: 'Set completion' });
    expect(bar).toHaveAttribute('aria-valuenow', '60');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(container.querySelector('[style*="width: 60%"]')).not.toBeNull();
  });

  it('updates the progressbar for another percent', () => {
    const { container } = renderProgress({ percent: 25 });
    expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '25');
    expect(container.querySelector('[style*="width: 25%"]')).not.toBeNull();
    expect(container.querySelector('[style*="width: 60%"]')).toBeNull();
  });

  it('renders 0% as 0, not as an empty value', () => {
    renderProgress({ owned: 0, total: 4, percent: 0 });
    expect(screen.getByTestId('test-completion')).toHaveTextContent('0%');
    expect(screen.getByRole('progressbar', { name: 'Set completion' })).toHaveAttribute('aria-valuenow', '0');
  });

  it('renders no upgrade slot content when none is passed', () => {
    renderProgress();
    expect(screen.queryByTestId('test-upgrade-slot')).not.toBeInTheDocument();
  });

  it('renders the upgrade slot inside the root, before the completion', () => {
    renderProgress({ upgradeSlot: <span data-testid="test-upgrade-slot">1 to upgrade</span> });
    const root = screen.getByTestId('test-progress');
    const slot = within(root).getByTestId('test-upgrade-slot');
    expect(slot).toHaveTextContent('1 to upgrade');
    const completion = within(root).getByTestId('test-completion');
    expect(slot.compareDocumentPosition(completion) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('adds className to the root', () => {
    renderProgress({ className: 'self-end test-extra-class' });
    expect(screen.getByTestId('test-progress').className).toContain('test-extra-class');
  });
});

describe('SetProgressSkeleton', () => {
  it('renders a wrapper with the given test id that contains skeleton placeholders', () => {
    render(<SetProgressSkeleton testId="test-progress-loading" />);
    const wrapper = screen.getByTestId('test-progress-loading');
    expect(within(wrapper).getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(1);
  });

  it('shows no numbers or progressbar', () => {
    render(<SetProgressSkeleton testId="test-progress-loading" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('test-completion')).not.toBeInTheDocument();
  });
});
