import type { CanonicalSetSummary } from '@coin-collector/shared';
import enLanding from '@/lib/i18n/locales/en/landing';

/**
 * Builds /llms.txt: a short Markdown description of the site and its public read API for AI
 * agents. Pure (no fetching); the route handler passes in the checklists it got from the API.
 */

export const LLMS_TXT_CONTENT_TYPE = 'text/markdown; charset=utf-8';

/** Where the API serves its OpenAPI JSON, relative to the API host (outside the /api/v1 prefix). */
export const OPENAPI_JSON_PATH = '/api/docs-json';

/**
 * The public API base URL (NEXT_PUBLIC_API_URL), trimmed and without a trailing slash, or null
 * when unset. Deliberately the public URL, not the server-only API_URL: outside agents read it.
 */
export function publicApiBaseUrl(
  raw: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): string | null {
  const trimmed = raw?.trim().replace(/\/+$/, '');
  return trimmed ? trimmed : null;
}

export function openApiJsonUrl(apiBaseUrl: string): string {
  return new URL(OPENAPI_JSON_PATH, apiBaseUrl).href;
}

export const PUBLIC_API_ENDPOINTS: readonly { method: 'GET'; path: string; description: string }[] =
  [
    {
      method: 'GET',
      path: '/catalog',
      description:
        'Approved coins, paginated (page, limit up to 100) and filterable by country, denomination, name, yearMin, yearMax, keyDateOnly and sort.',
    },
    {
      method: 'GET',
      path: '/catalog/:id',
      description: 'One coin with its specs, mintage and image licence.',
    },
    {
      method: 'GET',
      path: '/catalog/facets',
      description: 'The countries and denominations in the catalog, for building filters.',
    },
    {
      method: 'GET',
      path: '/sets/canonical',
      description: 'Every curated checklist with its coin count.',
    },
    {
      method: 'GET',
      path: '/sets/canonical/:id',
      description: 'One curated checklist with its ordered coins.',
    },
    {
      method: 'GET',
      path: '/sets/public',
      description: 'Public sets built by collectors, paginated.',
    },
    {
      method: 'GET',
      path: '/sets/public/:id',
      description: 'One public set with its ordered coins.',
    },
  ];

const ABOUT =
  'Coin Collector Companion is a free coin catalog and collection tracker. Collectors browse a catalog of circulation and commemorative coins by country, denomination, year, mint mark and variety, start from a curated checklist or from another collector’s public set, mark the coins they own, and see the gaps: the coins still missing from each set. The catalog, the curated checklists and public sets are open to everyone; an account is only needed to track your own collection.';

const LICENCE =
  'Catalog data derived from [Wikipedia](https://en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content), used under CC BY-SA 4.0.';

export function buildLlmsTxt(input: {
  siteOrigin: string;
  apiBaseUrl: string | null;
  checklists: CanonicalSetSummary[] | null;
}): string {
  const { siteOrigin, apiBaseUrl, checklists } = input;
  const blocks: string[] = [
    '# Coin Collector Companion',
    `> ${enLanding['landing.metaDescription']}`,
    ABOUT,
    [
      '## Entry points',
      '',
      `- [Coin catalog](${siteOrigin}/catalog): every approved coin, filterable by country, denomination, year and name`,
      `- [Curated checklists](${siteOrigin}/sets/canonical): ready-made checklists for popular series`,
      `- [Public sets](${siteOrigin}/sets/public): sets built by collectors, free to clone`,
      `- [Glossary](${siteOrigin}/glossary): coin collecting terms`,
    ].join('\n'),
  ];

  if (checklists && checklists.length > 0) {
    blocks.push(
      [
        '## Covered series',
        '',
        ...checklists.map(
          (set) =>
            `- [${set.name}](${siteOrigin}/sets/canonical/${set.id}): ${set.coinCount} ${
              set.coinCount === 1 ? 'coin' : 'coins'
            }`,
        ),
      ].join('\n'),
    );
  }

  if (apiBaseUrl) {
    blocks.push(
      [
        '## Public read API',
        '',
        `Base URL: ${apiBaseUrl}`,
        '',
        'These endpoints need no authentication and return JSON.',
        '',
        ...PUBLIC_API_ENDPOINTS.map((e) => `- \`${e.method} ${e.path}\`: ${e.description}`),
        '',
        `OpenAPI document: ${openApiJsonUrl(apiBaseUrl)}`,
      ].join('\n'),
    );
  }

  blocks.push(['## Licence', '', LICENCE].join('\n'));

  return `${blocks.join('\n\n')}\n`;
}
