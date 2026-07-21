/**
 * Tests for: auth-api
 * Contract source: runs/run_20260721_094026/plan.md § Interface Contract → Module: auth-api
 * Covers criteria: #2 (from prd.md)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// fetch is mocked via vi.stubGlobal, not vi.mock(), see vitest.setup.ts
import { login, register } from '@/lib/auth-api';
import { getStoredToken } from '@/lib/auth-token';

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
});
