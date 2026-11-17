/**
 * Tests for: useMediaQuery
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Hook: useMediaQuery
 * Covers criteria: #12, #18 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from '@/lib/hooks/use-media-query';

type Listener = (event: { matches: boolean }) => void;

interface FakeList {
  matches: boolean;
  listeners: Set<Listener>;
}

function installMatchMedia(initial: Record<string, boolean>) {
  const lists = new Map<string, FakeList>();
  const removeSpy = vi.fn();
  const matchMedia = vi.fn((query: string) => {
    let list = lists.get(query);
    if (!list) {
      list = { matches: initial[query] ?? false, listeners: new Set() };
      lists.set(query, list);
    }
    const current = list;
    const add = (_type: string | Listener, listener?: Listener) => {
      current.listeners.add(typeof _type === 'function' ? _type : (listener as Listener));
    };
    const remove = (_type: string | Listener, listener?: Listener) => {
      removeSpy();
      current.listeners.delete(typeof _type === 'function' ? _type : (listener as Listener));
    };
    return {
      get matches() {
        return current.matches;
      },
      media: query,
      onchange: null,
      addEventListener: add,
      removeEventListener: remove,
      addListener: add,
      removeListener: remove,
      dispatchEvent: () => true,
    };
  });
  Object.defineProperty(window, 'matchMedia', { configurable: true, writable: true, value: matchMedia });
  return {
    removeSpy,
    set(query: string, matches: boolean) {
      const list = lists.get(query);
      if (!list) throw new Error(`no list for ${query}`);
      list.matches = matches;
      act(() => {
        for (const listener of [...list.listeners]) listener({ matches });
      });
    },
    listenerCount(query: string) {
      return lists.get(query)?.listeners.size ?? 0;
    },
  };
}

describe('useMediaQuery', () => {
  afterEach(() => {
    // jsdom has no matchMedia; remove the fake so other tests see the real environment
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('is false when window.matchMedia is not a function (jsdom)', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    const { result } = renderHook(() => useMediaQuery('(max-width: 899px)'));

    expect(result.current).toBe(false);
  });

  it('returns what matchMedia reports for the query, per query', () => {
    installMatchMedia({ '(max-width: 899px)': true, '(prefers-reduced-motion: reduce)': false });

    const narrow = renderHook(() => useMediaQuery('(max-width: 899px)'));
    const reduced = renderHook(() => useMediaQuery('(prefers-reduced-motion: reduce)'));

    expect(narrow.result.current).toBe(true);
    expect(reduced.result.current).toBe(false);
  });

  it('re-renders when the media query changes', () => {
    const media = installMatchMedia({ '(max-width: 899px)': false });
    const { result } = renderHook(() => useMediaQuery('(max-width: 899px)'));
    expect(result.current).toBe(false);

    media.set('(max-width: 899px)', true);
    expect(result.current).toBe(true);

    media.set('(max-width: 899px)', false);
    expect(result.current).toBe(false);
  });

  it('removes its listener on unmount', () => {
    const media = installMatchMedia({ '(max-width: 899px)': false });
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 899px)'));
    expect(media.listenerCount('(max-width: 899px)')).toBeGreaterThan(0);

    unmount();

    expect(media.listenerCount('(max-width: 899px)')).toBe(0);
    expect(media.removeSpy).toHaveBeenCalled();
  });
});
