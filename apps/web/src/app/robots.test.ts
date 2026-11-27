// @vitest-environment node
/**
 * Tests for: robots (apps/web/src/app/robots.ts)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Metadata route: robots
 * Covers criteria: #4, #5 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { resolveRobots } from 'next/dist/build/webpack/loaders/metadata/resolve-route-data';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import robots from '@/app/robots';

const BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'Claude-SearchBot',
  'Claude-User',
  'ClaudeBot',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'CCBot',
];

const DISALLOWED = [
  '/dashboard',
  '/collection',
  '/want-list',
  '/settings',
  '/admin',
  '/sets/new',
  '/sets/*/missing',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
];

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function rulesOf() {
  const result = robots();
  return Array.isArray(result.rules) ? result.rules : [result.rules];
}

describe('robots rules', () => {
  it('has the wildcard group first, then one group per named bot in order', () => {
    const rules = rulesOf();
    expect(rules).toHaveLength(11);
    expect(rules.map((r) => r.userAgent)).toEqual(['*', ...BOTS]);
  });

  it('allows everything and repeats the disallow list in every group', () => {
    for (const rule of rulesOf()) {
      expect(rule.allow).toBe('/');
      expect(rule.disallow).toEqual(DISALLOWED);
    }
  });

  it('disallows the signed-in and auth-only paths but not public ones', () => {
    const disallow = rulesOf()[0].disallow as string[];
    for (const path of DISALLOWED) {
      expect(disallow).toContain(path);
    }
    for (const publicPath of ['/', '/catalog', '/glossary', '/privacy', '/sets/canonical', '/sets/public']) {
      expect(disallow).not.toContain(publicPath);
    }
  });

  it('does not block any named bot entirely', () => {
    for (const rule of rulesOf()) {
      expect(rule.disallow).not.toContain('/');
    }
  });
});

describe('robots sitemap and host', () => {
  it('links the sitemap on the configured site', () => {
    expect(robots().sitemap).toBe('https://site.example/sitemap.xml');
  });

  it('follows a different configured site', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://other.example/');
    expect(robots().sitemap).toBe('https://other.example/sitemap.xml');
  });

  it('falls back to localhost when the site URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    expect(robots().sitemap).toBe('http://localhost:3000/sitemap.xml');
  });

  it('has no host field', () => {
    expect(robots()).not.toHaveProperty('host');
  });
});

describe('robots.txt text form', () => {
  it('renders user agents, disallow lines and the sitemap line', () => {
    const text = resolveRobots(robots());
    const userAgents = text.split('\n').filter((l) => l.startsWith('User-Agent:'));
    expect(userAgents).toEqual(['*', ...BOTS].map((b) => `User-Agent: ${b}`));
    expect(text).toContain('Disallow: /sets/*/missing');
    expect(text).toContain('Disallow: /dashboard');
    expect(text.split('\n').filter((l) => l === 'Disallow: /admin')).toHaveLength(11);
    expect(text).toContain('Sitemap: https://site.example/sitemap.xml');
  });
});
