/**
 * Tests for: StatusToggle and useDelayedPending
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: StatusToggle
 * Covers criteria: #9, #16 (from prd.md)
 *
 * Fake timers drive the 150ms spinner delay. Events use fireEvent because userEvent and fake
 * timers do not mix well.
 *
 * CONTRACT_GAPS: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import {
  PENDING_SPINNER_DELAY_MS,
  StatusToggle,
  useDelayedPending,
  type StatusToggleProps,
} from '@/components/ui/status-toggle';

function renderToggle(over: Partial<StatusToggleProps> = {}) {
  const onToggle = vi.fn();
  const utils = render(
    <StatusToggle variant="check" owned={false} coinTitle="Odesa Oblast" onToggle={onToggle} {...over} />,
  );
  return { onToggle, ...utils };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('StatusToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('button semantics', () => {
    it('is a plain button carrying variant, state and pressed attributes', () => {
      renderToggle({ owned: true });
      const button = screen.getByTestId('status-toggle');

      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('data-variant', 'check');
      expect(button).toHaveAttribute('data-state', 'idle');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('reflects ownership in aria-pressed', () => {
      const { rerender, onToggle } = renderToggle({ owned: false });
      expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'false');

      rerender(<StatusToggle variant="check" owned coinTitle="Odesa Oblast" onToggle={onToggle} />);
      expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-pressed', 'true');
    });

    it('names the action: mark as owned when missing, mark as missing when owned', () => {
      const { rerender, onToggle } = renderToggle({ owned: false });
      expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-label', 'Mark Odesa Oblast as owned');

      rerender(<StatusToggle variant="check" owned coinTitle="Odesa Oblast" onToggle={onToggle} />);
      expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-label', 'Mark Odesa Oblast as missing');

      rerender(<StatusToggle variant="check" owned={false} coinTitle="Kyiv Oblast" onToggle={onToggle} />);
      expect(screen.getByTestId('status-toggle')).toHaveAttribute('aria-label', 'Mark Kyiv Oblast as owned');
    });

    it('calls onToggle once per click when idle', () => {
      const { onToggle } = renderToggle();
      fireEvent.click(screen.getByTestId('status-toggle'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('appends a custom className', () => {
      renderToggle({ className: 'absolute right-1 top-1' });
      expect(screen.getByTestId('status-toggle').className).toContain('absolute right-1 top-1');
    });

    it('has a visible focus ring', () => {
      renderToggle();
      expect(screen.getByTestId('status-toggle').className).toContain('focus-visible:outline-accent-700');
    });
  });

  describe('pending state and the 150ms spinner delay', () => {
    it('disables the button and marks it busy straight away, with its own accessible name', () => {
      const { onToggle } = renderToggle({ state: 'pending' });
      const button = screen.getByTestId('status-toggle');

      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveAttribute('data-state', 'pending');
      expect(button).toHaveAttribute('aria-label', 'Saving Odesa Oblast');

      fireEvent.click(button);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('shows no spinner before the delay: absent at 0ms and at 149ms', () => {
      renderToggle({ state: 'pending' });
      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();

      advance(149);
      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();
    });

    it('shows the spinner once 150ms have passed', () => {
      renderToggle({ state: 'pending' });
      advance(149);
      advance(1);
      expect(screen.getByTestId('status-toggle-spinner')).toBeInTheDocument();
    });

    it('never shows the spinner when the request settles within the delay', () => {
      const { rerender, onToggle } = renderToggle({ state: 'pending' });
      advance(100);
      rerender(<StatusToggle variant="check" owned coinTitle="Odesa Oblast" onToggle={onToggle} state="idle" />);
      advance(500);

      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();
      expect(screen.getByTestId('status-toggle')).not.toBeDisabled();
      expect(screen.getByTestId('status-toggle')).not.toHaveAttribute('aria-busy', 'true');
    });

    it('removes the spinner when the state returns to idle', () => {
      const { rerender, onToggle } = renderToggle({ state: 'pending' });
      advance(200);
      expect(screen.getByTestId('status-toggle-spinner')).toBeInTheDocument();

      rerender(<StatusToggle variant="check" owned coinTitle="Odesa Oblast" onToggle={onToggle} state="idle" />);
      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();
    });

    it('does not show a spinner in the idle or failed states', () => {
      const { unmount } = renderToggle({ state: 'idle' });
      advance(1000);
      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();
      unmount();

      renderToggle({ state: 'failed' });
      advance(1000);
      expect(screen.queryByTestId('status-toggle-spinner')).not.toBeInTheDocument();
    });

    it('leaves no timer running after unmount', () => {
      const baseline = vi.getTimerCount();
      const { unmount } = renderToggle({ state: 'pending' });
      expect(vi.getTimerCount()).toBeGreaterThan(baseline);

      unmount();
      expect(vi.getTimerCount()).toBe(baseline);
    });
  });

  describe('failed state', () => {
    it('is enabled, says it could not save, and names the coin', () => {
      renderToggle({ state: 'failed' });
      const button = screen.getByTestId('status-toggle');

      expect(button).toBeEnabled();
      expect(button).toHaveAttribute('data-state', 'failed');
      expect(button).toHaveAttribute('aria-label', 'Couldn’t save Odesa Oblast. Try again');
    });

    it('calls onToggle on click when there is no onRetry', () => {
      const { onToggle } = renderToggle({ state: 'failed' });
      fireEvent.click(screen.getByTestId('status-toggle'));
      expect(onToggle).toHaveBeenCalledTimes(1);
    });

    it('calls onRetry instead of onToggle when both are given', () => {
      const onRetry = vi.fn();
      const { onToggle } = renderToggle({ state: 'failed', onRetry });
      fireEvent.click(screen.getByTestId('status-toggle'));

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('uses danger styling', () => {
      renderToggle({ state: 'failed' });
      expect(screen.getByTestId('status-toggle').outerHTML).toContain('text-danger');
    });
  });

  describe('check variant', () => {
    it('has a 44px hit area and no visible text', () => {
      renderToggle({ variant: 'check', owned: false });
      const button = screen.getByTestId('status-toggle');

      expect(button.className).toContain('size-11');
      expect(button).not.toHaveTextContent(/Owned|Missing|Retry|Saving/);
    });

    it('draws a dashed face when missing and a solid accent face when owned', () => {
      const { unmount } = renderToggle({ variant: 'check', owned: false });
      const missingHtml = screen.getByTestId('status-toggle').outerHTML;
      expect(missingHtml).toContain('border-dashed');
      unmount();

      renderToggle({ variant: 'check', owned: true });
      const ownedHtml = screen.getByTestId('status-toggle').outerHTML;
      expect(ownedHtml).toContain('bg-accent');
      expect(ownedHtml).not.toContain('border-dashed');
    });
  });

  describe('pill variant', () => {
    it('is a 40px tall pill with a visible label', () => {
      renderToggle({ variant: 'pill', owned: false });
      const button = screen.getByTestId('status-toggle');

      expect(button).toHaveAttribute('data-variant', 'pill');
      expect(button.className).toContain('h-10');
      expect(button).toHaveTextContent('Missing');
    });

    it('labels an owned coin "Owned"', () => {
      renderToggle({ variant: 'pill', owned: true });
      expect(screen.getByTestId('status-toggle')).toHaveTextContent('Owned');
      expect(screen.getByTestId('status-toggle')).not.toHaveTextContent('Missing');
    });

    it('uses the dashed outline when missing and the accent outline when owned', () => {
      const { unmount } = renderToggle({ variant: 'pill', owned: false });
      expect(screen.getByTestId('status-toggle').className).toContain('border-dashed');
      unmount();

      renderToggle({ variant: 'pill', owned: true });
      expect(screen.getByTestId('status-toggle').className).toContain('border-accent-400');
    });

    it('shows "Saving…" only once the spinner shows', () => {
      renderToggle({ variant: 'pill', owned: false, state: 'pending' });
      expect(screen.getByTestId('status-toggle')).not.toHaveTextContent('Saving…');

      advance(150);
      expect(screen.getByTestId('status-toggle')).toHaveTextContent('Saving…');
      expect(screen.getByTestId('status-toggle-spinner')).toBeInTheDocument();
    });

    it('shows "Retry" when failed', () => {
      renderToggle({ variant: 'pill', state: 'failed' });
      expect(screen.getByTestId('status-toggle')).toHaveTextContent('Retry');
    });
  });
});

describe('PENDING_SPINNER_DELAY_MS', () => {
  it('is 150', () => {
    expect(PENDING_SPINNER_DELAY_MS).toBe(150);
  });
});

describe('useDelayedPending', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is false while inactive, however long it waits', () => {
    const { result } = renderHook(() => useDelayedPending(false));
    advance(1000);
    expect(result.current).toBe(false);
  });

  it('turns true only after the default delay of active time', () => {
    const { result } = renderHook(() => useDelayedPending(true));
    expect(result.current).toBe(false);

    advance(149);
    expect(result.current).toBe(false);

    advance(1);
    expect(result.current).toBe(true);
  });

  it('honours a custom delay', () => {
    const { result } = renderHook(() => useDelayedPending(true, 400));

    advance(399);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it('goes back to false as soon as it becomes inactive', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedPending(active), {
      initialProps: { active: true },
    });
    advance(200);
    expect(result.current).toBe(true);

    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it('restarts the wait when it becomes active again', () => {
    const { result, rerender } = renderHook(({ active }) => useDelayedPending(active), {
      initialProps: { active: true },
    });
    advance(100);
    rerender({ active: false });
    rerender({ active: true });

    advance(100);
    expect(result.current).toBe(false);
    advance(50);
    expect(result.current).toBe(true);
  });

  it('clears its timer on unmount', () => {
    const baseline = vi.getTimerCount();
    const { unmount } = renderHook(() => useDelayedPending(true));
    expect(vi.getTimerCount()).toBeGreaterThan(baseline);

    unmount();
    expect(vi.getTimerCount()).toBe(baseline);
  });
});
