// @vitest-environment node
/**
 * Tests for: next.config.ts PostHog /relay proxy (growth backlog 0.6)
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Config: next.config.ts
 * Covers criteria: #8 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Imports the real next.config.ts (the Sentry-wrapped object) under Node and reads the file as text
 * only to prove the withSentryConfig wrapper is still there.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../../next.config';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

async function rewritesFor(region: string | undefined) {
  if (region === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_REGION;
  else vi.stubEnv('NEXT_PUBLIC_POSTHOG_REGION', region);
  const rewrites = config.rewrites;
  if (!rewrites) throw new Error('next.config.ts has no rewrites()');
  return rewrites();
}

function expected(region: string) {
  return [
    { source: '/relay/static/:path*', destination: `https://${region}-assets.i.posthog.com/static/:path*` },
    { source: '/relay/array/:path*', destination: `https://${region}-assets.i.posthog.com/array/:path*` },
    { source: '/relay/:path*', destination: `https://${region}.i.posthog.com/:path*` },
  ];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('next.config.ts /relay proxy', () => {
  it('skips the trailing-slash redirect', () => {
    expect(config.skipTrailingSlashRedirect).toBe(true);
  });

  it('defaults to the eu region, with the three rewrites in this exact order', async () => {
    expect(await rewritesFor(undefined)).toEqual(expected('eu'));
  });

  it('uses the us hosts when the region is us', async () => {
    const result = await rewritesFor('us');

    expect(result).toEqual(expected('us'));
    expect(result).not.toEqual(expected('eu'));
  });

  it('reads the region at call time, so changing it changes the result', async () => {
    const us = await rewritesFor('us');
    const eu = await rewritesFor('eu');

    expect(JSON.stringify(us)).toContain('us-assets.i.posthog.com');
    expect(JSON.stringify(eu)).toContain('eu-assets.i.posthog.com');
    expect(JSON.stringify(eu)).not.toContain('us.i.posthog.com');
  });

  it.each(['', 'xx', 'EU', 'global'])('falls back to eu for the region %j', async (region) => {
    expect(await rewritesFor(region)).toEqual(expected('eu'));
  });

  it.each([' US ', 'Us'])('accepts %j as us', async (region) => {
    expect(await rewritesFor(region)).toEqual(expected('us'));
  });

  it('puts the specific static and array rewrites before the catch-all', async () => {
    const result = (await rewritesFor('eu')) as { source: string }[];

    const sources = result.map((r) => r.source);
    expect(sources.indexOf('/relay/static/:path*')).toBeLessThan(sources.indexOf('/relay/:path*'));
    expect(sources.indexOf('/relay/array/:path*')).toBeLessThan(sources.indexOf('/relay/:path*'));
    expect(sources).toHaveLength(3);
  });
});

describe('next.config.ts keeps the Sentry wrapper', () => {
  it('still exports through withSentryConfig(', () => {
    const text = readFileSync(path.join(webRoot, 'next.config.ts'), 'utf8');

    expect(text).toContain('withSentryConfig(');
  });
});
