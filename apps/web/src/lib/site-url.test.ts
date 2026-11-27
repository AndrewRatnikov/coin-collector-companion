// @vitest-environment node
/**
 * Tests for: siteMetadataBase, siteOrigin, DEFAULT_SITE_ORIGIN (apps/web/src/lib/site-url.ts)
 * Contract source: runs/run_20261121_160034/plan.md § Interface Contract → Function: siteMetadataBase;
 * runs/run_20261127_065505/plan.md § Interface Contract → Module: site origin
 *
 * CONTRACT_GAPs: none
 */

import { getSocialImageMetadataBaseFallback, resolveUrl } from 'next/dist/lib/metadata/resolvers/resolve-url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_ORIGIN, siteMetadataBase, siteOrigin } from '@/lib/site-url';

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

describe('siteOrigin', () => {
  it('exposes the localhost default', () => {
    expect(DEFAULT_SITE_ORIGIN).toBe('http://localhost:3000');
  });

  it('returns the origin without a trailing slash', () => {
    expect(siteOrigin('https://site.example')).toBe('https://site.example');
    expect(siteOrigin('https://site.example/')).toBe('https://site.example');
  });

  it('drops any path in the value', () => {
    expect(siteOrigin('https://site.example/some/path')).toBe('https://site.example');
  });

  it('trims whitespace', () => {
    expect(siteOrigin(' https://site.example ')).toBe('https://site.example');
  });

  it('follows different inputs', () => {
    expect(siteOrigin('https://one.example')).toBe('https://one.example');
    expect(siteOrigin('http://two.example:8080')).toBe('http://two.example:8080');
  });

  it.each([undefined, '', '   ', 'not a url', 'ftp://site.example'])(
    'falls back to the default for %j',
    (raw) => {
      vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://env.example');
      // an explicit argument wins over the env var, even when invalid; undefined reads the env var
      if (raw === undefined) {
        expect(siteOrigin(raw)).toBe('https://env.example');
      } else {
        expect(siteOrigin(raw)).toBe(DEFAULT_SITE_ORIGIN);
      }
    },
  );

  it('reads NEXT_PUBLIC_SITE_URL at call time', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://first.example');
    expect(siteOrigin()).toBe('https://first.example');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://second.example/');
    expect(siteOrigin()).toBe('https://second.example');
  });

  it('uses the default when the env var is blank', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(siteOrigin()).toBe(DEFAULT_SITE_ORIGIN);
  });
});
