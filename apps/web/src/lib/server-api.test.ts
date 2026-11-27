// @vitest-environment node
/**
 * Tests for: server-only API helper (apps/web/src/lib/server-api.ts)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Module: server API helper
 * Covers criteria: #3, #8 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  COIN_REVALIDATE_SECONDS,
  LIST_REVALIDATE_SECONDS,
  SERVER_FETCH_TIMEOUT_MS,
  ServerApiError,
  serverApiBaseUrl,
  serverApiGet,
} from '@/lib/server-api';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', '');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://public.example/api/v1');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('constants', () => {
  it('has the documented revalidate intervals and timeout', () => {
    expect(LIST_REVALIDATE_SECONDS).toBe(3600);
    expect(COIN_REVALIDATE_SECONDS).toBe(86400);
    expect(SERVER_FETCH_TIMEOUT_MS).toBe(5000);
  });
});

describe('server-only marker', () => {
  it('has import server-only as its first line', () => {
    const source = readFileSync(resolve(__dirname, 'server-api.ts'), 'utf8');
    expect(source.split('\n')[0]).toBe("import 'server-only';");
  });
});

describe('serverApiBaseUrl', () => {
  it('prefers API_URL over NEXT_PUBLIC_API_URL', () => {
    vi.stubEnv('API_URL', 'http://internal.example/api/v1');
    expect(serverApiBaseUrl()).toBe('http://internal.example/api/v1');
  });

  it('falls back to NEXT_PUBLIC_API_URL when API_URL is blank', () => {
    vi.stubEnv('API_URL', '   ');
    expect(serverApiBaseUrl()).toBe('http://public.example/api/v1');
  });

  it('trims and removes trailing slashes', () => {
    vi.stubEnv('API_URL', ' http://internal.example/api/v1/ ');
    expect(serverApiBaseUrl()).toBe('http://internal.example/api/v1');
  });

  it('reads the env at call time', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://one.example');
    expect(serverApiBaseUrl()).toBe('http://one.example');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://two.example');
    expect(serverApiBaseUrl()).toBe('http://two.example');
  });

  it('throws a config error when neither is set', () => {
    vi.stubEnv('API_URL', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    let caught: unknown;
    try {
      serverApiBaseUrl();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ServerApiError);
    expect((caught as ServerApiError).kind).toBe('config');
    expect((caught as ServerApiError).status).toBeNull();
  });
});

describe('ServerApiError', () => {
  it('carries kind, status and name', () => {
    const error = new ServerApiError('http', 503, 'boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ServerApiError');
    expect(error.kind).toBe('http');
    expect(error.status).toBe(503);
    expect(error.message).toBe('boom');
  });
});

describe('serverApiGet', () => {
  it('fetches base + path and returns the parsed JSON', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [1, 2] }));
    const result = await serverApiGet<{ items: number[] }>('/catalog?page=1&limit=100');
    expect(result).toEqual({ items: [1, 2] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://public.example/api/v1/catalog?page=1&limit=100');
  });

  it('uses API_URL when set', async () => {
    vi.stubEnv('API_URL', 'http://internal.example/api/v1');
    fetchMock.mockResolvedValue(jsonResponse([]));
    await serverApiGet('/sets/canonical');
    expect(fetchMock.mock.calls[0][0]).toBe('http://internal.example/api/v1/sets/canonical');
  });

  it('sends Accept JSON and the default list revalidate, with a signal', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await serverApiGet('/sets/canonical');
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers).toEqual({ Accept: 'application/json' });
    expect(init.next).toEqual({ revalidate: 3600 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('passes a custom revalidate through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await serverApiGet('/catalog/abc', { revalidate: COIN_REVALIDATE_SECONDS });
    expect(fetchMock.mock.calls[0][1].next).toEqual({ revalidate: 86400 });
  });

  it('never sends credentials, Authorization or Cookie', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await serverApiGet('/sets/canonical');
    const init = fetchMock.mock.calls[0][1];
    expect(init.credentials).toBeUndefined();
    const headerNames = Object.keys(init.headers).map((h) => h.toLowerCase());
    expect(headerNames).not.toContain('authorization');
    expect(headerNames).not.toContain('cookie');
  });

  it.each([404, 500, 503])('throws an http error carrying status %i', async (status) => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'nope' }, status));
    const error = await serverApiGet('/catalog/x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerApiError);
    expect((error as ServerApiError).kind).toBe('http');
    expect((error as ServerApiError).status).toBe(status);
  });

  it('throws a network error when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const error = await serverApiGet('/catalog').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ServerApiError);
    expect((error as ServerApiError).kind).toBe('network');
    expect((error as ServerApiError).status).toBeNull();
  });

  it('throws a config error without calling fetch when no base URL is set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const error = await serverApiGet('/catalog').catch((e: unknown) => e);
    expect((error as ServerApiError).kind).toBe('config');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts after the timeout and throws a timeout error', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
    const pending = serverApiGet('/catalog').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(SERVER_FETCH_TIMEOUT_MS - 1);
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;
    expect(error).toBeInstanceOf(ServerApiError);
    expect((error as ServerApiError).kind).toBe('timeout');
    expect((error as ServerApiError).status).toBeNull();
  });

  it('clears the timer after a successful response', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    await serverApiGet('/catalog');
    expect(vi.getTimerCount()).toBe(0);
  });
});
