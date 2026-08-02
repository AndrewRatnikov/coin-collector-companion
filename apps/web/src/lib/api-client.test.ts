/**
 * Tests for: api-client (modified apiFetch)
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: api-client (existing file, modified)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Module: api-client (MODIFY)
 *                   runs/run_20260802_221803/plan.md § Interface Contract → Module: apps/web/src/lib/api-client.ts (MODIFY)
 * Covers criteria: #3 (from run_20260721_094026's prd.md), #7 (from run_20260802_183303's prd.md),
 *                  #10 (from run_20260802_221803's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * run_20260802_183303: adds coverage for the new `skipAuthRedirectOn401` opt-out (new
 * describe block below) plus a regression guard confirming the default (no opt-out) behavior
 * is unchanged. Every existing describe block above is carried over byte-identical.
 *
 * run_20260802_221803: adds coverage for `credentials: 'include'` on every fetch call, and
 * for the one-shot silent refresh-and-retry on a session-invalidating 401 (new describe
 * blocks below). The existing "criterion 3: 401 handling..." blocks above are carried over
 * byte-identical and, per plan.md's Approach section, continue to pass unmodified: a single
 * canned `mockResolvedValue` response applies to every `fetch` call regardless of URL, so the
 * new internal refresh attempt "fails" the same way the original request did in those tests,
 * and the existing clear-token-and-redirect fallback still fires exactly as before.
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

  describe('criterion 7 (run_20260802_183303): skipAuthRedirectOn401 opt-out', () => {
    it('does not clear the token or redirect on a 401 when skipAuthRedirectOn401 is true', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Current password is incorrect' });

      await expect(
        apiFetch('/auth/password', { method: 'PATCH' }, { skipAuthRedirectOn401: true }),
      ).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBe('tok-abc');
      expect(window.location.href).toBe('http://localhost/dashboard');
    });

    it('still throws ApiError with the response details when skipAuthRedirectOn401 is true', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Current password is incorrect' });

      await expect(
        apiFetch('/auth/password', { method: 'PATCH' }, { skipAuthRedirectOn401: true }),
      ).rejects.toMatchObject({ status: 401 });
    });

    it('regression guard: still redirects on a 401 for a normal call without the opt-out', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Unauthorized' });

      await expect(apiFetch('/protected')).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });
  });

  describe('criterion 10 (run_20260802_221803): credentials are always included', () => {
    it('sends credentials: "include" on a normal successful call', async () => {
      const fetchMock = stubFetchResolving(200, { ok: true });
      await apiFetch('/some/path');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe('include');
    });

    it('sends credentials: "include" on a 401 that has no token attached', async () => {
      const fetchMock = stubFetchResolving(401, { message: 'Invalid credentials' });
      await expect(apiFetch('/auth/login', { method: 'POST' })).rejects.toThrow(ApiError);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.credentials).toBe('include');
    });
  });

  describe('criterion 10 (run_20260802_221803): silent refresh-and-retry on a session-invalidating 401', () => {
    it('on 401 with a token attached, attempts one POST /auth/refresh and retries the original request, returning the retried result on success', async () => {
      setStoredToken('stale-tok');
      const fetchMock = vi
        .fn()
        // 1. original request -> 401
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Unauthorized' }) })
        // 2. POST /auth/refresh -> 200 with a new access token
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ accessToken: 'new-tok' }) })
        // 3. retried original request -> 200 with the real data
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: 'the-real-data' }) });
      vi.stubGlobal('fetch', fetchMock);

      const result = await apiFetch('/protected');

      expect(result).toEqual({ data: 'the-real-data' });
      expect(fetchMock).toHaveBeenCalledTimes(3);

      const [refreshUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(refreshUrl).toContain('/auth/refresh');

      const [, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];
      const retryHeaders = retryInit.headers as Headers;
      expect(retryHeaders.get('Authorization')).toBe('Bearer new-tok');
    });

    it('stores the refreshed access token in localStorage on a successful silent refresh', async () => {
      setStoredToken('stale-tok');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ accessToken: 'new-tok' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: 'x' }) });
      vi.stubGlobal('fetch', fetchMock);

      await apiFetch('/protected');

      expect(getStoredToken()).toBe('new-tok');
    });

    it('does not redirect to /login when the silent refresh-and-retry succeeds', async () => {
      setStoredToken('stale-tok');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ accessToken: 'new-tok' }) })
        .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', json: async () => ({ data: 'x' }) });
      vi.stubGlobal('fetch', fetchMock);

      await apiFetch('/protected');

      expect(window.location.href).toBe('http://localhost/dashboard');
    });

    it('falls back to clearing the token and redirecting when the refresh call itself fails', async () => {
      setStoredToken('stale-tok');
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Unauthorized' }) })
        .mockResolvedValueOnce({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ message: 'Invalid refresh token' }) });
      vi.stubGlobal('fetch', fetchMock);

      await expect(apiFetch('/protected')).rejects.toThrow(ApiError);

      expect(getStoredToken()).toBeNull();
      expect(window.location.href).toBe('/login');
      expect(fetchMock).toHaveBeenCalledTimes(2); // original + failed refresh, no retry attempted
    });

    it('never attempts a refresh when the 401 comes from /auth/refresh itself (no recursion)', async () => {
      setStoredToken('stale-tok');
      const fetchMock = stubFetchResolving(401, { message: 'Invalid refresh token' });

      await expect(apiFetch('/auth/refresh', { method: 'POST' })).rejects.toThrow(ApiError);

      expect(fetchMock).toHaveBeenCalledTimes(1); // no nested refresh attempt
      expect(getStoredToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('does not attempt a refresh when skipAuthRedirectOn401 is set', async () => {
      setStoredToken('tok-abc');
      const fetchMock = stubFetchResolving(401, { message: 'Current password is incorrect' });

      await expect(
        apiFetch('/auth/password', { method: 'PATCH' }, { skipAuthRedirectOn401: true }),
      ).rejects.toThrow(ApiError);

      expect(fetchMock).toHaveBeenCalledTimes(1); // no refresh attempt, no retry
      expect(getStoredToken()).toBe('tok-abc');
    });
  });
});
