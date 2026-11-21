// @vitest-environment node
/**
 * Tests for: siteMetadataBase (apps/web/src/lib/site-url.ts)
 * Contract source: runs/run_20261121_160034/plan.md § Interface Contract → Function: siteMetadataBase
 *
 * CONTRACT_GAPs: none
 */

import { getSocialImageMetadataBaseFallback, resolveUrl } from 'next/dist/lib/metadata/resolvers/resolve-url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { siteMetadataBase } from '@/lib/site-url';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('siteMetadataBase', () => {
  it.each([undefined, '', '   ', 'not a url', 'site.example', 'ftp://site.example', '/relative/path'])(
    'returns undefined for %j',
    (raw) => {
      expect(siteMetadataBase(raw)).toBeUndefined();
    },
  );

  it('returns a URL for an absolute https value', () => {
    const base = siteMetadataBase('https://site.example');
    expect(base).toBeInstanceOf(URL);
    expect(base?.href).toBe('https://site.example/');
  });

  it('accepts http as well', () => {
    expect(siteMetadataBase('http://other.example')?.href).toBe('http://other.example/');
  });

  it('trims surrounding whitespace', () => {
    expect(siteMetadataBase(' https://site.example ')?.href).toBe('https://site.example/');
  });

  it('gives different results for different inputs', () => {
    expect(siteMetadataBase('https://one.example')?.host).toBe('one.example');
    expect(siteMetadataBase('https://two.example')?.host).toBe('two.example');
  });
});

describe('Open Graph image URL resolved by Next against the helper output', () => {
  it('is absolute and on the configured site', () => {
    const base = siteMetadataBase('https://site.example');
    const resolved = resolveUrl('/opengraph-image.png', base ?? null);
    expect(resolved.href).toBe('https://site.example/opengraph-image.png');
    expect(resolved.href.startsWith('https://site.example/')).toBe(true);
  });

  it('follows a different configured site', () => {
    const base = siteMetadataBase('https://another.example');
    expect(resolveUrl('/opengraph-image.png', base ?? null).href).toBe(
      'https://another.example/opengraph-image.png',
    );
  });

  it('is used as the social image base fallback', () => {
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', '');
    vi.stubEnv('VERCEL_BRANCH_URL', '');
    vi.stubEnv('VERCEL_ENV', '');
    const base = siteMetadataBase('https://site.example');
    expect(getSocialImageMetadataBaseFallback(base ?? null).href).toBe('https://site.example/');
  });
});
