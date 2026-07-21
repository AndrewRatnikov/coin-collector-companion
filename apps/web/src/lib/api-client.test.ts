/**
 * Tests for: api-client (modified apiFetch)
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: api-client (existing file, modified)
 * Covers criteria: #3 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { apiFetch, ApiError } from '@/lib/api-client';
import { getStoredToken, setStoredToken } from '@/lib/auth-token';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'status',
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('apiFetch', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    // window.location.href is not directly assignable in jsdom without a full navigation
    // stub, so replace `window.location` with a plain mutable object for these tests.
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, href: 'http://localhost/dashboard' },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  describe('criterion 3: Bearer header attachment', () => {
    it('attaches Authorization: Bearer <token> when a token is stored', async () => {
      setStoredToken('tok-abc');
      const fetchMock = stubFetchResolving(200, { ok: true });
      await apiFetch('/some/path');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer tok-abc');
    });

    it('omits the Authorization header entirely when no token is stored', async () => {
      const fetchMock = stubFetchResolving(200, { ok: true });
      await apiFetch('/some/path');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Headers;
      expect(headers.has('Authorization')).toBe(false);
    });
  });

  describe('criterion 3: 401 handling is gated on whether a token was attached', () => {
    it('clears the token and redirects to /login on a 401 when a token WAS attached', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Unauthorized' });

      await expect(apiFetch('/protected')).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('does NOT clear/redirect on a 401 when no token was attached (e.g. bad login credentials)', async () => {
      stubFetchResolving(401, { message: 'Invalid credentials' });

      await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow(ApiError);

      // no token existed before or after; the pre-test href set in beforeEach must be untouched
      expect(getStoredToken()).toBeNull();
      expect(window.location.href).toBe('http://localhost/dashboard');
    });

    it('still throws ApiError with the response details on a 401 with a token attached', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Session expired' });

      await expect(apiFetch('/protected')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('does not clear the token or redirect on a non-401 error (e.g. 500)', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(500, { message: 'Internal error' });

      await expect(apiFetch('/protected')).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBe('tok-abc');
      expect(window.location.href).toBe('http://localhost/dashboard');
    });
  });
});
