// @vitest-environment node
/**
 * Tests for: llms.txt builder (apps/web/src/lib/llms-txt.ts)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Module: llms.txt builder
 * Covers criteria: #9, #10, #10a (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import type { CanonicalSetSummary } from '@coin-collector/shared';
import {
  LLMS_TXT_CONTENT_TYPE,
  OPENAPI_JSON_PATH,
  PUBLIC_API_ENDPOINTS,
  buildLlmsTxt,
  openApiJsonUrl,
  publicApiBaseUrl,
} from '@/lib/llms-txt';
import en from '@/lib/i18n/locales/en';

const SITE = 'https://site.example';
const API = 'https://api.example/api/v1';

function checklist(id: string, name: string, coinCount: number): CanonicalSetSummary {
  return { id, name, description: null, source: 'seed-template', templateVersion: 'v1', coinCount };
}

const LISTS = [
  checklist('11111111-1111-4111-8111-111111111111', 'Lincoln Wheat Cents', 150),
  checklist('22222222-2222-4222-8222-222222222222', 'Single Coin Set', 1),
];

describe('constants', () => {
  it('has the content type and OpenAPI path', () => {
    expect(LLMS_TXT_CONTENT_TYPE).toBe('text/markdown; charset=utf-8');
    expect(OPENAPI_JSON_PATH).toBe('/api/docs-json');
  });
});

describe('publicApiBaseUrl', () => {
  it.each([undefined, '', '   '])('returns null for %j', (raw) => {
    expect(publicApiBaseUrl(raw)).toBeNull();
  });

  it('trims and removes trailing slashes', () => {
    expect(publicApiBaseUrl(' https://api.example/api/v1/ ')).toBe('https://api.example/api/v1');
  });

  it.each(['api.example', 'api.example/api/v1', 'ftp://api.example', 'not a url'])(
    'returns null for the malformed value %j instead of throwing later',
    (raw) => {
      expect(publicApiBaseUrl(raw)).toBeNull();
      expect(() =>
        buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: publicApiBaseUrl(raw), checklists: null }),
      ).not.toThrow();
    },
  );

  it('follows different inputs', () => {
    expect(publicApiBaseUrl('https://a.example/api/v1')).toBe('https://a.example/api/v1');
    expect(publicApiBaseUrl('https://b.example/api/v1')).toBe('https://b.example/api/v1');
  });
});

describe('openApiJsonUrl', () => {
  it('replaces the path with /api/docs-json on the API host', () => {
    expect(openApiJsonUrl('https://api.example/api/v1')).toBe('https://api.example/api/docs-json');
    expect(openApiJsonUrl('https://other.example/api/v1')).toBe('https://other.example/api/docs-json');
  });
});

describe('PUBLIC_API_ENDPOINTS', () => {
  it('lists the seven public GETs in order', () => {
    expect(PUBLIC_API_ENDPOINTS.map((e) => `${e.method} ${e.path}`)).toEqual([
      'GET /catalog',
      'GET /catalog/:id',
      'GET /catalog/facets',
      'GET /sets/canonical',
      'GET /sets/canonical/:id',
      'GET /sets/public',
      'GET /sets/public/:id',
    ]);
  });

  it('has a non-empty one-line description for each', () => {
    for (const endpoint of PUBLIC_API_ENDPOINTS) {
      expect(endpoint.description.trim().length).toBeGreaterThan(0);
      expect(endpoint.description).not.toContain('\n');
    }
  });

  it('does not list health', () => {
    expect(PUBLIC_API_ENDPOINTS.some((e) => e.path.includes('health'))).toBe(false);
  });
});

describe('buildLlmsTxt', () => {
  const text = buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: API, checklists: LISTS });

  it('starts with the title and the landing meta description as a quote', () => {
    const lines = text.split('\n');
    expect(lines[0]).toBe('# Coin Collector Companion');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe(`> ${en['landing.metaDescription']}`);
  });

  it('uses \\n line endings and ends with exactly one newline', () => {
    expect(text).not.toContain('\r');
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('has the sections in order', () => {
    const headings = text.split('\n').filter((l) => l.startsWith('## '));
    expect(headings).toEqual(['## Entry points', '## Covered series', '## Public read API', '## Licence']);
  });

  it('links the entry points on the site origin', () => {
    expect(text).toContain(`- [Coin catalog](${SITE}/catalog): `);
    expect(text).toContain(`- [Curated checklists](${SITE}/sets/canonical): `);
    expect(text).toContain(`- [Public sets](${SITE}/sets/public): `);
    expect(text).toContain(`- [Glossary](${SITE}/glossary): `);
  });

  it('lists each checklist with its url and coin count, in API order', () => {
    const l1 = `- [Lincoln Wheat Cents](${SITE}/sets/canonical/11111111-1111-4111-8111-111111111111): 150 coins`;
    const l2 = `- [Single Coin Set](${SITE}/sets/canonical/22222222-2222-4222-8222-222222222222): 1 coin`;
    expect(text).toContain(l1);
    expect(text).toContain(l2);
    expect(text).not.toContain('1 coins');
    expect(text.indexOf(l1)).toBeLessThan(text.indexOf(l2));
  });

  it('reflects different checklists', () => {
    const other = buildLlmsTxt({
      siteOrigin: SITE,
      apiBaseUrl: API,
      checklists: [checklist('33333333-3333-4333-8333-333333333333', 'Morgan Dollars', 7)],
    });
    expect(other).toContain('- [Morgan Dollars](https://site.example/sets/canonical/33333333-3333-4333-8333-333333333333): 7 coins');
    expect(other).not.toContain('Lincoln Wheat Cents');
  });

  it('writes the base URL, one line per endpoint and the OpenAPI link', () => {
    expect(text).toContain(`Base URL: ${API}`);
    for (const endpoint of PUBLIC_API_ENDPOINTS) {
      expect(text).toContain(`- \`GET ${endpoint.path}\`: ${endpoint.description}`);
    }
    expect(text).toContain('OpenAPI document: https://api.example/api/docs-json');
  });

  it('ends with the licence line', () => {
    expect(text).toContain(
      'Catalog data derived from [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content), used under CC BY-SA 4.0.',
    );
    expect(text.trimEnd().split('\n').pop()).toContain('CC BY-SA 4.0');
  });

  it('omits Covered series entirely when checklists is null', () => {
    const degraded = buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: API, checklists: null });
    expect(degraded).not.toContain('## Covered series');
    expect(degraded).toContain('## Public read API');
    expect(degraded).toContain('## Licence');
  });

  it('omits Covered series entirely when checklists is empty', () => {
    const empty = buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: API, checklists: [] });
    expect(empty).not.toContain('## Covered series');
  });

  it('omits Public read API entirely when there is no API base URL', () => {
    const noApi = buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: null, checklists: LISTS });
    expect(noApi).not.toContain('## Public read API');
    expect(noApi).not.toContain('Base URL:');
    expect(noApi).not.toContain('OpenAPI document');
    expect(noApi).toContain('## Covered series');
  });

  it('never has more than one blank line in a row', () => {
    expect(text).not.toMatch(/\n\n\n/);
    const degraded = buildLlmsTxt({ siteOrigin: SITE, apiBaseUrl: null, checklists: null });
    expect(degraded).not.toMatch(/\n\n\n/);
  });
});
