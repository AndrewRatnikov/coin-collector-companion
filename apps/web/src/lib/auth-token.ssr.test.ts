// @vitest-environment node
/**
 * Tests for: auth-token (SSR-safety branch)
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: auth-token
 * Covers criteria: #1 (from prd.md)
 *
 * Run in Vitest's 'node' environment (no jsdom) via the per-file `@vitest-environment` pragma
 * above, so `typeof window === 'undefined'` is genuinely true here — the only way to exercise
 * the documented SSR guard for real, since jsdom always provides a `window` global.
 */

import { describe, expect, it } from 'vitest';
import { getStoredToken, setStoredToken, clearStoredToken } from '@/lib/auth-token';

describe('auth-token (no window / SSR)', () => {
  it('getStoredToken returns null when window is undefined', () => {
    expect(typeof window).toBe('undefined');
    expect(getStoredToken()).toBeNull();
  });

  it('setStoredToken does not throw when window is undefined', () => {
    expect(() => setStoredToken('abc123')).not.toThrow();
  });

  it('clearStoredToken does not throw when window is undefined', () => {
    expect(() => clearStoredToken()).not.toThrow();
  });
});
