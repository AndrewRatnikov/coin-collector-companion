// @vitest-environment node
/**
 * Tests for: GET /llms.txt (apps/web/src/app/llms.txt/route.ts)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Route handler: /llms.txt
 * Covers criteria: #9 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server-api', () => ({ serverApiGet: vi.fn() }));

import { GET, dynamic } from '@/app/llms.txt/route';
import { serverApiGet } from '@/lib/server-api';

const getMock = vi.mocked(serverApiGet);

function list(id: string, name: string, coinCount: number) {
  return { id, name, description: null, source: 'seed-template', templateVersion: 'v1', coinCount };
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example/api/v1');
  getMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('llms.txt route', () => {
  it('is force-dynamic', () => {
    expect(dynamic).toBe('force-dynamic');
  });

  it('answers 200 with the markdown content type', async () => {
    getMock.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
  });

  it('fetches the checklists with one argument and writes them into the body', async () => {
    getMock.mockResolvedValue([list('11111111-1111-4111-8111-111111111111', 'Lincoln Wheat Cents', 150)]);
    const body = await (await GET()).text();
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock.mock.calls[0]).toEqual(['/sets/canonical']);
    expect(body.startsWith('# Coin Collector Companion')).toBe(true);
    expect(body).toContain(
      '- [Lincoln Wheat Cents](https://site.example/sets/canonical/11111111-1111-4111-8111-111111111111): 150 coins',
    );
  });

  it('keeps counts current: a different API answer gives a different body', async () => {
    getMock.mockResolvedValueOnce([list('11111111-1111-4111-8111-111111111111', 'Alpha', 5)]);
    const first = await (await GET()).text();
    getMock.mockResolvedValueOnce([list('22222222-2222-4222-8222-222222222222', 'Beta', 9)]);
    const second = await (await GET()).text();
    expect(first).toContain('Alpha');
    expect(first).toContain('5 coins');
    expect(second).toContain('Beta');
    expect(second).toContain('9 coins');
    expect(second).not.toContain('Alpha');
  });

  it('takes the API base URL from NEXT_PUBLIC_API_URL and links the OpenAPI JSON', async () => {
    getMock.mockResolvedValue([]);
    const body = await (await GET()).text();
    expect(body).toContain('Base URL: https://api.example/api/v1');
    expect(body).toContain('OpenAPI document: https://api.example/api/docs-json');
  });

  it('leaves out the series section but still answers 200 when the API call fails', async () => {
    getMock.mockRejectedValue(new Error('api asleep'));
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8');
    const body = await res.text();
    expect(body).not.toContain('## Covered series');
    expect(body).toContain('## Entry points');
    expect(body).toContain('## Public read API');
  });

  it('uses the configured site origin in entry points', async () => {
    getMock.mockResolvedValue([]);
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://another.example');
    const body = await (await GET()).text();
    expect(body).toContain('(https://another.example/catalog)');
    expect(body).not.toContain('https://site.example');
  });
});
