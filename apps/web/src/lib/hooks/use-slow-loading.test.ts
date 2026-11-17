/**
 * Tests for: useSlowLoading, SERVER_WAKING_DELAY_MS
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Hook: useSlowLoading
 * Covers criteria: #1 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { SERVER_WAKING_DELAY_MS, useSlowLoading } from '@/lib/hooks/use-slow-loading';

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('useSlowLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes a 3 second default delay', () => {
    expect(SERVER_WAKING_DELAY_MS).toBe(3000);
  });

  it('is false at once, false just before 3 s of loading and true at 3 s', () => {
    const { result } = renderHook(({ loading }) => useSlowLoading(loading), {
      initialProps: { loading: true },
    });

    expect(result.current).toBe(false);
    advance(2999);
    expect(result.current).toBe(false);
    advance(1);
    expect(result.current).toBe(true);
  });

  it('stays false when never loading, however long it waits', () => {
    const { result } = renderHook(() => useSlowLoading(false));

    advance(10000);

    expect(result.current).toBe(false);
  });

  it('turns false as soon as loading ends after it was true', () => {
    const { result, rerender } = renderHook(({ loading }) => useSlowLoading(loading), {
      initialProps: { loading: true },
    });
    advance(3500);
    expect(result.current).toBe(true);

    rerender({ loading: false });

    expect(result.current).toBe(false);
  });

  it('is never true when loading ends before the delay', () => {
    const { result, rerender } = renderHook(({ loading }) => useSlowLoading(loading), {
      initialProps: { loading: true },
    });
    advance(2000);
    rerender({ loading: false });

    advance(10000);

    expect(result.current).toBe(false);
  });

  it('restarts the clock when loading starts again', () => {
    const { result, rerender } = renderHook(({ loading }) => useSlowLoading(loading), {
      initialProps: { loading: true },
    });
    advance(2000);
    rerender({ loading: false });
    rerender({ loading: true });

    advance(2900);
    expect(result.current).toBe(false);
    advance(100);
    expect(result.current).toBe(true);
  });

  it('honours a custom delay and a different custom delay gives a different threshold', () => {
    const short = renderHook(() => useSlowLoading(true, 500));
    const long = renderHook(() => useSlowLoading(true, 8000));

    advance(499);
    expect(short.result.current).toBe(false);
    advance(1);
    expect(short.result.current).toBe(true);
    expect(long.result.current).toBe(false);
    advance(7500);
    expect(long.result.current).toBe(true);
  });

  it('leaves no pending timer after unmount', () => {
    const { unmount } = renderHook(() => useSlowLoading(true));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer when loading ends', () => {
    const { rerender } = renderHook(({ loading }) => useSlowLoading(loading), {
      initialProps: { loading: true },
    });

    rerender({ loading: false });

    expect(vi.getTimerCount()).toBe(0);
  });
});
