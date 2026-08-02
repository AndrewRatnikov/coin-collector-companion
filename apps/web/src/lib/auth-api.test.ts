/**
 * Tests for: auth-api
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: auth-api
 *                   runs/run_20260802_172836/plan.md § Interface Contract → Module: auth-api (MODIFY)
 *                   runs/run_20260802_183303/plan.md § Interface Contract → Module: auth-api (MODIFY)
 * Covers criteria: #2 (from run_20260721_094026's prd.md), #4 (from run_20260802_172836's prd.md),
 *                  #5 (from run_20260802_183303's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * run_20260802_183303: adds changePassword() coverage (new describe block below), including a
 * regression assertion that a wrong-current-password 401 rejection does NOT clear the stored
 * token (proving auth-api.ts's changePassword() actually passes the { skipAuthRedirectOn401:
 * true } option through to apiFetch, per plan.md). Every existing describe block above is
 * carried over byte-identical.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { login, register, getCurrentUser, changePassword } from '@/lib/auth-api';
import { getStoredToken, setStoredToken } from '@/lib/auth-token';

function stubFetchResolving(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('auth-api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('criterion 2: login/register store the returned accessToken on success', () => {
    it('login stores accessToken on success and returns the response', async () => {
      stubFetchResolving(200, { accessToken: 'tok-123' });
      const result = await login({ email: 'a@example.com', password: 'password123' });
      expect(result).toEqual({ accessToken: 'tok-123' });
      expect(getStoredToken()).toBe('tok-123');
    });

    it('login posts to /auth/login with the credentials as the JSON body', async () => {
      const fetchMock = stubFetchResolving(200, { accessToken: 'tok-123' });
      await login({ email: 'a@example.com', password: 'password123' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/login');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ email: 'a@example.com', password: 'password123' });
    });

    it('register stores accessToken on success and returns the response', async () => {
      stubFetchResolving(200, { accessToken: 'tok-456' });
      const result = await register({ email: 'b@example.com', password: 'password123' });
      expect(result).toEqual({ accessToken: 'tok-456' });
      expect(getStoredToken()).toBe('tok-456');
    });

    it('register posts to /auth/register with the credentials as the JSON body', async () => {
      const fetchMock = stubFetchResolving(200, { accessToken: 'tok-456' });
      await register({ email: 'b@example.com', password: 'password123' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/register');
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ email: 'b@example.com', password: 'password123' });
    });

    it('login does not store a token when the request fails (wrong credentials)', async () => {
      stubFetchResolving(401, { message: 'Invalid credentials' });
      await expect(login({ email: 'a@example.com', password: 'wrong' })).rejects.toThrow();
      expect(getStoredToken()).toBeNull();
    });

    it('register propagates a rejection without storing a token (e.g. duplicate email)', async () => {
      stubFetchResolving(409, { message: 'Email already registered' });
      await expect(register({ email: 'dup@example.com', password: 'password123' })).rejects.toThrow();
      expect(getStoredToken()).toBeNull();
    });
  });

  describe('criterion 4 (run_20260802_172836): getCurrentUser fetches GET /auth/me', () => {
    it('resolves with the CurrentUser shape returned by GET /auth/me', async () => {
      const currentUser = {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        email: 'collector@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      stubFetchResolving(200, currentUser);

      const result = await getCurrentUser();

      expect(result).toEqual(currentUser);
    });

    it('makes a GET request to /auth/me with no body', async () => {
      const fetchMock = stubFetchResolving(200, {
        id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        email: 'collector@example.com',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      await getCurrentUser();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/me');
      expect(init.method === undefined || init.method === 'GET').toBe(true);
      expect(init.body).toBeUndefined();
    });

    it('propagates a rejection when the request fails (e.g. unauthenticated)', async () => {
      stubFetchResolving(401, { message: 'Unauthorized' });
      await expect(getCurrentUser()).rejects.toThrow();
    });
  });

  describe('criterion 5 (run_20260802_183303): changePassword sends PATCH /auth/password', () => {
    it('sends a PATCH request with currentPassword/newPassword as the JSON body', async () => {
      const fetchMock = stubFetchResolving(204, undefined);

      await changePassword('oldpassword123', 'newpassword123');

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/auth/password');
      expect(init.method).toBe('PATCH');
      expect(JSON.parse(init.body as string)).toEqual({
        currentPassword: 'oldpassword123',
        newPassword: 'newpassword123',
      });
    });

    it('resolves to undefined on a 204 success response', async () => {
      stubFetchResolving(204, undefined);

      await expect(changePassword('oldpassword123', 'newpassword123')).resolves.toBeUndefined();
    });

    it('propagates a rejection on a wrong-current-password 401', async () => {
      stubFetchResolving(401, { message: 'Current password is incorrect' });

      await expect(changePassword('wrongpassword', 'newpassword123')).rejects.toThrow();
    });

    it('does not clear the stored token on a wrong-current-password 401 (skipAuthRedirectOn401)', async () => {
      setStoredToken('tok-abc');
      stubFetchResolving(401, { message: 'Current password is incorrect' });

      await expect(changePassword('wrongpassword', 'newpassword123')).rejects.toThrow();

      expect(getStoredToken()).toBe('tok-abc');
    });
  });
});
