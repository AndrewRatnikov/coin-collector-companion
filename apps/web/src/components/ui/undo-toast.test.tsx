/**
 * Tests for: UndoToastProvider and useUndoToast
 * Contract source: runs/run_20261017_142658/plan.md § Interface Contract → Component: UndoToast
 * Covers criteria: #12, #16 (from prd.md)
 *
 * A tiny consumer renders buttons that call show() and dismiss(); they are found by role and
 * name, not by testid, because the contract declares no test-only testids. Fake timers drive
 * the 8s auto-dismiss, pause and replace behaviour.
 *
 * CONTRACT_GAPS: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  UNDO_TOAST_DURATION_MS,
  UndoToastProvider,
  useUndoToast,
  type UndoToastOptions,
} from '@/components/ui/undo-toast';

interface ConsumerProps {
  first?: UndoToastOptions;
  second?: UndoToastOptions;
}

function Consumer({ first, second }: ConsumerProps) {
  const toast = useUndoToast();
  return (
    <div>
      <button type="button" onClick={() => toast.show(first ?? { message: 'First toast' })}>
        Show first
      </button>
      <button type="button" onClick={() => toast.show(second ?? { message: 'Second toast' })}>
        Show second
      </button>
      <button type="button" onClick={() => toast.dismiss()}>
        Dismiss from hook
      </button>
    </div>
  );
}

function renderToasts(props: ConsumerProps = {}) {
  return render(
    <UndoToastProvider>
      <Consumer {...props} />
    </UndoToastProvider>,
  );
}

function press(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('UndoToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('live region', () => {
    it('always renders a polite, atomic status region, even with no toast', () => {
      renderToasts();
      const region = screen.getByTestId('undo-toast-region');

      expect(region).toHaveAttribute('role', 'status');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveAttribute('aria-atomic', 'true');
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('renders the toast inside the region so its text is announced', () => {
      renderToasts();
      press('Show first');

      const region = screen.getByTestId('undo-toast-region');
      expect(within(region).getByTestId('undo-toast')).toBeInTheDocument();
      expect(within(region).getByTestId('undo-toast-message')).toHaveTextContent('First toast');
    });

    it('keeps the region after the toast closes', () => {
      renderToasts();
      press('Show first');
      advance(UNDO_TOAST_DURATION_MS);

      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
      expect(screen.getByTestId('undo-toast-region')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('shows the message, an Undo button and a Dismiss button', () => {
      renderToasts({ first: { message: 'Marked Donetsk Oblast as owned' } });
      press('Show first');

      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Marked Donetsk Oblast as owned');
      expect(screen.getByTestId('undo-toast-undo')).toHaveTextContent('Undo');
      expect(screen.getByTestId('undo-toast-dismiss')).toHaveAttribute('aria-label', 'Dismiss');
    });

    it('uses a custom action label when given', () => {
      renderToasts({ first: { message: 'Removed', actionLabel: 'Put back' } });
      press('Show first');

      expect(screen.getByTestId('undo-toast-undo')).toHaveTextContent('Put back');
      expect(screen.getByTestId('undo-toast-undo')).not.toHaveTextContent(/^Undo$/);
    });

    it('accepts a node as the message', () => {
      renderToasts({ first: { message: <strong>Bold words</strong> } });
      press('Show first');

      expect(within(screen.getByTestId('undo-toast-message')).getByText('Bold words').tagName).toBe('STRONG');
    });

    it('sits at the bottom centre of the viewport', () => {
      renderToasts();
      press('Show first');
      const { className } = screen.getByTestId('undo-toast');

      expect(className).toContain('fixed');
      expect(className).toContain('bottom-6');
      expect(className).toContain('left-1/2');
      expect(className).toContain('-translate-x-1/2');
    });
  });

  describe('auto-dismiss after 8 seconds', () => {
    it('lasts 8000ms', () => {
      expect(UNDO_TOAST_DURATION_MS).toBe(8000);
    });

    it('stays at 7999ms and commits and closes at 8000ms', () => {
      const onCommit = vi.fn();
      const onUndo = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit, onUndo } });
      press('Show first');

      advance(7999);
      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();
      expect(onCommit).not.toHaveBeenCalled();

      advance(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onUndo).not.toHaveBeenCalled();
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('works without any callbacks', () => {
      renderToasts({ first: { message: 'Just a note' } });
      press('Show first');

      advance(UNDO_TOAST_DURATION_MS);
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });
  });

  describe('Undo and Dismiss buttons', () => {
    it('Undo calls onUndo, closes, and never commits', () => {
      const onCommit = vi.fn();
      const onUndo = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit, onUndo } });
      press('Show first');

      fireEvent.click(screen.getByTestId('undo-toast-undo'));

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
      advance(UNDO_TOAST_DURATION_MS * 2);
      expect(onCommit).not.toHaveBeenCalled();
      expect(onUndo).toHaveBeenCalledTimes(1);
    });

    it('Dismiss commits, closes, and does not undo', () => {
      const onCommit = vi.fn();
      const onUndo = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit, onUndo } });
      press('Show first');

      fireEvent.click(screen.getByTestId('undo-toast-dismiss'));

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onUndo).not.toHaveBeenCalled();
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
      advance(UNDO_TOAST_DURATION_MS * 2);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('dismiss() from the hook closes the toast', () => {
      renderToasts();
      press('Show first');
      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();

      press('Dismiss from hook');
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });
  });

  describe('at most one toast', () => {
    it('commits the old toast and replaces it when a new one is shown', () => {
      const firstCommit = vi.fn();
      const secondCommit = vi.fn();
      renderToasts({
        first: { message: 'First toast', onCommit: firstCommit },
        second: { message: 'Second toast', onCommit: secondCommit },
      });
      press('Show first');
      press('Show second');

      expect(firstCommit).toHaveBeenCalledTimes(1);
      expect(secondCommit).not.toHaveBeenCalled();
      expect(screen.getAllByTestId('undo-toast')).toHaveLength(1);
      expect(screen.getByTestId('undo-toast-message')).toHaveTextContent('Second toast');
      expect(screen.getByTestId('undo-toast-message')).not.toHaveTextContent('First toast');
    });

    it('does not undo the replaced toast', () => {
      const firstUndo = vi.fn();
      renderToasts({ first: { message: 'First toast', onUndo: firstUndo } });
      press('Show first');
      press('Show second');

      expect(firstUndo).not.toHaveBeenCalled();
    });

    it('restarts the 8 second timer for the new toast and never commits the old one twice', () => {
      const firstCommit = vi.fn();
      const secondCommit = vi.fn();
      renderToasts({
        first: { message: 'First toast', onCommit: firstCommit },
        second: { message: 'Second toast', onCommit: secondCommit },
      });
      press('Show first');
      advance(5000);
      press('Show second');

      advance(7999);
      expect(secondCommit).not.toHaveBeenCalled();
      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();

      advance(1);
      expect(secondCommit).toHaveBeenCalledTimes(1);
      expect(firstCommit).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('does not commit a toast that already closed when the next one is shown', () => {
      const firstCommit = vi.fn();
      renderToasts({ first: { message: 'First toast', onCommit: firstCommit } });
      press('Show first');
      advance(UNDO_TOAST_DURATION_MS);
      expect(firstCommit).toHaveBeenCalledTimes(1);

      press('Show second');
      expect(firstCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('pausing', () => {
    it('pauses while hovered and resumes with the remaining time on mouse leave', () => {
      const onCommit = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit } });
      press('Show first');
      const toast = screen.getByTestId('undo-toast');

      advance(5000);
      fireEvent.mouseEnter(toast);
      advance(20000);
      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();

      fireEvent.mouseLeave(toast);
      advance(2999);
      expect(onCommit).not.toHaveBeenCalled();
      advance(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();
    });

    it('pauses while focus is inside the toast and resumes when it leaves', () => {
      const onCommit = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit } });
      press('Show first');
      const undo = screen.getByTestId('undo-toast-undo');

      advance(6000);
      act(() => {
        undo.focus();
      });
      advance(20000);
      expect(onCommit).not.toHaveBeenCalled();
      expect(screen.getByTestId('undo-toast')).toBeInTheDocument();

      act(() => {
        undo.blur();
      });
      advance(1999);
      expect(onCommit).not.toHaveBeenCalled();
      advance(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });

    it('does not finish early: time spent before hovering still counts, time spent hovering does not', () => {
      const onCommit = vi.fn();
      renderToasts({ first: { message: 'Saved', onCommit } });
      press('Show first');
      const toast = screen.getByTestId('undo-toast');

      advance(4000);
      fireEvent.mouseEnter(toast);
      advance(4000);
      fireEvent.mouseLeave(toast);
      advance(3999);
      expect(onCommit).not.toHaveBeenCalled();
      advance(1);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('focus', () => {
    it('never takes focus when it appears', () => {
      renderToasts();
      const trigger = screen.getByRole('button', { name: 'Show first' });
      act(() => {
        trigger.focus();
      });

      fireEvent.click(trigger);

      const toast = screen.getByTestId('undo-toast');
      expect(document.activeElement).toBe(trigger);
      expect(toast.contains(document.activeElement)).toBe(false);
    });

    it('does not move focus when a second toast replaces the first', () => {
      renderToasts();
      const trigger = screen.getByRole('button', { name: 'Show second' });
      press('Show first');
      act(() => {
        trigger.focus();
      });

      fireEvent.click(trigger);

      expect(document.activeElement).toBe(trigger);
      expect(screen.getByTestId('undo-toast').contains(document.activeElement)).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('clears the timer when the provider unmounts', () => {
      const baseline = vi.getTimerCount();
      const onCommit = vi.fn();
      const { unmount } = renderToasts({ first: { message: 'Saved', onCommit } });
      press('Show first');
      expect(vi.getTimerCount()).toBeGreaterThan(baseline);

      unmount();

      expect(vi.getTimerCount()).toBe(baseline);
      advance(UNDO_TOAST_DURATION_MS * 2);
      expect(onCommit).not.toHaveBeenCalled();
    });
  });
});
