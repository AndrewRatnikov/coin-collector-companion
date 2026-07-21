/**
 * Tests for: auth-token
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: auth-token
 * Covers criteria: #1 (from prd.md)
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_TOKEN_STORAGE_KEY, getStoredToken, setStoredToken, clearStoredToken } from '@/lib/auth-token';

describe('auth-token', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('criterion 1: token storage against localStorage', () => {
    it('getStoredToken returns null when nothing is stored', () => {
      expect(getStoredToken()).toBeNull();
    });

    it('setStoredToken persists the token under the documented storage key', () => {
      setStoredToken('abc123');
      expect(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('abc123');
    });

    it('getStoredToken returns a previously stored token', () => {
      setStoredToken('abc123');
      expect(getStoredToken()).toBe('abc123');
    });

    it('clearStoredToken removes a previously stored token', () => {
      setStoredToken('abc123');
      clearStoredToken();
      expect(getStoredToken()).toBeNull();
    });

    it('clearStoredToken is a no-op when nothing is stored (does not throw)', () => {
      expect(() => clearStoredToken()).not.toThrow();
      expect(getStoredToken()).toBeNull();
    });

    it('setStoredToken overwrites a previously stored token', () => {
      setStoredToken('first');
      setStoredToken('second');
      expect(getStoredToken()).toBe('second');
    });
  });
});
