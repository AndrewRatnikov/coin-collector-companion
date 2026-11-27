/**
 * Tests for: WebsiteJsonLd (apps/web/src/components/seo/website-json-ld.tsx)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Component: WebsiteJsonLd
 * Covers criteria: #12 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebsiteJsonLd, buildWebsiteJsonLd, serializeJsonLd } from '@/components/seo/website-json-ld';
import en from '@/lib/i18n/locales/en';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('buildWebsiteJsonLd', () => {
  it('returns exactly the five WebSite keys', () => {
    expect(buildWebsiteJsonLd('https://site.example')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Coin Collector Companion',
      url: 'https://site.example/',
      description: en['landing.metaDescription'],
    });
  });

  it('has no potentialAction / SearchAction', () => {
    const data = buildWebsiteJsonLd('https://site.example');
    expect(data).not.toHaveProperty('potentialAction');
    expect(JSON.stringify(data)).not.toContain('SearchAction');
  });

  it('follows the origin it is given', () => {
    expect(buildWebsiteJsonLd('https://one.example').url).toBe('https://one.example/');
    expect(buildWebsiteJsonLd('https://two.example').url).toBe('https://two.example/');
  });
});

describe('serializeJsonLd', () => {
  it('round-trips through JSON.parse', () => {
    const data = { a: 1, b: ['x', 'y'], c: { d: true } };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('escapes < so a closing script tag cannot appear', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).toContain('\\u003c');
    expect(JSON.parse(out)).toEqual({ name: '</script><script>alert(1)</script>' });
  });

  it('leaves text without < unchanged', () => {
    expect(serializeJsonLd({ n: 'plain' })).toBe('{"n":"plain"}');
  });
});

describe('WebsiteJsonLd', () => {
  it('renders one ld+json script that parses to the WebSite object', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(<WebsiteJsonLd />);
    const script = screen.getByTestId('website-json-ld');
    expect(script.tagName).toBe('SCRIPT');
    expect(script).toHaveAttribute('type', 'application/ld+json');
    expect(JSON.parse(script.innerHTML)).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Coin Collector Companion',
      url: 'https://site.example/',
      description: en['landing.metaDescription'],
    });
  });

  it('uses the configured site origin', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example');
    render(<WebsiteJsonLd />);
    expect(JSON.parse(screen.getByTestId('website-json-ld').innerHTML).url).toBe('https://other.example/');
  });

  it('falls back to localhost when the site URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    render(<WebsiteJsonLd />);
    expect(JSON.parse(screen.getByTestId('website-json-ld').innerHTML).url).toBe('http://localhost:3000/');
  });
});
